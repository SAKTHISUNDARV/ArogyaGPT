import { useState } from 'react'
import AuthenticatedShell from '../components/layout/AuthenticatedShell'
import { api } from '../services/api'

interface ProfilePageProps {
  onNavigate: (page: string) => void
}

export default function ProfilePage({ onNavigate }: ProfilePageProps) {
  const currentUser = api.getCurrentUser()
  const [name, setName] = useState(currentUser?.full_name || 'User')
  const [email] = useState(currentUser?.email || '')
  const [editing, setEditing] = useState(false)
  const [tempName, setTempName] = useState(name)
// Removed tempEmail state – email is not editable

  const handleSaveProfile = async () => {
    try {
      const updated = await api.updateProfile(tempName.trim())
      setName(updated.full_name)
      setEditing(false)
    } catch {
      // Keep the modal open if the profile update fails.
    }
  }

  return (
    <AuthenticatedShell title="Profile" subtitle="Overview of your patient profile, activity statistics, and workspace history." onNavigate={onNavigate} currentPage="profile">

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Profile Card Header */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Subtle top accent bar */}
          <div className="h-2 w-full bg-gradient-to-r from-[#1D9E75] to-[#0ea5e9]"></div>
          
          <div className="p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#E1F5EE] text-3xl font-bold text-[#1D9E75] shadow-sm ring-1 ring-gray-100"
                aria-label={name}
              >
                {name.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white ring-2 ring-white">
                <span className="h-3 w-3 rounded-full bg-[#1D9E75]"></span>
              </span>
            </div>
            
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{name}</h2>
              </div>
              <p className="text-sm font-medium text-gray-500">{email}</p>
              <p className="text-xs text-gray-400 pt-1 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Active workspace member
              </p>
            </div>
            
            <button
              onClick={() => { setTempName(name); setEditing(true); }}
              className="mt-4 sm:mt-0 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:text-[#1D9E75] hover:border-[#1D9E75]/30 transition-all focus:outline-none focus:ring-4 focus:ring-gray-100"
            >
              Edit Profile
            </button>
          </div>
        </div>

        {/* Account Status Widgets */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Account Type', value: currentUser?.role || 'patient', desc: 'Workspace role', bg: 'bg-blue-50', color: 'text-blue-600' },
            { label: 'Email Status', value: currentUser?.is_email_verified ? 'Verified' : 'Pending', desc: 'Account verification', bg: 'bg-[#E1F5EE]', color: 'text-[#1D9E75]' },
            { label: 'Workspace', value: currentUser?.is_active ? 'Active' : 'Inactive', desc: 'Current account status', bg: 'bg-purple-50', color: 'text-purple-600' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg} ${stat.color}`}>
                <span className="text-sm font-bold">{stat.value.slice(0, 1).toUpperCase()}</span>
              </div>
              <span className="text-lg font-bold text-gray-900">{stat.value}</span>
              <h3 className="mt-1 text-sm font-semibold text-gray-900">{stat.label}</h3>
              <p className="text-xs font-medium text-gray-500">{stat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl border border-[#E3F1EB]">
            <h3 className="font-display text-lg font-bold text-[#18322D] mb-4">Edit Profile</h3>
            
            <div className="space-y-4 font-body text-xs">
              <div>
                <label className="block font-medium text-[#4A5E59] mb-1">Full Name</label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full rounded-full border border-[#DCEBE6] bg-[#FAFAF8] px-4 py-2.5 text-[#18322D] focus:border-[#1D9E75] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 font-body text-xs">
              <button
                onClick={() => setEditing(false)}
                className="rounded-full border border-[#DCEBE6] px-4 py-2 text-[#4A5E59]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="rounded-full bg-[#1D9E75] px-5 py-2 font-semibold text-white shadow-md"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthenticatedShell>
  )
}
