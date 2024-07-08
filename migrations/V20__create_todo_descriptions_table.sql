-- V20__create_todo_descriptions_table.sql

CREATE TABLE todo_descriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    user_id INT,
    initial_daily_todo_id INT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (initial_daily_todo_id) REFERENCES daily_todos(id)
);

ALTER TABLE daily_todos ADD COLUMN todo_description_id INT;
ALTER TABLE daily_todos ADD FOREIGN KEY (todo_description_id) REFERENCES todo_descriptions(id);
