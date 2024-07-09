-- V21__create_todays_todo_notes_table.sql
CREATE TABLE todays_todo_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    daily_todo_id INT,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    user_id INT,
    FOREIGN KEY (daily_todo_id) REFERENCES daily_todos(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
