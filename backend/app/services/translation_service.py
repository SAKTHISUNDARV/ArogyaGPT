"""
ArogyaGPT - Translation Service
Multi-provider translation supporting 12 Indian languages.
"""

from app.core.config import settings
from app.core.constants import LANGUAGE_NAMES
from app.core.exceptions import TranslationError
from app.core.logging import get_logger

logger = get_logger(__name__)


class TranslationService:
    """
    Translation service supporting Indian languages via deep-translator.

    Supported languages: en, hi, ta, te, kn, ml, mr, bn, gu, pa, or, ur
    Providers: deep-translator (Google Translate free API), googletrans
    """

    async def translate(
        self,
        text: str,
        target_lang: str,
        source_lang: str = "en",
    ) -> str:
        """
        Translate text to target language.

        Args:
            text: Source text to translate.
            target_lang: ISO 639-1 target language code.
            source_lang: ISO 639-1 source language code (default: 'en').

        Returns:
            Translated text string.

        Raises:
            TranslationError: If translation fails.
        """
        if target_lang == source_lang:
            return text

        if not text.strip():
            return text

        if target_lang not in LANGUAGE_NAMES:
            raise TranslationError(
                f"Language '{target_lang}' is not supported. "
                f"Supported languages: {list(LANGUAGE_NAMES.keys())}"
            )

        # Split long text into chunks to stay within API limits
        max_chunk = 4500
        if len(text) <= max_chunk:
            return await self._translate_chunk(text, target_lang, source_lang)

        chunks = self._split_into_chunks(text, max_chunk)
        translated_chunks = []
        for chunk in chunks:
            translated = await self._translate_chunk(chunk, target_lang, source_lang)
            translated_chunks.append(translated)

        return "\n".join(translated_chunks)

    async def _translate_chunk(
        self, text: str, target_lang: str, source_lang: str
    ) -> str:
        """Translate a single text chunk using the configured provider."""
        last_error: Exception | None = None

        # Try deep-translator first
        try:
            from deep_translator import GoogleTranslator
            translator = GoogleTranslator(source=source_lang, target=target_lang)
            result = translator.translate(text)
            if result:
                logger.debug(
                    f"Translation: {source_lang} → {target_lang} | "
                    f"{len(text)} chars → {len(result)} chars"
                )
                return result
        except ImportError:
            logger.warning("deep-translator not installed. Trying googletrans...")
        except Exception as e:
            logger.warning(f"deep-translator failed: {e}. Trying googletrans...")
            last_error = e

        # Fallback: googletrans
        try:
            from googletrans import Translator
            translator = Translator()
            result = await translator.translate(text, dest=target_lang, src=source_lang)
            return result.text
        except Exception as e:
            logger.warning(f"googletrans failed: {e}. Trying Groq LLM translation...")
            last_error = e

        # Fallback: Groq LLM
        try:
            from app.services.llm_service import LLMService, LANGUAGE_MAP
            llm = LLMService()
            target_name = LANGUAGE_MAP.get(target_lang, target_lang)
            prompt = (
                f"You are an expert medical translator. Translate the following medical report text clearly and accurately into {target_name}.\n"
                f"STRICT REQUIREMENT: Output ONLY the translated text in {target_name}. Do NOT add explanations or conversational filler.\n\n"
                f"{text}"
            )
            res = await llm._generate(prompt, max_tokens=2048, temperature=0.1)
            if res and len(res.strip()) > 0:
                return res.strip()
        except Exception as e:
            logger.warning(f"Groq LLM translation failed: {e}.")
            last_error = e

        raise TranslationError(
            f"Could not translate the text into {LANGUAGE_NAMES.get(target_lang, target_lang)}."
        ) from last_error

    @staticmethod
    def _split_into_chunks(text: str, max_length: int) -> list[str]:
        """Split text into chunks at sentence boundaries."""
        sentences = text.replace("\n", " \n ").split(". ")
        chunks = []
        current_chunk = []
        current_length = 0

        for sentence in sentences:
            sentence_len = len(sentence)
            if current_length + sentence_len > max_length and current_chunk:
                chunks.append(". ".join(current_chunk) + ".")
                current_chunk = [sentence]
                current_length = sentence_len
            else:
                current_chunk.append(sentence)
                current_length += sentence_len

        if current_chunk:
            chunks.append(". ".join(current_chunk))

        return chunks

    def get_supported_languages(self) -> dict[str, str]:
        """Return all supported language codes and their names."""
        return LANGUAGE_NAMES.copy()
