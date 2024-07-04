package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/alexedwards/scs/v2"
	_ "github.com/go-sql-driver/mysql"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var db *sql.DB
var sessionManager *scs.SessionManager

type User struct {
    ID       int    `json:"id"`
    Email    string `json:"email"`
    Password string `json:"password,omitempty"`
    Timezone string `json:"timezone"`
    Username string `json:"username"`
}

type Todo struct {
    ID        int       `json:"id"`
    UserID    int       `json:"user_id"`
    Title     string    `json:"title"`
    DayNumber int       `json:"day_number"`
    Status    int       `json:"status"`
    Goal      int       `json:"goal"`
    CreatedAt string    `json:"created_at"`
    UpdatedAt string    `json:"updated_at"`
    SortIndex int       `json:"sort_index"`
}

type TodosResponse struct {
    Todos        []Todo `json:"todos"`
    NewDay       bool   `json:"new_day"`
    NewDayNumber int    `json:"new_day_number"`
}

// Reference date: June 16, 2024
var referenceDate = time.Date(2024, 6, 16, 0, 0, 0, 0, time.UTC)

// Calculate the day number since the reference date adjusted to the specified timezone
func calculateDayNumber(t time.Time, timezone string) int {
    loc, err := time.LoadLocation(timezone)
    if err != nil {
        log.Printf("Error loading location: %v", err)
        return 0
    }
    // Adjust the reference date to midnight in the user's timezone
    adjustedReferenceDate := time.Date(referenceDate.Year(), referenceDate.Month(), referenceDate.Day(), 0, 0, 0, 0, loc)
    adjustedCurrentTime := t.In(loc)

    log.Printf("Adjusted Reference Date: %v", adjustedReferenceDate)
    log.Printf("Adjusted Current Time: %v", adjustedCurrentTime)

    // Calculate the difference in days
    daysDifference := int(adjustedCurrentTime.Sub(adjustedReferenceDate).Hours() / 24)

    log.Printf("Days Difference: %d", daysDifference)

    return daysDifference + 1 // Adding 1 to make the day number start from 1
}

// Get the user's timezone and the current time in their timezone
func getUserTimezoneAndCurrentTime(userID int) (string, time.Time, error) {
    var user User
    err := db.QueryRow("SELECT id, timezone FROM users WHERE id = ?", userID).Scan(&user.ID, &user.Timezone)
    if err != nil {
        return "", time.Time{}, fmt.Errorf("failed to fetch user timezone: %w", err)
    }

    loc, err := time.LoadLocation(user.Timezone)
    if err != nil {
        return "", time.Time{}, fmt.Errorf("failed to load location for timezone %s: %w", user.Timezone, err)
    }

    return user.Timezone, time.Now().In(loc), nil
}

// Fetch the most recent day_number from daily_todos for the user
func getMostRecentDayNumberForUser(userID int) (int, error) {
    var recentDayNumber sql.NullInt64
    err := db.QueryRow("SELECT COALESCE(MAX(day_number), 0) FROM daily_todos WHERE user_id = ? and deleted = 0", userID).Scan(&recentDayNumber)
    if err != nil {
        return 0, fmt.Errorf("failed to fetch most recent day_number: %w", err)
    }

    if !recentDayNumber.Valid {
        return 0, nil
    }

    return int(recentDayNumber.Int64), nil
}

// Copy todos from the most recent day to the current day
func copyTodosToCurrentDay(userID int, recentDayNumber int, currentDayNumber int) error {
    rows, err := db.Query("SELECT title, goal, sort_index FROM daily_todos WHERE user_id = ? AND day_number = ? AND deleted = 0", userID, recentDayNumber)
    if err != nil {
        return fmt.Errorf("failed to fetch recent todos: %w", err)
    }
    defer rows.Close()

    for rows.Next() {
        var title string
        var goal, sortIndex int
        if err := rows.Scan(&title, &goal, &sortIndex); err != nil {
            return fmt.Errorf("failed to scan todo: %w", err)
        }

        _, err := db.Exec("INSERT INTO daily_todos (user_id, title, day_number, status, goal, sort_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
            userID, title, currentDayNumber, 0, goal, sortIndex)
        if err != nil {
            return fmt.Errorf("failed to insert new todo: %w", err)
        }
    }

    return nil
}

// Fetch the recent todos for the user
func getRecentTodosForUser(userID int) ([]Todo, bool, int, error) {
    userTimezone, currentTime, err := getUserTimezoneAndCurrentTime(userID)
    if err != nil {
        return nil, false, 0, err
    }

    fmt.Println("User Timezone:", userTimezone)
    fmt.Println("Current Time:", currentTime)

    recentDayNumber, err := getMostRecentDayNumberForUser(userID)
    if err != nil {
        return nil, false, 0, err
    }

    if recentDayNumber == 0 {
        // No todos found for the user, return empty list
        return []Todo{}, false, 0, nil
    }

    currentDayNumber := calculateDayNumber(currentTime, userTimezone)

    fmt.Println("Recent Day Number:", recentDayNumber)
    fmt.Println("Current Day Number:", currentDayNumber)

    newDay := false
    // Adjust the logic to copy todos if the current day number is greater than the recent day number
    if recentDayNumber < currentDayNumber {
        if err := copyTodosToCurrentDay(userID, recentDayNumber, currentDayNumber); err != nil {
            return nil, false, 0, err
        }
        // Update the recentDayNumber after copying todos
        recentDayNumber = currentDayNumber
        newDay = true
    }

    sevenDaysAgo := currentDayNumber - 7

    rows, err := db.Query("SELECT id, user_id, title, day_number, status, goal, created_at, updated_at FROM daily_todos WHERE user_id = ? AND day_number BETWEEN ? AND ? AND deleted = 0 ORDER BY day_number DESC, sort_index ASC", userID, sevenDaysAgo, currentDayNumber)
    if err != nil {
        return nil, false, 0, fmt.Errorf("failed to fetch recent todos: %w", err)
    }
    defer rows.Close()

    todos := []Todo{}
    for rows.Next() {
        var todo Todo
        var createdAt, updatedAt string
        if err := rows.Scan(&todo.ID, &todo.UserID, &todo.Title, &todo.DayNumber, &todo.Status, &todo.Goal, &createdAt, &updatedAt); err != nil {
            return nil, false, 0, fmt.Errorf("failed to scan todo: %w", err)
        }
        todo.CreatedAt = createdAt
        todo.UpdatedAt = updatedAt
        todos = append(todos, todo)
    }

    return todos, newDay, currentDayNumber, nil
}

func main() {
    var err error
    db, err = sql.Open("mysql", "user:password@tcp(mysql:3306)/todo_db")
    if err != nil {
        log.Fatal(err)
    }

    // init session manager
    sessionManager = scs.New()
    sessionManager.Lifetime = 24 * time.Hour
    sessionManager.IdleTimeout = 12 * time.Hour
    sessionManager.Cookie.Name = "session_id"
    sessionManager.Cookie.HttpOnly = true
    sessionManager.Cookie.Secure = false // Set to true in production
    sessionManager.Cookie.SameSite = http.SameSiteLaxMode // set to strict mode in prod

    router := mux.NewRouter()
    router.HandleFunc("/api/signup", SignUpHandler).Methods("POST")
    router.HandleFunc("/api/login", LoginHandler).Methods("POST")
    router.HandleFunc("/api/logout", LogoutHandler).Methods("POST")
    router.HandleFunc("/api/logged-in-user", LoggedInUserHandler).Methods("GET")
    router.HandleFunc("/api/todos", GetRecentTodosHandler).Methods("GET")
    router.HandleFunc("/api/todos", CreateOrUpdateTodayTodo).Methods("POST")
    router.HandleFunc("/api/todos/{id}", UpdateTodo).Methods("PUT")
    router.HandleFunc("/api/todos/{id}", DeleteTodoHandler).Methods("DELETE")
    router.HandleFunc("/api/latest-thread", GetLatestThreadIDHandler).Methods("GET")
    router.HandleFunc("/api/user-mission", GetUserMissionHandler).Methods("GET")
    router.HandleFunc("/api/user-thread", SaveUserThreadHandler).Methods("POST")
    router.HandleFunc("/api/user-first-name", GetUserFirstNameHandler).Methods("GET")
    router.HandleFunc("/api/save-assistant-message", SaveAssistantMessageHandler).Methods("POST")
    router.HandleFunc("/api/get-saved-assistant-message", GetSavedAssistantMessageHandler).Methods("GET")
    router.HandleFunc("/api/update-sort-indexes", UpdateSortIndexesHandler).Methods("POST")
    router.HandleFunc("/api/assistant-id", GetAssistantIDHandler).Methods("GET")
    router.HandleFunc("/api/save-assistant-id", SaveAssistantIDHandler).Methods("POST")

    // New test endpoints
    router.HandleFunc("/api/save-test", SaveTestHandler).Methods("GET")
    router.HandleFunc("/api/read-test", ReadTestHandler).Methods("GET")

    sessionRouter := sessionManager.LoadAndSave(router)

    // Set up CORS headers
    corsHandler := handlers.CORS(
        handlers.AllowedOrigins([]string{"http://localhost:3000"}),
        handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
        handlers.AllowedHeaders([]string{"Content-Type"}),
        handlers.AllowCredentials(), // Allow credentials to be sent
    )

    fmt.Println("Starting server on :8080")
    log.Fatal(http.ListenAndServe(":8080", corsHandler(sessionRouter)))
}

func SignUpHandler(w http.ResponseWriter, r *http.Request) {
    var credentials struct {
        Email    string `json:"email"`
        Password string `json:"password"`
        Timezone string `json:"timezone"`
    }

    if err := json.NewDecoder(r.Body).Decode(&credentials); err != nil {
        http.Error(w, "Invalid request payload", http.StatusBadRequest)
        return
    }

    // Validate email
    atIndex := strings.Index(credentials.Email, "@")
    if atIndex == -1 {
        http.Error(w, "Invalid email address", http.StatusBadRequest)
        return
    }
    // Generate username from email
    username := credentials.Email[:atIndex]

    // Check password length
    if len(credentials.Password) < 6 {
        http.Error(w, "Password must be at least 6 characters long", http.StatusBadRequest)
        return
    }

    // Validate timezone
    credentials.Timezone = strings.TrimSpace(credentials.Timezone)
    if credentials.Timezone == "" {
        log.Printf("Empty or whitespace-only timezone provided. Defaulting to America/Los_Angeles")
        credentials.Timezone = "America/Los_Angeles"
    } else if _, err := time.LoadLocation(credentials.Timezone); err != nil {
        log.Printf("Invalid timezone provided: %s. Defaulting to America/Los_Angeles", credentials.Timezone)
        credentials.Timezone = "America/Los_Angeles"
    }

    // Hash the password
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(credentials.Password), bcrypt.DefaultCost)
    if err != nil {
        http.Error(w, "Failed to hash password", http.StatusInternalServerError)
        return
    }

    // Insert the new user into the database
    result, err := db.Exec("INSERT INTO users (email, password_hash, timezone, username) VALUES (?, ?, ?, ?)",
        credentials.Email, string(hashedPassword), credentials.Timezone, username)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to create user: %v", err), http.StatusInternalServerError)
        return
    }

    userID, err := result.LastInsertId()
    if err != nil {
        http.Error(w, "Failed to retrieve user ID", http.StatusInternalServerError)
        return
    }

    // Set userID in the session
    sessionManager.Put(r.Context(), "userID", int(userID))
    log.Printf("User ID %d set in session", userID)

    // Create the user object to return
    user := User{
        ID:       int(userID),
        Email:    credentials.Email,
        Timezone: credentials.Timezone,
        Username: username,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
    var credentials struct {
        Email    string `json:"email"`
        Password string `json:"password"`
    }

    if err := json.NewDecoder(r.Body).Decode(&credentials); err != nil {
        http.Error(w, "Invalid request payload", http.StatusBadRequest)
        return
    }

    var user User
    err := db.QueryRow("SELECT id, email, password_hash, timezone, username FROM users WHERE email = ?", credentials.Email).Scan(&user.ID, &user.Email, &user.Password, &user.Timezone, &user.Username)
    if err != nil {
        if err == sql.ErrNoRows {
            http.Error(w, "Invalid email or password", http.StatusUnauthorized)
        } else {
            http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
        }
        return
    }

    if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(credentials.Password)); err != nil {
        http.Error(w, "Invalid email or password", http.StatusUnauthorized)
        return
    }

    sessionManager.Put(r.Context(), "userID", user.ID)
    log.Printf("User ID %d set in session", user.ID)

    user.Password = ""

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
    err := sessionManager.Destroy(r.Context())
    if err != nil {
        http.Error(w, "Failed to destroy session", http.StatusInternalServerError)
        return
    }
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("User logged out successfully"))
}

func LoggedInUserHandler(w http.ResponseWriter, r *http.Request) {
    userID, err := GetUserIDFromSession(r)
    if err != nil {
        // Return a mock user if not logged in
        anonymousUser := User{
            ID:       0,
            Email:    "anonymoususer@mailinator.com",
            Timezone: "America/Los_Angeles",
            Username: "anonymoususer",
        }
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(anonymousUser)
        return
    }

    var user User
    err = db.QueryRow("SELECT id, email, timezone, username FROM users WHERE id = ?", userID).Scan(&user.ID, &user.Email, &user.Timezone, &user.Username)
    if err != nil {
        if err == sql.ErrNoRows {
            http.Error(w, "User not found", http.StatusNotFound)
        } else {
            http.Error(w, fmt.Sprintf("Database error: %v", err), http.StatusInternalServerError)
        }
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}

// Example handler to get a session value
func GetUserIDFromSession(r *http.Request) (int, error) {
    userID, ok := sessionManager.Get(r.Context(), "userID").(int)
    if !ok {
        log.Println("No user ID in session")
        return 0, fmt.Errorf("no user ID in session")
    }
    log.Printf("Retrieved user ID %d from session", userID)
    return userID, nil
}

func UpdateSortIndexesHandler(w http.ResponseWriter, r *http.Request) {
    var updates map[int]int // Maps daily_todo ID to new sort_index
    if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
        http.Error(w, "Invalid request payload", http.StatusBadRequest)
        return
    }

    for id, newIndex := range updates {
        _, err := db.Exec("UPDATE daily_todos SET sort_index = ? WHERE id = ?", newIndex, id)
        if err != nil {
            http.Error(w, fmt.Sprintf("Failed to update sort_index for todo ID %d: %v", id, err), http.StatusInternalServerError)
            return
        }
    }

    w.WriteHeader(http.StatusOK)
    w.Write([]byte("Sort indexes updated successfully"))
}


func GetUserFirstNameHandler(w http.ResponseWriter, r *http.Request) {
    userIDStr := r.URL.Query().Get("user_id")
    if userIDStr == "" {
        http.Error(w, "user_id is required", http.StatusBadRequest)
        return
    }

    userID, err := strconv.Atoi(userIDStr)
    if err != nil {
        http.Error(w, "invalid user_id", http.StatusBadRequest)
        return
    }

    var firstName string
    err = db.QueryRow("SELECT username FROM users WHERE id = ?", userID).Scan(&firstName)
    if err != nil {
        if err == sql.ErrNoRows {
            http.Error(w, "user not found", http.StatusNotFound)
            return
        } else {
            http.Error(w, fmt.Sprintf("Failed to fetch first name: %v", err), http.StatusInternalServerError)
            return
        }
    }

    response := map[string]string{"first_name": firstName}
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func SaveUserThreadHandler(w http.ResponseWriter, r *http.Request) {
    var input struct {
        UserID   int    `json:"user_id"`
        ThreadID string `json:"thread_id"`
    }

    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    _, err := db.Exec(`
        INSERT INTO user_threads (user_id, thread_id, created_at, updated_at)
        VALUES (?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        input.UserID, input.ThreadID)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to save user thread: %v", err), http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusOK)
    w.Write([]byte("User thread saved successfully"))
}


func GetLatestThreadIDHandler(w http.ResponseWriter, r *http.Request) {
    userID := r.URL.Query().Get("user_id")
    if userID == "" {
        http.Error(w, "user_id is required", http.StatusBadRequest)
        return
    }

    var threadID *string
    err := db.QueryRow("SELECT thread_id FROM user_threads WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", userID).Scan(&threadID)
    if err != nil {
        if err == sql.ErrNoRows {
            response := map[string]*string{"thread_id": nil}
            w.Header().Set("Content-Type", "application/json")
            json.NewEncoder(w).Encode(response)
            return
        } else {
            http.Error(w, fmt.Sprintf("Failed to fetch thread ID: %v", err), http.StatusInternalServerError)
            return
        }
    }

    response := map[string]*string{"thread_id": threadID}
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func GetUserMissionHandler(w http.ResponseWriter, r *http.Request) {
    userIDStr := r.URL.Query().Get("user_id")
    if userIDStr == "" {
        http.Error(w, "user_id is required", http.StatusBadRequest)
        return
    }

    userID, err := strconv.Atoi(userIDStr)
    if err != nil {
        http.Error(w, "invalid user_id", http.StatusBadRequest)
        return
    }

    var mission *string
    err = db.QueryRow("SELECT mission FROM user_missions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", userID).Scan(&mission)
    if err != nil {
        if err == sql.ErrNoRows {
            mission = nil
        } else {
            http.Error(w, fmt.Sprintf("Failed to fetch mission: %v", err), http.StatusInternalServerError)
            return
        }
    }

    // Get the current day number
    userTimezone, currentTime, err := getUserTimezoneAndCurrentTime(userID)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to fetch user timezone: %v", err), http.StatusInternalServerError)
        return
    }
    currentDayNumber := calculateDayNumber(currentTime, userTimezone)

    // Fetch the last 7 days of todos excluding the current day
    todos, err := getLast7DaysTodos(userID, currentDayNumber-1)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to fetch todos: %v", err), http.StatusInternalServerError)
        return
    }

    response := map[string]interface{}{
        "mission":           mission,
        "todos":             todos,
        "current_day_number": currentDayNumber,
    }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

// Helper function to fetch the last 7 days of todos excluding the current day
func getLast7DaysTodos(userID int, upToDayNumber int) ([]map[string]interface{}, error) {
    rows, err := db.Query(`
        SELECT day_number, title, status, goal 
        FROM daily_todos 
        WHERE user_id = ? 
        AND day_number BETWEEN ? AND ?
        AND deleted = 0
        ORDER BY day_number DESC, sort_index ASC`, userID, upToDayNumber-6, upToDayNumber)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch todos: %w", err)
    }
    defer rows.Close()

    todos := []map[string]interface{}{}
    for rows.Next() {
        var dayNumber, status, goal int
        var title string
        if err := rows.Scan(&dayNumber, &title, &status, &goal); err != nil {
            return nil, fmt.Errorf("failed to scan todo: %w", err)
        }
        todos = append(todos, map[string]interface{}{
            "day_number": dayNumber,
            "title":      title,
            "progress":   fmt.Sprintf("%d out of %d", status, goal),
        })
    }
    return todos, nil
}

func GetRecentTodosHandler(w http.ResponseWriter, r *http.Request) {
    userID, err := GetUserIDFromSession(r)
    if err != nil {
        http.Error(w, "Unauthorized: No user logged in", http.StatusUnauthorized)
        return
    }

    todos, newDay, newDayNumber, err := getRecentTodosForUser(userID)
    if err != nil {
        log.Printf("failed to get recent todos: %v", err)
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    response := TodosResponse{
        Todos:        todos,
        NewDay:       newDay,
        NewDayNumber: newDayNumber,
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

// Handler to create or update today's todo
func CreateOrUpdateTodayTodo(w http.ResponseWriter, r *http.Request) {
    var todo Todo
    if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    userID, err := GetUserIDFromSession(r)
    if err != nil {
        http.Error(w, "Unauthorized: No user logged in", http.StatusUnauthorized)
        return
    }

    todo.UserID = userID

    userTimezone, currentTime, err := getUserTimezoneAndCurrentTime(todo.UserID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    loc, _ := time.LoadLocation(userTimezone)
    todo.DayNumber = calculateDayNumber(currentTime.In(loc), userTimezone)

    // Determine the next sort_index
    var maxSortIndex int
    err = db.QueryRow("SELECT COALESCE(MAX(sort_index), 0) FROM daily_todos WHERE user_id = ? AND day_number = ? AND deleted = 0", todo.UserID, todo.DayNumber).Scan(&maxSortIndex)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to determine sort_index: %v", err), http.StatusInternalServerError)
        return
    }
    todo.SortIndex = maxSortIndex + 1

    // TODO: there is no way for there to be a duplicate key!
    result, err := db.Exec("INSERT INTO daily_todos (user_id, title, day_number, status, goal, sort_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE status = ?, goal = ?", todo.UserID, todo.Title, todo.DayNumber, todo.Status, todo.Goal, todo.SortIndex, todo.Status, todo.Goal)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    id, err := result.LastInsertId()
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    todo.ID = int(id)

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todo)
}

// Handler to delete a todo by ID (soft delete)
func DeleteTodoHandler(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id := vars["id"]

    _, err := db.Exec("UPDATE daily_todos SET deleted = TRUE WHERE id = ?", id)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to delete todo: %v", err), http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusOK)
    w.Write([]byte("Todo deleted successfully"))
}

// Handler to update a todo by ID
func UpdateTodo(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id := vars["id"]

    var todo Todo
    if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    // Fetch the current status and goal from the database
    var currentStatus, currentGoal int
    err := db.QueryRow("SELECT status, goal FROM daily_todos WHERE id = ? AND deleted = 0", id).Scan(&currentStatus, &currentGoal)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to fetch current todo: %v", err), http.StatusInternalServerError)
        return
    }

    // If the goal is changing and the current status is greater than the new goal, update the status
    if todo.Goal != currentGoal && currentStatus > todo.Goal {
        todo.Status = todo.Goal
    }

    _, err = db.Exec("UPDATE daily_todos SET title = ?, status = ?, goal = ? WHERE id = ?", todo.Title, todo.Status, todo.Goal, id)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todo)
}

func SaveAssistantMessageHandler(w http.ResponseWriter, r *http.Request) {
    var input struct {
        UserID    int    `json:"user_id"`
        DayNumber int    `json:"day_number"`
        Message   string `json:"message"`
    }

    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    _, err := db.Exec(`
        INSERT INTO saved_assistant_messages (user_id, day_number, message, created_at)
        VALUES (?, ?, ?, NOW())`,
        input.UserID, input.DayNumber, input.Message)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to save assistant message: %v", err), http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusOK)
    w.Write([]byte("Assistant message saved successfully"))
}

func GetSavedAssistantMessageHandler(w http.ResponseWriter, r *http.Request) {
    userIDStr := r.URL.Query().Get("user_id")
    dayNumberStr := r.URL.Query().Get("day_number")

    if userIDStr == "" || dayNumberStr == "" {
        http.Error(w, "user_id and day_number are required", http.StatusBadRequest)
        return
    }

    userID, err := strconv.Atoi(userIDStr)
    if err != nil {
        http.Error(w, "invalid user_id", http.StatusBadRequest)
        return
    }

    dayNumber, err := strconv.Atoi(dayNumberStr)
    if err != nil {
        http.Error(w, "invalid day_number", http.StatusBadRequest)
        return
    }

    var message string
    err = db.QueryRow("SELECT message FROM saved_assistant_messages WHERE user_id = ? AND day_number = ?", userID, dayNumber).Scan(&message)
    if err != nil {
        if err == sql.ErrNoRows {
            http.Error(w, "message not found", http.StatusNotFound)
            return
        } else {
            http.Error(w, fmt.Sprintf("Failed to fetch message: %v", err), http.StatusInternalServerError)
            return
        }
    }

    response := map[string]string{"message": message}
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func GetAssistantIDHandler(w http.ResponseWriter, r *http.Request) {
    var assistantID string
    err := db.QueryRow("SELECT assistant_id FROM assistants ORDER BY created_at DESC LIMIT 1").Scan(&assistantID)
    if err != nil {
        if err == sql.ErrNoRows {
            http.Error(w, "assistant not found", http.StatusNotFound)
            return
        } else {
            http.Error(w, fmt.Sprintf("Failed to fetch assistant ID: %v", err), http.StatusInternalServerError)
            return
        }
    }

    response := map[string]string{"assistant_id": assistantID}
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
}

func SaveAssistantIDHandler(w http.ResponseWriter, r *http.Request) {
    var input struct {
        AssistantID string `json:"assistant_id"`
    }

    if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
        http.Error(w, "Invalid request payload", http.StatusBadRequest)
        return
    }

    _, err := db.Exec(`
        INSERT INTO assistants (assistant_id, created_at, updated_at)
        VALUES (?, NOW(), NOW())`,
        input.AssistantID)
    if err != nil {
        http.Error(w, fmt.Sprintf("Failed to save assistant ID: %v", err), http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusOK)
    w.Write([]byte("Assistant ID saved successfully"))
}

// New test endpoints
func SaveTestHandler(w http.ResponseWriter, r *http.Request) {
    sessionManager.Put(r.Context(), "test", "raza")
    log.Println("Saved 'test' = 'raza' in session")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("Saved 'test' = 'raza' in session"))
}

func ReadTestHandler(w http.ResponseWriter, r *http.Request) {
    testValue, ok := sessionManager.Get(r.Context(), "test").(string)
    if !ok {
        log.Println("No 'test' value found in session")
        http.Error(w, "No 'test' value found in session", http.StatusNotFound)
        return
    }
    log.Printf("Retrieved 'test' = '%s' from session", testValue)
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(fmt.Sprintf("Retrieved 'test' = '%s' from session", testValue)))
}
