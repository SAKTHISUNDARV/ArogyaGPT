import { useState, useRef, useEffect } from 'react'
import ReportPanel, { Section, Parameter } from '../components/report/ReportPanel'
import ChatPanel from '../components/chat/ChatPanel'
import PdfExportContent from '../components/report/PdfExportContent'
import { useSpeech } from '../hooks/useSpeech'
import { api, ReportDetail } from '../services/api'


interface ReportViewPageProps {
  onNavigate: (page: 'home' | 'upload' | 'report') => void
}

const AVAILABLE_LANGUAGES = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi']
const LANGUAGE_CODES: Record<string, string> = {
  English: 'en', Tamil: 'ta', Hindi: 'hi', Telugu: 'te', Kannada: 'kn',
  Malayalam: 'ml', Marathi: 'mr', Bengali: 'bn', Gujarati: 'gu', Punjabi: 'pa',
}

type DownloadState = 'idle' | 'generating' | 'done'

function mapReportToSections(detail: ReportDetail): Section[] {
  if (!detail.lab_results || detail.lab_results.length === 0) {
    return [
      {
        name: detail.report_type || detail.title || 'Laboratory Findings',
        params: [],
      },
    ]
  }

  const params: Parameter[] = detail.lab_results.map((r) => {
    const isAb = r.is_abnormal
    const status: 'normal' | 'warning' | 'critical' = isAb
      ? (r.abnormality_direction === 'high' ? 'critical' : 'warning')
      : 'normal'

    const numVal = r.numeric_value ?? (parseFloat(r.result_value) || 0)
    return {
      name: r.test_name,
      value: r.result_value,
      unit: r.unit || '',
      range: r.reference_range || 'Normal',
      status,
      rangeMin: numVal * 0.7,
      rangeMax: numVal * 1.3,
      actualValue: numVal,
      plain: isAb
        ? `${r.test_name} (${r.result_value} ${r.unit || ''}) is outside expected reference range (${r.reference_range || 'abnormal'}).`
        : `${r.test_name} (${r.result_value} ${r.unit || ''}) is within normal parameters.`,
      translation: `${r.test_name}: ${r.result_value} ${r.unit || ''}`,
    }
  })

  return [
    {
      name: detail.report_type || 'Laboratory Findings',
      params,
    },
  ]
}

function mapReportToInsights(detail: ReportDetail) {
  if (!detail.abnormalities || detail.abnormalities.length === 0) {
    return []
  }
  return detail.abnormalities.map((ab) => ({
    icon: ab.severity === 'critical' ? '🚨' : '⚠️',
    title: `${ab.parameter_name}: ${ab.detected_value} ${ab.parameter_unit || ''}`,
    body:
      ab.plain_language_explanation ||
      ab.clinical_significance ||
      `Recorded outside standard range (${ab.reference_range_text || 'abnormal'}). Consult your physician.`,
  }))
}

export default function ReportViewPage({ onNavigate }: ReportViewPageProps) {
  const [mobileTab, setMobileTab] = useState<'report' | 'chat'>('report')
  const initialLanguage = localStorage.getItem('activeReportLanguage') || 'English'
  const [language, setLanguage] = useState(initialLanguage)

  const [reportData, setReportData] = useState<ReportDetail | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // ── Fetch active report from backend ────────────────────────────────────
  useEffect(() => {
    const reportId = localStorage.getItem('activeReportId')
    if (!reportId) return

    let active = true
    const fetchReport = async () => {
      try {
        const data = await api.getReport(reportId)
        if (active) {
          setReportData(data)
          const persistedLanguage = localStorage.getItem('activeReportLanguage')
          const persistedCode = localStorage.getItem('activeReportLanguageCode')
          if (persistedLanguage) {
            setLanguage(persistedLanguage)
          } else if (persistedCode && data.translations?.length) {
            const matching = data.translations.find((translation) => translation.language_code === persistedCode)
            if (matching) setLanguage(matching.language_name || 'English')
          } else if (data.translations && data.translations.length > 0) {
            setLanguage(data.translations[0].language_name || 'English')
          }

          if (persistedCode && persistedCode !== 'en' && data.status === 'completed') {
            const hasTranslation = data.translations?.some((translation) => translation.language_code === persistedCode)
            if (!hasTranslation) {
              api.translateReport({
                report_id: data.id,
                target_language: persistedCode,
                text_to_translate: data.summary || data.simplified_text || '',
              }).then((translation) => {
                if (!active) return
                setReportData((current) => {
                  if (!current) return current
                  const others = current.translations.filter((item) => item.language_code !== persistedCode)
                  return { ...current, translations: [...others, translation] }
                })
              }).catch((error) => console.warn('Could not translate existing report summary:', error))
            }
          }

          if (data.status === 'processing' || data.status === 'pending') {
            setIsProcessing(true)
          } else {
            setIsProcessing(false)
          }
        }
      } catch (err) {
        console.warn('Could not load report details:', err)
      }
    }

    fetchReport()
    const timer = setInterval(() => {
      if (isProcessing) {
        fetchReport()
      }
    }, 2500)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [isProcessing])

  // ── Voice ──────────────────────────────────────────────────────────────
  const { speak, pause, resume, stop, isSpeaking, isPaused, progress, speechError } = useSpeech()
  const pressTimer = useRef<number | null>(null)

  const handleVoiceClick = () => {
    if (isSpeaking && !isPaused) {
      pause()
    } else if (isPaused) {
      resume()
    } else {
      const text = document.querySelector('[role="tabpanel"]')?.textContent || document.body.innerText
      speak(text, language)
    }
  }

  const startPress = () => {
    pressTimer.current = window.setTimeout(() => stop(), 500)
  }

  const clearPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  // ── Download ───────────────────────────────────────────────────────────
  const [downloadState, setDownloadState] = useState<DownloadState>('idle')
  const [downloadError, setDownloadError] = useState(false)

  const activeTitle = reportData?.title || "Medical Report"
  const activeSections = reportData ? mapReportToSections(reportData) : []
  const activeInsights = reportData ? mapReportToInsights(reportData) : []
  const handleLanguageChange = async (languageName: string) => {
    setLanguage(languageName)
    localStorage.setItem('activeReportLanguage', languageName)
    const targetCode = LANGUAGE_CODES[languageName]
    if (targetCode) localStorage.setItem('activeReportLanguageCode', targetCode)
    if (!reportData || !languageName || languageName === 'English') return

    if (!targetCode) return

    try {
      const translation = await api.translateReport({
        report_id: reportData.id,
        target_language: targetCode,
        text_to_translate: reportData.summary || reportData.simplified_text || activeSummary,
      })
      setReportData((current) => {
        if (!current) return current
        const others = current.translations.filter((item) => item.language_code !== targetCode)
        return { ...current, translations: [...others, translation] }
      })
    } catch (err) {
      console.warn('Could not translate report summary:', err)
    }
  }
  const selectedTranslation = reportData?.translations?.find((translation) => {
    const selected = language.toLowerCase()
    const code = translation.language_code.toLowerCase()
    const name = translation.language_name.toLowerCase()
    return code === selected || name === selected
  })
  const fullSummary =
    selectedTranslation?.translated_text ||
    reportData?.summary ||
    reportData?.simplified_text ||
    "Your medical report has been processed by ArogyaGPT. Review each laboratory parameter and consult your doctor for medical advice."
  const summarySentences = fullSummary.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.slice(0, 2) || []
  const activeSummary = summarySentences.join(' ').trim().slice(0, 420)

  const handleDownload = () => {
    setDownloadState('generating')
    setDownloadError(false)

    const escapeHtml = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    const abnormalCount = activeSections.reduce((total, section) =>
      total + section.params.filter((param) => param.status !== 'normal').length, 0)
    const valueCount = activeSections.reduce((total, section) => total + section.params.length, 0)
    const disclaimer = language === 'Tamil'
      ? 'இந்த அறிக்கை தகவலுக்காக மட்டுமே; இது மருத்துவ நோயறிதல் அல்லது சிகிச்சை ஆலோசனை வழங்காது. தகுதி பெற்ற மருத்துவரை அணுகவும்.'
      : 'This report is for informational purposes only and does not provide medical diagnosis or treatment advice. Consult a qualified doctor.'

    const printable = window.open('', '_blank', 'width=900,height=700')
    if (!printable) {
      setDownloadError(true)
      setDownloadState('idle')
      return
    }

    const sectionsHtml = activeSections.map((section) => {
      const abnormal = section.params.filter((param) => param.status !== 'normal').length
      const rows = section.params.map((param) => `
        <tr>
          <td><strong>${escapeHtml(param.name)}</strong><div class="plain">${escapeHtml(param.plain)}</div></td>
          <td class="value">${escapeHtml(param.value)} ${escapeHtml(param.unit)}</td>
          <td>${escapeHtml(param.range)}</td>
          <td><span class="status ${param.status}">${escapeHtml(param.status === 'normal' ? 'Normal' : param.status === 'warning' ? 'Borderline' : 'Abnormal')}</span></td>
        </tr>`).join('')
      return `<section><div class="section-title"><h3>${escapeHtml(section.name)}</h3><span>${section.params.length} values · ${abnormal} abnormal</span></div><table><thead><tr><th>Parameter</th><th>Your Value</th><th>Normal Range</th><th>Status</th></tr></thead><tbody>${rows || `<tr><td colspan="4">${escapeHtml(activeSummary)}</td></tr>`}</tbody></table></section>`
    }).join('')

    const insightsHtml = activeInsights.map((insight) => `<div class="insight"><strong>${escapeHtml(insight.title)}</strong><div>${escapeHtml(insight.body)}</div></div>`).join('')

    printable.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(activeTitle)}</title><style>
      @page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#18322d;margin:0;font-size:12px}.header{background:#18322d;color:white;padding:18px 22px;display:flex;justify-content:space-between}.brand{font-size:20px;font-weight:bold}.meta{text-align:right}.summary{border:1px solid #d9e8e2;border-left:4px solid #1d9e75;border-radius:8px;margin:16px 0;padding:14px 16px}.summary h2,.section-title h3{margin:0 0 8px}.summary p{margin:0;line-height:1.55}.report-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #dfe9e5;padding:10px 0}section{break-inside:avoid;margin-top:14px}.section-title{display:flex;justify-content:space-between;align-items:center}.section-title span{color:#a96e2e;font-size:11px}table{width:100%;border-collapse:collapse}th{background:#edf5f1;text-align:left;color:#587068;font-size:10px;text-transform:uppercase;padding:7px 8px;border-bottom:1px solid #dfe9e5}td{border-bottom:1px solid #edf0ee;padding:8px;vertical-align:top}.plain{font-size:10px;color:#6b7c77;margin-top:3px}.value{font-family:monospace;font-weight:bold}.status{padding:3px 7px;border-radius:12px;font-size:10px;font-weight:bold}.status.normal{color:#2d7a56;background:#ebf7f1}.status.warning{color:#a96e2e;background:#fef3e8}.status.critical{color:#a03030;background:#fdecea}.insight{border:1px solid #e1e8e5;border-radius:8px;padding:10px;margin-bottom:8px}.insight strong{display:block;margin-bottom:4px}.disclaimer{margin-top:16px;border-top:1px solid #dfe9e5;padding-top:10px;color:#6b7c77;font-size:10px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><div class="header"><div><div class="brand">ArogyaGPT</div>Simplified Medical Report</div><div class="meta"><strong>${escapeHtml(activeTitle)}</strong><br>${escapeHtml(language)}</div></div><div class="summary"><h2>Report Summary</h2><p>${escapeHtml(activeSummary)}</p></div><div class="report-head"><strong>Lab Report</strong><span>${valueCount} values · ${abnormalCount} abnormal</span></div>${sectionsHtml}<h3>Health Insights &amp; Recommendations</h3>${insightsHtml}<div class="disclaimer"><strong>Medical disclaimer:</strong> ${escapeHtml(disclaimer)}</div></body></html>`)
    printable.document.close()
    printable.focus()
    printable.onload = () => {
      printable.print()
      setDownloadState('done')
      setTimeout(() => setDownloadState('idle'), 2000)
    }
  }

  return (
    <div className="flex h-screen h-[100dvh] flex-col overflow-hidden bg-bg-base">

      {/* Hidden PDF export — rendered off-screen, always light */}
      <PdfExportContent
        patientName={activeTitle}
        reportDate={reportData?.report_date || new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        language={language}
        sections={activeSections}
        summary={activeSummary}
        detailedText={reportData?.simplified_text || undefined}
        insights={activeInsights}
      />

      {/* Top bar */}
      <div
        className="sticky top-0 z-40 bg-bg-surface border-b border-[rgba(46,125,107,0.1)]"
      >
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 flex items-center justify-between h-14 md:h-16 gap-4">
          {/* Back + filename */}
          <button
            onClick={() => {
              if (window.confirm('Leave this report and return to upload? Your chat on this page will be cleared.')) {
                onNavigate('upload')
              }
            }}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary
                       transition-colors duration-fast min-h-[44px] flex-shrink-0"
            aria-label="Go back to upload"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M13 4 L7 10 L13 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="font-display text-lg font-medium text-text-primary hidden sm:inline truncate max-w-sm">
              {activeTitle}
            </span>
          </button>

          {/* Processing badge if background pipeline is still active */}
          {isProcessing && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              AI Analyzing Document...
            </span>
          )}

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Language selector */}
            <div className="hidden md:flex items-center gap-1.5 font-body text-sm text-text-secondary
                         px-3 py-1.5 rounded-md border border-[rgba(46,125,107,0.15)]
                         hover:border-brand-glow/40 transition-colors duration-fast min-h-[40px] relative">
              <select
                value={language}
                onChange={(e) => { void handleLanguageChange(e.target.value) }}
                className="appearance-none bg-transparent outline-none cursor-pointer pr-4 text-text-secondary"
                aria-label="Change language"
              >
                {AVAILABLE_LANGUAGES.map(lang => (
                  <option key={lang} value={lang} className="text-text-primary bg-bg-surface">{lang}</option>
                ))}
              </select>
              <svg className="w-3 h-3 absolute right-3 pointer-events-none" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 4 L6 8 L10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>

            {/* ── VOICE BUTTON ── */}
            <div className="relative group">
              {isSpeaking && (
                <div className="absolute -left-5 top-1/2 -translate-y-1/2 flex items-center gap-[2px]">
                  <div className={`w-[3px] rounded-sm bg-brand-glow ${isPaused ? 'h-[8px]' : 'animate-wave-1'}`} />
                  <div className={`w-[3px] rounded-sm bg-brand-glow ${isPaused ? 'h-[14px]' : 'animate-wave-2'}`} />
                  <div className={`w-[3px] rounded-sm bg-brand-glow ${isPaused ? 'h-[8px]' : 'animate-wave-3'}`} />
                </div>
              )}
              <button
                onMouseDown={startPress}
                onMouseUp={clearPress}
                onMouseLeave={clearPress}
                onTouchStart={startPress}
                onTouchEnd={clearPress}
                onClick={handleVoiceClick}
                className={`w-[36px] h-[36px] rounded-full flex items-center justify-center transition-all duration-fast flex-shrink-0
                  ${!isSpeaking && !isPaused
                    ? 'bg-transparent border border-[rgba(126,207,194,0.15)] text-text-muted hover:border-[rgba(126,207,194,0.4)]'
                    : isPaused
                      ? 'bg-[rgba(200,169,110,0.10)] border border-[rgba(200,169,110,0.30)] text-accent-gold'
                      : 'bg-[rgba(46,125,107,0.15)] border border-[rgba(126,207,194,0.40)] text-brand-glow'
                  }`}
                aria-label={!isSpeaking && !isPaused ? 'Listen to report' : isPaused ? 'Resume' : 'Pause reading'}
              >
                {!isPaused && (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                )}
                {isPaused && (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>
              <div className="absolute top-full right-0 mt-2 whitespace-nowrap bg-bg-deep text-text-inverse text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {isSpeaking ? (isPaused ? 'Resume (Hold to stop)' : 'Pause (Hold to stop)') : 'Listen to report'}
              </div>
            </div>

            {/* ── DOWNLOAD BUTTON ── */}
            <div className="relative group">
              <button
                onClick={downloadState === 'idle' ? handleDownload : undefined}
                disabled={downloadState === 'generating'}
                className={`w-[36px] h-[36px] rounded-full flex items-center justify-center transition-all duration-fast flex-shrink-0
                  ${downloadState === 'idle'
                    ? 'bg-transparent border border-[rgba(126,207,194,0.15)] text-text-muted hover:border-[rgba(126,207,194,0.4)] cursor-pointer'
                    : downloadState === 'generating'
                      ? 'bg-[rgba(200,169,110,0.10)] border border-[rgba(200,169,110,0.30)] cursor-not-allowed'
                      : 'bg-[rgba(58,158,110,0.15)] border border-[rgba(58,158,110,0.30)]'
                  }`}
                aria-label={
                  downloadState === 'idle' ? 'Download simplified report'
                  : downloadState === 'generating' ? 'Preparing your PDF...'
                  : 'Downloaded!'
                }
              >
                {downloadState === 'idle' && (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
                {downloadState === 'generating' && (
                  <svg className="w-[16px] h-[16px] animate-spin-smooth" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="rgba(200,169,110,0.25)" strokeWidth="2.5" />
                    <path d="M12 3 A9 9 0 0 1 21 12" stroke="#E6A817" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                )}
                {downloadState === 'done' && (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#3A9E6E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                )}
              </button>

              {downloadState !== 'idle' && (
                <span className={`absolute top-1/2 -translate-y-1/2 right-[44px] whitespace-nowrap text-[11px] pointer-events-none
                  ${downloadState === 'generating' ? 'text-text-muted' : 'text-status-normal'}`}>
                  {downloadState === 'generating' ? 'Preparing PDF...' : ''}
                </span>
              )}

              {downloadState === 'idle' && (
                <div className="absolute top-full right-0 mt-2 whitespace-nowrap bg-bg-deep text-text-inverse text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  Download simplified report
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-[2px] w-full relative overflow-hidden" aria-hidden="true">
        <div
          className={`absolute inset-0 bg-[rgba(126,207,194,0.10)] transition-opacity duration-300 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`}
        >
          <div
            className="h-full bg-gradient-to-r from-brand-primary to-brand-glow transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {downloadState === 'generating' && (
          <div className="absolute inset-0 shimmer-gold" />
        )}

        {downloadState === 'done' && (
          <div className="absolute inset-0 bg-status-normal transition-opacity duration-500" />
        )}
      </div>

      {downloadError && (
        <div className="text-center py-1 font-body text-[11px] text-status-critical bg-status-critical/5">
          Download failed. Please try again.
        </div>
      )}
      {speechError && (
        <div role="alert" className="text-center py-1 font-body text-[11px] text-status-critical bg-status-critical/5">
          {speechError}
        </div>
      )}

      {/* Two-panel layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden max-w-screen-2xl mx-auto w-full pb-14 md:pb-0">

        {/* Left — Report (58%) */}
        <div
          className={`flex-[58] min-h-0 min-w-0 border-r border-[rgba(46,125,107,0.1)]
                       overflow-hidden flex flex-col
                       ${mobileTab === 'chat' ? 'hidden md:flex' : 'flex'}`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6 lg:p-8">
            <ReportPanel
              sections={activeSections}
              summary={activeSummary}
              detailedText={reportData?.simplified_text || undefined}
              insights={activeInsights}
              reportId={reportData?.id}
              language={language}
            />
          </div>
        </div>

        {/* Right — Chat (42%) */}
        <div
          className={`flex-[42] min-h-0 min-w-0 overflow-hidden flex flex-col bg-bg-base
                       ${mobileTab === 'report' ? 'hidden md:flex' : 'flex'}`}
        >
          <div className="min-h-0 flex-1 overflow-hidden flex flex-col p-4 md:p-6">
            <ChatPanel selectedLanguage={language} onLanguageChange={(selected) => { void handleLanguageChange(selected) }} />
          </div>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 bg-bg-deep border-t border-white/8"
        role="tablist"
        aria-label="Switch between report and chat"
      >
        <div className="flex">
          {([
            { key: 'report', label: 'Report', icon: (
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6 7 H14 M6 11 H12 M6 15 H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            )},
            { key: 'chat', label: 'Chat', icon: (
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 5 C4 3.5 5.5 2 7 2 H13 C14.5 2 16 3.5 16 5 V11 C16 12.5 14.5 14 13 14 H11 L8 18 V14 H7 C5.5 14 4 12.5 4 11 Z"
                      stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )},
          ] as { key: 'report' | 'chat'; label: string; icon: React.ReactNode }[]).map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={mobileTab === tab.key}
              onClick={() => setMobileTab(tab.key)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 font-body text-xs
                           transition-colors duration-fast min-h-[56px]
                           ${mobileTab === tab.key
                             ? 'text-accent-gold'
                             : 'text-text-muted/60'}`}
            >
              {tab.icon}
              {tab.label}
              {mobileTab === tab.key && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-accent-gold rounded-full" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
