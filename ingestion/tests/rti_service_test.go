package tests

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/LDFLK/RTI-Tracker/ingestion/internals/client"
	"github.com/LDFLK/RTI-Tracker/ingestion/internals/core"
	"github.com/LDFLK/RTI-Tracker/ingestion/internals/models"
	"github.com/LDFLK/RTI-Tracker/ingestion/internals/ports"
	"github.com/hashicorp/go-retryablehttp"
)

func TestProcessRTI(t *testing.T) {

	// listing the RTIRequests
	rtiRequestList := []models.RTIRequest{}

	// payload --> success
	rtiRequestList = append(rtiRequestList, models.RTIRequest{
		Title:               "Title_1",
		Description:         "Description_1",
		Source:              "Source_1",
		Sender:              "Sender_1",
		ReceiverInstitution: "ReceiverInstitution_1",
		ReceiverPosition:    "ReceiverPosition_1",
		Created:             time.Now().Format(time.RFC3339),
	})

	// payload --> with spaces in created date
	rtiRequestList = append(rtiRequestList, models.RTIRequest{
		Title:               "Title_2",
		Description:         "Description_2",
		Source:              "Source_2",
		Sender:              "Sender_2",
		ReceiverInstitution: "ReceiverInstitution_2",
		ReceiverPosition:    "ReceiverPosition_2",
		Created:             "   ",
	})

	// payload --> with empty receiver institution
	rtiRequestList = append(rtiRequestList, models.RTIRequest{
		Title:               "Title_3",
		Description:         "Description_3",
		Source:              "Source_3",
		Sender:              "Sender_3",
		ReceiverInstitution: "",
		ReceiverPosition:    "ReceiverPosition_3",
		Created:             time.Now().Format(time.RFC3339),
	})

	// payload --> with empty receiver position
	rtiRequestList = append(rtiRequestList, models.RTIRequest{
		Title:               "Title_4",
		Description:         "Description_4",
		Source:              "Source_4",
		Sender:              "Sender_4",
		ReceiverInstitution: "ReceiverInstitution_4",
		ReceiverPosition:    "",
		Created:             time.Now().Format(time.RFC3339),
	})

	// payload --> with empty title
	rtiRequestList = append(rtiRequestList, models.RTIRequest{
		Title:               "",
		Description:         "Description_5",
		Source:              "Source_5",
		Sender:              "Sender_5",
		ReceiverInstitution: "ReceiverInstitution_5",
		ReceiverPosition:    "ReceiverPosition_5",
		Created:             time.Now().Format(time.RFC3339),
	})

	// payload --> with empty content
	rtiRequestList = append(rtiRequestList, models.RTIRequest{
		Title:               "Title_6",
		Description:         "",
		Source:              "Source_6",
		Sender:              "Sender_7",
		ReceiverInstitution: "ReceiverInstitution_6",
		ReceiverPosition:    "ReceiverPosition_6",
		Created:             time.Now().Format(time.RFC3339),
	})

	// payload --> with empty sender
	rtiRequestList = append(rtiRequestList, models.RTIRequest{
		Title:               "Title_7",
		Description:         "Description_7",
		Source:              "Source_7",
		Sender:              "",
		ReceiverInstitution: "ReceiverInstitution_7",
		ReceiverPosition:    "ReceiverPosition_7",
		Created:             time.Now().Format(time.RFC3339),
	})

	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/entities" {
			w.WriteHeader(http.StatusCreated)
			mockEntity := models.Entity{ID: "mock-rti-id"}
			json.NewEncoder(w).Encode(mockEntity)
			return
		}

		if r.Method == http.MethodPost && r.URL.Path == "/v1/entities/search" {
			w.WriteHeader(http.StatusOK)
			mockSearchResponse := models.SearchResponse{
				Body: []models.SearchResult{
					{
						ID:      "parent-org-id",
						Name:    "{\"typeUrl\":\"\",\"value\":\"5265636569766572496e737469747574696f6e5f31\"}",
						Created: time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
					},
				},
			}
			json.NewEncoder(w).Encode(mockSearchResponse)
			return
		}

		if r.Method == http.MethodPost && strings.Contains(r.URL.Path, "/relations") {
			w.WriteHeader(http.StatusOK)
			var reqBody models.Relationship
			json.NewDecoder(r.Body).Decode(&reqBody)

			if reqBody.Name == "AS_MINISTER" {
				mockRelations := []models.Relationship{
					{
						Direction: "INCOMING",
						Name:      "AS_MINISTER",
					},
				}
				json.NewEncoder(w).Encode(mockRelations)
			} else {
				json.NewEncoder(w).Encode([]models.Relationship{})
			}
			return
		}

		if r.Method == http.MethodPut {
			w.WriteHeader(http.StatusOK)
			var mockUpdatedEntity models.Entity
			json.NewDecoder(r.Body).Decode(&mockUpdatedEntity)
			json.NewEncoder(w).Encode(mockUpdatedEntity)
			return
		}

		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockServer.Close()

	retryClient := retryablehttp.NewClient()
	retryClient.Logger = nil

	testClient := client.Client{
		IngestionURL: mockServer.URL,
		ReadURL:      mockServer.URL,
		HttpClient:   retryClient,
	}

	for _, tc := range rtiRequestList {
		t.Run(tc.Title, func(t *testing.T) {
			ingestionClient := ports.NewIngestionService(testClient)
			readClient := ports.NewReadService(testClient)
			service := core.NewRTIService(ingestionClient, readClient)

			result, err := service.InsertRTIEntity(&tc)

			// validate empty title
			if strings.TrimSpace(tc.Title) == "" {
				if err == nil || err.Error() != "invalid payload: RTI request title cannot be empty" {
					t.Fatalf("Expected title empty err, got: %v", err)
				}
				return
			}

			// validate empty description
			if strings.TrimSpace(tc.Description) == "" {
				if err == nil || err.Error() != "invalid payload: RTI request description cannot be empty" {
					t.Fatalf("Expected description empty err, got: %v", err)
				}
				return
			}

			// validate empty source
			if strings.TrimSpace(tc.Source) == "" {
				if err == nil || err.Error() != "invalid payload: RTI request source cannot be empty" {
					t.Fatalf("Expected source empty err, got: %v", err)
				}
				return
			}

			// validate empty sender
			if strings.TrimSpace(tc.Sender) == "" {
				if err == nil || err.Error() != "invalid payload: RTI request sender cannot be empty" {
					t.Fatalf("Expected sender empty err, got: %v", err)
				}
				return
			}

			// validate empty receiver institution
			if strings.TrimSpace(tc.ReceiverInstitution) == "" {
				if err == nil || err.Error() != "invalid payload: RTI request receiver institution cannot be empty" {
					t.Fatalf("Expected receiver institution empty err, got: %v", err)
				}
				return
			}

			// validate empty receiver position
			if strings.TrimSpace(tc.ReceiverPosition) == "" {
				if err == nil || err.Error() != "invalid payload: RTI request receiver position cannot be empty" {
					t.Fatalf("Expected receiver position empty err, got: %v", err)
				}
				return
			}

			// validate empty receiver created
			if strings.TrimSpace(tc.Created) == "" {
				if err == nil || err.Error() != "invalid payload: RTI request created cannot be empty" {
					t.Fatalf("Expected created date empty err, got: %v", err)
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if result == nil {
				t.Fatalf("Expected an entity, got nil")
			}

			if result.ID != "parent-org-id" {
				t.Errorf("Expected result ID to be parent-org-id, got %s", result.ID)
			}

			// Validate values inside updated entity (relationships)
			if len(result.Relationships) != 1 {
				t.Fatalf("Expected 1 relationship, got %d", len(result.Relationships))
			}

			rel := result.Relationships[0].Value
			if rel.RelatedEntityID != "mock-rti-id" { // as defined in the POST /entities mock
				t.Errorf("Expected RelatedEntityID 'mock-rti-id', got %s", rel.RelatedEntityID)
			}
			if rel.Name != "AS_RTI" {
				t.Errorf("Expected relation Name 'AS_RTI', got %s", rel.Name)
			}
			if rel.StartTime != tc.Created {
				t.Errorf("Expected StartTime '%s', got %s", tc.Created, rel.StartTime)
			}

		})
	}
}
