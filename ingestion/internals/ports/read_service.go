package ports

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	client "github.com/LDFLK/RTI-Tracker/ingestion/internals/client"
	models "github.com/LDFLK/RTI-Tracker/ingestion/internals/models"
)

type ReadService struct {
	client client.Client
}

// NewReadService creates a new ReadService.
func NewReadService(c client.Client) *ReadService {
	return &ReadService{client: c}
}

// SearchEntities searches for entities based on criteria
func (c *ReadService) SearchEntities(criteria *models.SearchCriteria) ([]models.SearchResult, error) {
	jsonData, err := json.Marshal(criteria)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal search criteria: %w", err)
	}

	resp, err := c.client.HttpClient.Post(
		fmt.Sprintf("%s/v1/entities/search", c.client.ReadURL),
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to search entities: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, client.HttpErrorFromStatus(resp.StatusCode, string(body))
	}

	var response models.SearchResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Decode the name field for each search result
	for i := range response.Body {
		// The name is already a JSON string containing a protobuf object
		var protobufName struct {
			TypeURL string `json:"typeUrl"`
			Value   string `json:"value"`
		}
		if err := json.Unmarshal([]byte(response.Body[i].Name), &protobufName); err != nil {
			return nil, fmt.Errorf("failed to unmarshal protobuf name: %w", err)
		}

		// Convert hex to string
		decoded, err := hex.DecodeString(protobufName.Value)
		if err != nil {
			return nil, fmt.Errorf("failed to decode hex value: %w", err)
		}
		response.Body[i].Name = string(decoded)
	}

	return response.Body, nil
}

// GetRelatedEntities gets related entity IDs based on query parameters
func (c *ReadService) GetRelatedEntities(entityID string, query *models.Relationship) ([]models.Relationship, error) {
	jsonData, err := json.Marshal(query)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query: %w", err)
	}

	encodedID := url.QueryEscape(entityID)

	resp, err := c.client.HttpClient.Post(
		fmt.Sprintf("%s/v1/entities/%s/relations", c.client.ReadURL, encodedID),
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get related entities: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, client.HttpErrorFromStatus(resp.StatusCode, string(body))
	}

	var relations []models.Relationship
	if err := json.Unmarshal(body, &relations); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return relations, nil
}
