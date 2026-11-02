import { useState, useRef, useEffect } from 'react'
import { useSpeech } from '../../hooks/useSpeech'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { api } from '../../services/api'

interface Message {
  id: number
  role: 'user' | 'ai'
  text: string
  lang?: string
}

export interface LanguageOption {
  code: string
  name: string
  native: string
}

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
]

const SUGGESTED_BY_LANG: Record<string, string[]> = {
  ta: [
    'எனது அறிக்கையில் என்ன குறிப்பிடப்பட்டுள்ளது?',
    'எந்த மதிப்புகள் மாறுபட்டுள்ளன?',
    'நான் என்ன முன்னெச்சரிக்கை எடுக்க வேண்டும்?',
  ],
  hi: [
    'मेरी रिपोर्ट क्या दर्शाती है?',
    'कौन से मान असामान्य हैं?',
    'मुझे क्या सावधानियां बरतनी चाहिए?',
  ],
  te: [
    'నా నివేదిక ఏమి తెలియజేస్తుంది?',
    'ఏ విలువలు అసాధారణంగా ఉన్నాయి?',
    'నేను తీసుకోవలసిన జాగ్రత్తలు ఏమిటి?',
  ],
  kn: [
    'ನನ್ನ ವರದಿ ಏನು ಸೂಚಿಸುತ್ತದೆ?',
    'ಯಾವ ಮೌಲ್ಯಗಳು ಅಸಹಜವಾಗಿವೆ?',
    'ನಾನು ಯಾವ ಮುನ್ನೆಚ್ಚರಿಕೆಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಬೇಕು?',
  ],
  ml: [
    'എന്റെ റിപ്പോർട്ട് എന്ത് സൂചിപ്പിക്കുന്നു?',
    'ഏതൊക്കെ മൂല്യങ്ങളാണ് അസാധാരണമായിട്ടുള്ളത്?',
    'ഞാൻ എന്ത് മുൻകരുതലുകൾ എടുക്കണം?',
  ],
  bn: [
    'আমার রিপোর্টে কি বোঝানো হয়েছে?',
    'কোন মানগুলি অস্বাভাবিক?',
    'আমার কি সতর্কতা অবলম্বন করা উচিত?',
  ],
  en: [
    'What does my report indicate?',
    'Which values are abnormal?',
    'What precautions should I take?',
  ],
}

const CHAT_ERROR_BY_LANG: Record<string, string> = {
  ta: 'இப்போது உங்கள் அறிக்கையை பகுப்பாய்வு செய்வதில் சிக்கல் உள்ளது. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.',
  hi: 'अभी आपकी रिपोर्ट का विश्लेषण करने में समस्या आ रही है। कृपया थोड़ी देर बाद फिर से कोशिश करें।',
  te: 'ప్రస్తుతం మీ నివేదికను విశ్లేషించడంలో సమస్య ఉంది. దయచేసి కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.',
  kn: 'ಪ್ರಸ್ತುತ ನಿಮ್ಮ ವರದಿಯನ್ನು ವಿಶ್ಲೇಷಿಸಲು ಸಮಸ್ಯೆಯಾಗುತ್ತಿದೆ. ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.',
  ml: 'ഇപ്പോൾ നിങ്ങളുടെ റിപ്പോർട്ട് വിശകലനം ചെയ്യുന്നതിൽ പ്രശ്നമുണ്ട്. കുറച്ച് കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക.',
  bn: 'এই মুহূর্তে আপনার রিপোর্ট বিশ্লেষণ করতে সমস্যা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  mr: 'सध्या तुमच्या अहवालाचे विश्लेषण करण्यात अडचण येत आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.',
  gu: 'અત્યારે તમારા રિપોર્ટનું વિશ્લેષણ કરવામાં સમસ્યા આવી રહી છે. કૃપા કરીને થોડી વાર પછી ફરી પ્રયાસ કરો.',
  pa: 'ਇਸ ਵੇਲੇ ਤੁਹਾਡੀ ਰਿਪੋਰਟ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰਨ ਵਿੱਚ ਸਮੱਸਿਆ ਆ ਰਹੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਕੁਝ ਦੇਰ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
  or: 'ବର୍ତ୍ତମାନ ଆପଣଙ୍କ ରିପୋର୍ଟ ବିଶ୍ଳେଷଣ କରିବାରେ ସମସ୍ୟା ହେଉଛି। ଦୟାକରି କିଛି ସମୟ ପରେ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',
  ur: 'اس وقت آپ کی رپورٹ کا تجزیہ کرنے میں مسئلہ ہو رہا ہے۔ براہِ کرم کچھ دیر بعد دوبارہ کوشش کریں۔',
}

let msgId = 1

interface ChatPanelProps {
  selectedLanguage?: string
  onLanguageChange?: (lang: string) => void
}

export default function ChatPanel({ selectedLanguage, onLanguageChange }: ChatPanelProps) {
  // Find current language object
  const getLangObj = (langNameOrCode?: string): LanguageOption => {
    if (!langNameOrCode) return SUPPORTED_LANGUAGES[0] // Default Tamil
    const query = langNameOrCode.toLowerCase().trim()
    const found = SUPPORTED_LANGUAGES.find(
      l => l.code.toLowerCase() === query || l.name.toLowerCase() === query || l.native.toLowerCase() === query
    )
    return found || SUPPORTED_LANGUAGES[0]
  }

  const [currentLang, setCurrentLang] = useState<LanguageOption>(() => getLangObj(selectedLanguage))
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync when parent changes language
  useEffect(() => {
    if (selectedLanguage) {
      const match = getLangObj(selectedLanguage)
      if (match.code !== currentLang.code) {
        setCurrentLang(match)
      }
    }
  }, [selectedLanguage, currentLang.code])

  const handleLanguageSelect = (code: string) => {
    const match = SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0]
    setCurrentLang(match)
    if (onLanguageChange) {
      onLanguageChange(match.name)
    }
  }

  const { speak, pause, resume, isSpeaking, isPaused, speechError } = useSpeech()
  const { startListening, stopListening, isListening, transcript } = useSpeechRecognition(currentLang.name)
  
  const [speakingId, setSpeakingId] = useState<number | null>(null)

  useEffect(() => {
    if (!isSpeaking) setSpeakingId(null)
  }, [isSpeaking])

  const handleListenBubble = (id: number, text: string) => {
    if (speakingId === id && isSpeaking && !isPaused) {
      pause()
    } else if (speakingId === id && isPaused) {
      resume()
    } else {
      speak(text, currentLang.name)
      setSpeakingId(id)
    }
  }

  useEffect(() => {
    if (transcript) setInput(transcript)
  }, [transcript])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const sendMessage = async (text: string) => {
    if (!text.trim()) return
    const userMsg: Message = { id: msgId++, role: 'user', text }
    setMessages(p => [...p, userMsg])
    setInput('')
    setTyping(true)

    try {
      const activeReportId = localStorage.getItem('activeReportId') || undefined
      const data = await api.askQuestion({
        question: text,
        report_id: activeReportId,
        language_code: currentLang.code,
      })
      setTyping(false)
      setMessages(p => [...p, { id: msgId++, role: 'ai', text: data.answer, lang: currentLang.native }])
    } catch (error) {
      console.warn('Backend chat API error:', error)
      const errorMsg = CHAT_ERROR_BY_LANG[currentLang.code]
        || "I'm having trouble analyzing your report right now. Please ensure your report has completed processing, or try again in a moment."
      setTyping(false)
      setMessages(p => [...p, { id: msgId++, role: 'ai', text: errorMsg, lang: currentLang.native }])
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const suggestedQuestions = SUGGESTED_BY_LANG[currentLang.code] || SUGGESTED_BY_LANG.en

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="pb-3 border-b border-[rgba(46,125,107,0.1)] mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium text-text-primary tracking-[-0.01em]">
            Ask Your Report
          </h2>
          <p className="font-body text-xs text-text-muted mt-0.5">
            Groq AI answers in your chosen language
          </p>
        </div>

        {/* Language selector in chat */}
        <div className="flex items-center gap-1.5 bg-bg-surface px-2.5 py-1.5 rounded-xl border border-[rgba(46,125,107,0.18)] shadow-sm">
          <span className="text-xs text-text-muted">🗣️</span>
          <select
            value={currentLang.code}
            onChange={e => handleLanguageSelect(e.target.value)}
            className="bg-transparent font-body text-xs font-semibold text-brand-primary outline-none cursor-pointer"
            aria-label="Select Chat Language"
          >
            {SUPPORTED_LANGUAGES.map(l => (
              <option key={l.code} value={l.code} className="text-gray-900 bg-white">
                {l.native} ({l.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Message area */}
      <div
        className="min-h-0 flex-1 overflow-y-auto scrollbar-thin space-y-4 pb-4"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {/* Suggested questions */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 animate-fade-in" aria-label="Suggested questions">
            {suggestedQuestions.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="font-body text-sm px-3.5 py-2.5 rounded-full
                           bg-bg-surface border border-[rgba(46,125,107,0.15)]
                           text-text-secondary hover:border-brand-glow/40 hover:text-brand-primary
                           transition-all duration-fast ease-smooth
                           min-h-[44px] text-left"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
          >
            {msg.role === 'user' ? (
              <div
                className="max-w-[75%] px-4 py-3 rounded-xl font-body text-base text-text-inverse bg-brand-primary"
                style={{ borderBottomRightRadius: 4 }}
              >
                {msg.text}
              </div>
            ) : (
              <div className="max-w-[85%]">
                <div
                  className="px-4 py-3 rounded-xl font-body text-base text-text-primary
                               bg-bg-surface border border-[rgba(46,125,107,0.1)] leading-[1.7]"
                  style={{ borderBottomLeftRadius: 4 }}
                  dangerouslySetInnerHTML={{ 
                    __html: msg.text
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/\n/g, '<br/>') 
                  }}
                />
                <div className="flex items-center gap-3 mt-2 pl-1">
                  <button
                    onClick={() => handleListenBubble(msg.id, msg.text)}
                    className={`flex items-center gap-1.5 font-body text-[12px] px-2.5 py-1 rounded-lg border transition-colors duration-fast
                      ${speakingId === msg.id && isSpeaking && !isPaused
                        ? 'bg-[rgba(46,125,107,0.14)] border-[rgba(126,207,194,0.30)] text-brand-glow'
                        : 'bg-[rgba(46,125,107,0.06)] border-[rgba(126,207,194,0.10)] text-text-muted hover:border-[rgba(126,207,194,0.3)] hover:bg-[rgba(46,125,107,0.10)]'
                      }`}
                    aria-label={speakingId === msg.id && isSpeaking && !isPaused ? "Pause" : "Listen"}
                  >
                    {speakingId === msg.id && isSpeaking && !isPaused ? (
                      <svg className="w-[13px] h-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="10" y1="15" x2="10" y2="9"></line>
                        <line x1="14" y1="15" x2="14" y2="9"></line>
                      </svg>
                    ) : (
                      <svg className="w-[13px] h-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                      </svg>
                    )}
                    {speakingId === msg.id && isSpeaking && !isPaused ? 'Pause' : 'Listen'}
                  </button>

                  {msg.lang && (
                    <span className="font-body text-xs text-text-muted/70">
                      {msg.lang}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex justify-start animate-fade-in">
            <div
              className="px-5 py-3.5 rounded-xl bg-bg-surface border border-[rgba(46,125,107,0.1)]"
              style={{ borderBottomLeftRadius: 4 }}
              aria-label="AI is typing"
            >
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-brand-glow animate-bounce-dot"
                    style={{ animationDelay: `${i * 160}ms` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {speechError && (
        <p role="alert" className="pb-2 text-xs text-status-critical">{speechError}</p>
      )}

      {/* Screen reader announcement */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isListening ? `Listening for voice input in ${currentLang.name}` : ''}
      </div>

      {/* Input bar */}
      <div className="pt-3 border-t border-[rgba(46,125,107,0.1)]">
        <div className="flex items-end gap-2 bg-bg-base rounded-lg border border-[rgba(46,125,107,0.15)]
                        focus-within:border-brand-primary/50 transition-colors duration-fast p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autoResize() }}
            onKeyDown={handleKey}
            placeholder={isListening ? `Listening... speak in ${currentLang.native}` : `Ask in ${currentLang.native} (${currentLang.name})...`}
            className={`flex-1 bg-transparent font-body text-base resize-none outline-none min-h-[48px] max-h-[120px] py-2.5 px-2 leading-[1.5] ${isListening ? 'text-brand-glow italic' : 'text-text-primary placeholder-text-muted'}`}
            aria-label="Type your question"
            rows={1}
          />
          {/* Mic button */}
          <div className="relative flex items-center justify-center">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-[40px] h-[40px] rounded-[10px] flex items-center justify-center flex-shrink-0 transition-colors duration-fast relative z-10
                           ${isListening 
                             ? 'bg-[rgba(212,102,90,0.12)] border border-[rgba(212,102,90,0.3)] text-[#D4665A]' 
                             : 'bg-transparent border-none text-text-muted hover:text-brand-primary'}`}
              aria-label={isListening ? 'Stop recording' : 'Use voice input'}
              aria-pressed={isListening}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </button>
            {isListening && <div className="absolute inset-0 pulse-ring-wrapper pointer-events-none rounded-full" aria-hidden="true"></div>}
          </div>
          {/* Send button */}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim()}
            className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0
                         transition-all duration-fast min-h-[44px] min-w-[44px]
                         ${input.trim()
                           ? 'bg-brand-primary text-text-inverse hover:bg-brand-secondary'
                           : 'bg-text-muted/10 text-text-muted cursor-not-allowed'}`}
            aria-label="Send message"
            aria-disabled={!input.trim()}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M14 8 L2 3 L5 8 L2 13 Z" stroke="currentColor" strokeWidth="1.4"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
