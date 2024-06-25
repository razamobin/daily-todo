-- V10__update_user_threads.sql

ALTER TABLE user_threads
ADD CONSTRAINT unique_thread_id UNIQUE (thread_id);
