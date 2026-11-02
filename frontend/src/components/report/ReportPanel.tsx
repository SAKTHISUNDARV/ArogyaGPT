import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { useSpeech } from '../../hooks/useSpeech'

type Status = 'normal' | 'warning' | 'critical'

export interface Parameter {
  name: string
  value: string
  unit: string
  range: string
  status: Status
  rangeMin: number
  rangeMax: number
  actualValue: number
  plain: string
  translation: string
}

export interface Section {
  name: string
  params: Parameter[]
}

export interface Insight {
  icon: string
  title: string
  body: string
}

const REPORT_DATA: Section[] = []

const DISCLAIMERS: Record<string, string> = {
  en: 'This report is for informational purposes only and does not provide medical diagnosis or treatment advice. Consult a qualified doctor for clinical interpretation and medical decisions.',
  english: 'This report is for informational purposes only and does not provide medical diagnosis or treatment advice. Consult a qualified doctor for clinical interpretation and medical decisions.',
  ta: 'இந்த அறிக்கை தகவலுக்காக மட்டுமே; இது மருத்துவ நோயறிதல் அல்லது சிகிச்சை ஆலோசனை வழங்காது. மருத்துவ விளக்கத்திற்கும் மருத்துவ முடிவுகளுக்கும் தகுதி பெற்ற மருத்துவரை அணுகவும்.',
  tamil: 'இந்த அறிக்கை தகவலுக்காக மட்டுமே; இது மருத்துவ நோயறிதல் அல்லது சிகிச்சை ஆலோசனை வழங்காது. மருத்துவ விளக்கத்திற்கும் மருத்துவ முடிவுகளுக்கும் தகுதி பெற்ற மருத்துவரை அணுகவும்.',
  hi: 'यह रिपोर्ट केवल जानकारी के लिए है और चिकित्सा निदान या उपचार सलाह प्रदान नहीं करती। नैदानिक व्याख्या और चिकित्सा निर्णय के लिए योग्य चिकित्सक से सलाह लें।',
  hindi: 'यह रिपोर्ट केवल जानकारी के लिए है और चिकित्सा निदान या उपचार सलाह प्रदान नहीं करती। नैदानिक व्याख्या और चिकित्सा निर्णय के लिए योग्य चिकित्सक से सलाह लें।',
  te: 'ఈ నివేదిక సమాచారం కోసం మాత్రమే; ఇది వైద్య నిర్ధారణ లేదా చికిత్స సలహా ఇవ్వదు. వైద్య వివరణ మరియు నిర్ణయాలకు అర్హులైన వైద్యుడిని సంప్రదించండి.',
  telugu: 'ఈ నివేదిక సమాచారం కోసం మాత్రమే; ఇది వైద్య నిర్ధారణ లేదా చికిత్స సలహా ఇవ్వదు. వైద్య వివరణ మరియు నిర్ణయాలకు అర్హులైన వైద్యుడిని సంప్రదించండి.',
  kn: 'ಈ ವರದಿ ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ; ಇದು ವೈದ್ಯಕೀಯ ರೋಗನಿರ್ಣಯ ಅಥವಾ ಚಿಕಿತ್ಸಾ ಸಲಹೆಯನ್ನು ನೀಡುವುದಿಲ್ಲ. ವೈದ್ಯಕೀಯ ವ್ಯಾಖ್ಯಾನ ಮತ್ತು ನಿರ್ಧಾರಗಳಿಗಾಗಿ ಅರ್ಹ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
  kannada: 'ಈ ವರದಿ ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ; ಇದು ವೈದ್ಯಕೀಯ ರೋಗನಿರ್ಣಯ ಅಥವಾ ಚಿಕಿತ್ಸಾ ಸಲಹೆಯನ್ನು ನೀಡುವುದಿಲ್ಲ. ವೈದ್ಯಕೀಯ ವ್ಯಾಖ್ಯಾನ ಮತ್ತು ನಿರ್ಧಾರಗಳಿಗಾಗಿ ಅರ್ಥ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
  ml: 'ഈ റിപ്പോർട്ട് വിവരങ്ങൾക്കായി മാത്രമുള്ളതാണ്; ഇത് രോഗനിർണയമോ ചികിത്സാ നിർദ്ദേശമോ നൽകുന്നില്ല. ക്ലിനിക്കൽ വ്യാഖ്യാനത്തിനും ആരോഗ്യ തീരുമാനങ്ങൾക്കും യോഗ്യതയുള്ള ഡോക്ടറെ സമീപിക്കുക.',
  malayalam: 'ഈ റിപ്പോർട്ട് വിവരങ്ങൾക്കായി മാത്രമുള്ളതാണ്; ഇത് രോഗനിർണയമോ ചികിത്സാ നിർദ്ദേശമോ നൽകുന്നില്ല. ക്ലിനിക്കൽ വ്യാഖ്യാനത്തിനും ആരോഗ്യ തീരുമാനങ്ങൾക്കും യോഗ്യതയുള്ള ഡോക്ടറെ സമീപിക്കുക.',
  bn: 'এই রিপোর্টটি শুধুমাত্র তথ্যের জন্য এবং চিকিৎসাগত নির্ণয় বা চিকিৎসার পরামর্শ প্রদান করে না। ক্লিনিক্যাল ব্যাখ্যা ও চিকিৎসা সিদ্ধান্তের জন্য যোগ্য চিকিৎসকের পরামর্শ নিন।',
  bengali: 'এই রিপোর্টটি শুধুমাত্র তথ্যের জন্য এবং চিকিৎসাগত নির্ণয় বা চিকিৎসার পরামর্শ প্রদান করে না। ক্লিনিক্যাল ব্যাখ্যা ও চিকিৎসা সিদ্ধান্তের জন্য যোগ্য চিকিৎসকের পরামর্শ নিন।',
  mr: 'हा अहवाल फक्त माहितीसाठी आहे आणि वैद्यकीय निदान किंवा उपचारांचा सल्ला देत नाही. क्लिनिकल स्पष्टीकरण आणि वैद्यकीय निर्णयांसाठी पात्र डॉक्टरांचा सल्ला घ्या।',
  marathi: 'हा अहवाल फक्त माहितीसाठी आहे आणि वैद्यकीय निदान किंवा उपचारांचा सल्ला देत नाही. क्लिनिकल स्पष्टीकरण आणि वैद्यकीय निर्णयांसाठी पात्र डॉक्टरांचा सल्ला घ्या।',
  gu: 'આ રિપોર્ટ માત્ર માહિતી માટે છે અને તબીબી નિદાન અથવા સારવારની સલાહ આપતું નથી. તબીબી અર્થઘટન અને નિર્ણયો માટે સપ્રમાણિત ડોક્ટરની સલાહ લો.',
  gujarati: 'આ રિપોર્ટ માત્ર માહિતી માટે છે અને તબીબી નિદાન અથવા સારવારની સલાહ આપતું નથી. તબીબી અર્થઘટન અને નિર્ણયો માટે સપ્રમાણિત ડોક્ટરની સલાહ લો.',
  pa: 'ਇਹ ਰਿਪੋਰਟ ਸਿਰਫ ਜਾਣਕਾਰੀ ਲਈ ਹੈ ਅਤੇ ਡਾਕਟਰੀ ਨਿਸ਼ਚਿਤਤਾ ਜਾਂ ਇਲਾਜ ਦੀ ਸਲਾਹ ਨਹੀਂ ਦਿੰਦੀ। ਕਲੀਨਿਕਲ ਵਿਆਖਿਆ ਅਤੇ ਇਲਾਜ ਦੇ ਫੈਸਲਿਆਂ ਲਈ ਯੋਗ ਡਾਕਟਰ ਨਾਲ ਸਲਾਹ ਕਰੋ।',
  punjabi: 'ਇਹ ਰਿਪੋਰਟ ਸਿਰਫ ਜਾਣਕਾਰੀ ਲਈ ਹੈ ਅਤੇ ਡਾਕਟਰੀ ਨਿਸ਼ਚਿਤਤਾ ਜਾਂ ਇਲਾਜ ਦੀ ਸਲਾਹ ਨਹੀਂ ਦਿੰਦੀ। ਕਲੀਨਿਕਲ ਵਿਆਖਿਆ ਅਤੇ ਇਲਾਜ ਦੇ ਫੈਸਲਿਆਂ ਲਈ ਯੋਗ ਡਾਕਟਰ ਨਾਲ ਸਲਾਹ ਕਰੋ।',
  or: 'ଏହି ରିପୋର୍ଟ କେବଳ ସୂଚନା ପାଇଁ ଏବଂ ଏହା ଚିକିତ୍ସା ନିର୍ଣ୍ଣୟ କିମ୍ବା ଚିକିତ୍ସା ପରାମର୍ଶ ଦିଏ ନାହିଁ। କ୍ଲିନିକାଲ ବ୍ୟାଖ୍ୟା ଓ ନିର୍ଣ୍ଣୟ ପାଇଁ ଯୋଗ୍ୟ ଡାକ୍ତରଙ୍କୁ ପରାମର୍ଶ କରନ୍ତୁ।',
  odia: 'ଏହି ରିପୋର୍ଟ କେବଳ ସୂଚନା ପାଇଁ ଏବଂ ଏହା ଚିକିତ୍ସା ନିର୍ଣ୍ଣୟ କିମ୍ବା ଚିକିତ୍ସା ପରାମର୍ଶ ଦିଏ ନାହିଁ। କ୍ଲିନିକାଲ ବ୍ୟାଖ୍ୟା ଓ ନିର୍ଣ୍ଣୟ ପାଇଁ ଯୋଗ୍ୟ ଡାକ୍ତରଙ୍କୁ ପରାମର୍ଶ କରନ୍ତୁ।',
  ur: 'یہ رپورٹ صرف معلومات کے لیے ہے اور طبی تشخیص یا علاج کی مشورہ نہیں دیتی۔ طبی تشریح اور فیصلوں کے لیے اہل ڈاکٹر سے مشورہ کریں۔',
  urdu: 'یہ رپورٹ صرف معلومات کے لیے ہے اور طبی تشخیص یا علاج کی مشورہ نہیں دیتی۔ طبی تشریح اور فیصلوں کے لیے اہل ڈاکٹر سے مشورہ کریں۔',
}

const getDisclaimer = (language: string) => DISCLAIMERS[language.toLowerCase().trim()] || DISCLAIMERS.en

interface ReportPanelProps {
  sections?: Section[]
  summary?: string
  detailedText?: string
  insights?: Insight[]
  reportId?: string
  language?: string
}

const StatusBadge = ({ status }: { status: Status }) => {
  const map: Record<Status, { label: string; cls: string; icon: string }> = {
    normal:   { label: 'Normal',     cls: 'badge-normal',   icon: '✓' },
    warning:  { label: 'Borderline', cls: 'badge-warning',  icon: '~' },
    critical: { label: 'High',       cls: 'badge-critical', icon: '!' },
  }
  const { label, cls, icon } = map[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-body font-medium ${cls}`}
          role="status" aria-label={`Value status: ${label}`}>
      <span aria-hidden="true">{icon}</span>{label}
    </span>
  )
}

const RangeBar = ({ min, max, value }: { min: number; max: number; value: number }) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const color = value > max ? '#C0574A' : value < min ? '#D4924A' : '#3A9E6E'
  return (
    <div className="relative w-20 h-1.5 bg-text-muted/15 rounded-full overflow-visible" aria-hidden="true">
      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: '100%', background: 'rgba(58,158,110,0.15)' }} />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-bg-surface"
        style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', background: color }}
      />
    </div>
  )
}

type ReportTab = 'simplified' | 'values' | 'insights'

export default function ReportPanel({
  sections: propSections,
  summary: propSummary,
  detailedText,
  insights: propInsights = [],
  reportId,
  language = 'English',
}: ReportPanelProps = {}) {
  const activeData = propSections && propSections.length > 0 ? propSections : REPORT_DATA
  const activeSummary = propSummary || 'Your medical report has been processed by ArogyaGPT. Please review your laboratory findings and clinical parameters.'

  const [activeTab, setActiveTab] = useState<ReportTab>('simplified')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'Complete Blood Count': true, 'Diagnostic Report': true, 'Laboratory Findings': true })
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [explainingTerm, setExplainingTerm] = useState<string | null>(null)

  const toggleSection = (name: string) =>
    setExpanded(p => ({ ...p, [name]: !p[name] }))

  const allParams = activeData.flatMap(s => s.params)
  const filtered = filter === 'all' ? allParams : allParams.filter(p => p.status === filter)

  // Compute lab-based insights from abnormal params
  const labInsights: Insight[] = allParams
    .filter(p => p.status !== 'normal')
    .map(p => ({
      icon: p.status === 'critical' ? '🚨' : '⚠️',
      title: `${p.name} is ${p.status === 'critical' ? 'Outside Standard Range' : 'Borderline'}`,
      body: `Recorded value: ${p.value} ${p.unit} (Reference: ${p.range}). ${p.plain}`,
    }))

  // Merge: backend abnormalities (propInsights) take priority; if lab insights also exist, combine
  const allInsights: Insight[] = propInsights.length > 0 ? propInsights : labInsights

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-bg-base rounded-lg mb-4" role="tablist" aria-label="Report sections">
        {([
          { key: 'simplified', label: 'Simplified Report' },
          { key: 'values',     label: 'Test Values' },
          { key: 'insights',   label: 'Health Insights' },
        ] as { key: ReportTab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 font-body text-sm py-2 px-3 rounded-md transition-all duration-fast ease-smooth
              ${activeTab === tab.key
                ? 'bg-brand-primary text-text-inverse shadow-card'
                : 'text-text-secondary hover:text-text-primary'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">

        {/* TAB 1: Simplified Report */}
        {activeTab === 'simplified' && (
          <div id="tabpanel-simplified" role="tabpanel" aria-label="Simplified report">
            {/* Summary card */}
            <div className="bg-bg-deep rounded-lg p-6 mb-6">
              <p className="font-body text-xs uppercase tracking-[0.1em] text-text-muted mb-3">Report Summary</p>
              <div
                className="font-display text-lg italic text-text-inverse leading-[1.7] font-light"
                dangerouslySetInnerHTML={{
                  __html: activeSummary
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br/>')
                }}
              />
            </div>

            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-body text-xs leading-relaxed text-amber-900">
              <strong>Medical disclaimer:</strong> {getDisclaimer(language)}
            </div>

            {/* Sections */}
            <div className="space-y-3">
              {activeData.map(section => {
                const abnormal = section.params.filter(p => p.status !== 'normal').length
                const isOpen = expanded[section.name] !== false
                return (
                  <div key={section.name} className="bg-bg-surface rounded-lg border border-[rgba(46,125,107,0.08)]">
                    <button
                      onClick={() => toggleSection(section.name)}
                      className="w-full flex items-center justify-between p-4 text-left min-h-[56px]"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-body text-lg font-semibold text-text-primary">{section.name}</span>
                        <span className={`font-body text-xs px-2.5 py-1 rounded-full
                          ${abnormal > 0 ? 'bg-status-warning/10 text-status-warning' : 'bg-status-normal/10 text-status-normal'}`}>
                          {section.params.length === 0
                            ? 'Diagnostic Report'
                            : `${section.params.length} values · ${abnormal > 0 ? `${abnormal} abnormal` : 'all normal'}`}
                        </span>
                      </div>
                      <svg
                        className={`w-5 h-5 text-text-muted transition-transform duration-base ${isOpen ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M5 8 L10 13 L15 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 space-y-3 border-t border-[rgba(46,125,107,0.06)]">
                        {section.params.length === 0 && detailedText ? (
                          <div
                            className="space-y-1 p-4 bg-bg-base/60 rounded-lg font-body text-base text-text-primary leading-[1.7]"
                          >
                            {detailedText.split('\n').map((line, index) => {
                              const term = line
                                .replace(/<[^>]*>/g, '')
                                .replace(/[*_#`>-]/g, '')
                                .trim()
                              if (!line.trim()) {
                                return <div key={`line-${index}`} className="h-2" />
                              }
                              return (
                                <div key={`line-${index}`} className="flex items-start gap-2">
                                  <span
                                    className="min-w-0 flex-1"
                                    dangerouslySetInnerHTML={{
                                      __html: line
                                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*(.*?)\*/g, '<em>$1</em>'),
                                    }}
                                  />
                                </div>
                                )
                              })}
                            </div>
                        ) : (
                          section.params.map(param => (
                            <div
                              key={param.name}
                              className={`rounded-lg p-4 ${param.status === 'critical' ? 'row-critical' : 'bg-bg-base/60'}`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  {param.status === 'critical' && (
                                    <span className="text-status-critical font-bold text-base" aria-label="Critical value">!</span>
                                  )}
                                  <span className="font-body text-base font-medium text-text-primary">{param.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setExplainingTerm(param.name)}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white border border-brand-primary/20 transition-all cursor-pointer flex-shrink-0"
                                    title={`What does "${param.name}" mean? Click to explain in ${language}`}
                                    aria-label={`Explain ${param.name} in ${language}`}
                                  >
                                    i
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`font-mono text-base font-semibold
                                    ${param.status === 'critical' ? 'text-status-critical'
                                      : param.status === 'warning' ? 'text-status-warning'
                                      : 'text-text-primary'}`}>
                                    {param.value} {param.unit}
                                  </span>
                                  <StatusBadge status={param.status} />
                                </div>
                              </div>
                              <p className="font-body text-sm italic text-text-secondary leading-[1.6] mb-1">{param.plain}</p>
                              <p className="font-body text-sm text-brand-secondary">{param.translation}</p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Test Values */}
        {activeTab === 'values' && (
          <div id="tabpanel-values" role="tabpanel" aria-label="Test values table">
            {/* Filter chips */}
            <div className="flex gap-2 mb-5 flex-wrap" role="radiogroup" aria-label="Filter results">
              {([
                { key: 'all', label: 'All' },
                { key: 'normal', label: '✓ Normal' },
                { key: 'warning', label: '~ Borderline' },
                { key: 'critical', label: '! Abnormal' },
              ] as { key: 'all' | Status; label: string }[]).map(f => (
                <button
                  key={f.key}
                  role="radio"
                  aria-checked={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`lang-chip font-body text-sm px-4 py-2 rounded-full border min-h-[40px]
                    ${filter === f.key
                      ? 'bg-brand-primary text-text-inverse border-transparent'
                      : 'bg-bg-surface text-text-secondary border-[rgba(46,125,107,0.15)] hover:border-brand-glow/40'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {allParams.length === 0 ? (
              <div className="bg-bg-surface rounded-lg border border-[rgba(46,125,107,0.1)] p-6 text-center mt-4">
                <h3 className="font-display font-medium text-text-primary text-base mb-1">No Structured Values Found</h3>
                <p className="text-sm text-text-muted max-w-md mx-auto">
                  This report does not contain tabular laboratory values. It may be an imaging report (like an X-Ray or MRI) or a clinical note.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-4 py-2">
                  {['Parameter', 'Your Value', 'Normal Range', 'Status', 'Position'].map(h => (
                    <span key={h} className="font-body text-xs uppercase tracking-[0.08em] text-text-muted">{h}</span>
                  ))}
                </div>
                {filtered.map((param, i) => (
                  <div
                    key={param.name}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center
                                 px-4 py-3 rounded-lg
                                 ${i % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-base/50'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-body text-base text-text-primary truncate" title={param.name}>
                        {param.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExplainingTerm(param.name)}
                        className="inline-flex items-center justify-center w-5 h-5 flex-shrink-0 rounded-full text-xs font-bold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white border border-brand-primary/20 transition-all cursor-pointer"
                        title={`What does "${param.name}" mean? Click to explain in ${language}`}
                        aria-label={`Explain ${param.name} in ${language}`}
                      >
                        i
                      </button>
                    </div>
                    <span className={`font-mono text-sm font-semibold
                      ${param.status === 'critical' ? 'text-status-critical'
                        : param.status === 'warning' ? 'text-status-warning'
                        : 'text-text-primary'}`}>
                      {param.value} {param.unit}
                    </span>
                    <span className="font-mono text-xs text-text-muted">{param.range}</span>
                    <StatusBadge status={param.status} />
                    <RangeBar min={param.rangeMin} max={param.rangeMax} value={param.actualValue} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Health Insights */}
        {activeTab === 'insights' && (
          <div id="tabpanel-insights" role="tabpanel" aria-label="Health insights" className="space-y-4">
            {allInsights.length === 0 ? (
              <div className="bg-bg-surface rounded-lg border border-[rgba(46,125,107,0.1)] p-6 text-center mt-4">
                <p className="text-2xl mb-2">✅</p>
                <h3 className="font-display font-medium text-text-primary text-base mb-1">No Abnormal Findings</h3>
                <p className="text-sm text-text-muted max-w-md mx-auto">
                  No critical or abnormal findings were flagged in this report. Consult your doctor for a complete clinical interpretation.
                </p>
              </div>
            ) : (
              allInsights.map((insight, i) => (
                <InsightCard
                  key={`${insight.title}-${i}`}
                  icon={insight.icon}
                  title={insight.title}
                  body={insight.body}
                  language={language}
                  onExplainTerm={(term) => setExplainingTerm(term)}
                  sections={[
                    { q: 'Clinical Significance', a: insight.body },
                    { q: 'Recommended Action', a: 'Discuss this finding with your physician for clinical evaluation and treatment guidance.' },
                  ]}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Medical Term Explainer Modal */}
      {explainingTerm && (
        <TermExplanationModal
          term={explainingTerm}
          reportId={reportId}
          language={language}
          onClose={() => setExplainingTerm(null)}
        />
      )}
    </div>
  )
}

function InsightCard({
  icon,
  title,
  body,
  sections,
  language,
  onExplainTerm,
}: {
  icon: string
  title: string
  body: string
  sections: { q: string; a: string }[]
  language: string
  onExplainTerm: (term: string) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  const cleanTerm = title.split(':')[0].trim()

  return (
    <div className="bg-bg-surface rounded-xl shadow-card border border-[rgba(46,125,107,0.12)] p-6 card-hover transition-all">
      <div className="text-4xl mb-4" aria-hidden="true">{icon}</div>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <h3 className="font-display text-xl font-medium text-text-primary tracking-[-0.01em] flex-1 min-w-[200px]">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => onExplainTerm(cleanTerm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-primary/10 hover:bg-brand-primary hover:text-white text-brand-primary border border-brand-primary/25 text-xs font-semibold transition-all cursor-pointer flex-shrink-0 shadow-xs"
          title={`Explain what "${cleanTerm}" means in ${language}`}
        >
          <span className="w-4 h-4 rounded-full bg-brand-primary/20 flex items-center justify-center text-[10px] font-bold">i</span>
          <span>Explain Term</span>
        </button>
      </div>
      <p
        className="font-body text-base text-text-secondary leading-[1.7] mb-5"
        dangerouslySetInnerHTML={{
          __html: body
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br/>')
        }}
      />
      <div className="space-y-2">
        {sections.map((s, i) => (
          <div key={s.q} className="border-t border-[rgba(46,125,107,0.08)] pt-3">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between text-left min-h-[44px]"
              aria-expanded={open === i}
            >
              <span className="font-body text-base font-medium text-text-primary">{s.q}</span>
              <svg
                className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-fast ${open === i ? 'rotate-180' : ''}`}
                viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6 L8 10 L12 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            {open === i && (
              <p className="font-body text-base text-text-secondary leading-[1.7] mt-2 pb-1 animate-fade-in">{s.a}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const LANGUAGE_CODES: Record<string, string> = {
  tamil: 'ta',
  english: 'en',
  hindi: 'hi',
  telugu: 'te',
  kannada: 'kn',
  malayalam: 'ml',
  bengali: 'bn',
  marathi: 'mr',
  gujarati: 'gu',
  punjabi: 'pa',
  odia: 'or',
  urdu: 'ur',
}

function TermExplanationModal({
  term,
  reportId,
  language,
  onClose,
}: {
  term: string
  reportId?: string
  language: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState('')
  const { speak, stop, isSpeaking } = useSpeech()

  // Clean term (remove trailing values or colons if present)
  const cleanTerm = term.split(':')[0].trim()

  useEffect(() => {
    let active = true
    const fetchExplanation = async () => {
      setLoading(true)
      setError('')
      try {
        const langCode = LANGUAGE_CODES[language.toLowerCase()] || 'en'
        const res = await api.explainReportTerm(reportId, cleanTerm, langCode)
        if (active) {
          setExplanation(res)
        }
      } catch {
        if (active) {
          setError('Could not load the explanation. Please try again.')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchExplanation()
    return () => {
      active = false
      stop()
    }
  }, [cleanTerm, language, reportId])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stop()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, stop])

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      stop()
    } else if (explanation) {
      speak(explanation, language)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={() => { stop(); onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="term-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-bg-surface border border-[rgba(46,125,107,0.2)] p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[rgba(46,125,107,0.12)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-semibold tracking-wide uppercase">
                Medical Term Explainer
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-bg-base border border-brand-primary/15 text-text-secondary font-medium">
                🌐 {language}
              </span>
            </div>
            <h3 id="term-modal-title" className="font-display text-xl sm:text-2xl font-medium text-text-primary leading-snug">
              {cleanTerm}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => { stop(); onClose() }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-base transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-brand-primary/20 border-t-brand-primary animate-spin" />
              <p className="font-body text-sm text-text-secondary">
                Asking Groq AI to explain <strong className="text-text-primary">"{cleanTerm}"</strong> in {language}...
              </p>
            </div>
          ) : error ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-status-critical">⚠️ {error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  setError('')
                  const langCode = LANGUAGE_CODES[language.toLowerCase()] || 'en'
                  api.explainReportTerm(reportId, cleanTerm, langCode)
                    .then(setExplanation)
                    .catch(() => setError('Could not load the explanation. Please try again.'))
                    .finally(() => setLoading(false))
                }}
                className="px-4 py-2 rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="font-body text-base text-text-primary leading-[1.8] whitespace-pre-line bg-bg-base/50 p-4 rounded-xl border border-brand-primary/10">
                {explanation}
              </div>

              {/* Audio Listen Bar */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-brand-primary/[0.06] border border-brand-primary/15">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔊</span>
                  <span className="text-xs font-medium text-text-primary">
                    {isSpeaking ? `Reading aloud in ${language}...` : `Listen to explanation in ${language}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSpeak}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm
                    ${isSpeaking
                      ? 'bg-status-critical text-white hover:bg-status-critical/90'
                      : 'bg-brand-primary text-white hover:bg-brand-primary/90'}`}
                >
                  <span>{isSpeaking ? '⏹ Stop' : '▶ Play'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[rgba(46,125,107,0.12)] flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-text-muted leading-tight max-w-xs">
            💡 Educational explanation powered by Groq AI. Always consult your doctor for clinical diagnosis.
          </p>
          <button
            type="button"
            onClick={() => { stop(); onClose() }}
            className="px-5 py-2 rounded-xl bg-brand-primary text-white font-medium text-sm hover:bg-brand-primary/90 transition-all cursor-pointer shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
