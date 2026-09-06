package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/go-sql-driver/mysql"
)

func TestSignupDatabaseErrors(t *testing.T) {
	for _, tc := range []struct {
		name    string
		err     error
		status  int
		message string
	}{
		{"duplicate email", &mysql.MySQLError{Number: 1062, Message: "private database detail"}, http.StatusConflict, "Email already exists"},
		{"database unavailable", errors.New("private database detail"), http.StatusInternalServerError, "Please retry"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			database, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			defer database.Close()
			previous := db
			db = database
			defer func() { db = previous }()
			mock.ExpectExec("INSERT INTO users").WithArgs("test@example.com", sqlmock.AnyArg(), "America/Merida", "test").WillReturnError(tc.err)
			r := httptest.NewRequest(http.MethodPost, "/api/signup", strings.NewReader(`{"email":"test@example.com","password":"test-password","timezone":"America/Merida"}`))
			w := httptest.NewRecorder()
			SignUpHandler(w, r)
			if w.Code != tc.status || !strings.Contains(w.Body.String(), tc.message) {
				t.Fatalf("got %d %s", w.Code, w.Body.String())
			}
			if strings.Contains(w.Body.String(), "private") {
				t.Fatal("database details leaked")
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}
