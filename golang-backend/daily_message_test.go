package main

import (
	"context"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRegenerateDailyMessage(t *testing.T) {
	for _, fail := range []bool{false, true} {
		database, mock, err := sqlmock.New()
		if err != nil {
			t.Fatal(err)
		}
		mock.ExpectBegin()
		mock.ExpectQuery("SELECT id FROM users WHERE id = .* FOR UPDATE").WithArgs(7).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(7))
		mock.ExpectQuery("SELECT message FROM saved_assistant_messages").WithArgs(7, 3).
			WillReturnRows(sqlmock.NewRows([]string{"message"}).AddRow("original"))
		update := mock.ExpectExec("UPDATE saved_assistant_messages SET message").WithArgs("replacement", 7, 3)
		if fail {
			update.WillReturnError(errors.New("write failed"))
			mock.ExpectRollback()
		} else {
			update.WillReturnResult(sqlmock.NewResult(0, 1))
			mock.ExpectCommit()
		}
		message, err := saveDailyMessage(context.Background(), database, 7, 3, "replacement", true)
		if fail && (err == nil || message != "") {
			t.Fatal("failed replacement reported success")
		}
		if !fail && (err != nil || message != "replacement") {
			t.Fatalf("replacement failed: %s %v", message, err)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatal(err)
		}
		database.Close()
	}
}

func TestSaveDailyMessage(t *testing.T) {
	for _, scenario := range []string{"new", "existing", "insert failure", "commit failure", "read failure"} {
		t.Run(scenario, func(t *testing.T) {
			database, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			defer database.Close()
			mock.ExpectBegin()
			mock.ExpectQuery("SELECT id FROM users WHERE id = .* FOR UPDATE").WithArgs(7).
				WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(7))
			read := mock.ExpectQuery("SELECT message FROM saved_assistant_messages").WithArgs(7, 3)
			if scenario == "existing" {
				read.WillReturnRows(sqlmock.NewRows([]string{"message"}).AddRow("original"))
			} else if scenario == "read failure" {
				read.WillReturnError(errors.New("database unavailable"))
			} else {
				read.WillReturnRows(sqlmock.NewRows([]string{"message"}))
				insert := mock.ExpectExec("INSERT INTO saved_assistant_messages").WithArgs(7, 3, "new text")
				if scenario == "insert failure" {
					insert.WillReturnError(errors.New("write failed"))
				} else {
					insert.WillReturnResult(sqlmock.NewResult(1, 1))
				}
			}
			if scenario == "insert failure" || scenario == "read failure" {
				mock.ExpectRollback()
			} else if scenario == "commit failure" {
				mock.ExpectCommit().WillReturnError(errors.New("commit failed"))
			} else {
				mock.ExpectCommit()
			}
			message, err := saveDailyMessage(context.Background(), database, 7, 3, "new text", false)
			if scenario == "new" || scenario == "existing" {
				if err != nil {
					t.Fatal(err)
				}
				want := "new text"
				if scenario == "existing" {
					want = "original"
				}
				if message != want {
					t.Fatalf("got %q, want %q", message, want)
				}
			} else if err == nil || message != "" {
				t.Fatal("failed save must not return success or a saved message")
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
