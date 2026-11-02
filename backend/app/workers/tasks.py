"""
ArogyaGPT - Celery Task Definitions
All asynchronous background tasks for AI pipeline processing.
"""

import asyncio
from typing import Optional

from celery import shared_task
from celery.utils.log import get_task_logger

from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)


def _run_async(coro):
    """Run an async coroutine in a Celery task (sync context)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ==============================================================================
# Report Processing Pipeline Task
# ==============================================================================

@celery_app.task(
    bind=True,
    name="app.workers.tasks.process_report_task",
    max_retries=3,
    default_retry_delay=30,
    queue="reports",
)
def process_report_task(
    self,
    report_id: str,
    file_path: str,
    user_id: str,
    language: str = "en",
) -> dict:
    """
    Master pipeline task for processing a medical report.

    Pipeline:
    1. OCR text extraction
    2. Text cleaning
    3. Medical entity recognition (NLP)
    4. Disease + medicine detection
    5. Laboratory value extraction
    6. Abnormality detection (rule engine + LLM)
    7. LLM simplification
    8. Translation (if non-English)
    9. RAG chunking + FAISS indexing
    10. Persist all results to database
    """
    logger.info(f"[TASK] Processing report {report_id} | user={user_id} | lang={language}")

    try:
        result = _run_async(_pipeline_async(report_id, file_path, user_id, language))
        logger.info(f"[TASK] Report {report_id} processed successfully.")
        return result
    except Exception as exc:
        logger.error(f"[TASK] Report {report_id} processing failed: {exc}")
        # Update report status to failed
        _run_async(_mark_report_failed(report_id, str(exc)))
        raise self.retry(exc=exc, countdown=30)


async def _pipeline_async(
    report_id: str,
    file_path: str,
    user_id: str,
    language: str,
) -> dict:
    """
    Full async AI pipeline orchestrator.
    Runs all pipeline stages and persists results.
    """
    from sqlalchemy import select
    from datetime import datetime, timezone

    from app.database.session import AsyncSessionLocal
    from app.models.report import Report, ExtractedText, ReportChunk
    from app.core.constants import ReportStatus, PipelineStage

    async with AsyncSessionLocal() as db:
        # Fetch report
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            raise ValueError(f"Report {report_id} not found in database.")

        # Mark as processing
        report.status = ReportStatus.PROCESSING.value
        report.pipeline_stage = PipelineStage.OCR_PROCESSING.value
        report.processing_started_at = datetime.now(timezone.utc)
        await db.commit()

        try:
            # ---- Stage 1: OCR ----
            logger.info(f"[OCR] Extracting text from: {file_path}")
            from app.services.ocr_service import OCRService
            ocr_service = OCRService()
            raw_text, confidence = await ocr_service.extract_text(file_path)

            report.pipeline_stage = PipelineStage.OCR_COMPLETED.value
            await db.commit()

            # Store extracted text
            extracted = ExtractedText(
                report_id=report_id,
                raw_text=raw_text,
                ocr_provider=ocr_service.provider,
                ocr_confidence=confidence,
                word_count=len(raw_text.split()),
            )
            db.add(extracted)

            # ---- Stage 2: Text Cleaning ----
            from app.utils.text_cleaner import clean_medical_text
            cleaned_text = clean_medical_text(raw_text)
            extracted.cleaned_text = cleaned_text
            report.pipeline_stage = PipelineStage.TEXT_CLEANING.value
            await db.commit()

            # ---- Stage 3: Medical NLP ----
            report.pipeline_stage = PipelineStage.ENTITY_EXTRACTION.value
            await db.commit()

            from app.services.nlp_service import MedicalNLPService
            nlp_service = MedicalNLPService()
            entities = await nlp_service.extract_entities(cleaned_text)

            # ---- Stage 4: Disease + Medicine Detection ----
            report.pipeline_stage = PipelineStage.DISEASE_DETECTION.value
            await db.commit()

            from app.models.report import Diagnosis, Medicine
            for disease in entities.get("diseases", []):
                db.add(Diagnosis(
                    report_id=report_id,
                    condition_name=disease["name"],
                    confidence_score=disease.get("confidence"),
                    source="nlp",
                ))

            for med in entities.get("medicines", []):
                db.add(Medicine(
                    report_id=report_id,
                    medicine_name=med["name"],
                    dosage=med.get("dosage"),
                    frequency=med.get("frequency"),
                ))
            await db.commit()

            # ---- Stage 5 & 6: Lab Values + Abnormality Detection ----
            report.pipeline_stage = PipelineStage.ABNORMALITY_DETECTION.value
            await db.commit()

            from app.services.abnormal_detection_service import AbnormalDetectionService
            detection_service = AbnormalDetectionService()
            lab_results, abnormalities = await detection_service.analyze(cleaned_text, entities)

            if language != "en":
                try:
                    from app.services.translation_service import TranslationService
                    translator = TranslationService()

                    for lab_result in lab_results:
                        for field in ("test_name", "reference_range"):
                            original = lab_result.get(field)
                            if original:
                                lab_result[field] = await translator.translate(
                                    text=str(original), target_lang=language, source_lang="en"
                                )

                    for abnormality in abnormalities:
                        for field in (
                            "parameter_name", "reference_range_text",
                            "clinical_significance", "plain_language_explanation"
                        ):
                            original = abnormality.get(field)
                            if original:
                                abnormality[field] = await translator.translate(
                                    text=str(original), target_lang=language, source_lang="en"
                                )
                except Exception as translation_error:
                    logger.warning(
                        f"Structured report translation failed for {language}: {translation_error}"
                    )

            from app.models.report import LabResult, Abnormality
            for lr in lab_results:
                db.add(LabResult(report_id=report_id, **lr))
            for ab in abnormalities:
                db.add(Abnormality(report_id=report_id, **ab))
            await db.commit()

            # Determine risk level
            critical_count = sum(1 for ab in abnormalities if ab.get("severity") == "critical")
            severe_count = sum(1 for ab in abnormalities if ab.get("severity") == "severe")
            if critical_count > 0:
                report.risk_level = "critical"
            elif severe_count > 0:
                report.risk_level = "high"
            elif len(abnormalities) > 0:
                report.risk_level = "medium"
            else:
                report.risk_level = "low"

            # ---- Stage 7: LLM Simplification ----
            report.pipeline_stage = PipelineStage.LLM_SIMPLIFICATION.value
            await db.commit()

            from app.services.llm_service import LLMService
            llm_service = LLMService()
            simplified_text = await llm_service.simplify_report(
                text=cleaned_text,
                abnormalities=abnormalities,
                diagnoses=[{"name": d["name"]} for d in entities.get("diseases", [])],
                language=language,
            )
            report.simplified_text = simplified_text

            # Generate summary
            report.summary = await llm_service.generate_summary(simplified_text, language=language)
            await db.commit()

            # ---- Stage 8: Translation (if needed) ----
            # LLMService already translates natively via prompt. We just persist the Translation record
            # to satisfy the database schema/frontend expectations without hitting another LLM call.
            if language != "en":
                report.pipeline_stage = PipelineStage.TRANSLATION.value
                await db.commit()

                from app.models.report import Translation
                from app.core.constants import LANGUAGE_NAMES
                db.add(Translation(
                    report_id=report_id,
                    language_code=language,
                    language_name=LANGUAGE_NAMES.get(language, language),
                    original_text=cleaned_text, # Original English text
                    translated_text=simplified_text, # LLM output is already in target language
                ))
                await db.commit()

            # ---- Stage 9: RAG Chunking + Indexing ----
            report.pipeline_stage = PipelineStage.RAG_INDEXING.value
            await db.commit()

            from app.services.rag_service import RAGService
            rag_service = RAGService()
            chunks = await rag_service.chunk_and_index(
                text=cleaned_text,
                report_id=report_id,
            )
            for i, chunk_text in enumerate(chunks):
                db.add(ReportChunk(
                    report_id=report_id,
                    chunk_index=i,
                    chunk_text=chunk_text,
                    chunk_size=len(chunk_text.split()),
                    embedding_model=rag_service.embedding_model_name,
                ))
            await db.commit()

            # ---- Mark Complete ----
            report.status = ReportStatus.COMPLETED.value
            report.pipeline_stage = PipelineStage.COMPLETED.value
            report.processing_completed_at = datetime.now(timezone.utc)
            await db.commit()

            logger.info(f"✅ Pipeline complete for report {report_id}")
            return {
                "report_id": report_id,
                "status": "completed",
                "risk_level": report.risk_level,
                "chunks_indexed": len(chunks),
                "abnormalities_found": len(abnormalities),
            }

        except Exception as e:
            await _mark_report_failed_in_session(db, report, str(e))
            raise


async def _mark_report_failed_in_session(db, report, error: str) -> None:
    """Mark report as failed within an existing session."""
    from app.core.constants import ReportStatus, PipelineStage
    report.status = ReportStatus.FAILED.value
    report.pipeline_stage = PipelineStage.FAILED.value
    report.processing_error = error[:2000]  # Truncate to column limit
    await db.commit()


async def _mark_report_failed(report_id: str, error: str) -> None:
    """Mark report as failed in a new session (called from sync retry handler)."""
    from app.database.session import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.report import Report
    from app.core.constants import ReportStatus, PipelineStage

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Report).where(Report.id == report_id))
        report = result.scalar_one_or_none()
        if report:
            await _mark_report_failed_in_session(db, report, error)


# ==============================================================================
# Email Tasks
# ==============================================================================

@celery_app.task(
    name="app.workers.tasks.send_verification_email_task",
    queue="emails",
    max_retries=3,
)
def send_verification_email_task(user_id: str, email: str, token: str) -> None:
    """Send email verification email to the user."""
    logger.info(f"[EMAIL] Sending verification email to {email}")
    # Implement SMTP/SendGrid email sending here
    # For now, log the token for development testing
    logger.info(f"[EMAIL] Verification token for {email}: {token}")


@celery_app.task(
    name="app.workers.tasks.send_password_reset_task",
    queue="emails",
    max_retries=3,
)
def send_password_reset_task(user_id: str, email: str, token: str) -> None:
    """Send password reset email."""
    logger.info(f"[EMAIL] Sending password reset email to {email}")
    logger.info(f"[EMAIL] Reset token for {email}: {token}")


# ==============================================================================
# Voice Generation Task
# ==============================================================================

@celery_app.task(
    name="app.workers.tasks.generate_voice_task",
    queue="voice",
    max_retries=2,
)
def generate_voice_task(
    voice_request_id: str,
    text: str,
    language_code: str,
) -> dict:
    """Generate TTS audio for a voice request."""
    logger.info(f"[VOICE] Generating audio for request {voice_request_id} | lang={language_code}")
    result = _run_async(_generate_voice_async(voice_request_id, text, language_code))
    return result


async def _generate_voice_async(voice_request_id: str, text: str, language_code: str) -> dict:
    """Async voice generation implementation."""
    from app.database.session import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.report import VoiceRequest
    from app.services.voice_service import VoiceService

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(VoiceRequest).where(VoiceRequest.id == voice_request_id)
        )
        voice_req = result.scalar_one_or_none()
        if not voice_req:
            raise ValueError(f"VoiceRequest {voice_request_id} not found")

        service = VoiceService()
        audio_path, duration = await service.generate(text=text, language_code=language_code)

        voice_req.audio_file_path = audio_path
        voice_req.audio_duration_seconds = duration
        voice_req.status = "completed"
        await db.commit()

        return {"audio_path": audio_path, "duration": duration}
