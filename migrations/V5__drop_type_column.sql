-- V5__drop_type_column.sql
update DailyTodos set goal = 1 where type = 'yes_no';
ALTER TABLE DailyTodos DROP COLUMN type;
