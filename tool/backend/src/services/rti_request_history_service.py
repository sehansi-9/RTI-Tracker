import os
import logging
from uuid import UUID, uuid4
from sqlmodel import Session, select, func
from src.models import (
    PaginationModel,
    RTIRequestHistoryRequest,
    RTIRequestHistoryUpdateRequest,
)
from src.services.github_file_service import GithubFileService
from src.models.table_schemas.table_schemas import (
    RTIRequest, 
    RTIStatusHistory, 
    RTIStatus
)
from src.models.response_models.rti_request_histories import (
    RTIRequestHistoryResponse,
    RTIRequestHistoryListResponse,
)
from src.core.exceptions import (
    InternalServerException, 
    NotFoundException, 
    BadRequestException,
    ConflictException
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

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
    def get_rti_request_histories_by_id(
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
                select(RTIStatusHistory)
                .where(RTIStatusHistory.rti_request_id == target_id)
                .options(selectinload(RTIStatusHistory.rti_status))
                .order_by(RTIStatusHistory.created_at.desc())
                .offset(offset)
                .limit(page_size)
            )
            results = self.session.exec(statement_records).all()

            # Fetch total count
            statement_count = (
                select(func.count())
                .select_from(RTIStatusHistory)
                .where(RTIStatusHistory.rti_request_id == target_id)
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

    # API
    async def create_rti_request_history(
        self,
        *,
        rti_request_id: UUID,
        request_data: RTIRequestHistoryRequest
    ) -> RTIRequestHistoryResponse:

        committed = False
        uploaded_file_paths: list[str] = []
        try:
            # 1. Validate RTI Request existence
            rti_request = self.session.get(RTIRequest, rti_request_id)
            if not rti_request:
                raise NotFoundException(f"RTI Request with id {rti_request_id} not found.")

            # 2. Validate Status existence
            status = self.session.get(RTIStatus, request_data.status_id)
            if not status:
                raise NotFoundException(f"RTI Status with id {request_data.status_id} not found.")

            # 3. Validate files
            if request_data.files:
                for file in request_data.files:
                    _, ext = os.path.splitext(file.filename)
                    if not ext or ext.lower() not in self.ALLOWED_FILE_TYPES:
                        raise BadRequestException(
                            f"{file.filename} doesn't have a valid extension ({', '.join(self.ALLOWED_FILE_TYPES)})"
                        )

            unique_history_id = uuid4()
            
            # 4. Upload files to GitHub
            if request_data.files:
                for i, file in enumerate(request_data.files):
                    _, ext = os.path.splitext(file.filename)
                    file_path = f"rti-requests/{rti_request_id}/histories/{unique_history_id}/{unique_history_id}_{i}{ext.lower()}"
                    
                    content = await file.read()
                    response = await self.file_service.create_file(
                        file_path=file_path,
                        content=content,
                        message=f"Upload file for RTI Request History {unique_history_id}_{i}{ext.lower()}"
                    )
                    
                    relative_path = response.get("relative_path", "")
                    if not relative_path:
                        # If service returned success but no path, attempt immediate cleanup of the target path
                        await self.file_service.delete_file(file_path=file_path)
                        raise InternalServerException("[RTI HISTORY SERVICE] Invalid path response from file service")
                    
                    uploaded_file_paths.append(relative_path)
                    

            # 5. Insert RTIStatusHistory
            status_history = RTIStatusHistory(
                id=unique_history_id,
                rti_request_id=rti_request_id,
                status_id=request_data.status_id,
                direction=request_data.direction,
                description=request_data.description,
                entry_time=request_data.entry_time,
                exit_time=request_data.exit_time,
                files=uploaded_file_paths
            )
            self.session.add(status_history)
            self.session.commit()
            committed = True
            self.session.refresh(status_history)

            return RTIRequestHistoryResponse.model_validate(status_history)

        except (BadRequestException, NotFoundException, ConflictException, InternalServerException):
            raise
        except Exception as e:
            if not committed:
                self.session.rollback()
                # Compensating transaction: remove uploaded files from GitHub
                for file_path in uploaded_file_paths:
                    try:
                        await self.file_service.delete_file(file_path=file_path)
                    except Exception as ex:
                        logger.error(f"[RTI HISTORY SERVICE] Rollback failed - could not delete {file_path}: {ex}")

            if isinstance(e, IntegrityError):
                logger.error(f"[RTI HISTORY SERVICE] Integrity error creating history: {e}")
                raise ConflictException("Database integrity error occurred while creating the RTI Request History.") from e

            logger.error(f"[RTI HISTORY SERVICE] Error creating history for RTI Request {rti_request_id}: {e}")
            raise InternalServerException(f"Failed to create RTI request history.") from e

    # API
    async def update_rti_request_history(
        self,
        *,
        rti_request_id: UUID,
        request_data: RTIRequestHistoryUpdateRequest
    ) -> RTIRequestHistoryResponse:
        """Updates an existing RTI Status History record."""
        committed = False
        uploaded_file_paths: list[str] = []
        try:
            target_id = request_data.id
            history = self.session.get(RTIStatusHistory, target_id)
            if not history:
                raise NotFoundException(f"RTI Request History with id {target_id} not found.")

            # Validation: Ensure the history record belongs to the specified RTI Request
            if history.rti_request_id != rti_request_id:
                raise BadRequestException(f"History record {target_id} does not belong to RTI Request {rti_request_id}")

            # Validate Status existence if provided
            if request_data.status_id is not None:
                status = self.session.get(RTIStatus, request_data.status_id)
                if not status:
                    raise NotFoundException(f"RTI Status with id {request_data.status_id} not found.")
                history.status_id = request_data.status_id

            # Update other fields if provided
            if request_data.direction is not None:
                history.direction = request_data.direction
            if request_data.description is not None:
                history.description = request_data.description
            if request_data.entry_time is not None:
                history.entry_time = request_data.entry_time
            if request_data.exit_time is not None:
                history.exit_time = request_data.exit_time

            # Create a NEW list instance so SQLAlchemy detects the change to the JSON column
            current_files = list(history.files) if history.files else []

            # 1. Handle file deletions (from database list)
            if request_data.files_to_delete:
                for file_path in request_data.files_to_delete:
                    if file_path in current_files:
                        current_files.remove(file_path)
                    else:
                        logger.warning(f"[RTI HISTORY SERVICE] File {file_path} not found in history record {target_id}")

            # 2. Handle new file uploads
            if request_data.files_to_add:
                # Validate extensions
                for file in request_data.files_to_add:
                    _, ext = os.path.splitext(file.filename)
                    if not ext or ext.lower() not in self.ALLOWED_FILE_TYPES:
                        raise BadRequestException(
                            f"{file.filename} doesn't have a valid extension ({', '.join(self.ALLOWED_FILE_TYPES)})"
                        )
                
                # Upload new files
                base_idx = len(history.files) if history.files else 0
                for i, file in enumerate(request_data.files_to_add):
                    _, ext = os.path.splitext(file.filename)
                    file_path = f"rti-requests/{history.rti_request_id}/histories/{target_id}/{target_id}_{base_idx + i}{ext.lower()}"
                    
                    content = await file.read()
                    response = await self.file_service.create_file(
                        file_path=file_path,
                        content=content,
                        message=f"Upload additional file for RTI Request History {target_id}"
                    )
                    
                    relative_path = response.get("relative_path", "")
                    if not relative_path:
                        # Attempt immediate cleanup of the target path if response is invalid
                        await self.file_service.delete_file(file_path=file_path)
                        raise InternalServerException("[RTI HISTORY SERVICE] Invalid path response from file service")
                    
                    uploaded_file_paths.append(relative_path)
                    current_files.append(relative_path)

            history.files = current_files
            self.session.add(history)
            self.session.commit()
            committed = True

            # 3. Handle physical file deletions from GitHub after successful commit
            if request_data.files_to_delete:
                for file_path in request_data.files_to_delete:
                    try:
                        await self.file_service.delete_file(file_path=file_path)
                    except Exception as ex:
                        # Log but don't fail, as the DB is already updated
                        logger.error(f"[RTI HISTORY SERVICE] Failed to delete orphaned file {file_path} from GitHub: {ex}")

            self.session.refresh(history)
            return RTIRequestHistoryResponse.model_validate(history)

        except (BadRequestException, NotFoundException, ConflictException, InternalServerException):
            raise
        except Exception as e:
            if not committed:
                self.session.rollback()
                # Clean up newly uploaded files if DB update failed
                for file_path in uploaded_file_paths:
                    try:
                        await self.file_service.delete_file(file_path=file_path)
                    except Exception as ex:
                        logger.error(f"[RTI HISTORY SERVICE] Rollback failed - could not delete {file_path}: {ex}")

            if isinstance(e, IntegrityError):
                logger.error(f"[RTI HISTORY SERVICE] Integrity error updating history: {e}")
                raise ConflictException("Database integrity error occurred while updating the RTI Request History.") from e

            logger.error(f"[RTI HISTORY SERVICE] Error updating history {request_data.id}: {e}")
            raise InternalServerException(f"Failed to update RTI request history: {e}") from e

    # API
    async def delete_rti_request_history(
        self,
        *,
        rti_request_id: UUID,
        history_id: UUID
    ) -> None:
        """Deletes an RTI Status History record and its associated files."""
        committed = False
        files_to_delete: list[str] = []
        try:
            history = self.session.get(RTIStatusHistory, history_id)
            if not history:
                raise NotFoundException(f"RTI Request History with id {history_id} not found.")

            # Validation: Ensure the history record belongs to the specified RTI Request
            if history.rti_request_id != rti_request_id:
                raise BadRequestException(f"History record {history_id} does not belong to RTI Request {rti_request_id}")

            files_to_delete = list(history.files) if history.files else []

            self.session.delete(history)
            self.session.commit()
            committed = True

            # Physically delete files from GitHub after successful DB commit
            if files_to_delete:
                for file_path in files_to_delete:
                    try:
                        await self.file_service.delete_file(file_path=file_path)
                    except Exception as ex:
                        # Log but don't fail, as the DB record is already gone
                        logger.error(f"[RTI HISTORY SERVICE] Failed to delete orphaned file {file_path} from GitHub during record deletion: {ex}")

        except (BadRequestException, NotFoundException, InternalServerException):
            raise
        except Exception as e:
            if not committed:
                self.session.rollback()

            logger.error(f"[RTI HISTORY SERVICE] Error deleting history {history_id}: {e}")
            raise InternalServerException(f"Failed to delete RTI request history: {e}") from e

