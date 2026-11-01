import UploadPage from './UploadPage'

interface UploadReportPageProps {
  onNavigate: (page: string) => void
}

export default function UploadReportPage({ onNavigate }: UploadReportPageProps) {
  return <UploadPage onNavigate={onNavigate} />
}
