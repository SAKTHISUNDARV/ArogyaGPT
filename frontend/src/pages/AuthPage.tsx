import { useEffect, useState } from 'react'
import { api } from '../services/api'

interface AuthPageProps {
  onNavigate: (page: string) => void
  onLoginSuccess?: () => void
  initialMode?: 'signin' | 'signup'
}

export default function AuthPage({ onNavigate, onLoginSuccess, initialMode = 'signin' }: AuthPageProps) {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('oauth_error')
    if (oauthError) {
      params.delete('oauth_error')
      window.history.replaceState({}, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}#signin`)
      setErrorMsg(
        oauthError === 'google_oauth_not_configured'
          ? 'Google OAuth is not configured yet.'
          : 'Google authentication could not be completed.'
      )
      return
    }

    if (!params.has('oauth_success')) return

    setIsLoading(true)
    api.googleSession()
      .then(() => {
        params.delete('oauth_success')
        const query = params.toString()
        window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}#signin`)
        if (onLoginSuccess) {
          onLoginSuccess()
        } else {
          onNavigate('dashboard')
        }
      })
      .catch((err: unknown) => {
        const apiError = err as {
          response?: { data?: { message?: string; detail?: string } }
        }
        setErrorMsg(
          apiError.response?.data?.message ||
          apiError.response?.data?.detail ||
          'Google authentication failed. Please try again.'
        )
      })
      .finally(() => setIsLoading(false))
  }, [onLoginSuccess, onNavigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (isSignUp && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      if (isSignUp) {
        await api.register({
          email: email.trim(),
          password,
          confirm_password: confirmPassword,
          full_name: name.trim() || 'User',
        })
      }
      await api.login(email.trim(), password)
      setSubmitted(true)
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess()
          return
        }
        onNavigate('dashboard')
      }, 500)
    } catch (err: unknown) {
      console.error('Auth error:', err)
      const apiError = err as {
        response?: {
          data?: {
            message?: string
            detail?: string
          }
        }
      }
      const detail =
        apiError.response?.data?.message ||
        apiError.response?.data?.detail ||
        'Authentication failed. Please verify your credentials.'
      setErrorMsg(detail)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={`min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4 sm:p-6 md:p-10 ${initialMode === 'signup' ? 'pt-20' : 'pt-4'}`}>
      <div className="w-full max-w-5xl rounded-[32px] border border-[#E3F1EB] bg-white shadow-[0_24px_64px_rgba(24,50,45,0.08)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        
        {/* Left Side: Medical AI Illustration & Branding Banner */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#18322D] via-[#0F766E] to-[#1D9E75] p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Outer Glow */}
          <div className="absolute -left-10 -bottom-10 h-64 w-64 rounded-full bg-[#1D9E75]/30 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 mb-8 text-left"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E1F5EE]">
                <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6" aria-hidden="true">
                  <path d="M6 26 C6 26 8 14 16 10 C24 6 28 10 28 10 C28 10 24 22 16 24 C12 25 8 24 6 26Z" fill="none" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M6 26 L16 16" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="22" cy="11" r="2" fill="#E6A817" />
                </svg>
              </div>
              <span className="font-display text-xl font-semibold tracking-tight">
                Arogya<span className="text-[#7ECFC2]">GPT</span>
              </span>
            </button>

            <h2 className="font-display text-3xl font-light leading-tight sm:text-4xl">
              AI-Powered Health Clarity for Every Patient.
            </h2>
            <p className="mt-4 font-body text-sm leading-relaxed text-[#DCEBE6] max-w-md">
              Upload medical reports, simplify clinical jargon, and chat with your diagnostic results using secure vision AI.
            </p>
          </div>

          {/* Features Illustration card */}
          <div className="relative z-10 mt-8 rounded-[24px] border border-white/20 bg-white/10 p-6 backdrop-blur-md">
            <h4 className="font-display text-sm font-semibold mb-4 text-[#E1F5EE]">Platform Features</h4>
            <div className="grid grid-cols-2 gap-4 text-xs font-body text-[#DCEBE6]">
              <div className="flex items-center gap-2">
                <span>📄</span> OCR Extraction
              </div>
              <div className="flex items-center gap-2">
                <span>🧠</span> AI Summary
              </div>
              <div className="flex items-center gap-2">
                <span>📊</span> Health Insights
              </div>
              <div className="flex items-center gap-2">
                <span>🌍</span> Multi-Language
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-6">
              <h3 className="font-display text-2xl font-bold text-[#18322D]">
                {isSignUp ? 'Create your Account' : 'Welcome Back'}
              </h3>
              <p className="mt-1 font-body text-xs text-[#6B7C77]">
                {isSignUp ? 'Enter details to start simplifying medical reports.' : 'Sign in to access your secure ArogyaGPT workspace.'}
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700 shadow-sm">
                ⚠️ {errorMsg}
              </div>
            )}

            {submitted && (
              <div className="mb-4 rounded-2xl bg-[#1D9E75] p-3 text-xs font-semibold text-white shadow-md animate-pulse">
                ✓ Authenticating... Redirecting to Dashboard...
              </div>
            )}

            <button
              type="button"
              onClick={() => { window.location.href = '/api/v1/auth/google/login' }}
              className="mb-4 flex w-full items-center justify-center gap-3 rounded-full border border-[#DCEBE6] bg-white py-3.5 font-semibold text-[#18322D] shadow-sm transition hover:bg-[#FAFAF8]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path fill="#4285F4" d="M21.35 12.24c0-.74-.07-1.45-.19-2.13H12v4.03h5.25a4.49 4.49 0 0 1-1.95 2.94v3h3.15c1.85-1.7 2.9-4.2 2.9-7.84z"/>
                <path fill="#34A853" d="M12 21.6c2.63 0 4.84-.87 6.45-2.36l-3.15-2.44c-.87.58-1.98.93-3.3.93-2.53 0-4.67-1.71-5.44-4H3.3v3.06A9.6 9.6 0 0 0 12 21.6z"/>
                <path fill="#FBBC05" d="M6.56 13.73A5.78 5.78 0 0 1 6.25 12c0-.6.11-1.18.31-1.73V7.21H3.3A9.6 9.6 0 0 0 2.4 12c0 1.55.37 3.02 1.02 4.31l3.14-2.58z"/>
                <path fill="#EA4335" d="M12 6.27c1.43 0 2.71.49 3.72 1.45l2.79-2.79A9.58 9.58 0 0 0 12 2.4 9.6 9.6 0 0 0 3.3 7.21l3.26 3.06C7.33 7.98 9.47 6.27 12 6.27z"/>
              </svg>
              Continue with Google
            </button>

            <div className="mb-4 flex items-center gap-3 text-[11px] text-[#6B7C77]">
              <span className="h-px flex-1 bg-[#DCEBE6]" />
              <span>or use email</span>
              <span className="h-px flex-1 bg-[#DCEBE6]" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4 font-body text-xs">
              {isSignUp && (
                <div>
                  <label className="block font-medium text-[#4A5E59] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-full border border-[#DCEBE6] bg-[#FAFAF8] px-4 py-3 text-[#18322D] focus:border-[#1D9E75] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-[#4A5E59] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  autoComplete={isSignUp ? 'email' : 'username'}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-full border border-[#DCEBE6] bg-[#FAFAF8] px-4 py-3 text-[#18322D] focus:border-[#1D9E75] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-[#4A5E59] mb-1">Password</label>
                <input
                  type="password"
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-full border border-[#DCEBE6] bg-[#FAFAF8] px-4 py-3 text-[#18322D] focus:border-[#1D9E75] focus:outline-none"
                />
              </div>

              {isSignUp && (
                <div>
                  <label className="block font-medium text-[#4A5E59] mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-full border border-[#DCEBE6] bg-[#FAFAF8] px-4 py-3 text-[#18322D] focus:border-[#1D9E75] focus:outline-none"
                  />
                </div>
              )}

              {!isSignUp && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 accent-[#1D9E75]"
                    />
                    <span className="text-[#4A5E59]">Remember Me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => alert('Password reset link sent to email.')}
                    className="font-semibold text-[#1D9E75] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-full bg-gradient-to-r from-[#1D9E75] to-[#059669] py-3.5 font-semibold text-white shadow-md hover:scale-[1.01] transition disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : isSignUp ? 'Create Account' : 'Sign In'}
              </button>

              {/* Bottom Toggle */}
              <div className="pt-4 text-center">
                <p className="text-[#6B7C77]">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="font-bold text-[#1D9E75] hover:underline"
                  >
                    {isSignUp ? 'Sign In' : 'Create Account'}
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
