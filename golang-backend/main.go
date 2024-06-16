package main

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "github.com/gorilla/mux"
    _ "github.com/go-sql-driver/mysql"
    "time"
)

var db *sql.DB

type Todo struct {
    ID        int       `json:"id"`
    UserID    int       `json:"user_id"`
    Title     string    `json:"title"`
    Type      string    `json:"type"`
    Date      string    `json:"date"`
    Status    int       `json:"status"`
    CreatedAt string    `json:"created_at"`
    UpdatedAt string    `json:"updated_at"`
}

func main() {
    var err error
    db, err = sql.Open("mysql", "user:password@tcp(mysql:3306)/todo_db")
    if err != nil {
        log.Fatal(err)
    }

    router := mux.NewRouter()
    router.HandleFunc("/api/todos", GetTodayTodos).Methods("GET")
    router.HandleFunc("/api/todos", CreateOrUpdateTodayTodo).Methods("POST")
    router.HandleFunc("/api/todos/{id}", UpdateTodo).Methods("PUT")
    router.HandleFunc("/api/todos/yesterday", GetYesterdayTodos).Methods("GET")
    router.HandleFunc("/api/todos/yesterday/{id}", UpdateYesterdayTodo).Methods("PUT")

    fmt.Println("Starting server on :8080")
    log.Fatal(http.ListenAndServe(":8080", router))
}

func GetTodayTodos(w http.ResponseWriter, r *http.Request) {
    userID := 1 // Hardcoded for now, replace with actual user ID after authentication is added
    today := time.Now().Format("2006-01-02")

    rows, err := db.Query("SELECT id, user_id, title, type, DATE_FORMAT(date, '%Y-%m-%d') as date, status, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') as created_at, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') as updated_at FROM DailyTodos WHERE user_id = ? AND date = ?", userID, today)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    todos := []Todo{}
    for rows.Next() {
        var todo Todo
        if err := rows.Scan(&todo.ID, &todo.UserID, &todo.Title, &todo.Type, &todo.Date, &todo.Status, &todo.CreatedAt, &todo.UpdatedAt); err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        todos = append(todos, todo)
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todos)
}

func CreateOrUpdateTodayTodo(w http.ResponseWriter, r *http.Request) {
    var todo Todo
    if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    todo.UserID = 1 // Hardcoded for now, replace with actual user ID after authentication is added
    todo.Date = time.Now().Format("2006-01-02")

    result, err := db.Exec("INSERT INTO DailyTodos (user_id, title, type, date, status) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = ?", todo.UserID, todo.Title, todo.Type, todo.Date, todo.Status, todo.Status)
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

func UpdateTodo(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id := vars["id"]

    var todo Todo
    if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    _, err := db.Exec("UPDATE DailyTodos SET title = ?, type = ?, status = ? WHERE id = ?", todo.Title, todo.Type, todo.Status, id)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todo)
}

func GetYesterdayTodos(w http.ResponseWriter, r *http.Request) {
    userID := 1 // Hardcoded for now, replace with actual user ID after authentication is added
    yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")

    rows, err := db.Query("SELECT id, user_id, title, type, DATE_FORMAT(date, '%Y-%m-%d') as date, status, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') as created_at, DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') as updated_at FROM DailyTodos WHERE user_id = ? AND date = ?", userID, yesterday)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    todos := []Todo{}
    for rows.Next() {
        var todo Todo
        if err := rows.Scan(&todo.ID, &todo.UserID, &todo.Title, &todo.Type, &todo.Date, &todo.Status, &todo.CreatedAt, &todo.UpdatedAt); err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        todos = append(todos, todo)
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todos)
}

func UpdateYesterdayTodo(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    id := vars["id"]

    var todo Todo
    if err := json.NewDecoder(r.Body).Decode(&todo); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    _, err := db.Exec("UPDATE DailyTodos SET title = ?, type = ?, status = ? WHERE id = ?", todo.Title, todo.Type, todo.Status, id)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(todo)
}


