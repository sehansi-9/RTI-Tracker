package ports

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"

	client "github.com/LDFLK/RTI-Tracker/ingestion/internals/client"
	models "github.com/LDFLK/RTI-Tracker/ingestion/internals/models"

	"github.com/hashicorp/go-retryablehttp"
)

type IngestionService struct {
	client client.Client
}

// NewIngestionService creates a new IngestionService.
func NewIngestionService(c client.Client) *IngestionService {
	return &IngestionService{client: c}
}

func (c *IngestionService) CreateEntity(entity *models.Entity) (*models.Entity, error) {
	jsonData, err := json.Marshal(entity)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal entity: %w", err)
	}

	resp, err := c.client.HttpClient.Post(c.client.IngestionURL+"/entities", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to marshal entity: %w", err)
	}

	// close connection to prevent resource exhausting
	defer resp.Body.Close()

	// read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusCreated {
		return nil, client.HttpErrorFromStatus(resp.StatusCode, string(body))
	}

	var createdEntity models.Entity
	if err := json.Unmarshal(body, &createdEntity); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	log.Printf("[Ingestion]: Entity Created %+v", createdEntity)

	return &createdEntity, nil
}

// UpdateEntity updates an existing entity
func (c *IngestionService) UpdateEntity(id string, entity *models.Entity) (*models.Entity, error) {
	jsonData, err := json.Marshal(entity)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal entity: %w", err)
	}

	// URL encode the entity ID to handle special characters like slashes
	encodedID := url.QueryEscape(id)

	req, err := retryablehttp.NewRequest(
		http.MethodPut,
		fmt.Sprintf("%s/entities/%s", c.client.IngestionURL, encodedID),
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.HttpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to update entity: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, client.HttpErrorFromStatus(resp.StatusCode, string(body))
	}

	var updatedEntity models.Entity
	if err := json.Unmarshal(body, &updatedEntity); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &updatedEntity, nil
}
