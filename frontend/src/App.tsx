import { useState } from 'react'
import Navbar from './components/layout/Navbar'
import HomePage from './pages/HomePage'
import UploadPage from './pages/UploadPage'
import ReportViewPage from './pages/ReportViewPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import DashboardPage from './pages/DashboardPage'
import UploadReportPage from './pages/UploadReportPage'
import ProcessingPage from './pages/ProcessingPage'
import ReportSummaryPage from './pages/ReportSummaryPage'
import ChatPage from './pages/ChatPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import TestValuesPage from './pages/TestValuesPage'
import ValueDetailPage from './pages/ValueDetailPage'
import VoiceSummaryPage from './pages/VoiceSummaryPage'
import TranslationPage from './pages/TranslationPage'
import ExportPage from './pages/ExportPage'
import SettingsPage from './pages/SettingsPage'
import ErrorStatesPage from './pages/ErrorStatesPage'


type Page =
  | 'home'
  | 'upload'
  | 'report'
  | 'signin'
  | 'signup'
  | 'forgot-password'
  | 'dashboard'
  | 'upload-report'
  | 'processing'
  | 'summary'
  | 'test-values'
  | 'value-detail'
  | 'chat'
  | 'voice'
  | 'translation'
  | 'history'
  | 'export'
  | 'profile'
  | 'settings'
  | 'errors'

type FontSize = 'normal' | 'large' | 'xl'

const PUBLIC_PAGES: Page[] = ['home', 'report', 'signin', 'signup', 'forgot-password']
const PROTECTED_PAGES: Page[] = [
  'upload',
  'dashboard',
  'upload-report',
  'processing',
  'summary',
  'test-values',
  'value-detail',
  'chat',
  'voice',
  'translation',
  'history',
  'export',
  'profile',
  'settings',
  'errors',
]

const fontSizeMap: Record<FontSize, string> = {
  normal: '16px',
  large: '18px',
  xl: '20px',
}

export default function App() {
  const goToPage = (targetPage: Page) => {
    setPage(targetPage)
    localStorage.setItem('savedPage', targetPage)
    window.location.hash = targetPage
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const [page, setPage] = useState<Page>(() => {
    const hash = window.location.hash.replace('#', '') as Page
    const saved = localStorage.getItem('savedPage') as Page
    const initialPage = hash || saved || 'home'
    const authed = localStorage.getItem('isAuthenticated') === 'true'

    if (PROTECTED_PAGES.includes(initialPage) && !authed) {
      localStorage.setItem('redirectAfterLogin', initialPage)
      window.location.hash = 'signin'
      return 'signin'
    }

    return initialPage
  })
  const [fontSize, setFontSize] = useState<FontSize>('normal')
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('isAuthenticated') === 'true')

  const navigate = (p: string) => {
    if (p === 'logout' || p === 'signout') {
      handleLogout()
      return
    }

    const targetPage = p as Page

    if (PROTECTED_PAGES.includes(targetPage) && !isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', targetPage)
      goToPage('signin')
      return
    }

    goToPage(targetPage)
  }

  const handleFontSize = (size: FontSize) => {
    setFontSize(size)
    document.documentElement.style.setProperty('--font-size-base', fontSizeMap[size])
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.setItem('isAuthenticated', 'false')
    localStorage.removeItem('redirectAfterLogin')
    goToPage('home')
  }

  const handleAuthSuccess = () => {
    setIsAuthenticated(true)
    localStorage.setItem('isAuthenticated', 'true')
    const redirect = (localStorage.getItem('redirectAfterLogin') as Page | null) || 'dashboard'
    localStorage.removeItem('redirectAfterLogin')
    goToPage(PROTECTED_PAGES.includes(redirect) || PUBLIC_PAGES.includes(redirect) ? redirect : 'dashboard')
  }

  const showGlobalNavbar = PUBLIC_PAGES.includes(page) && page !== 'signin' && page !== 'report'

  return (
    <div className={`min-h-screen bg-bg-base font-body fs-${fontSize}`}>
      {showGlobalNavbar && (
        <Navbar
          onNavigate={navigate}
          currentPage={page}
          fontSize={fontSize}
          onFontSizeChange={handleFontSize}
          isLoggedIn={isAuthenticated}
          onLogout={handleLogout}
        />
      )}

      <main>
        {page === 'home' && <HomePage onNavigate={navigate} isLoggedIn={isAuthenticated} />}
        {page === 'upload' && <UploadPage onNavigate={navigate} />}
        {page === 'report' && <ReportViewPage onNavigate={navigate} />}
        {page === 'signin' && <SignInPage onNavigate={navigate} onSignIn={handleAuthSuccess} />}
        {page === 'signup' && <SignUpPage onNavigate={navigate} onSignUp={handleAuthSuccess} />}
        {page === 'forgot-password' && <ForgotPasswordPage onNavigate={navigate} />}
        {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
        {page === 'upload-report' && <UploadReportPage onNavigate={navigate} />}
        {page === 'processing' && <ProcessingPage onNavigate={navigate} />}
        {page === 'summary' && <ReportSummaryPage onNavigate={navigate} />}
        {page === 'test-values' && <TestValuesPage onNavigate={navigate} />}
        {page === 'value-detail' && <ValueDetailPage onNavigate={navigate} />}
        {page === 'chat' && <ChatPage onNavigate={navigate} />}
        {page === 'voice' && <VoiceSummaryPage onNavigate={navigate} />}
        {page === 'translation' && <TranslationPage onNavigate={navigate} />}
        {page === 'history' && <HistoryPage onNavigate={navigate} />}
        {page === 'export' && <ExportPage onNavigate={navigate} />}
        {page === 'profile' && <ProfilePage onNavigate={navigate} />}
        {page === 'settings' && <SettingsPage onNavigate={navigate} />}
        {page === 'errors' && <ErrorStatesPage onNavigate={navigate} />}
      </main>
    </div>
  )
}
