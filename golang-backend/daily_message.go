package main

import (
	"context"
	"database/sql"
)

// saveDailyMessage serializes saves; explicit regeneration replaces the saved text.
// The Python Redis lease also prevents duplicate upstream generations.
func saveDailyMessage(ctx context.Context, database *sql.DB, userID, day int, text string, replace bool) (string, error) {
	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	var lockedUserID int
	if err = tx.QueryRowContext(ctx, "SELECT id FROM users WHERE id = ? FOR UPDATE", userID).Scan(&lockedUserID); err != nil {
		return "", err
	}
	var message string
	err = tx.QueryRowContext(ctx, "SELECT message FROM saved_assistant_messages WHERE user_id = ? AND day_number = ? ORDER BY id ASC LIMIT 1", userID, day).Scan(&message)
	if err == sql.ErrNoRows {
		message = text
		_, err = tx.ExecContext(ctx, `
			INSERT INTO saved_assistant_messages (user_id, day_number, message, created_at)
			VALUES (?, ?, ?, NOW())`, userID, day, message)
	} else if err == nil && replace {
		_, err = tx.ExecContext(ctx, "UPDATE saved_assistant_messages SET message = ? WHERE user_id = ? AND day_number = ? ORDER BY id ASC LIMIT 1", text, userID, day)
		message = text
	}

	if err != nil {
		return "", err
	}
	if err = tx.Commit(); err != nil {
		return "", err
	}
	return message, nil
}
