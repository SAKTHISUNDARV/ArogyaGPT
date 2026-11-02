interface FeaturesSectionProps {
  onNavigate: (page: string) => void
}

const features = [
  {
    id: 'upload',
    title: 'Upload Reports',
    description: 'Seamlessly upload PDF documents, scanned images, or mobile photo captures of any medical lab report.',
    icon: (
      <svg className="w-6 h-6 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
    tag: 'Instant Upload',
  },
  {
    id: 'ocr',
    title: 'OCR Text Extraction',
    description: 'Advanced vision AI reads handwriting, complex hospital layouts, tables, and nested medical lab values.',
    icon: (
      <svg className="w-6 h-6 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    tag: 'Vision AI',
  },
  {
    id: 'simplify',
    title: 'AI Simplification',
    description: 'Transforms dense jargon and complex clinical ranges into clear, empathetic plain language summaries.',
    icon: (
      <svg className="w-6 h-6 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    tag: 'Plain Language',
  },
  {
    id: 'chat',
    title: 'Chat with Report',
    description: 'Ask anything directly to your report: diagnoses, prescribed dosages, normal ranges, or next doctor steps.',
    icon: (
      <svg className="w-6 h-6 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    tag: 'ChatGPT Style',
  },
  {
    id: 'storage',
    title: 'Secure Storage',
    description: 'HIPAA-aligned bank-grade encryption protects your health history with full privacy and user data control.',
    icon: (
      <svg className="w-6 h-6 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    tag: 'Bank Encrypted',
  },
]

export default function FeaturesSection({ onNavigate }: FeaturesSectionProps) {
  return (
    <section id="features" className="relative py-20 bg-white/60 overflow-hidden" aria-label="Key Features">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="font-body text-xs uppercase tracking-[0.2em] font-semibold text-[#1D9E75] mb-3">
            Intelligent Health Capabilities
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#18322D] tracking-tight">
            Designed for Clarity, Built for Patient Empowerment
          </h2>
          <p className="mt-4 font-body text-base text-[#4A5E59] leading-relaxed">
            MedSimplify AI brings together computer vision, medical NLP, and conversational intelligence to make medical reports accessible to everyone.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((item) => (
            <div
              key={item.id}
              onClick={() => onNavigate(item.id === 'upload' ? 'upload' : item.id === 'chat' ? 'chat' : 'dashboard')}
              className="group cursor-pointer rounded-[24px] border border-[#E3F1EB] bg-white/90 p-7 shadow-[0_12px_36px_rgba(24,50,45,0.04)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-[#1D9E75]/40 hover:shadow-[0_20px_50px_rgba(29,158,117,0.12)]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E1F5EE] group-hover:bg-[#1D9E75] group-hover:text-white transition-colors duration-300">
                  {item.icon}
                </div>
                <span className="font-body text-xs font-semibold px-3 py-1 rounded-full bg-[#F3FCF8] text-[#1D9E75] border border-[#DCEBE6]">
                  {item.tag}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold text-[#18322D] group-hover:text-[#1D9E75] transition-colors">
                {item.title}
              </h3>
              <p className="mt-3 font-body text-sm text-[#4A5E59] leading-relaxed">
                {item.description}
              </p>
              <div className="mt-6 flex items-center gap-1.5 font-body text-xs font-semibold text-[#1D9E75] group-hover:translate-x-1 transition-transform">
                Explore capability <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
