"""
ArogyaGPT - Chat & RAG Service
Complete conversational AI service with:
- RAG-powered Q&A against medical reports
- Conversational memory window
- Citation support (source chunk tracking)
- Multi-session management
- Language-aware responses
"""

import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.constants import MessageRole, APIMessage
from app.core.exceptions import (
    ReportNotFoundError,
    ResourceNotFoundError,
    RAGIndexingError,
)
from app.core.logging import get_logger
from app.models.chat import ChatSession, ChatMessage
from app.models.report import Report
from app.models.user import User
from app.schemas.report import (
    AskQuestionRequest,
    AskQuestionResponse,
    ChatSessionResponse,
    ChatMessageResponse,
)
from app.services.llm_service import LLMService
from app.services.rag_service import RAGService

logger = get_logger(__name__)


class ChatService:
    """
    RAG-powered conversational AI service.

    Manages chat sessions, retrieves relevant document chunks via FAISS,
    injects context into LLM prompts, and persists conversation history.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.llm = LLMService()
        self.rag = RAGService()

    # =========================================================================
    # Session Management
    # =========================================================================

    async def create_session(
        self,
        user: User,
        report_id: Optional[str] = None,
        title: str = "Medical Report Chat",
        language_code: str = "en",
    ) -> ChatSession:
        """
        Create a new chat session optionally linked to a report.

        Args:
            user: The authenticated user.
            report_id: Optional report UUID to scope the conversation.
            title: Display title for the session.
            language_code: Preferred language for AI responses.

        Returns:
            Newly created ChatSession ORM object.
        """
        if report_id:
            # Verify the report belongs to this user
            result = await self.db.execute(
                select(Report).where(
                    Report.id == report_id,
                    Report.user_id == user.id,
                    Report.is_deleted == False,
                )
            )
            if not result.scalar_one_or_none():
                raise ReportNotFoundError(identifier=report_id)

        session = ChatSession(
            id=str(uuid.uuid4()),
            user_id=user.id,
            report_id=report_id,
            title=title,
            language_code=language_code,
            is_active=True,
            message_count=0,
        )
        self.db.add(session)
        await self.db.flush()

        logger.info(
            f"Chat session created: id={session.id} | "
            f"user={user.email} | report_id={report_id}"
        )
        return session

    async def get_session(
        self, session_id: str, user_id: str
    ) -> ChatSession:
        """Retrieve a chat session, verifying ownership."""
        result = await self.db.execute(
            select(ChatSession)
            .where(
                ChatSession.id == session_id,
                ChatSession.user_id == user_id,
                ChatSession.is_deleted == False,
            )
            .options(selectinload(ChatSession.messages))
        )
        session = result.scalar_one_or_none()
        if not session:
            raise ResourceNotFoundError("Chat session", session_id)
        return session

    async def list_sessions(
        self,
        user_id: str,
        report_id: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[ChatSession], int]:
        """List all chat sessions for a user with optional report filter."""
        from sqlalchemy import func

        query = select(ChatSession).where(
            ChatSession.user_id == user_id,
            ChatSession.is_deleted == False,
        )
        if report_id:
            query = query.where(ChatSession.report_id == report_id)

        query = query.order_by(ChatSession.updated_at.desc())

        count_result = await self.db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar() or 0

        offset = (page - 1) * per_page
        paginated = await self.db.execute(query.offset(offset).limit(per_page))
        sessions = list(paginated.scalars().all())

        return sessions, total

    async def delete_session(self, session_id: str, user_id: str) -> None:
        """Soft-delete a chat session."""
        session = await self.get_session(session_id, user_id)
        session.is_deleted = True
        session.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()
        logger.info(f"Chat session deleted: {session_id}")

    async def get_session_history(
        self,
        session_id: str,
        user_id: str,
        limit: int = 50,
    ) -> list[ChatMessage]:
        """Retrieve ordered message history for a session."""
        await self.get_session(session_id, user_id)  # Verify ownership

        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    # =========================================================================
    # Core Q&A Logic
    # =========================================================================

    async def ask(
        self,
        user: User,
        payload: AskQuestionRequest,
    ) -> AskQuestionResponse:
        """
        Main entry point for a RAG-powered question.

        Flow:
        1. Resolve or create chat session.
        2. Retrieve relevant document chunks from FAISS.
        3. Build conversation history string.
        4. Call LLM with context + history + question.
        5. Persist user message and AI response.
        6. Return structured response with citations.

        Args:
            user: Authenticated user.
            payload: Question request with session/report context.

        Returns:
            AskQuestionResponse with answer and citations.
        """
        start_time = time.perf_counter()

        # ---- Resolve session ----
        session = await self._resolve_session(user, payload)

        # ---- Retrieve RAG context ----
        source_chunks: list[dict] = []
        context_text = ""

        report_id = session.report_id or payload.report_id

        if report_id:
            try:
                retrieved = await self.rag.retrieve(
                    query=payload.question,
                    report_id=report_id,
                    top_k=settings.RAG_TOP_K,
                )
                source_chunks = retrieved
                context_text = self._format_context(retrieved)
            except Exception as e:
                logger.warning(f"RAG retrieval failed: {e}. Proceeding without context.")
                context_text = "No report context available."
        else:
            context_text = (
                "No medical report is linked to this session. "
                "I can answer general health questions, but for report-specific "
                "questions, please upload a report first."
            )

        # ---- Build conversation history ----
        history_text = await self._build_history(session.id, window=session.context_window_size)

        # ---- Determine language ----
        target_lang = payload.language_code or session.language_code or getattr(user, "preferred_language", "en") or "en"
        if payload.language_code and session.language_code != payload.language_code:
            session.language_code = payload.language_code

        # Commit any pending changes (e.g. session creation) to release DB locks before long LLM call
        await self.db.commit()

        # ---- Call LLM ----
        answer = await self.llm.answer_question(
            question=payload.question,
            context=context_text,
            chat_history=history_text,
            language=target_lang,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000

        # ---- Persist user message ----
        user_msg = ChatMessage(
            id=str(uuid.uuid4()),
            session_id=session.id,
            role=MessageRole.USER.value,
            content=payload.question,
        )
        self.db.add(user_msg)

        # ---- Persist AI response ----
        ai_msg = ChatMessage(
            id=str(uuid.uuid4()),
            session_id=session.id,
            role=MessageRole.ASSISTANT.value,
            content=answer,
            source_chunks=[
                {"text": c["text"][:200], "score": c["score"], "chunk_index": c["chunk_index"]}
                for c in source_chunks
            ] if source_chunks else None,
            retrieved_context=context_text[:2000] if context_text else None,
            model_used=settings.GROQ_MODEL_NAME,
            latency_ms=latency_ms,
        )
        self.db.add(ai_msg)

        # ---- Update session metadata ----
        session.message_count += 2
        session.updated_at = datetime.now(timezone.utc)

        await self.db.flush()

        logger.info(
            f"Chat Q&A complete | session={session.id} | "
            f"chunks_retrieved={len(source_chunks)} | latency={latency_ms:.0f}ms"
        )

        return AskQuestionResponse(
            answer=answer,
            session_id=session.id,
            message_id=ai_msg.id,
            source_chunks=[
                {
                    "text": c["text"][:300],
                    "score": round(c["score"], 4),
                    "chunk_index": c["chunk_index"],
                }
                for c in source_chunks
            ],
            model_used=settings.GROQ_MODEL_NAME,
            tokens_used=None,  # Groq doesn't expose token counts in LangChain interface
            latency_ms=round(latency_ms, 2),
        )

    async def submit_feedback(
        self,
        message_id: str,
        user_id: str,
        is_helpful: bool,
        feedback_text: Optional[str] = None,
    ) -> None:
        """Record user feedback on an AI message."""
        result = await self.db.execute(
            select(ChatMessage)
            .join(ChatSession, ChatSession.id == ChatMessage.session_id)
            .where(
                ChatMessage.id == message_id,
                ChatSession.user_id == user_id,
                ChatMessage.role == MessageRole.ASSISTANT.value,
            )
        )
        message = result.scalar_one_or_none()
        if not message:
            raise ResourceNotFoundError("Chat message", message_id)

        message.is_helpful = is_helpful
        message.feedback_text = feedback_text
        await self.db.flush()
        logger.info(f"Feedback recorded: message_id={message_id} | helpful={is_helpful}")

    # =========================================================================
    # Private Helpers
    # =========================================================================

    async def _resolve_session(
        self,
        user: User,
        payload: AskQuestionRequest,
    ) -> ChatSession:
        """
        Resolve existing session or create a new one.

        If payload.session_id is provided, load it.
        Otherwise, create a new session (optionally scoped to a report).
        """
        if payload.session_id:
            return await self.get_session(payload.session_id, user.id)

        # Auto-generate session title from question
        title = payload.question[:80] + "..." if len(payload.question) > 80 else payload.question

        return await self.create_session(
            user=user,
            report_id=payload.report_id,
            title=title,
            language_code=payload.language_code,
        )

    async def _build_history(self, session_id: str, window: int = 10) -> str:
        """
        Build a formatted conversation history string for LLM context.

        Takes the last `window` messages (user + assistant pairs).
        """
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(window)
        )
        messages = list(reversed(result.scalars().all()))

        if not messages:
            return ""

        history_parts = []
        for msg in messages:
            role = "Patient" if msg.role == MessageRole.USER.value else "ArogyaGPT"
            history_parts.append(f"{role}: {msg.content}")

        return "\n".join(history_parts)

    @staticmethod
    def _format_context(chunks: list[dict]) -> str:
        """Format retrieved chunks into a readable context block for the LLM."""
        if not chunks:
            return "No relevant information found in the report."

        parts = []
        for i, chunk in enumerate(chunks, 1):
            parts.append(f"[Source {i} | Relevance: {chunk['score']:.2f}]\n{chunk['text']}")

        return "\n\n---\n\n".join(parts)
