import os
import re
import logging
from uuid import UUID, uuid4
from typing import Dict
from sqlalchemy.exc import IntegrityError
from sqlmodel import select, Session, func
from src.models import PaginationModel
from src.services.github_file_service import GithubFileService
from src.models.table_schemas.table_schemas import RTIRequest, RTIStatus, RTIStatusHistories, RTIDirection, Receiver
from src.models.response_models.rti_requests import RTIRequestResponse, RTIRequestListResponse
from src.models.request_models.rti_requests import RTIRequestRequest, RTIRequestUpdateRequest
from src.core.exceptions import InternalServerException, BadRequestException, NotFoundException, ConflictException
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class RTIRequestService:
    """
    This service is responsible for executing all RTI request operations.
    """

    def __init__(self, session: Session, file_service: GithubFileService):
        self.session = session
        self.file_service = file_service

    async def create_rti_request(
        self,
        *,
        request_data: RTIRequestRequest
    ) -> RTIRequestResponse:
        try:
            unique_id = uuid4()
            uploaded_file_path: str | None = None

            # 1. validate file extension
            if not request_data.file:
                raise BadRequestException("RTI Request file is required")

            _, ext = os.path.splitext(request_data.file.filename)
            if not ext or ext.lower() not in [".pdf"]:
                raise BadRequestException(f"{request_data.file.filename} doesn't have a valid extension (.pdf)")
    
            file_path = f"rti-requests/{unique_id}/{unique_id}{ext.lower()}"

            # 2. Upload file
            content = await request_data.file.read()
            response = await self.file_service.create_file(
                file_path=file_path,
                content=content,
                message=f"Upload file for RTI Request {unique_id}"
            )

            relative_path = response.get("relative_path", "")
            if not relative_path:
                raise InternalServerException("[RTI SERVICE] Invalid path response from file service")

            uploaded_file_path = relative_path

            # 3. Insert RTIRequest
            rti_request = RTIRequest(
                id=unique_id,
                title=request_data.title,
                description=request_data.description,
                sender_id=request_data.sender_id,
                receiver_id=request_data.receiver_id,
                rti_template_id=request_data.rti_template_id
            )
            self.session.add(rti_request)

            # 4. Insert RTIStatusHistories
            statement = select(RTIStatus).where(RTIStatus.name == "CREATED")
            created_status = self.session.exec(statement).first()

            if not created_status:
                raise InternalServerException("Status 'CREATED' not found in database.")

            status_history = RTIStatusHistories(
                id=uuid4(),
                rti_request_id=unique_id,
                status_id=created_status.id,
                direction=RTIDirection.sent,
                description="RTI Request Created",
                entry_time=datetime.now(timezone.utc),
                files=[relative_path]
            )
            self.session.add(status_history)

            self.session.commit()
            self.session.refresh(rti_request)

            return RTIRequestResponse.model_validate(rti_request)

        except (BadRequestException, NotFoundException, ConflictException, InternalServerException):
            raise
        except Exception as e:
            self.session.rollback()
            # remove the orphaned file from GitHub if the DB commit failed
            if uploaded_file_path:
                try:
                    await self.file_service.delete_file(file_path=uploaded_file_path)
                except Exception as ex:
                    logger.error(f"[RTI SERVICE] Compensating transaction failed — could not delete {uploaded_file_path}: {ex}")

            if isinstance(e, IntegrityError):
                logger.error(f"[RTI SERVICE] Integrity error creating RTI request: {e}")
                raise ConflictException("Database integrity error occurred while creating the RTI Request.") from e

            logger.error(f"[RTI SERVICE] Error creating RTI request: {e}")
            raise InternalServerException(f"Failed to create RTI request: {e}") from e

    # API
    def get_rti_requests(
        self,
        *,
        page: int = 1,
        page_size: int = 10
    ) -> RTIRequestListResponse:
        """Fetches a paginated list of RTI Requests."""
        try:
            offset = (page - 1) * page_size

            # fetch the records from the table
            statement_records = select(RTIRequest).offset(offset).limit(page_size)
            results = self.session.exec(statement_records).all()
            
            # fetch the total record count
            statement_count = select(func.count()).select_from(RTIRequest)
            total_items = self.session.exec(statement_count).one()

            # pagination response
            pagination = PaginationModel(
                page=page,
                pageSize=page_size,
                totalItem=total_items,
                totalPages=(total_items + page_size - 1) // page_size if total_items > 0 else 0
            )
            
            # return the final response
            return RTIRequestListResponse(
                data=[RTIRequestResponse.model_validate(r) for r in results],
                pagination=pagination
            )
        except Exception as e:
            logger.error(f"Error fetching RTI requests: {e}")
            raise InternalServerException("Failed to fetch RTI requests from database.") from e

    # API
    def get_rti_request_by_id(
        self,
        *,
        request_id
    ) -> RTIRequestResponse:
        """Fetches a single RTI Request by its ID."""
        try:
            try:
                target_id = UUID(request_id) if isinstance(request_id, str) else request_id
            except ValueError:
                raise BadRequestException(f"Invalid UUID format: {request_id}")

            rti_request = self.session.get(RTIRequest, target_id)

            if not rti_request:
                raise NotFoundException(f"RTI Request with id {request_id} not found.")

            return RTIRequestResponse.model_validate(rti_request)

        except (BadRequestException, NotFoundException):
            raise
        except Exception as e:
            logger.error(f"[RTI SERVICE] Error reading RTI request: {e}")
            raise InternalServerException(f"Failed to read RTI request: {e}") from e

    # API
    async def update_rti_request(
        self,
        *,
        request_data: RTIRequestUpdateRequest
    ) -> RTIRequestResponse:
        """Updates an existing RTI Request."""
        try:
            try:
                target_id = UUID(request_data.id) if isinstance(request_data.id, str) else request_data.id
            except ValueError:
                raise BadRequestException(f"Invalid UUID format: {request_data.id}")

            rti_request = self.session.get(RTIRequest, target_id)
            if not rti_request:
                raise NotFoundException(f"RTI Request with id {request_data.id} not found.")

            old_file_data: Dict | None = None
            old_file_path: str | None = None
            new_file_path: str | None = None

            # 1. Update file if provided
            if request_data.file:
                _, ext = os.path.splitext(request_data.file.filename)
                if not ext or ext.lower() not in [".pdf"]:
                    raise BadRequestException(f"{request_data.file.filename} doesn't have a valid extension (.pdf)")

                # Find the 'CREATED' status history to get the current file path
                status_statement = select(RTIStatus).where(RTIStatus.name == "CREATED")
                created_status = self.session.exec(status_statement).first()

                if not created_status:
                    raise InternalServerException("Status 'CREATED' not found in database.")

                history_statement = select(RTIStatusHistories).where(
                    RTIStatusHistories.rti_request_id == target_id,
                    RTIStatusHistories.status_id == created_status.id
                )
                status_history = self.session.exec(history_statement).first()

                if not status_history or not status_history.files:
                    raise InternalServerException("Initial file record not found for this RTI Request.")

                old_file_path = status_history.files[0]
                content = await request_data.file.read()

                # If extension is same, update in place. If different, create new & delete old.
                _, old_ext = os.path.splitext(old_file_path)
                
                if ext.lower() == old_ext.lower():
                    # Same extension: Update existing file
                    old_file_data = await self.file_service.read_file(old_file_path)
                    response = await self.file_service.update_file(
                        file_path=old_file_path,
                        content=content,
                        sha=old_file_data["sha"],
                        message=f"Update content for RTI Request {target_id}"
                    )
                else:
                    # Different extension: Create new, will delete old on success
                    new_file_path = f"rti-requests/{target_id}/{target_id}{ext.lower()}"
                    response = await self.file_service.create_file(
                        file_path=new_file_path,
                        content=content,
                        message=f"Update file (new extension) for RTI Request {target_id}"
                    )
                    status_history.files = [new_file_path]
                    self.session.add(status_history)

            # 2. Update other fields
            update_data = request_data.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                if key not in ["id", "file"] and hasattr(rti_request, key):
                    setattr(rti_request, key, value)

            self.session.add(rti_request)
            self.session.commit()
            
            # If extension changed and commit succeeded, delete the old file
            if new_file_path and old_file_path:
                await self.file_service.delete_file(file_path=old_file_path)

            self.session.refresh(rti_request)
            return RTIRequestResponse.model_validate(rti_request)

        except (BadRequestException, NotFoundException, ConflictException, InternalServerException):
            raise
        except Exception as e:
            self.session.rollback()
            
            # Compensating transactions for file updates
            if old_file_data and old_file_path:
                # Restore old version
                try:
                    current_file_data = await self.file_service.read_file(old_file_path)
                    await self.file_service.update_file(
                        file_path=old_file_path,
                        content=old_file_data["content"],
                        sha=current_file_data["sha"],
                        message=f"Rollback: restore previous version for {target_id}"
                    )
                except Exception as ex:
                    logger.error(f"[RTI SERVICE] Rollback failed (restore old): {ex}")
            elif new_file_path:
                # Delete newly created file
                try:
                    await self.file_service.delete_file(file_path=new_file_path)
                except Exception as ex:
                    logger.error(f"[RTI SERVICE] Rollback failed (delete new): {ex}")

            if isinstance(e, IntegrityError):
                logger.error(f"[RTI SERVICE] Integrity error updating RTI request: {e}")
                raise ConflictException("Database integrity error occurred while updating the RTI Request.") from e

            logger.error(f"[RTI SERVICE] Error updating RTI request: {e}")
            raise InternalServerException(f"Failed to update RTI request: {e}") from e
    
            
