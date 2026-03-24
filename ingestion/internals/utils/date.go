package utils

import (
	"fmt"
	"strings"
	"time"
)

func DateToISO(dateStr string) (string, error) {
	// validate dateStr
	trimmedDate := strings.TrimSpace(dateStr)
	if trimmedDate == "" {
		return "0", fmt.Errorf("Date should not be empty")
	}
	date, err := time.Parse("2006-01-02", trimmedDate)
	if err != nil {
		return "0", fmt.Errorf("failed to parse date: %w", err)
	}

	dateISO := date.Format(time.RFC3339)

	return dateISO, nil
}
