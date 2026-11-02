import { useState, useEffect } from 'react'
import AuthenticatedShell from '../components/layout/AuthenticatedShell'
import { api, ReportItem } from '../services/api'

interface DashboardPageProps {
  onNavigate: (page: string) => void
}

type StatusType = 'Completed' | 'Needs Review' | 'Processing' | 'Critical'

interface Report {
  id: string
  date: string
  type: string
  hospital: string
  status: StatusType
  simplifiedCount: number
}

function mapStatus(s: string): StatusType {
  const m: Record<string, StatusType> = {
    completed: 'Completed',
    needs_review: 'Needs Review',
    processing: 'Processing',
    critical: 'Critical',
    pending: 'Processing',
    failed: 'Needs Review',
  }
  return m[s.toLowerCase()] ?? 'Processing'
}

function mapApiReport(r: ReportItem): Report {
  return {
    id: r.id,
    date: r.report_date ?? r.created_at?.slice(0, 10) ?? '',
    type: r.report_type ?? r.title ?? 'Medical Report',
    hospital: r.hospital_name ?? 'Unknown Facility',
    status: mapStatus(r.status),
    simplifiedCount: r.file_count ?? 0,
  }
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<StatusType | 'All'>('All')
  const [reports, setReports] = useState<Report[]>([])
  const [totalReports, setTotalReports] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    api.listReports({ per_page: 20 })
      .then(({ items, total }) => {
        setReports(items.map(mapApiReport))
        setTotalReports(total)
      })
      .catch(() => {
        setReports([])
        setTotalReports(0)
      })

    api.listChatSessions()
      .then((sessions) => setChatCount(sessions.length))
      .catch(() => setChatCount(0))
  }, [])

  const needsAttention = reports.filter((report) =>
    report.status === 'Needs Review' || report.status === 'Critical'
  ).length
  const completedSummaries = reports.filter((report) => report.status === 'Completed').length
  const filteredReports = reports.filter(report => {
    const matchesSearch = report.type.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          report.hospital.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === 'All' || report.status === filter
    return matchesSearch && matchesFilter
  })

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / rowsPerPage))
  const paginatedReports = filteredReports.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const handleFilterChange = (f: StatusType | 'All') => { setFilter(f); setCurrentPage(1) }
  const handleSearchChange = (v: string) => { setSearchQuery(v); setCurrentPage(1) }
  const handleRowsPerPageChange = (v: number) => { setRowsPerPage(v); setCurrentPage(1) }

  const getStatusBadge = (status: StatusType) => {
    const styles = {
      'Completed': 'bg-green-50 text-green-700 border-green-200',
      'Needs Review': 'bg-yellow-50 text-yellow-700 border-yellow-200',
      'Processing': 'bg-blue-50 text-blue-700 border-blue-200',
      'Critical': 'bg-red-50 text-red-700 border-red-200'
    }
    const dots = {
      'Completed': '🟢',
      'Needs Review': '🟡',
      'Processing': '🔵',
      'Critical': '🔴'
    }
    
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm ${styles[status]}`}>
        <span className="text-[10px]">{dots[status]}</span>
        {status}
      </span>
    )
  }

  return (
    <AuthenticatedShell
      title="Dashboard"
      subtitle="Manage your medical reports and AI summaries."
      onNavigate={onNavigate}
      currentPage="dashboard"
    >
      {/* Overview Cards */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Reports */}
        <div className="group relative rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-blue-500 rounded-l-2xl" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{totalReports}</h3>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Total Reports</p>
        </div>

        {/* AI Summaries */}
        <div className="group relative rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-[#1D9E75] rounded-l-2xl" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E1F5EE]">
              <svg className="h-5 w-5 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{completedSummaries}</h3>
          <p className="text-xs font-medium text-gray-500 mt-0.5">AI Summaries</p>
        </div>

        {/* Needs Attention */}
        <div className="group relative rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-amber-400 rounded-l-2xl" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            {needsAttention > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                Urgent
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{needsAttention}</h3>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Needs Attention</p>
        </div>

        {/* AI Chats */}
        <div className="group relative rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-all overflow-hidden">
          <div className="absolute top-0 left-0 h-full w-1 bg-purple-500 rounded-l-2xl" />
          <div className="flex items-center justify-between mb-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{chatCount}</h3>
          <p className="text-xs font-medium text-gray-500 mt-0.5">AI Chats</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-10">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Upload Report */}
          <button
            onClick={() => onNavigate('upload')}
            aria-label="Upload Report"
            className="group flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-[#1D9E75]/40 hover:shadow-md text-left"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-110">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-900 group-hover:text-[#1D9E75] transition-colors">Upload Report</span>
              <span className="block text-xs text-gray-400 mt-0.5">PDF, JPG, DOCX</span>
            </div>
            <svg className="h-4 w-4 text-gray-300 group-hover:text-[#1D9E75] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>

          {/* AI Chat */}
          <button
            onClick={() => onNavigate('chat')}
            aria-label="AI Chat"
            className="group flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-[#1D9E75]/40 hover:shadow-md text-left"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E1F5EE] text-[#1D9E75] transition-transform group-hover:scale-110">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-900 group-hover:text-[#1D9E75] transition-colors">AI Chat</span>
              <span className="block text-xs text-gray-400 mt-0.5">Ask about reports</span>
            </div>
            <svg className="h-4 w-4 text-gray-300 group-hover:text-[#1D9E75] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>

          {/* History */}
          <button
            onClick={() => onNavigate('history')}
            aria-label="History"
            className="group flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-[#1D9E75]/40 hover:shadow-md text-left"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-transform group-hover:scale-110">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-gray-900 group-hover:text-[#1D9E75] transition-colors">History</span>
              <span className="block text-xs text-gray-400 mt-0.5">Past analyses & reports</span>
            </div>
            <svg className="h-4 w-4 text-gray-300 group-hover:text-[#1D9E75] transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Recent Reports Table Section */}
      <div className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Header / Search / Filters */}
        <div className="border-b border-gray-200 bg-gray-50/50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">Recent Reports</h3>
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input 
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full rounded-full border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]"
              />
            </div>
          </div>
          
          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            {(['All', 'Completed', 'Needs Review', 'Processing', 'Critical'] as const).map(status => (
              <button
                key={status}
                onClick={() => handleFilterChange(status)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-200 ${
                  filter === status
                    ? 'bg-[#1D9E75] text-white shadow-sm border border-[#1D9E75]'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-white text-gray-500">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Report Type</th>
                <th className="px-6 py-4 font-medium">Facility</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {paginatedReports.map((report) => (
                <tr key={report.id} className="transition-colors hover:bg-gray-50/80 group">
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{report.date}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{report.type}</td>
                  <td className="px-6 py-4 text-gray-500">{report.hospital}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(report.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#1D9E75] hover:bg-[#E1F5EE] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedReports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl">🔍</span>
                      <p>No reports found matching your criteria.</p>
                      <button 
                        onClick={() => { handleSearchChange(''); handleFilterChange('All'); }}
                        className="text-[#1D9E75] hover:underline mt-1"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-5 py-3">
          {/* Rows per page */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-medium">›</span>
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={e => handleRowsPerPageChange(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:border-[#1D9E75] focus:outline-none cursor-pointer"
            >
              {[5, 10, 20, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Page info + nav */}
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>{filteredReports.length === 0 ? '0' : `${(currentPage - 1) * rowsPerPage + 1}–${Math.min(currentPage * rowsPerPage, filteredReports.length)}`} of {filteredReports.length}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="min-w-[2.5rem] text-center font-medium text-gray-700">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Viewing Report Details */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 pr-4 tracking-tight leading-tight">{selectedReport.type}</h3>
                {getStatusBadge(selectedReport.status)}
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-600 mt-6">
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Date</p>
                  <p className="font-medium text-gray-900">{selectedReport.date}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Facility</p>
                  <p className="font-medium text-gray-900">{selectedReport.hospital}</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#E1F5EE] bg-[#F7FCF9] p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 text-4xl">✨</div>
                <p className="font-semibold text-[#18322D] mb-2 flex items-center gap-2">
                  AI Summary
                </p>
                <p className="leading-relaxed text-[#4A5E59]">
                  Report processed by ArogyaGPT. Open the report to view all clinical parameters and ask questions in your chosen language.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                onClick={() => setSelectedReport(null)}
                className="w-full sm:w-auto rounded-xl px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => { setSelectedReport(null); onNavigate('chat') }}
                className="w-full sm:w-auto rounded-xl bg-[#1D9E75] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#168562] transition-colors flex items-center justify-center gap-2"
              >
                <span>💬</span> Chat About Report
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedShell>
  )
}
