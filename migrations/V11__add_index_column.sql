-- V11__add_index_column.sql
ALTER TABLE daily_todos ADD COLUMN `index` INT NOT NULL DEFAULT 0;
