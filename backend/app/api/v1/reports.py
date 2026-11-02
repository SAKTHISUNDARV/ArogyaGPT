"""
ArogyaGPT - Reports API Router
Medical report upload, retrieval, and management endpoints.
"""

import uuid
import hashlib
import base64
import re
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, Query, UploadFile, status, BackgroundTasks
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.constants import APIMessage, ReportStatus, PipelineStage
from app.core.dependencies import VerifiedUser, DBSession, Cache
from app.core.exceptions import (
    UnsupportedFileTypeError,
    FileTooLargeError,
    ReportNotFoundError,
    ValidationError,
)
from app.models.report import Report, ReportFile
from app.schemas.base import PaginatedResponse, SuccessResponse
from app.schemas.report import (
    ReportDetailResponse,
    ReportSummaryResponse,
    ReportUploadMetadata,
    CameraUploadRequest,
    MedicalTermExplanationRequest,
)
from app.core.logging import get_logger
from app.services.llm_service import LLMService
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

logger = get_logger(__name__)

router = APIRouter(prefix="/reports", tags=["Medical Reports"])

ALLOWED_EXTENSIONS = set(settings.ALLOWED_FILE_TYPES)
UPLOAD_DIR = Path(settings.UPLOAD_DIR)


def _validate_file(file: UploadFile) -> str:
    """Validate uploaded file type and size. Returns the file extension."""
    if not file.filename:
        raise UnsupportedFileTypeError("unknown", list(ALLOWED_EXTENSIONS))

    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise UnsupportedFileTypeError(ext, list(ALLOWED_EXTENSIONS))

    # Check content-type as well
    allowed_mimes = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
    }

    return ext


async def _save_file(
    file: UploadFile, user_id: str, content: bytes
) -> tuple[str, str, int, str]:
    """
    Save uploaded file to local storage.

    Returns:
        (stored_filename, file_path, file_size_bytes, md5_checksum)
    """
    user_dir = UPLOAD_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    stored_filename = f"{uuid.uuid4()}.{file.filename.rsplit('.', 1)[-1].lower()}"
    file_path = user_dir / stored_filename

    # Validate size
    if len(content) > settings.MAX_FILE_SIZE_BYTES:
        raise FileTooLargeError(settings.MAX_UPLOAD_SIZE_MB)

    # Write to disk
    with open(file_path, "wb") as f:
        f.write(content)

    # Compute checksum
    md5 = hashlib.md5(content).hexdigest()

    return stored_filename, str(file_path), len(content), md5


# ==============================================================================
# POST /api/v1/reports/upload
# ==============================================================================

@router.post(
    "/upload",
    response_model=SuccessResponse[ReportSummaryResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a medical report",
    description=(
        "Upload a PDF or image medical report. Triggers async OCR and AI processing pipeline. "
        "Supported formats: PDF, PNG, JPG, JPEG. Maximum size: 20 MB."
    ),
)
async def upload_report(
    current_user: VerifiedUser,
    db: DBSession,
    redis: Cache,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Medical report file (PDF/PNG/JPG/JPEG)"),
    title: str = Form(..., min_length=1, max_length=500),
    description: Optional[str] = Form(default=None),
    report_type: Optional[str] = Form(default=None),
    hospital_name: Optional[str] = Form(default=None),
    doctor_name: Optional[str] = Form(default=None),
    preferred_language: Optional[str] = Form(default=None),
) -> SuccessResponse[ReportSummaryResponse]:
    # Validate file
    ext = _validate_file(file)

    # Read once so the checksum can be checked before a file or report row is
    # created.  This makes retries/double-clicks idempotent for each user.
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_BYTES:
        raise FileTooLargeError(settings.MAX_UPLOAD_SIZE_MB)
    checksum = hashlib.md5(content).hexdigest()

    duplicate_result = await db.execute(
        select(Report)
        .join(ReportFile, ReportFile.report_id == Report.id)
        .where(
            Report.user_id == current_user.id,
            Report.is_deleted == False,
            ReportFile.checksum_md5 == checksum,
        )
        .order_by(Report.created_at.desc())
    )
    existing_report = duplicate_result.scalars().first()
    if existing_report:
        logger.info(
            f"Duplicate report upload ignored: id={existing_report.id} | "
            f"user={current_user.email} | file={file.filename}"
        )
        return SuccessResponse(
            message="This report was already uploaded. Opening the existing report.",
            data=ReportSummaryResponse(
                id=existing_report.id,
                title=existing_report.title,
                report_type=existing_report.report_type,
                status=existing_report.status,
                pipeline_stage=existing_report.pipeline_stage,
                risk_level=existing_report.risk_level,
                hospital_name=existing_report.hospital_name,
                report_date=existing_report.report_date,
                version=existing_report.version,
                created_at=existing_report.created_at,
                updated_at=existing_report.updated_at,
                file_count=1,
            ),
            status=status.HTTP_200_OK,
        )

    # Save to disk
    stored_filename, file_path, file_size, md5 = await _save_file(
        file, current_user.id, content
    )

    # Create report record
    report_id = str(uuid.uuid4())
    report = Report(
        id=report_id,
        user_id=current_user.id,
        title=title,
        description=description,
        report_type=report_type,
        hospital_name=hospital_name,
        doctor_name=doctor_name,
        status=ReportStatus.PENDING.value,
        pipeline_stage=PipelineStage.UPLOADED.value,
    )
    db.add(report)
    await db.flush()

    # Create file record
    mime_map = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}
    report_file = ReportFile(
        id=str(uuid.uuid4()),
        report_id=report.id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_path=file_path,
        file_type=ext,
        file_size_bytes=file_size,
        mime_type=mime_map.get(ext, "application/octet-stream"),
        checksum_md5=md5,
        is_primary=True,
    )
    db.add(report_file)
    await db.flush()

    # Dispatch background AI processing immediately via FastAPI BackgroundTasks
    from app.workers.tasks import _pipeline_async
    background_tasks.add_task(
        _pipeline_async,
        report.id,
        file_path,
        current_user.id,
        preferred_language or current_user.preferred_language or "en",
    )

    logger.info(
        f"Report uploaded: id={report.id} | user={current_user.email} | "
        f"file={file.filename} | size={file_size}B"
    )

    summary = ReportSummaryResponse(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        status=report.status,
        pipeline_stage=report.pipeline_stage,
        risk_level=None,
        hospital_name=report.hospital_name,
        report_date=report.report_date,
        version=report.version,
        created_at=report.created_at,
        updated_at=report.updated_at,
        file_count=1,
    )

    return SuccessResponse(
        message=APIMessage.REPORT_UPLOADED,
        data=summary,
        status=201,
    )


# ==============================================================================
# POST /api/v1/reports/upload-camera
# ==============================================================================

@router.post(
    "/upload-camera",
    response_model=SuccessResponse[ReportSummaryResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a report via direct camera capture (Base64)",
    description=(
        "Accepts a Base64-encoded image captured directly from a device camera (webcam, smartphone camera). "
        "Decodes, validates, saves the image, and initiates the automated OCR & AI pipeline."
    ),
)
async def upload_camera_report(
    payload: CameraUploadRequest,
    current_user: VerifiedUser,
    db: DBSession,
    background_tasks: BackgroundTasks,
) -> SuccessResponse[ReportSummaryResponse]:
    # Extract Base64 string
    base64_str = payload.image_base64.strip()

    # Detect data URI format prefix (e.g. data:image/jpeg;base64,...)
    mime_type = "image/jpeg"
    ext = "jpg"

    if "," in base64_str:
        header, base64_str = base64_str.split(",", 1)
        match = re.search(r"data:(image/\w+);base64", header)
        if match:
            mime_type = match.group(1)
            ext = mime_type.split("/")[-1].replace("jpeg", "jpg")

    try:
        content = base64.b64decode(base64_str)
    except Exception as e:
        raise ValidationError(f"Invalid Base64 image payload: {e}")

    # Size check
    if len(content) > settings.MAX_FILE_SIZE_BYTES:
        raise FileTooLargeError(settings.MAX_UPLOAD_SIZE_MB)

    # Save image to user directory
    user_dir = UPLOAD_DIR / current_user.id
    user_dir.mkdir(parents=True, exist_ok=True)

    stored_filename = f"camera_{uuid.uuid4()}.{ext}"
    file_path = user_dir / stored_filename

    with open(file_path, "wb") as f:
        f.write(content)

    md5 = hashlib.md5(content).hexdigest()

    # Create report record
    report_id = str(uuid.uuid4())
    report = Report(
        id=report_id,
        user_id=current_user.id,
        title=payload.title,
        description=payload.description or "Captured via device camera",
        report_type=payload.report_type or "prescription",
        hospital_name=payload.hospital_name,
        doctor_name=payload.doctor_name,
        status=ReportStatus.PENDING.value,
        pipeline_stage=PipelineStage.UPLOADED.value,
    )
    db.add(report)
    await db.flush()

    # Create file record
    report_file = ReportFile(
        id=str(uuid.uuid4()),
        report_id=report.id,
        original_filename=f"camera_capture.{ext}",
        stored_filename=stored_filename,
        file_path=str(file_path),
        file_type=ext,
        file_size_bytes=len(content),
        mime_type=mime_type,
        checksum_md5=md5,
        is_primary=True,
    )
    db.add(report_file)
    await db.flush()

    # Dispatch background AI processing immediately via FastAPI BackgroundTasks
    from app.workers.tasks import _pipeline_async
    background_tasks.add_task(
        _pipeline_async,
        report.id,
        str(file_path),
        current_user.id,
        payload.preferred_language or current_user.preferred_language or "en",
    )

    logger.info(f"Camera report uploaded: id={report.id} | user={current_user.email} | size={len(content)}B")

    summary = ReportSummaryResponse(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        status=report.status,
        pipeline_stage=report.pipeline_stage,
        risk_level=None,
        hospital_name=report.hospital_name,
        report_date=report.report_date,
        version=report.version,
        created_at=report.created_at,
        updated_at=report.updated_at,
        file_count=1,
    )

    return SuccessResponse(
        message="Camera report image uploaded successfully. AI processing initiated.",
        data=summary,
        status=201,
    )


# ==============================================================================
# GET /api/v1/reports/
# ==============================================================================

@router.get(
    "/",
    response_model=PaginatedResponse[ReportSummaryResponse],
    status_code=status.HTTP_200_OK,
    summary="List all reports for the current user",
    description="Paginated list of all uploaded reports with filtering and sorting.",
)
async def list_reports(
    current_user: VerifiedUser,
    db: DBSession,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    report_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
) -> PaginatedResponse[ReportSummaryResponse]:
    offset = (page - 1) * per_page

    # Build query
    query = select(Report).where(
        Report.user_id == current_user.id,
        Report.is_deleted == False,
    )

    if status_filter:
        query = query.where(Report.status == status_filter)
    if report_type:
        query = query.where(Report.report_type == report_type)
    if search:
        query = query.where(Report.title.ilike(f"%{search}%"))

    # Sort
    sort_col = getattr(Report, sort_by, Report.created_at)
    if sort_order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginated results
    result = await db.execute(
        query.options(selectinload(Report.files)).offset(offset).limit(per_page)
    )
    reports = result.scalars().all()

    items = [
        ReportSummaryResponse(
            id=r.id,
            title=r.title,
            report_type=r.report_type,
            status=r.status,
            pipeline_stage=r.pipeline_stage,
            risk_level=r.risk_level,
            hospital_name=r.hospital_name,
            report_date=r.report_date,
            version=r.version,
            created_at=r.created_at,
            updated_at=r.updated_at,
            file_count=len(r.files),
        )
        for r in reports
    ]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        message=APIMessage.REPORTS_LISTED,
    )


# ==============================================================================
# GET /api/v1/reports/{report_id}
# ==============================================================================

@router.get(
    "/{report_id}",
    response_model=SuccessResponse[ReportDetailResponse],
    status_code=status.HTTP_200_OK,
    summary="Get full report details with AI results",
)
async def get_report(
    report_id: str,
    current_user: VerifiedUser,
    db: DBSession,
) -> SuccessResponse[ReportDetailResponse]:
    result = await db.execute(
        select(Report)
        .where(Report.id == report_id, Report.user_id == current_user.id, Report.is_deleted == False)
        .options(
            selectinload(Report.files),
            selectinload(Report.abnormalities),
            selectinload(Report.diagnoses),
            selectinload(Report.medicines),
            selectinload(Report.lab_results),
            selectinload(Report.translations),
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise ReportNotFoundError(identifier=report_id)

    return SuccessResponse(
        message=APIMessage.REPORT_FETCHED,
        data=ReportDetailResponse.model_validate(report),
    )


# ==============================================================================
# POST /api/v1/reports/{report_id}/explain
# ==============================================================================

@router.post(
    "/{report_id}/explain",
    response_model=SuccessResponse[str],
    status_code=status.HTTP_200_OK,
    summary="Explain a medical term from a report",
    description="Generate a short explanation in the selected language using Groq.",
)
async def explain_report_term(
    report_id: str,
    payload: MedicalTermExplanationRequest,
    current_user: VerifiedUser,
    db: DBSession,
) -> SuccessResponse[str]:
    explanation = await LLMService().explain_medical_term(
        term=payload.term,
        language=payload.language_code,
    )
    return SuccessResponse(
        message="Medical term explanation generated successfully.",
        data=explanation,
    )


# DELETE /api/v1/reports/{report_id}

@router.delete(
    "/{report_id}",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a report",
)
async def delete_report(
    report_id: str,
    current_user: VerifiedUser,
    db: DBSession,
) -> SuccessResponse:
    from datetime import datetime, timezone

    result = await db.execute(
        select(Report).where(
            Report.id == report_id,
            Report.user_id == current_user.id,
            Report.is_deleted == False,
        )
    )
    report = result.scalar_one_or_none()
    if not report:
        raise ReportNotFoundError(identifier=report_id)

    report.is_deleted = True
    report.deleted_at = datetime.now(timezone.utc)

    logger.info(f"Report soft-deleted: id={report_id} | user={current_user.email}")

    return SuccessResponse(message=APIMessage.REPORT_DELETED)
