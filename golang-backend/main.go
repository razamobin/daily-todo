package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

var db *sql.DB

type User struct {
    ID       int
    Timezone string
}

type Todo struct {
    ID        int       `json:"id"`
    UserID    int       `json:"user_id"`
    Title     string    `json:"title"`
    Type      string    `json:"type"`
    DayNumber int       `json:"day_number"`
    Status    int       `json:"status"`
    Goal      int       `json:"goal"`
    CreatedAt string    `json:"created_at"`
    UpdatedAt string    `json:"updated_at"`
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
    adjustedReferenceDate := referenceDate.In(loc)
    return int(t.Sub(adjustedReferenceDate).Hours() / 24) + 1
}

// Get the user's timezone and the current time in their timezone
func getUserTimezoneAndCurrentTime(userID int) (string, time.Time, error) {
    var user User
    err := db.QueryRow("SELECT id, timezone FROM Users WHERE id = ?", userID).Scan(&user.ID, &user.Timezone)
    if err != nil {
        return "", time.Time{}, fmt.Errorf("failed to fetch user timezone: %w", err)
    }

    loc, err := time.LoadLocation(user.Timezone)
    if err != nil {
        return "", time.Time{}, fmt.Errorf("failed to load location for timezone %s: %w", user.Timezone, err)
    }

    return user.Timezone, time.Now().In(loc), nil
}

// Fetch the most recent day_number from DailyTodos for the user
func getMostRecentDayNumberForUser(userID int) (int, error) {
    var recentDayNumber int
    err := db.QueryRow("SELECT MAX(day_number) FROM DailyTodos WHERE user_id = ?", userID).Scan(&recentDayNumber)
    if err != nil {
        return 0, fmt.Errorf("failed to fetch most recent day_number: %w", err)
    }

    return recentDayNumber, nil
}

// Copy todos from the most recent day to the current day
func copyTodosToCurrentDay(userID int, recentDayNumber int, currentDayNumber int) error {
    rows, err := db.Query("SELECT title, type, goal FROM DailyTodos WHERE user_id = ? AND day_number = ?", userID, recentDayNumber)
    if err != nil {
        return fmt.Errorf("failed to fetch recent todos: %w", err)
    }
    defer rows.Close()

    for rows.Next() {
        var title, todoType string
        var goal int
        if err := rows.Scan(&title, &todoType, &goal); err != nil {
            return fmt.Errorf("failed to scan todo: %w", err)
        }

        _, err := db.Exec("INSERT INTO DailyTodos (user_id, title, type, day_number, status, goal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
            userID, title, todoType, currentDayNumber, 0, goal)
        if err != nil {
            return fmt.Errorf("failed to insert new todo: %w", err)
        }
    }

    return nil
}

// Fetch the recent todos for the user
func getRecentTodosForUser(userID int) ([]Todo, error) {
    userTimezone, currentTime, err := getUserTimezoneAndCurrentTime(userID)
    if err != nil {
        return nil, err
    }

    fmt.Println("User Timezone:", userTimezone)
    fmt.Println("Current Time:", currentTime)

    recentDayNumber, err := getMostRecentDayNumberForUser(userID)
    if err != nil {
        return nil, err
    }

    currentDayNumber := calculateDayNumber(currentTime, userTimezone)

    fmt.Println("Recent Day Number:", recentDayNumber)
    fmt.Println("Current Day Number:", currentDayNumber)

    if recentDayNumber < currentDayNumber {
        if err := copyTodosToCurrentDay(userID, recentDayNumber, currentDayNumber); err != nil {
            return nil, err
        }
    }

    sevenDaysAgo := currentDayNumber - 7

    rows, err := db.Query("SELECT id, user_id, title, type, day_number, status, goal, created_at, updated_at FROM DailyTodos WHERE user_id = ? AND day_number BETWEEN ? AND ? ORDER BY day_number DESC, ID ASC", userID, sevenDaysAgo, currentDayNumber)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch recent todos: %w", err)
    }
    defer rows.Close()

    todos := []Todo{}
    for rows.Next() {
        var todo Todo
        var createdAt, updatedAt string
        if err := rows.Scan(&todo.ID, &todo.UserID, &todo.Title, &todo.Type, &todo.DayNumber, &todo.Status, &todo.Goal, &createdAt, &updatedAt); err != nil {
            return nil, fmt.Errorf("failed to scan todo: %w", err)
        }
        todo.CreatedAt = createdAt
        todo.UpdatedAt = updatedAt
        todos = append(todos, todo)
    }

    return todos, nil
}

func main() {
    var err error
    db, err = sql.Open("mysql", "user:password@tcp(mysql:3306)/todo_db")
    if err != nil {
        log.Fatal(err)
    }

    router := mux.NewRouter()
    router.HandleFunc("/api/todos", GetRecentTodosHandler).Methods("GET")
    router.HandleFunc("/api/todos", CreateOrUpdateTodayTodo).Methods("POST")
    router.HandleFunc("/api/todos/{id}", UpdateTodo).Methods("PUT")
    router.HandleFunc("/api/todos/yesterday", GetYesterdayTodos).Methods("GET")
    router.HandleFunc("/api/todos/yesterday/{id}", UpdateYesterdayTodo).Methods("PUT")

    // Set up CORS headers
    corsHandler := handlers.CORS(
        handlers.AllowedOrigins([]string{"http://localhost:3000"}),
        handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
        handlers.AllowedHeaders([]string{"Content-Type"}),
    )

    fmt.Println("Starting server on :8080")
    log.Fatal(http.ListenAndServe(":8080", corsHandler(router)))
}

func GetRecentTodosHandler(w http.ResponseWriter, r *http.Request) {
    userID := 1 // Replace with the actual user ID from the request context/session

    todos, err := getRecentTodosForUser(userID)
    if err != nil {
        log.Printf("failed to get recent todos: %v", err)
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todos)
}

// Handler to create or update today's todo
func CreateOrUpdateTodayTodo(w http.ResponseWriter, r *http.Request) {
    var todo Todo
    if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    todo.UserID = 1 // Hardcoded for now, replace with actual user ID after authentication is added

    userTimezone, currentTime, err := getUserTimezoneAndCurrentTime(todo.UserID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    loc, _ := time.LoadLocation(userTimezone)
    todo.DayNumber = calculateDayNumber(currentTime.In(loc), userTimezone)

    result, err := db.Exec("INSERT INTO DailyTodos (user_id, title, type, day_number, status, goal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE status = ?, goal = ?", todo.UserID, todo.Title, todo.Type, todo.DayNumber, todo.Status, todo.Goal, todo.Status, todo.Goal)
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

// Handler to update a todo by ID
func UpdateTodo(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id := vars["id"]

    var todo Todo
    if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    _, err := db.Exec("UPDATE DailyTodos SET title = ?, type = ?, status = ?, goal = ? WHERE id = ?", todo.Title, todo.Type, todo.Status, todo.Goal, id)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todo)
}

// Handler to get yesterday's todos
func GetYesterdayTodos(w http.ResponseWriter, r *http.Request) {
    userID := 1 // Hardcoded for now, replace with actual user ID after authentication is added

    userTimezone, currentTime, err := getUserTimezoneAndCurrentTime(userID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    loc, _ := time.LoadLocation(userTimezone)
    yesterdayDayNumber := calculateDayNumber(currentTime.AddDate(0, 0, -1).In(loc), userTimezone)

    rows, err := db.Query("SELECT id, user_id, title, type, day_number, status, goal, created_at, updated_at FROM DailyTodos WHERE user_id = ? AND day_number = ?", userID, yesterdayDayNumber)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    todos := []Todo{}
    for rows.Next() {
        var todo Todo
        if err := rows.Scan(&todo.ID, &todo.UserID, &todo.Title, &todo.Type, &todo.DayNumber, &todo.Status, &todo.Goal, &todo.CreatedAt, &todo.UpdatedAt); err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        todos = append(todos, todo)
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todos)
}

// Handler to update a todo from yesterday by ID
func UpdateYesterdayTodo(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id := vars["id"]

    var todo Todo
    if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    _, err := db.Exec("UPDATE DailyTodos SET title = ?, type = ?, status = ?, goal = ? WHERE id = ?", todo.Title, todo.Type, todo.Status, todo.Goal, id)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todo)
}



