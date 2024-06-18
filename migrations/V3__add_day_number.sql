-- V3__add_day_number.sql
ALTER TABLE DailyTodos ADD COLUMN day_number INT NOT NULL DEFAULT 0;
UPDATE DailyTodos SET day_number = 1;
ALTER TABLE DailyTodos ADD INDEX (day_number);

