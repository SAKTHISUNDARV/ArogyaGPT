"""
ArogyaGPT - LLM Service (Groq Async Client)
Medical report simplification, summarization, and intelligent Q&A using Groq LLM.
"""

import re
from typing import Optional
from groq import AsyncGroq

from app.core.config import settings
from app.core.exceptions import LLMServiceError
from app.core.logging import get_logger

logger = get_logger(__name__)

# Medical report simplification prompt
SIMPLIFY_PROMPT_TEMPLATE = """You are a compassionate medical expert translating a complex medical report into simple, easy-to-understand language for a patient in India.

The patient may not have a medical background. Explain findings clearly, warmly, and without causing unnecessary alarm.

**Medical Report Text:**
{report_text}

**Detected Abnormalities:**
{abnormalities}

**Detected Diagnoses:**
{diagnoses}

**Instructions:**
1. Summarize the report clearly and simply for the patient.
2. Explain what each abnormal value means in everyday terms.
3. Explain each diagnosis in patient-friendly language.
4. Provide clear lifestyle recommendations where appropriate.
5. Use bullet points and short paragraphs.
6. Do NOT add any new medical diagnoses not present in the report.
7. Do NOT provide specific medication advice.
8. End with "Please consult your doctor for personalized medical advice." (translated to the target language).
9. STRICT MULTILINGUAL REQUIREMENT: You MUST write your entire explanation in {language}. If Tamil, write completely in Tamil script (தமிழ்). If Hindi, write completely in Devanagari script (हिन्दी). If Telugu, write in Telugu (తెలుగు), etc.

Target Language: {language}

Simplified Explanation:"""

SUMMARY_PROMPT_TEMPLATE = """Create a brief summary in exactly 2 short sentences for a patient:

{simplified_text}

Instructions:
1. Mention only the most important finding and the recommended next step.
2. Keep the complete summary under 55 words.
3. STRICT MULTILINGUAL REQUIREMENT: Write completely in {language}. Do not use English unless the term has no translation.

Summary:"""

CHAT_PROMPT_TEMPLATE = """You are ArogyaGPT, a medical AI assistant for Indian patients. You are answering questions about the patient's medical report.

**Context from Medical Report:**
{context}

**Conversation History:**
{chat_history}

**Patient's Question:**
{question}

**STRICT INSTRUCTIONS — READ CAREFULLY:**
1. NEVER introduce yourself. NEVER say "Hello", "Hi", "I am ArogyaGPT", "Certainly!", "Of course!", "Sure!", or any greeting or filler phrase. Start your response DIRECTLY with the answer.
2. Your answer MUST be grounded strictly in the medical report context provided above. Do NOT make up values, diagnoses, or medications not present in the report.
3. If the report does not contain the information needed to answer, respond EXACTLY: "This information is not available in your report. Please consult your doctor for further guidance."
4. Use simple, compassionate, patient-friendly language. Explain medical terms in plain words.
5. Always end with a brief reminder to consult their doctor for clinical decisions — but do NOT make this the primary response.
6. Keep the response concise: answer in 3-5 sentences unless more detail is essential for safety.
7. STRICT MULTILINGUAL REQUIREMENT: You MUST write your ENTIRE response in {target_language}.
   - If Tamil: respond completely in Tamil script (தமிழ்), do NOT mix English.
   - If Hindi: respond completely in Hindi Devanagari script (हिन्दी), do NOT mix English.
   - If Telugu: respond completely in Telugu script (తెలుగు), do NOT mix English.
   - If Kannada: respond completely in Kannada script (ಕನ್ನಡ), do NOT mix English.
   - If Malayalam: respond completely in Malayalam script (മലയാളം), do NOT mix English.
   - If Bengali: respond completely in Bengali script (বাংলা), do NOT mix English.
   - If Marathi: respond completely in Marathi script (मराठी), do NOT mix English.
   - If Gujarati: respond completely in Gujarati script (ગુજરાતી), do NOT mix English.
   - If Punjabi: respond completely in Punjabi Gurmukhi script (ਪੰਜਾਬੀ), do NOT mix English.
   - If English: respond in clear, simple English.

Target Language: {target_language}

[Begin direct answer — no greeting, no preamble]:"""


LANGUAGE_MAP: dict[str, str] = {
    "en": "English",
    "english": "English",
    "ta": "Tamil (தமிழ் - write strictly in Tamil script)",
    "tamil": "Tamil (தமிழ் - write strictly in Tamil script)",
    "hi": "Hindi (हिन्दी - write strictly in Hindi Devanagari script)",
    "hindi": "Hindi (हिन्दी - write strictly in Hindi Devanagari script)",
    "te": "Telugu (తెలుగు - write strictly in Telugu script)",
    "telugu": "Telugu (తెలుగు - write strictly in Telugu script)",
    "kn": "Kannada (ಕನ್ನಡ - write strictly in Kannada script)",
    "kannada": "Kannada (ಕನ್ನಡ - write strictly in Kannada script)",
    "ml": "Malayalam (മലയാളം - write strictly in Malayalam script)",
    "malayalam": "Malayalam (മലയാളം - write strictly in Malayalam script)",
    "bn": "Bengali (বাংলা - write strictly in Bengali script)",
    "bengali": "Bengali (বাংলা - write strictly in Bengali script)",
    "mr": "Marathi (मराठी - write strictly in Marathi script)",
    "marathi": "Marathi (मराठी - write strictly in Marathi script)",
    "gu": "Gujarati (ગુજરાતી - write strictly in Gujarati script)",
    "gujarati": "Gujarati (ગુજરાતી - write strictly in Gujarati script)",
    "pa": "Punjabi (ਪੰਜਾਬੀ - write strictly in Punjabi Gurmukhi script)",
    "punjabi": "Punjabi (ਪੰਜਾਬੀ - write strictly in Punjabi Gurmukhi script)",
    "or": "Odia (ଓଡ଼ିଆ - write strictly in Odia script)",
    "odia": "Odia (ଓଡ଼ିଆ - write strictly in Odia script)",
    "ur": "Urdu (اردو - write strictly in Urdu script)",
    "urdu": "Urdu (اردو - write strictly in Urdu script)",
}

LANGUAGE_SCRIPTS: dict[str, str] = {
    "hi": r"[\u0900-\u097f]",
    "mr": r"[\u0900-\u097f]",
    "ta": r"[\u0b80-\u0bff]",
    "te": r"[\u0c00-\u0c7f]",
    "kn": r"[\u0c80-\u0cff]",
    "ml": r"[\u0d00-\u0d7f]",
    "bn": r"[\u0980-\u09ff]",
    "gu": r"[\u0a80-\u0aff]",
    "pa": r"[\u0a00-\u0a7f]",
    "or": r"[\u0b00-\u0b7f]",
    "ur": r"[\u0600-\u06ff]",
}


def _needs_script_translation(text: str, language_code: str) -> bool:
    script_pattern = LANGUAGE_SCRIPTS.get(language_code)
    if not script_pattern:
        return False

    alphabetic_characters = sum(character.isalpha() for character in text)
    script_characters = len(re.findall(script_pattern, text))
    return alphabetic_characters == 0 or script_characters / alphabetic_characters < 0.35


class LLMService:
    """
    Groq LLM service for medical AI tasks using official AsyncGroq client.
    """

    def __init__(self) -> None:
        self._client: Optional[AsyncGroq] = None
        self._candidate_models = list(dict.fromkeys([
            settings.GROQ_MODEL_NAME,
            "qwen/qwen3.8-27b",
            "openai/gpt-oss-20b",
            "openai/gpt-oss-120b",
        ]))

    async def _ensure_target_language(self, text: str, language_code: str) -> str:
        """Translate generated text when it does not contain the target script."""
        language_code = language_code.strip().lower()
        if language_code == "en" or not _needs_script_translation(text, language_code):
            return text
        try:
            from app.services.translation_service import TranslationService
            return await TranslationService().translate(
                text=text,
                target_lang=language_code,
                source_lang="auto",
            )
        except Exception as e:
            logger.warning(f"Post-generation translation failed for {language_code}: {e}")
            return text

    def _get_client(self) -> AsyncGroq:
        """Lazy-load the Groq Async client."""
        if self._client is None:
            if not settings.GROQ_API_KEY:
                raise LLMServiceError("GROQ_API_KEY is not configured.")
            self._client = AsyncGroq(api_key=settings.GROQ_API_KEY)
            logger.info("Groq Async client initialized.")
        return self._client

    async def _generate(self, prompt: str, max_tokens: int = 2048, temperature: float = 0.1) -> str:
        """Send prompt to Groq with model fallback resilience."""
        client = self._get_client()
        last_error = None

        for model in self._candidate_models:
            if not model:
                continue
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
                content = resp.choices[0].message.content
                if content:
                    return content.strip()
            except Exception as e:
                logger.warning(f"Groq generation failed with model '{model}': {e}. Trying next model...")
                last_error = e

        raise LLMServiceError(f"All Groq models failed: {last_error}")

    async def simplify_report(
        self,
        text: str,
        abnormalities: list[dict],
        diagnoses: list[dict],
        language: str = "en",
    ) -> str:
        """
        Simplify a medical report into patient-friendly language.
        """
        target_lang = LANGUAGE_MAP.get(language.strip().lower(), language)

        if not settings.GROQ_API_KEY:
            logger.warning("GROQ_API_KEY not configured. Generating simplified report fallback.")
            findings_str = "\n".join([
                f"- **{a.get('parameter_name', 'Parameter')}**: {a.get('detected_value', '')} ({a.get('severity', 'abnormal')})"
                for a in abnormalities
            ]) or "No abnormal parameters identified."

            diag_str = "\n".join([
                f"- **{d.get('condition_name', d.get('name', 'Condition'))}**"
                for d in diagnoses
            ]) or "No diagnostic flags identified."

            fallback = f"""### Medical Report Analysis
Findings extracted from your document:

#### Findings & Alerts:
{findings_str}

#### Clinical Conditions:
{diag_str}

Please consult your doctor for personalized medical advice."""
            if language.strip().lower() != "en":
                return await self._ensure_target_language(fallback, language.strip().lower())
            return fallback

        try:
            abnorm_text = "\n".join([
                f"- {a.get('parameter_name', 'Unknown')}: {a.get('detected_value', '')} "
                f"({a.get('abnormality_type', '')} - {a.get('severity', '')})"
                for a in abnormalities
            ]) or "No abnormalities detected."

            diag_text = "\n".join([
                f"- {d.get('condition_name', d.get('name', 'Unknown'))}"
                for d in diagnoses
            ]) or "No specific diagnoses identified."

            prompt = SIMPLIFY_PROMPT_TEMPLATE.format(
                report_text=text[:6000],
                abnormalities=abnorm_text,
                diagnoses=diag_text,
                language=target_lang,
            )

            result = await self._generate(prompt, max_tokens=settings.GROQ_MAX_TOKENS, temperature=settings.GROQ_TEMPERATURE)
            result = await self._ensure_target_language(result, language)
            logger.info(f"LLM simplification complete | {len(result)} chars | lang={language}")
            return result

        except Exception as e:
            logger.error(f"LLM simplification failed: {e}")
            raise LLMServiceError(f"Report simplification failed: {str(e)}")

    async def generate_summary(self, simplified_text: str, language: str = "en") -> str:
        """Generate a brief summary from already-simplified report text."""
        target_lang = LANGUAGE_MAP.get(language.strip().lower(), language)
        if not settings.GROQ_API_KEY:
            fallback_summary = "Report analysis completed. Please review findings above."
            if language.strip().lower() != "en":
                return await self._ensure_target_language(fallback_summary, language.strip().lower())
            return fallback_summary

        try:
            prompt = SUMMARY_PROMPT_TEMPLATE.format(
                simplified_text=simplified_text[:3000],
                language=target_lang,
            )
            result = await self._generate(prompt, max_tokens=120, temperature=0.2)
            return await self._ensure_target_language(result, language)
        except Exception as e:
            logger.error(f"LLM summary generation failed: {e}")
            return "Summary unavailable."

    async def explain_medical_term(self, term: str, language: str = "en") -> str:
        """Explain a medical report term in the patient's selected language."""
        target_lang = LANGUAGE_MAP.get(language.strip().lower(), language)
        if not settings.GROQ_API_KEY:
            raise LLMServiceError("GROQ_API_KEY is not configured.")

        prompt = f"""Explain this medical report finding or term in simple language for a patient:

{term}

Give a brief, factual explanation of what the term generally describes. Do not infer
the patient's diagnosis or health status from the term alone, and do not recommend
medicines or treatment. State that a clinician should interpret it in the context
of the full report. Write the entire explanation in {target_lang}, using its
appropriate script. Do not begin with a greeting.

Explanation:"""

        try:
            result = await self._generate(
                prompt,
                max_tokens=350,
                temperature=0.1,
            )
            language_code = language.strip().lower()
            if _needs_script_translation(result, language_code):
                from app.services.translation_service import TranslationService

                result = await TranslationService().translate(
                    text=result,
                    target_lang=language_code,
                    source_lang="auto",
                )
                if _needs_script_translation(result, language_code):
                    raise LLMServiceError(
                        f"The explanation could not be generated in {target_lang}."
                    )
            return result
        except Exception as e:
            logger.error(f"Medical term explanation failed: {e}")
            raise LLMServiceError(f"Medical term explanation failed: {str(e)}")

    async def answer_question(
        self,
        question: str,
        context: str,
        chat_history: str = "",
        language: str = "en",
    ) -> str:
        """
        Answer a patient's question using RAG context from their report in their chosen language.
        """
        target_lang = LANGUAGE_MAP.get(language.strip().lower(), language)

        if not settings.GROQ_API_KEY:
            raise LLMServiceError("GROQ_API_KEY is not configured.")

        try:
            prompt = CHAT_PROMPT_TEMPLATE.format(
                context=context[:4000],
                chat_history=chat_history[-2000:] if chat_history else "No previous messages.",
                question=question,
                target_language=target_lang,
            )
            result = await self._generate(prompt, max_tokens=512, temperature=0.1)
            language_code = language.strip().lower()
            if _needs_script_translation(result, language_code):
                from app.services.translation_service import TranslationService

                result = await TranslationService().translate(
                    text=result,
                    target_lang=language_code,
                    source_lang="auto",
                )
                if _needs_script_translation(result, language_code):
                    raise LLMServiceError(
                        f"The response could not be generated in {target_lang}."
                    )
            return result
        except Exception as e:
            logger.error(f"LLM Q&A failed: {e}")
            raise LLMServiceError(f"Chat response generation failed: {str(e)}")
