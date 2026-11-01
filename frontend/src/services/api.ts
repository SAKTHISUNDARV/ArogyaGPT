/**
 * ArogyaGPT - Unified Frontend API Client Service
 * Fully typed API interface connecting React to the FastAPI backend.
 */
import axios, { AxiosError } from 'axios'

const API_BASE = '/api/v1'

export interface User {
  id: string
  email: string
  full_name: string
  role: string
  preferred_language: string
  is_active: boolean
  is_email_verified: boolean
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface LoginResponseData {
  user: User
  tokens: AuthTokens
}

export interface LabResult {
  id: string
  test_name: string
  result_value: string
  numeric_value?: number | null
  unit?: string | null
  reference_range?: string | null
  is_abnormal: boolean
  abnormality_direction?: string | null
  category?: string | null
}

export interface Abnormality {
  id: string
  parameter_name: string
  detected_value: string
  parameter_unit?: string | null
  reference_range_text?: string | null
  abnormality_type?: string | null
  severity: string
  clinical_significance?: string | null
  plain_language_explanation?: string | null
}

export interface Diagnosis {
  id: string
  condition_name: string
  confidence_score?: number | null
  source: string
  plain_language?: string | null
}

export interface Translation {
  id: string
  language_code: string
  language_name: string
  original_text: string
  translated_text: string
}

export interface ReportItem {
  id: string
  title: string
  report_type?: string | null
  status: string
  pipeline_stage: string
  risk_level?: string | null
  hospital_name?: string | null
  report_date?: string | null
  created_at: string
  updated_at: string
  file_count: number
}

export interface ReportDetail extends ReportItem {
  description?: string | null
  doctor_name?: string | null
  simplified_text?: string | null
  summary?: string | null
  lab_results: LabResult[]
  abnormalities: Abnormality[]
  diagnoses: Diagnosis[]
  translations: Translation[]
}

export interface ChatSourceChunk {
  text: string
  score: number
  chunk_index: number
}

export interface AskQuestionResponseData {
  answer: string
  session_id: string
  message_id: string
  source_chunks?: ChatSourceChunk[]
  model_used?: string
  latency_ms?: number
}

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Auto-attach JWT Bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 unauthenticated
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.setItem('isAuthenticated', 'false')
    }
    return Promise.reject(error)
  }
)

export const api = {
  // --- Auth ---
  async login(email: string, password: string): Promise<LoginResponseData> {
    const res = await apiClient.post<{ data: LoginResponseData }>('/auth/login', {
      email,
      password,
    })
    const { user, tokens } = res.data.data
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('currentUser', JSON.stringify(user))
    return res.data.data
  },

  async googleSession(): Promise<LoginResponseData> {
    const res = await apiClient.get<{ data: LoginResponseData }>('/auth/google/session')
    const { user, tokens } = res.data.data
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    localStorage.setItem('isAuthenticated', 'true')
    localStorage.setItem('currentUser', JSON.stringify(user))
    return res.data.data
  },

  async register(data: {
    email: string
    password: string
    full_name: string
    preferred_language?: string
    role?: string
  }): Promise<User> {
    const res = await apiClient.post<{ data: User }>('/auth/register', {
      ...data,
      role: data.role || 'patient',
      preferred_language: data.preferred_language || 'en',
    })
    return res.data.data
  },

  async getMe(): Promise<User> {
    const res = await apiClient.post<{ data: User }>('/auth/me')
    return res.data.data
  },

  logout(): void {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.setItem('isAuthenticated', 'false')
    localStorage.removeItem('currentUser')
  },

  getCurrentUser(): User | null {
    const raw = localStorage.getItem('currentUser')
    if (!raw) return null
    try {
      return JSON.parse(raw) as User
    } catch {
      return null
    }
  },

  // --- Reports ---
  async uploadReport(
    file: File,
    meta: {
      title: string
      report_type?: string
      preferred_language?: string
      hospital_name?: string
      doctor_name?: string
      description?: string
    }
  ): Promise<ReportItem> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', meta.title || file.name)
    if (meta.report_type) formData.append('report_type', meta.report_type)
    if (meta.preferred_language) formData.append('preferred_language', meta.preferred_language)
    if (meta.hospital_name) formData.append('hospital_name', meta.hospital_name)
    if (meta.doctor_name) formData.append('doctor_name', meta.doctor_name)
    if (meta.description) formData.append('description', meta.description)

    const res = await apiClient.post<{ data: ReportItem }>('/reports/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return res.data.data
  },

  async listReports(params?: {
    page?: number
    per_page?: number
    search?: string
    status_filter?: string
  }): Promise<{ items: ReportItem[]; total: number }> {
    const res = await apiClient.get<{
      data: ReportItem[]
      total: number
    }>('/reports/', { params })
    // PaginatedResponse: items are at res.data.data (array), total at res.data.total
    return { items: res.data.data ?? [], total: res.data.total ?? 0 }
  },

  async getReport(id: string): Promise<ReportDetail> {
    const res = await apiClient.get<{ data: ReportDetail }>(`/reports/${id}`)
    return res.data.data
  },

  async explainReportTerm(
    reportId: string | undefined,
    term: string,
    languageCode: string
  ): Promise<string> {
    const id = reportId || 'general'
    const res = await apiClient.post<{ data: string }>(`/reports/${id}/explain`, {
      term,
      language_code: languageCode,
    })
    return res.data.data
  },

  async deleteReport(id: string): Promise<void> {
    await apiClient.delete(`/reports/${id}`)
  },

  // --- Chat ---
  async askQuestion(payload: {
    question: string
    report_id?: string
    session_id?: string
    language_code?: string
  }): Promise<AskQuestionResponseData> {
    const res = await apiClient.post<{ data: AskQuestionResponseData }>('/chat/ask', payload)
    return res.data.data
  },

  async listChatSessions(): Promise<Record<string, unknown>[]> {
    const res = await apiClient.get<{ data: Record<string, unknown>[] }>('/chat/sessions')
    return res.data.data ?? []
  },

  // --- Translation ---
  async translateReport(payload: {
    report_id: string
    target_language: string
    text_to_translate?: string
  }): Promise<Record<string, unknown>> {
    const res = await apiClient.post<{ data: Record<string, unknown> }>('/translation/translate', payload)
    return res.data.data
  },

  async getLanguages(): Promise<Record<string, string>> {
    const res = await apiClient.get<{ data: { languages: Record<string, string> } }>('/translation/languages')
    return res.data.data.languages
  },

  // --- Voice / TTS ---
  async generateVoice(payload: {
    text: string
    language_code?: string
    report_id?: string
  }): Promise<{ id: string; audio_file_url?: string }> {
    const res = await apiClient.post<{ data: { id: string; audio_file_url?: string } }>('/voice/generate', payload)
    return res.data.data
  },

  async downloadVoiceAudio(id: string): Promise<Blob> {
    const res = await apiClient.get<Blob>(`/voice/${id}/download`, {
      responseType: 'blob',
    })
    return res.data
  },
}
