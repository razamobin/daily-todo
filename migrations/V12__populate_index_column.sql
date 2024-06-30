-- V12__populate_index_column.sql
SET @day_number = -1;
SET @index = 0;

UPDATE daily_todos
JOIN (
    SELECT id, day_number,
           @index := IF(@day_number = day_number, @index + 1, 0) AS new_index,
           @day_number := day_number
    FROM daily_todos
    ORDER BY day_number DESC, id ASC
) AS temp
ON daily_todos.id = temp.id
SET daily_todos.`index` = temp.new_index;
