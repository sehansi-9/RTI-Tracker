from sqlmodel import Session, select, func
from src.models import RTIStatusResponse, RTIStatusListResponse, RTIStatusRequest, PaginationModel, RTIStatus
from src.core.exceptions import InternalServerException, ConflictException, NotFoundException
from uuid import uuid4
import logging
from uuid import UUID
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

class RTIStatusService:
    """
    This service is responsible for executing all RTI status related operations
    """

    def __init__(self, session: Session):
        self.session = session

    # API
    # create RTI status
    def create_rti_status(self, *, rti_status_request: RTIStatusRequest) -> RTIStatusResponse:
        try:
            # generate a uuid
            unique_id = uuid4()

            # create RTI status
            rti_status = RTIStatus(
                id=unique_id,
                name=rti_status_request.name,
          )

            self.session.add(rti_status)
            self.session.commit()
            self.session.refresh(rti_status)

            return RTIStatusResponse.model_validate(rti_status)

        except IntegrityError as e:
            self._handle_integrity_error(e, "creating RTI status")
        except Exception as e:
            self.session.rollback()
            logger.error(f"[RTI STATUS SERVICE] Error creating RTI status: {e}")
            raise InternalServerException(
                "[RTI STATUS SERVICE] Failed to create RTI status"
            ) from e
    
    # get RTI status list
    def get_rti_status_list(self, *, page: int = 1, page_size: int = 10) -> RTIStatusListResponse:
        try:
            # calculate the offset
            offset = (page - 1) * page_size

            # fetch the records from the table
            statement_records = select(RTIStatus)\
                .order_by(RTIStatus.created_at.desc())\
                .offset(offset)\
                .limit(page_size)
            results = self.session.exec(statement_records).all()
            
            # fetch the total record count
            statement_count = select(func.count()).select_from(RTIStatus)
            total_items = self.session.exec(statement_count).one()

            # pagination response
            pagination = PaginationModel(
                page=page,
                page_size=page_size,
                total_items=total_items,
                total_pages=(total_items + page_size - 1) // page_size if total_items > 0 else 0
            )
            
            # return the final response
            return RTIStatusListResponse(
                data=[RTIStatusResponse.model_validate(r) for r in results],
                pagination=pagination
            )
        except Exception as e:
            logger.error(f"[RTI STATUS SERVICE] Error getting RTI statuses: {e}")
            raise InternalServerException(
                "[RTI STATUS SERVICE] Failed to get RTI statuses"
            ) from e
    
    # get RTI status by id
    def get_rti_status_by_id(self, *, rti_status_id: UUID) -> RTIStatusResponse:
        try:
            # fetch the record from the table
            result = self.session.get(RTIStatus, rti_status_id)

            if result is None:
                raise NotFoundException(f"RTI Status with id {rti_status_id} not found.")

            return RTIStatusResponse.model_validate(result)
        except NotFoundException:
            raise
        except Exception as e:
            logger.error(f"[RTI STATUS SERVICE] Error getting RTI status: {e}")
            raise InternalServerException(
                "[RTI STATUS SERVICE] Failed to get RTI status"
            ) from e
    
    # update RTI status [PUT]
    def update_rti_status_put(self, *, rti_status_id: UUID, rti_status_request: RTIStatusRequest) -> RTIStatusResponse:
        try:
            # fetch the record from the table
            result = self.session.get(RTIStatus, rti_status_id)

            if result is None:
                raise NotFoundException(f"RTI Status with id {rti_status_id} not found.")

            # update(PUT) the record
            result.name = rti_status_request.name

            self.session.add(result)
            self.session.commit()
            self.session.refresh(result)

            return RTIStatusResponse.model_validate(result)
        except IntegrityError as e:
            self._handle_integrity_error(e, "updating RTI status")
        except NotFoundException:
            raise
        except Exception as e:
            self.session.rollback()
            logger.error(f"[RTI STATUS SERVICE] Error updating RTI status: {e}")
            raise InternalServerException(
                "[RTI STATUS SERVICE] Failed to update RTI status"
            ) from e
    
    # delete RTI status
    def delete_rti_status(self, *, rti_status_id: UUID) -> None:
        try:
            # fetch the record from the table
            result = self.session.get(RTIStatus, rti_status_id)

            if result is None:
                raise NotFoundException(f"RTI Status with id {rti_status_id} not found.")

            # delete the record
            self.session.delete(result)
            self.session.commit()

            return None
        except IntegrityError as e:
            self.session.rollback()
            # detect foreign key constraint violation
            logger.error(f"[RTI STATUS SERVICE] Error deleting RTI status: {e}")
            raise ConflictException(
                "Cannot delete RTI status because it is used in some other records"
            ) from e
        except NotFoundException:
            raise
        except Exception as e:
            self.session.rollback()
            logger.error(f"[RTI STATUS SERVICE] Error deleting RTI status: {e}")
            raise InternalServerException(
                "[RTI STATUS SERVICE] Failed to delete RTI status"
            ) from e    
    
    def _handle_integrity_error(self, e: IntegrityError, operation: str) -> None:
        self.session.rollback()
        error_msg = str(e.orig).lower()
        
        # Check for name uniqueness constraint (covers both Postgres and SQLite)
        if "rti_statuses_name_key" in error_msg or "unique constraint failed: rti_statuses.name" in error_msg:
            raise ConflictException("RTI Status name already exists")
        
        # Fallback for other integrity errors
        clean_error = error_msg.replace('\n', ' ').strip()
        logger.error(f"[RTI STATUS SERVICE] Integrity error during {operation}: {clean_error}")
        raise ConflictException(f"Database constraint violation: {clean_error}")

