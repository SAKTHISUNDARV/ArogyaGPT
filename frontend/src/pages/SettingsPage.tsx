import { useState, type ChangeEvent } from 'react'
import AuthenticatedShell from '../components/layout/AuthenticatedShell'
import { api } from '../services/api'

interface SettingsPageProps {
  onNavigate: (page: string) => void
}

type TabType = 'profile' | 'appearance' | 'notifications' | 'security' | 'privacy' | 'billing'

export default function SettingsPage({ onNavigate }: SettingsPageProps) {
  const currentUser = api.getCurrentUser()
  const profileName = currentUser?.full_name || 'User'
  const profileEmail = currentUser?.email || ''
  const profileInitial = profileName.charAt(0).toUpperCase() || 'U'
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Notification toggles
  const [notifs, setNotifs] = useState({
    email: true,
    aiComplete: true,
    weekly: false,
    marketing: false,
    product: true
  })

  // Theme states
  const [theme, setTheme] = useState<'light'|'dark'|'system'>('light')
  const [compactMode, setCompactMode] = useState(false)

  // Password states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      setToast('Changes saved successfully.')
      setTimeout(() => setToast(null), 3000)
    }, 800)
  }

  // Helper for iOS-style toggle
  const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: (c: boolean) => void }) => (
    <button 
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:ring-offset-2 ${checked ? 'bg-[#16A34A]' : 'bg-gray-200'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )

  // Helper for inputs
  const InputField = ({
    label,
    type = 'text',
    placeholder,
    value,
    onChange,
  }: {
    label: string
    type?: string
    placeholder?: string
    value: string
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  }) => (
    <div>
      <label className="block text-[13px] font-medium text-gray-700 mb-2">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full h-12 rounded-[14px] border border-gray-200 bg-gray-50/50 px-4 text-[15px] text-gray-900 focus:bg-white focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none transition-all"
      />
    </div>
  )

  return (
    <AuthenticatedShell
      title="Settings"
      onNavigate={onNavigate}
      currentPage="settings"
    >
      <div className="max-w-[1280px] mx-auto py-10 px-4 sm:px-6 lg:px-10 animate-fade-in bg-[#F8FAFC] min-h-screen">
        
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 px-5 py-3.5 text-sm font-medium text-white shadow-xl animate-fade-in flex items-center gap-3">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#10B981] text-white text-xs font-bold">✓</span>
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="mb-10">
          <h1 className="font-display text-[36px] font-bold text-[#111827] mb-2 tracking-tight">Settings</h1>
          <p className="text-[15px] text-[#6B7280]">Manage your account, security, notifications and privacy.</p>
        </div>

        {/* Segmented Navigation */}
        <div className="mb-10 flex flex-wrap gap-2 border-b border-gray-200 pb-0">
          {[
            { key: 'profile', icon: '👤', label: 'Profile' },
            { key: 'appearance', icon: '🎨', label: 'Appearance' },
            { key: 'notifications', icon: '🔔', label: 'Notifications' },
            { key: 'privacy', icon: '🔒', label: 'Privacy' },
            { key: 'security', icon: '🛡️', label: 'Security' },
            { key: 'billing', icon: '💳', label: 'Billing' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`relative px-4 py-3 text-[15px] font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.key ? 'text-[#16A34A]' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[#16A34A] rounded-t-full transition-all duration-300" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* LEFT COLUMN (70%) */}
          <div className="flex-1 lg:w-[70%] max-w-4xl space-y-10">
            
            {activeTab === 'profile' && (
              <div className="rounded-[20px] bg-white border border-[#E5E7EB] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-sm transition-shadow">
                <h2 className="text-[22px] font-bold text-[#111827] mb-6">Personal Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                  <InputField label="Full Name" value={profileName} />
                  <InputField label="Email Address" value={profileEmail} />
                  <InputField label="Phone Number" value="+1 (555) 123-4567" />
                  <InputField label="Country" value="United States" />
                  <div>
                    <label className="block text-[13px] font-medium text-gray-700 mb-2">Language</label>
                    <select className="w-full h-12 rounded-[14px] border border-gray-200 bg-gray-50/50 px-4 text-[15px] text-gray-900 focus:bg-white focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none transition-all appearance-none cursor-pointer">
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-xl bg-[#16A34A] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(22,163,74,0.2)] hover:bg-[#15803d] transition-colors flex items-center gap-2 disabled:opacity-70"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="rounded-[20px] bg-white border border-[#E5E7EB] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[22px] font-bold text-[#111827]">Password</h2>
                  <span className="text-[13px] text-gray-500 font-medium">Last Changed 12 days ago</span>
                </div>
                
                <div className="space-y-5 mb-8 max-w-md">
                  <InputField 
                    label="Current Password" 
                    type="password" 
                    placeholder="••••••••••" 
                    value={currentPassword}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
                  />
                  <InputField 
                    label="New Password" 
                    type="password" 
                    placeholder="••••••••••" 
                    value={newPassword}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  />
                  
                  {/* Password Strength */}
                  {newPassword.length > 0 && (
                    <div className="animate-fade-in">
                      <div className="flex justify-between text-[13px] font-medium mb-2">
                        <span className="text-gray-700">Password Strength</span>
                        <span className="text-[#10B981]">Strong</span>
                      </div>
                      <div className="flex gap-1 h-2 w-full">
                        <div className="flex-1 rounded-full bg-[#10B981]"></div>
                        <div className="flex-1 rounded-full bg-[#10B981]"></div>
                        <div className="flex-1 rounded-full bg-[#10B981]"></div>
                        <div className="flex-1 rounded-full bg-gray-200"></div>
                      </div>
                    </div>
                  )}

                  <InputField 
                    label="Confirm Password" 
                    type="password" 
                    placeholder="••••••••••" 
                    value={confirmPassword}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  />
                </div>
                
                <div className="flex justify-start pt-4 border-t border-gray-100">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving || !currentPassword || !newPassword}
                    className="rounded-xl bg-[#16A34A] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(22,163,74,0.2)] hover:bg-[#15803d] transition-colors disabled:opacity-50"
                  >
                    Update Password
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="rounded-[20px] bg-white border border-[#E5E7EB] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-sm transition-shadow">
                <h2 className="text-[22px] font-bold text-[#111827] mb-8">Appearance</h2>
                
                <div className="mb-10">
                  <h3 className="text-[15px] font-medium text-gray-900 mb-4">Theme</h3>
                  <div className="flex flex-wrap gap-4">
                    {['light', 'dark', 'system'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t as 'light' | 'dark' | 'system')}
                        className={`flex items-center gap-3 px-6 py-4 rounded-[16px] border ${theme === t ? 'border-[#16A34A] bg-[#16A34A]/5 ring-1 ring-[#16A34A]' : 'border-gray-200 bg-white hover:border-gray-300'} transition-all capitalize text-[15px] font-medium text-gray-900 w-full sm:w-auto`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${theme === t ? 'border-[#16A34A]' : 'border-gray-300'}`}>
                          {theme === t && <div className="w-2 h-2 rounded-full bg-[#16A34A]" />}
                        </div>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-10">
                  <h3 className="text-[15px] font-medium text-gray-900 mb-4">Accent Color</h3>
                  <div className="flex gap-3">
                    <button className="w-10 h-10 rounded-full bg-[#16A34A] ring-2 ring-offset-2 ring-[#16A34A]"></button>
                    <button className="w-10 h-10 rounded-full bg-blue-600 opacity-50 hover:opacity-100 transition-opacity"></button>
                    <button className="w-10 h-10 rounded-full bg-purple-600 opacity-50 hover:opacity-100 transition-opacity"></button>
                    <button className="w-10 h-10 rounded-full bg-orange-500 opacity-50 hover:opacity-100 transition-opacity"></button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                  <div>
                    <h3 className="text-[15px] font-medium text-gray-900">Compact Mode</h3>
                    <p className="text-[13px] text-gray-500 mt-1">Reduce spacing between elements for a denser layout.</p>
                  </div>
                  <ToggleSwitch checked={compactMode} onChange={setCompactMode} />
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="rounded-[20px] bg-white border border-[#E5E7EB] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-sm transition-shadow">
                <h2 className="text-[22px] font-bold text-[#111827] mb-8">Notification Preferences</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                    <div>
                      <h3 className="text-[15px] font-medium text-gray-900">Email Notifications</h3>
                      <p className="text-[13px] text-gray-500 mt-1">Receive important alerts and summaries directly to your inbox.</p>
                    </div>
                    <ToggleSwitch checked={notifs.email} onChange={(v) => setNotifs(n => ({...n, email: v}))} />
                  </div>
                  
                  <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                    <div>
                      <h3 className="text-[15px] font-medium text-gray-900">AI Analysis Complete</h3>
                      <p className="text-[13px] text-gray-500 mt-1">Get notified immediately when a new report is fully processed.</p>
                    </div>
                    <ToggleSwitch checked={notifs.aiComplete} onChange={(v) => setNotifs(n => ({...n, aiComplete: v}))} />
                  </div>

                  <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                    <div>
                      <h3 className="text-[15px] font-medium text-gray-900">Weekly Health Summary</h3>
                      <p className="text-[13px] text-gray-500 mt-1">Receive a weekly digest of your health trends and insights.</p>
                    </div>
                    <ToggleSwitch checked={notifs.weekly} onChange={(v) => setNotifs(n => ({...n, weekly: v}))} />
                  </div>

                  <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                    <div>
                      <h3 className="text-[15px] font-medium text-gray-900">Product Updates</h3>
                      <p className="text-[13px] text-gray-500 mt-1">Occasional updates about new AI features and platform improvements.</p>
                    </div>
                    <ToggleSwitch checked={notifs.product} onChange={(v) => setNotifs(n => ({...n, product: v}))} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[15px] font-medium text-gray-900">Marketing Emails</h3>
                      <p className="text-[13px] text-gray-500 mt-1">Receive offers and promotional content.</p>
                    </div>
                    <ToggleSwitch checked={notifs.marketing} onChange={(v) => setNotifs(n => ({...n, marketing: v}))} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-8">
                <div className="rounded-[20px] bg-white border border-[#E5E7EB] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] hover:shadow-sm transition-shadow">
                  <h2 className="text-[22px] font-bold text-[#111827] mb-2">Download Medical Data</h2>
                  <p className="text-[15px] text-gray-500 mb-6">Get a copy of all your medical reports, AI insights, and chat history.</p>
                  <div className="flex flex-wrap gap-4">
                    <button className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-[15px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2">
                      <span>📄</span> Export PDF
                    </button>
                    <button className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-[15px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-2">
                      <span>{'{ }'}</span> Export JSON
                    </button>
                  </div>
                </div>

                <div className="rounded-[20px] bg-white border border-red-200 p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  <h2 className="text-[22px] font-bold text-[#111827] mb-2">Danger Zone</h2>
                  <p className="text-[15px] text-gray-500 mb-6">Permanently delete your account and all associated medical data. This action cannot be undone.</p>
                  
                  <button className="rounded-xl bg-white border border-red-200 px-6 py-3 text-[15px] font-semibold text-[#EF4444] shadow-sm hover:bg-red-50 hover:border-red-300 transition-colors">
                    Request Data Deletion
                  </button>
                </div>
              </div>
            )}

            {(activeTab === 'billing') && (
              <div className="rounded-[20px] bg-white border border-[#E5E7EB] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] text-center py-20">
                <span className="text-4xl mb-4 block">💳</span>
                <h2 className="text-[22px] font-bold text-[#111827] mb-2">Billing & Subscription</h2>
                <p className="text-[15px] text-gray-500">You are currently on the Free Tier. Premium features coming soon.</p>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN (30%) - Fixed Sidebars */}
          <div className="flex-1 lg:w-[30%] max-w-sm space-y-6">
            
            {/* Profile Summary Card */}
            <div className="rounded-[20px] bg-white border border-[#E5E7EB] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] text-center group">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#16A34A] to-emerald-400 text-white flex items-center justify-center text-3xl font-display font-bold shadow-md mx-auto overflow-hidden">
                  {profileInitial}
                </div>
                <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-[12px] text-gray-600 hover:text-gray-900 transition-colors opacity-0 group-hover:opacity-100">
                  ✏️
                </button>
              </div>
              <h3 className="text-[18px] font-bold text-[#111827] mb-1">{profileName}</h3>
              <p className="text-[13px] text-gray-500 font-medium mb-4">{profileEmail}</p>
              
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF8F1] text-[#138A52] text-[13px] font-semibold mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                Verified Account
              </div>

              <div className="border-t border-gray-100 pt-4 flex justify-between text-[13px]">
                <span className="text-gray-500">Member Since</span>
                <span className="font-semibold text-gray-900">Current account</span>
              </div>
            </div>

            {/* Security Status Card */}
            <div className="rounded-[20px] bg-white border border-[#E5E7EB] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)]">
              <h3 className="text-[15px] font-bold text-[#111827] uppercase tracking-wide mb-5">Security Score</h3>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#EAF8F1] text-[#10B981] flex items-center justify-center text-xl shadow-sm">
                  🛡️
                </div>
                <div>
                  <div className="text-[13px] text-gray-500 font-medium">Status</div>
                  <div className="text-[16px] font-bold text-[#10B981]">Excellent</div>
                </div>
              </div>

              <div className="space-y-4 text-[14px]">
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Two-Factor Auth</span>
                  <span className="text-[#111827] font-semibold">Enabled</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Last Login</span>
                  <span className="text-[#111827] font-semibold">Today</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-gray-600 font-medium">Trusted Devices</span>
                  <span className="text-[#111827] font-semibold">3 Devices</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Encryption</span>
                  <span className="text-[#111827] font-semibold">256-bit Active</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </AuthenticatedShell>
  )
}
