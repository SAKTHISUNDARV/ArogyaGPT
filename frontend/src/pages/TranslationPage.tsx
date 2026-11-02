import { useState } from 'react'
import AuthenticatedShell from '../components/layout/AuthenticatedShell'
import { api } from '../services/api'

interface TranslationPageProps {
  onNavigate: (page: string) => void
}

const STATIC_LANGUAGES = [
  { language: 'English', code: 'en', tone: 'Voice + text' },
  { language: 'Tamil', code: 'ta', tone: 'Voice + text' },
  { language: 'Hindi', code: 'hi', tone: 'Voice + text' },
  { language: 'Malayalam', code: 'ml', tone: 'Text translation · Voice coming soon' },
  { language: 'Kannada', code: 'kn', tone: 'Text translation · Voice coming soon' },
  { language: 'Telugu', code: 'te', tone: 'Text translation · Voice coming soon' },
  { language: 'Bengali', code: 'bn', tone: 'Text translation · Voice coming soon' },
  { language: 'Marathi', code: 'mr', tone: 'Text translation · Voice coming soon' },
  { language: 'Gujarati', code: 'gu', tone: 'Text translation · Voice coming soon' },
  { language: 'Punjabi', code: 'pa', tone: 'Text translation · Voice coming soon' },
]

export default function TranslationPage({ onNavigate }: TranslationPageProps) {
  const [translating, setTranslating] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const reportId = localStorage.getItem('activeReportId') ?? ''

  const handleDownload = async (code: string, language: string) => {
    if (!reportId) {
      setError('No active report selected. Please open a report first.')
      setTimeout(() => setError(null), 3000)
      return
    }
    setTranslating(code)
    setError(null)
    try {
      const result = await api.translateReport({
        report_id: reportId,
        target_language: code,
      })
      const translatedText = typeof result === 'string'
        ? result
        : (result as { translated_text?: string } | undefined)?.translated_text ?? `[${language}] Translation complete.`
      const blob = new Blob(
        [translatedText],
        { type: 'text/plain;charset=utf-8' }
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${language.toLowerCase()}.txt`
      a.click()
      URL.revokeObjectURL(url)
      setDone(d => ({ ...d, [code]: true }))
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { detail?: string } } }
      setError(apiError.response?.data?.detail ?? 'Translation failed. Please try again.')
      setTimeout(() => setError(null), 4000)
    } finally {
      setTranslating(null)
    }
  }

  return (
    <AuthenticatedShell
      title="Translation center"
      subtitle="Translate the report into regional languages with voice support and downloadable copies."
      onNavigate={onNavigate}
      currentPage="translation"
      actionLabel="Open Voice Summary"
      onAction={() => onNavigate('voice')}
    >
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-[#E3F1EB] bg-white p-5 shadow-[0_16px_40px_rgba(24,50,45,0.05)]">
          <h3 className="font-display text-xl font-semibold text-[#18322D]">Available translations</h3>
          <div className="mt-5 space-y-3">
            {STATIC_LANGUAGES.map((item) => (
              <div key={item.code} className="flex flex-col gap-3 rounded-[20px] border border-[#EEF5F2] bg-[#FCFDFB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#18322D]">{item.language}</p>
                  <p className="mt-1 text-xs text-[#8FA49E]">{item.tone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-[#EAF8F1] px-3 py-1 text-xs font-semibold text-[#1D9E75]">
                    {done[item.code] ? '✓ Done' : 'Ready'}
                  </span>
                  <button
                    onClick={() => handleDownload(item.code, item.language)}
                    disabled={translating === item.code}
                    className="rounded-full border border-[#DCEBE6] px-4 py-2 text-sm font-semibold text-[#18322D] hover:bg-[#EAF8F1] disabled:opacity-50 transition-colors"
                  >
                    {translating === item.code ? 'Translating…' : 'Download'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-[#E3F1EB] bg-[linear-gradient(135deg,_#F7FCF9_0%,_#FFFFFF_100%)] p-5 shadow-[0_16px_40px_rgba(24,50,45,0.05)]">
            <h3 className="font-display text-xl font-semibold text-[#18322D]">Voice translation</h3>
            <p className="mt-3 text-sm leading-6 text-[#4A5E59]">Generate spoken narration in the same language so patients can listen instead of read.</p>
            <button onClick={() => onNavigate('voice')} className="mt-5 rounded-full bg-gradient-to-r from-[#1D9E75] to-[#059669] px-4 py-2.5 text-sm font-semibold text-white">
              Start voice translation
            </button>
          </div>

          <div className="rounded-[24px] border border-[#E3F1EB] bg-white p-5 shadow-[0_16px_40px_rgba(24,50,45,0.05)]">
            <h3 className="font-display text-xl font-semibold text-[#18322D]">Delivery options</h3>
            <div className="mt-4 space-y-3 text-sm text-[#4A5E59]">
              <div className="rounded-[16px] bg-[#F7FCF9] p-3">Download translated report as PDF.</div>
              <div className="rounded-[16px] bg-[#F7FCF9] p-3">Share directly to WhatsApp or email.</div>
              <div className="rounded-[16px] bg-[#F7FCF9] p-3">Print the patient-friendly regional language version.</div>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedShell>
  )
}
