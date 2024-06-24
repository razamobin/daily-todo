-- V9__create_saved_assistant_messages.sql

CREATE TABLE saved_assistant_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    day_number INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

