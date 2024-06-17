ALTER TABLE Users ADD COLUMN timezone VARCHAR(255) DEFAULT 'UTC';

UPDATE Users SET timezone = 'Pacific/Los_Angeles' WHERE id = 1;
