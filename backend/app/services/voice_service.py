"""
ArogyaGPT - Voice (TTS) Service
Text-to-speech generation using gTTS with Azure TTS fallback.
"""

import uuid
from pathlib import Path
from typing import Optional, Tuple

from app.core.config import settings
from app.core.exceptions import VoiceGenerationError
from app.core.logging import get_logger

logger = get_logger(__name__)

# Map ISO language codes to gTTS language codes
GTTS_LANG_MAP = {
    "en": "en",
    "hi": "hi",
    "ta": "ta",
    "te": "te",
    "kn": "kn",
    "ml": "ml",
    "mr": "mr",
    "bn": "bn",
    "gu": "gu",
    "pa": "pa",
    "or": "or",
    "ur": "ur",
}

# Azure voice names are not interchangeable across Indian languages.  In
# particular, the previous Telugu voice name (``Moana``) is not a Telugu
# voice, which made Azure reject the request before it could create audio.
AZURE_VOICE_MAP = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-ShrutiNeural",
    "kn": "kn-IN-SapnaNeural",
    "ml": "ml-IN-SobhanaNeural",
    "mr": "mr-IN-AarohiNeural",
    "bn": "bn-IN-TanishaaNeural",
    "gu": "gu-IN-DhwaniNeural",
    "pa": "pa-IN-AshleenNeural",
    "or": "or-IN-SubhasiniNeural",
    "ur": "ur-IN-GulNeural",
}


class VoiceService:
    """
    Text-to-Speech service for medical report audio playback.

    Providers:
    - gTTS (Google Text-to-Speech, free, no key required)
    - Azure Cognitive Services TTS (higher quality, requires key)
    """

    def __init__(self) -> None:
        self.output_dir = Path(settings.TTS_OUTPUT_DIR)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def generate(
        self,
        text: str,
        language_code: str = "en",
    ) -> Tuple[str, Optional[float]]:
        """
        Generate an audio file from text.

        Args:
            text: Input text to convert to speech.
            language_code: ISO 639-1 language code.

        Returns:
            Tuple of (absolute_file_path, duration_seconds_or_None).

        Raises:
            VoiceGenerationError: If TTS generation fails.
        """
        if not text.strip():
            raise VoiceGenerationError("Empty text provided for voice generation.")

        provider = settings.TTS_PROVIDER
        output_filename = f"{uuid.uuid4()}.mp3"
        output_path = self.output_dir / output_filename

        if provider == "azure" and settings.AZURE_TTS_KEY:
            return await self._azure_tts(text, language_code, str(output_path))

        return await self._gtts(text, language_code, str(output_path))

    async def _gtts(
        self, text: str, language_code: str, output_path: str
    ) -> Tuple[str, Optional[float]]:
        """Generate audio using gTTS (Google Text-to-Speech)."""
        try:
            from gtts import gTTS

            gtts_lang = GTTS_LANG_MAP.get(language_code, "en")

            # Split long text (gTTS has character limits)
            max_chars = 3000
            if len(text) > max_chars:
                text = text[:max_chars] + "..."

            tts = gTTS(text=text, lang=gtts_lang, slow=False)

            # Run synchronously (gTTS is blocking)
            import asyncio
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, tts.save, output_path)

            # Estimate duration (rough: ~130 words/min for TTS)
            word_count = len(text.split())
            duration = (word_count / 130) * 60

            logger.info(
                f"gTTS generated: {output_path} | lang={gtts_lang} | "
                f"~{duration:.1f}s | {len(text)} chars"
            )
            return output_path, duration

        except ImportError:
            raise VoiceGenerationError(
                "gTTS is not installed. Run: pip install gTTS"
            )
        except Exception as e:
            raise VoiceGenerationError(f"gTTS generation failed: {str(e)}")

    async def _azure_tts(
        self, text: str, language_code: str, output_path: str
    ) -> Tuple[str, Optional[float]]:
        """Generate high-quality audio using Azure Cognitive Services."""
        try:
            import azure.cognitiveservices.speech as speechsdk

            speech_config = speechsdk.SpeechConfig(
                subscription=settings.AZURE_TTS_KEY,
                region=settings.AZURE_TTS_REGION,
            )
            speech_config.set_speech_synthesis_output_format(
                speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
            )

            voice_name = AZURE_VOICE_MAP.get(language_code)
            if not voice_name:
                logger.warning(
                    f"Azure TTS voice unavailable for {language_code}; falling back to gTTS."
                )
                return await self._gtts(text, language_code, output_path)
            speech_config.speech_synthesis_voice_name = voice_name

            audio_config = speechsdk.audio.AudioOutputConfig(filename=output_path)
            synthesizer = speechsdk.SpeechSynthesizer(
                speech_config=speech_config, audio_config=audio_config
            )

            result = synthesizer.speak_text_async(text).get()

            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                duration = result.audio_duration.total_seconds()
                logger.info(f"Azure TTS generated: {output_path} | {duration:.1f}s")
                return output_path, duration
            else:
                raise VoiceGenerationError(f"Azure TTS failed: {result.cancellation_details}")

        except ImportError:
            logger.warning("Azure Speech SDK not installed. Falling back to gTTS.")
            return await self._gtts(text, language_code, output_path)
        except Exception as e:
            raise VoiceGenerationError(f"Azure TTS failed: {str(e)}")
