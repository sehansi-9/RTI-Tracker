package core

import (
	"fmt"
	"log"
	"strings"

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

// InsertTRIEntity calls the ingestion service to create an RTIEntity.
func (s *RTIService) InsertRTIRequest(RTIEntity *models.RTIRequest) (*models.Entity, error) {

	// validate input
	if err := RTIEntity.Validate(); err != nil {
		return nil, fmt.Errorf("invalid payload: %w", err)
	}

	// 1. Verify the receiver exists or not
	searchCriteria := &models.SearchCriteria{
		Name: RTIEntity.ReceiverInstitution,
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
		if strings.EqualFold(value.Name, RTIEntity.ReceiverInstitution) {
			filteredSearchResult = append(filteredSearchResult, value)
		}
	}

	var parentID string

	// relation search criteria
	relationSearchCriteriaMinistry := models.Relationship{
		Direction: "INCOMING",
		ActiveAt:  RTIEntity.Created,
		Name:      "AS_MINISTER",
	}

	// relation search criteria
	relationSearchCriteriaDepartment := models.Relationship{
		Direction: "INCOMING",
		ActiveAt:  RTIEntity.Created,
		Name:      "AS_DEPARTMENT",
	}

	// iterate through the filtered search result to find the active entity
	for _, result := range filteredSearchResult {

		var minorKind string = result.Kind.Minor

		if minorKind == "cabinetMinister" || minorKind == "stateMinister" {
			searchedRelationMinistry, err := s.readClient.GetRelatedEntities(result.ID, &relationSearchCriteriaMinistry)

			if err != nil {
				log.Printf("[RTI] error fetching active cabinet or state minister relations %s", err)
			}

			if len(searchedRelationMinistry) > 1 {
				log.Printf("[RTI] multiple active relationships found for %s on %s", result.ID, RTIEntity.Created)
			} else if len(searchedRelationMinistry) == 1 {
				parentID = result.ID
				break
			}

		} else if minorKind == "department" {
			searchedRelationDepartment, err := s.readClient.GetRelatedEntities(result.ID, &relationSearchCriteriaDepartment)

			if err != nil {
				log.Printf("[RTI] error fetching active department relations %s", err)
			}

			if len(searchedRelationDepartment) > 1 {
				log.Printf("[RTI] multiple active relationships found for %s on %s", result.ID, RTIEntity.Created)
			} else if len(searchedRelationDepartment) == 1 {
				parentID = result.ID
				break
			}
		}

	}

	if parentID == "" {
		return nil, fmt.Errorf("[RTI] skipping RTI creation (receiver not found for the given date): %s, receiver: %s", RTIEntity.Created, RTIEntity.ReceiverInstitution)
	}

	// 2. Insert the RTI Entity to Graph
	// Create a deterministic UUID so rerunning the script on the same data doesn't duplicate nodes
	hashInput := fmt.Sprintf("%s_%s", RTIEntity.Created, RTIEntity.Index)
	id := uuid.NewMD5(uuid.NameSpaceOID, []byte(hashInput))
	rtiId := "rti_" + id.String()

	// RTI payload
	rtiEntity := &models.Entity{
		ID:      rtiId,
		Created: RTIEntity.Created,
		Kind: models.Kind{
			Major: "Document",
			Minor: "rti",
		},
		Name: models.TimeBasedValue{
			StartTime: RTIEntity.Created,
			Value:     RTIEntity.Title,
		},
	}

	// Call the generic interface's method
	createdEntity, err := s.ingestionClient.CreateEntity(rtiEntity)
	if err != nil {
		return nil, fmt.Errorf("failed to create RTI: %w", err)
	}

	// 3. Make the relation to the receiver
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
					StartTime:       RTIEntity.Created,
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
