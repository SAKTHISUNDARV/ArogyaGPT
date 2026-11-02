import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';

const langCodeMap: Record<string, string> = {
  'Tamil': 'ta-IN',
  'Hindi': 'hi-IN',
  'Telugu': 'te-IN',
  'Kannada': 'kn-IN',
  'Malayalam': 'ml-IN',
  'Bengali': 'bn-IN',
  'Marathi': 'mr-IN',
  'Gujarati': 'gu-IN',
  'Punjabi': 'pa-IN',
  'English': 'en-IN'
};

export const useSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const fallbackRequestRef = useRef(0);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const playWithBackend = async (text: string, languageCode: string, requestId: number) => {
    try {
      const voice = await api.generateVoice({ text, language_code: languageCode });
      const audioBlob = await api.downloadVoiceAudio(voice.id);
      if (requestId !== fallbackRequestRef.current) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onplay = () => setIsSpeaking(true);
      audio.onended = () => { setIsSpeaking(false); setIsPaused(false); setProgress(0); };
      audio.onpause = () => setIsPaused(true);
      audio.ontimeupdate = () => {
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
      };
      await audio.play();
    } catch (error) {
      if (requestId !== fallbackRequestRef.current) return;
      console.error('Backend text-to-speech failed:', error);
      setIsSpeaking(false);
      setIsPaused(false);
      setSpeechError('Speech playback failed. Please try again.');
    }
  };

  const speak = (text: string, lang: string) => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    const requestId = ++fallbackRequestRef.current;
    setSpeechError(null);
    setIsSpeaking(false);
    setIsPaused(false);
    setProgress(0);
    
    const cleanText = text.replace(/<[^>]+>/g, '');
    const targetLang = langCodeMap[lang] || 'en-IN';
    
    const availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    const voice = availableVoices.find(v => v.lang.includes(targetLang) || v.lang.includes(targetLang.split('-')[0]));
    
    if (!voice) {
      void playWithBackend(cleanText, targetLang.split('-')[0], requestId);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = targetLang;
    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => { setIsSpeaking(false); setProgress(0); };
    utterance.onpause = () => setIsPaused(true);
    utterance.onresume = () => setIsPaused(false);

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        setProgress((charIndex / cleanText.length) * 100);
      }
    };
    utterance.onerror = () => {
      if (utteranceRef.current === utterance) {
        void playWithBackend(cleanText, targetLang.split('-')[0], requestId);
      }
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const pause = () => { 
    if (audioRef.current) {
      audioRef.current.pause();
    } else {
      window.speechSynthesis.pause(); 
    }
    setIsPaused(true); 
  };
  
  const resume = () => { 
    if (audioRef.current) {
      audioRef.current.play();
    } else {
      window.speechSynthesis.resume(); 
    }
    setIsPaused(false); 
  };
  
  const stop = () => {
    fallbackRequestRef.current += 1;
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setProgress(0);
  };

  return { speak, pause, resume, stop, isSpeaking, isPaused, progress, speechError };
};
