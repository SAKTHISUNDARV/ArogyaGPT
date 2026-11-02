import pytest

from app.core.config import settings
from app.core.exceptions import LLMServiceError
from app.services.llm_service import LLMService
from app.services.translation_service import TranslationService


@pytest.mark.asyncio
async def test_chat_translates_english_response_into_selected_script(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    service = LLMService()

    async def generate(*args, **kwargs):
        return "Your result is normal."

    async def translate(self, *, text, target_lang, source_lang):
        assert text == "Your result is normal."
        assert target_lang == "gu"
        assert source_lang == "auto"
        return "તમારું પરિણામ સામાન્ય છે."

    monkeypatch.setattr(service, "_generate", generate)
    monkeypatch.setattr(TranslationService, "translate", translate)

    answer = await service.answer_question(
        question="Is my result normal?",
        context="",
        language="gu",
    )

    assert answer == "તમારું પરિણામ સામાન્ય છે."


@pytest.mark.asyncio
async def test_chat_does_not_return_english_mock_without_groq_key(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")

    with pytest.raises(LLMServiceError, match="GROQ_API_KEY is not configured"):
        await LLMService().answer_question(
            question="Is my result normal?",
            context="",
            language="gu",
        )


@pytest.mark.asyncio
async def test_term_explanation_uses_selected_language(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    service = LLMService()
    prompts = []

    async def generate(prompt, **kwargs):
        prompts.append(prompt)
        return "இதயம் மற்றும் மார்பின் அளவுகளை ஒப்பிடும் விகிதம்."

    monkeypatch.setattr(service, "_generate", generate)

    explanation = await service.explain_medical_term(
        term="Cardiothoracic Ratio (CTR)",
        language="ta",
    )

    assert explanation == "இதயம் மற்றும் மார்பின் அளவுகளை ஒப்பிடும் விகிதம்."
    assert "Cardiothoracic Ratio (CTR)" in prompts[0]
    assert "Tamil" in prompts[0]


@pytest.mark.asyncio
async def test_term_explanation_requires_groq_key(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")

    with pytest.raises(LLMServiceError, match="GROQ_API_KEY is not configured"):
        await LLMService().explain_medical_term(
            term="Pleural effusion",
            language="en",
        )
