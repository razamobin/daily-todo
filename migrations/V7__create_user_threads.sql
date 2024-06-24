-- V7__create_user_threads.sql

CREATE TABLE user_threads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    thread_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

