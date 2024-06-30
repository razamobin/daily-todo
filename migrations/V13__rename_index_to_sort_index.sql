-- V13__rename_index_to_sort_index.sql
ALTER TABLE daily_todos CHANGE COLUMN `index` sort_index INT NOT NULL DEFAULT 0;
