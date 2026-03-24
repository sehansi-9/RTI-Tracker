package core

import (
	"fmt"
	"log"
	"strings"
	"sync"

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

// InsertTRIEntity calls the ingestion service to create an entity.
func (s *RTIService) InsertRTIEntity(entity *models.RTIRequest) (*models.Entity, error) {

	// validate input
	if err := entity.Validate(); err != nil {
		return nil, fmt.Errorf("invalid payload: %w", err)
	}

	// 1. Insert the RTI Entity to Graph
	// Create a deterministic UUID so rerunning the script on the same data doesn't duplicate nodes
	hashInput := fmt.Sprintf("%s_%s", entity.Created, entity.Index)
	id := uuid.NewMD5(uuid.NameSpaceOID, []byte(hashInput))
	rtiId := "rti_" + id.String()

	// RTI payload
	rtiEntity := &models.Entity{
		ID:      rtiId,
		Created: entity.Created,
		Kind: models.Kind{
			Major: "Document",
			Minor: "rti",
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

	// relation search criteria
	relationSearchCriteriaMinistry := models.Relationship{
		Direction: "INCOMING",
		ActiveAt:  entity.Created,
		Name:      "AS_MINISTER",
	}

	// relation search criteria
	relationSearchCriteriaDepartment := models.Relationship{
		Direction: "INCOMING",
		ActiveAt:  entity.Created,
		Name:      "AS_DEPARTMENT",
	}

	// iterate through the filtered search result to find the active entity
	for _, result := range filteredSearchResult {

		// define variables for relations and errors
		var (
			searchedRelationMinistry   []models.Relationship
			searchedRelationDepartment []models.Relationship
			errMinistry                error
			errDepartment              error
			wg                         sync.WaitGroup
		)

		wg.Add(2)

		// goroutine function
		go func() {
			defer wg.Done()
			searchedRelationMinistry, errMinistry = s.readClient.GetRelatedEntities(result.ID, &relationSearchCriteriaMinistry)
		}()

		// goroutine function
		go func() {
			defer wg.Done()
			searchedRelationDepartment, errDepartment = s.readClient.GetRelatedEntities(result.ID, &relationSearchCriteriaDepartment)
		}()

		// wait until the task finish
		wg.Wait()

		if errMinistry != nil || errDepartment != nil {
			log.Printf("[RTI] relation error fetching %s or %s", errMinistry, errDepartment)
			continue
		}

		if len(searchedRelationMinistry) > 0 && len(searchedRelationDepartment) > 0 {
			log.Printf("[RTI] multiple parent entities found for RTI: %s", entity.Title)
			continue
		}

		if len(searchedRelationMinistry) == 0 && len(searchedRelationDepartment) == 0 {
			continue
		}

		parentID = result.ID

	}

	if parentID == "" {
		return nil, fmt.Errorf("[RTI] skipping relation update (receiver not found for the given date): %s", entity.Created)
	}

	// make a unique relation ID
	uniqueRelationshipID := uuid.New().String()

	// payload for the parent
	parentEntity := &models.Entity{
		ID: parentID,
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
