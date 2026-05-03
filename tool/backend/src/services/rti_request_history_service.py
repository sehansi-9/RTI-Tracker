import logging
from uuid import UUID
from sqlmodel import Session, select, func
from src.models import PaginationModel
from src.services.github_file_service import GithubFileService
from src.models.table_schemas.table_schemas import RTIRequest, RTIStatusHistories
from src.models.response_models.rti_request_histories import (
    RTIRequestHistoryResponse,
    RTIRequestHistoryListResponse,
)
from src.core.exceptions import InternalServerException, NotFoundException, BadRequestException

logger = logging.getLogger(__name__)

class RTIRequestHistoryService:
    """
    This service is responsible for executing all RTI request history operations.
    """

    ALLOWED_FILE_TYPES = [".pdf"]

    def __init__(self, session: Session, file_service: GithubFileService):
        self.session = session
        self.file_service = file_service

    # API
    def get_rti_request_histories(
        self,
        *,
        rti_request_id: UUID,
        page: int = 1,
        page_size: int = 10,
    ) -> RTIRequestHistoryListResponse:
        try:
            # Validate that the parent RTI Request exists
            try:
                target_id = UUID(str(rti_request_id))
            except ValueError:
                raise BadRequestException(f"Invalid UUID format: {rti_request_id}")

            rti_request = self.session.get(RTIRequest, target_id)
            if not rti_request:
                raise NotFoundException(f"RTI Request with id {rti_request_id} not found.")

            offset = (page - 1) * page_size

            # Fetch paginated history records ordered by created_at descending
            statement_records = (
                select(RTIStatusHistories)
                .where(RTIStatusHistories.rti_request_id == target_id)
                .order_by(RTIStatusHistories.created_at.desc())
                .offset(offset)
                .limit(page_size)
            )
            results = self.session.exec(statement_records).all()

            # Fetch total count
            statement_count = (
                select(func.count())
                .select_from(RTIStatusHistories)
                .where(RTIStatusHistories.rti_request_id == target_id)
            )
            total_items = self.session.exec(statement_count).one()

            pagination = PaginationModel(
                page=page,
                page_size=page_size,
                total_items=total_items,
                total_pages=(total_items + page_size - 1) // page_size if total_items > 0 else 0,
            )

            return RTIRequestHistoryListResponse(
                data=[RTIRequestHistoryResponse.model_validate(r) for r in results],
                pagination=pagination,
            )

        except (BadRequestException, NotFoundException):
            raise
        except Exception as e:
            logger.error(f"[RTI HISTORY SERVICE] Error fetching histories for RTI Request {rti_request_id}: {e}")
            raise InternalServerException(
                "Failed to fetch RTI request histories from database."
            ) from e