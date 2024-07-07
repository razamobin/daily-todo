-- V18__make_user_id_unique_in_user_missions.sql

ALTER TABLE user_missions
ADD CONSTRAINT unique_user_id UNIQUE (user_id);
