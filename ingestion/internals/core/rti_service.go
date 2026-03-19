package core

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/LDFLK/RTI-Tracker/ingestion/internals/models"
	"github.com/LDFLK/RTI-Tracker/ingestion/internals/ports"
	"github.com/google/uuid"
)

// RTIService contains the business logic for RTI operations.
type RTIService struct {
	ingestionClient *ports.IngestionService
	readClient      *ports.ReadService
}

// NewRTIService creates a new RTIService.
func NewRTIService(ingestionClient *ports.IngestionService, readClient *ports.ReadService) *RTIService {
	return &RTIService{
		ingestionClient: ingestionClient,
		readClient:      readClient,
	}
}

// AddTRIEntity calls the ingestion service to create an entity.
func (s *RTIService) ProcessRTIEntity(entity *models.RTIRequest) (*models.Entity, error) {

	// validate input
	if err := entity.Validate(); err != nil {
		return nil, fmt.Errorf("invalid payload: %w", err)
	}

	// 1. Insert the RTI Entity to Graph
	id := uuid.New()
	rtiId := "rti_" + id.String()

	// TRI payload
	rtiEntity := &models.Entity{
		ID:      rtiId,
		Created: entity.Created,
		Kind: models.Kind{
			Major: "Document",
			Minor: "RTI",
		},
		Name: models.TimeBasedValue{
			StartTime: entity.Created,
			Value:     entity.Title,
		},
	}

	// Call the generic interface's method
	createdEntity, err := s.ingestionClient.CreateEntity(rtiEntity)
	if err != nil {
		return nil, fmt.Errorf("failed to create RTI: %w", err)
	}

	// 2. Make the relation to the receiver
	// find the receiver
	searchCriteria := &models.SearchCriteria{
		Name: entity.ReceiverInstitution,
		Kind: &models.Kind{
			Major: "Organisation",
		},
	}

	searchEntities, err := s.readClient.SearchEntities(searchCriteria)
	if err != nil {
		return nil, fmt.Errorf("error fetching entity for the given search criteria: %w", err)
	}

	// filter by name to get exact entities
	var filteredSearchResult []models.SearchResult
	for _, value := range searchEntities {
		if strings.EqualFold(value.Name, entity.ReceiverInstitution) {
			filteredSearchResult = append(filteredSearchResult, value)
		}
	}

	var parentID string
	if len(filteredSearchResult) > 0 {
		sort.Slice(filteredSearchResult, func(i, j int) bool {
			// Sort in descending order by created date
			timeI, errI := time.Parse(time.RFC3339, filteredSearchResult[i].Created)
			timeJ, errJ := time.Parse(time.RFC3339, filteredSearchResult[j].Created)
			if errI != nil || errJ != nil {
				return filteredSearchResult[i].Created > filteredSearchResult[j].Created
			}
			return timeI.After(timeJ)
		})

		entityCreatedTime, err := time.Parse(time.RFC3339, entity.Created)
		if err != nil {
			return nil, fmt.Errorf("failed time parsing")
		}

		for _, result := range filteredSearchResult {
			resultTime, err := time.Parse(time.RFC3339, result.Created)
			if err == nil && !resultTime.After(entityCreatedTime) {
				parentID = result.ID
				break
			}
		}

		// Fallback: if no floor date is found or parse failed, pick the first one
		if parentID == "" {
			return nil, fmt.Errorf("skipping relation update (receiver not found for the given date): %s", entity.Created)
		}
	}

	// make a unique relation ID
	uniqueRelationshipID := fmt.Sprintf("RTI_%s_%s", parentID, createdEntity.ID)

	// payload for the parent
	parentEntity := &models.Entity{
		ID:         parentID,
		Kind:       models.Kind{},
		Created:    "",
		Terminated: "",
		Name:       models.TimeBasedValue{},
		Metadata:   []models.MetadataEntry{},
		Attributes: []models.AttributeEntry{},
		Relationships: []models.RelationshipEntry{
			{
				Key: uniqueRelationshipID,
				Value: models.Relationship{
					RelatedEntityID: createdEntity.ID,
					StartTime:       entity.Created,
					EndTime:         "",
					ID:              uniqueRelationshipID,
					Name:            "AS_RTI",
				},
			},
		},
	}

	updatedEntity, err := s.ingestionClient.UpdateEntity(parentID, parentEntity)
	if err != nil {
		return nil, fmt.Errorf("failed to update parent entity: %w", err)
	}

	return updatedEntity, nil
}
