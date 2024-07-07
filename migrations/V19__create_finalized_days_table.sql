-- V19__create_finalized_days_table.sql
CREATE TABLE finalized_days (
    user_id INT,
    day_number INT,
    finalized BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (user_id, day_number),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
