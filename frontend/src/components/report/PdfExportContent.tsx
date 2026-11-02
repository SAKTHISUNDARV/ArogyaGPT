// Hidden PDF export component — always light theme, never dark
// Positioned off-screen, captured by html2pdf.js

interface PdfParam {
  name: string
  value: string
  unit: string
  range: string
  status: 'normal' | 'warning' | 'critical'
  plain: string
  translation: string
}

interface PdfSection {
  name: string
  params: PdfParam[]
}

const PDF_DISCLAIMER_MAP: Record<string, string> = {
  en: 'This report is for informational purposes only. Consult your doctor for medical advice.',
  English: 'This report is for informational purposes only. Consult your doctor for medical advice.',
  ta: 'இந்த அறிக்கை தகவலுக்காக மட்டுமே. மருத்துவ ஆலோசனைக்கு உங்கள் மருத்துவரை அணுகவும்.',
  Tamil: 'இந்த அறிக்கை தகவலுக்காக மட்டுமே. மருத்துவ ஆலோசனைக்கு உங்கள் மருத்துவரை அணுகவும்.',
  hi: 'यह रिपोर्ट केवल जानकारी के लिए है। चिकित्सा सलाह के लिए अपने चिकित्सक से मिलें।',
  Hindi: 'यह रिपोर्ट केवल जानकारी के लिए है। चिकित्सा सलाह के लिए अपने चिकित्सक से मिलें।',
  te: 'ఈ నివేదిక సమాచారం కోసం మాత్రమే. వైద్య సలహా కోసం మీ వైద్యుడిని సంప్రదించండి.',
  Telugu: 'ఈ నివేదిక సమాచారం కోసం మాత్రమే. వైద్య సలహా కోసం మీ వైద్యుడిని సంప్రదించండి.',
  kn: 'ಈ ವರದಿ ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ. ವೈದ್ಯಕೀಯ ಸಲಹೆಗೆ ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
  Kannada: 'ಈ ವರದಿ ಮಾಹಿತಿಗಾಗಿ ಮಾತ್ರ. ವೈದ್ಯಕೀಯ ಸಲಹೆಗೆ ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
  ml: 'ഈ റിപ്പോർട്ട് വിവരങ്ങൾക്കായി മാത്രമാണ്. മെഡിക്കൽ सलाहയ്ക്ക് നിങ്ങളുടെ ഡോക്ടറെ സമീപിക്കുക.',
  Malayalam: 'ഈ റിപ്പോർട്ട് വിവരങ്ങൾക്കായി മാത്രമാണ്. മെഡിക്കൽ सलाहയ്ക്ക് നിങ്ങളുടെ ഡോക്ടറെ സമീപിക്കുക.',
  bn: 'এই রিপোর্টটি শুধুমাত্র তথ্যে ব্যবহারের জন্য। চিকিৎসা পরামর্শের জন্য আপনার চিকিৎসকের কাছে যান।',
  Bengali: 'এই রিপোর্টটি শুধুমাত্র তথ্যে ব্যবহারের জন্য। চিকিৎসা পরামর্শের জন্য আপনার চিকিৎসকের কাছে যান।',
  mr: 'हा अहवाल फक्त माहितीसाठी आहे. वैद्यकीय सल्ल्यासाठी आपल्या डॉक्टरांना भेटा.',
  Marathi: 'हा अहवाल फक्त माहितीसाठी आहे. वैद्यकीय सल्ल्यासाठी आपल्या डॉक्टरांना भेटा.',
  gu: 'આ રિપોર્ટ માત્ર માહિતી માટે છે. તબીબી સલાહ માટે તમારા ડોક્ટરનો સંપર્ક કરો.',
  Gujarati: 'આ રિપોર્ટ માત્ર માહિતી માટે છે. તબીબી સલાહ માટે તમારા ડોક્ટરનો સંપર્ક કરો.',
  pa: 'ਇਹ ਰਿਪੋਰਟ ਸਿਰਫ ਜਾਣਕਾਰੀ ਲਈ ਹੈ। ਡਾਕਟਰੀ ਸਲਾਹ ਲਈ ਆਪਣੇ ਡਾਕਟਰ ਨਾਲ ਸਲਾਹ ਕਰੋ।',
  Punjabi: 'ਇਹ ਰਿਪੋਰਟ ਸਿਰਫ ਜਾਣਕਾਰੀ ਲਈ ਹੈ। ਡਾਕਟਰੀ ਸਲਾਹ ਲਈ ਆਪਣੇ ਡਾਕਟਰ ਨਾਲ ਸਲਾਹ ਕਰੋ।',
}

interface PdfExportContentProps {
  patientName: string
  reportDate: string
  language: string
  sections: PdfSection[]
  summary: string
  detailedText?: string
  insights: { icon: string; title: string; body: string }[]
}

const PDF_LABELS: Record<string, { report: string; summary: string; values: string; abnormal: string; parameter: string; normal: string; status: string; insights: string; disclaimerTitle: string }> = {
  en: { report: 'Simplified Medical Report', summary: 'Report Summary', values: 'values', abnormal: 'abnormal', parameter: 'Parameter', normal: 'Normal', status: 'Status', insights: 'Health Insights & Recommendations', disclaimerTitle: 'Medical disclaimer' },
  ta: { report: 'எளிமைப்படுத்தப்பட்ட மருத்துவ அறிக்கை', summary: 'அறிக்கைச் சுருக்கம்', values: 'மதிப்புகள்', abnormal: 'மாறுபட்டவை', parameter: 'மதிப்பீடு', normal: 'இயல்பு', status: 'நிலை', insights: 'ஆரோக்கிய நுண்ணறிவுகள் & பரிந்துரைகள்', disclaimerTitle: 'மருத்துவ எச்சரிக்கை' },
  hi: { report: 'सरल चिकित्सा रिपोर्ट', summary: 'रिपोर्ट सारांश', values: 'मान', abnormal: 'असामान्य', parameter: 'पैरामीटर', normal: 'सामान्य', status: 'स्थिति', insights: 'स्वास्थ्य जानकारी और सिफारिशें', disclaimerTitle: 'चिकित्सा अस्वीकरण' },
  te: { report: 'సులభమైన వైద్య నివేదిక', summary: 'నివేదిక సారాంశం', values: 'విలువలు', abnormal: 'అసాధారణం', parameter: 'పారామీటర్', normal: 'సాధారణం', status: 'స్థితి', insights: 'ఆరోగ్య సూచనలు & సిఫార్సులు', disclaimerTitle: 'వైద్య నిబంధన' },
  kn: { report: 'ಸರಳೀಕೃತ ವೈದ್ಯಕೀಯ ವರದಿ', summary: 'ವರದಿ ಸಾರಾಂಶ', values: 'ಮೌಲ್ಯಗಳು', abnormal: 'ಅಸಾಮಾನ್ಯ', parameter: 'ಪ್ಯಾರಾಮೀಟರ್', normal: 'ಸಾಮಾನ್ಯ', status: 'ಸ್ಥಿತಿ', insights: 'ಆರೋಗ್ಯ ಒಳನೋಟಗಳು & ಶಿಫಾರಸುಗಳು', disclaimerTitle: 'ವೈದ್ಯಕೀಯ ಎಚ್ಚರಿಕೆ' },
  ml: { report: 'ലളിതമാക്കിയ മെഡിക്കൽ റിപ്പോർട്ട്', summary: 'റിപ്പോർട്ട് സംഗ്രഹം', values: 'മൂല്യങ്ങൾ', abnormal: 'അസാധാരണം', parameter: 'പാരാമീറ്റർ', normal: 'സാധാരണം', status: 'സ്ഥിതി', insights: 'ആരോഗ്യ നിർദ്ദേശങ്ങളും ശുപാർശകളും', disclaimerTitle: 'വೈദ്യപരമായ അറിയിപ്പ്' },
  mr: { report: 'सोपे वैद्यकीय अहवाल', summary: 'अहवाल सारांश', values: 'मूल्ये', abnormal: 'असामान्य', parameter: 'पॅरामीटर', normal: 'सामान्य', status: 'स्थिती', insights: 'आरोग्य माहिती आणि शिफारसी', disclaimerTitle: 'वैद्यकीय सूचना' },
  bn: { report: 'সহজীকৃত মেডিকেল রিপোর্ট', summary: 'রিপোর্ট সারাংশ', values: 'মান', abnormal: 'অস্বাভাবিক', parameter: 'প্যারামিটার', normal: 'সাধারণ', status: 'অবস্থা', insights: 'স্বাস্থ্য অন্তর্দৃষ্টি ও সুপারিশ', disclaimerTitle: 'চিকিৎসা সতর্কতা' },
  gu: { report: 'સરળ તબીબી રિપોર્ટ', summary: 'રિપોર્ટ सारांश', values: 'મૂલ્યો', abnormal: 'અસામાન્ય', parameter: 'પેરામીટર', normal: 'સામાન્ય', status: 'સ્થિતિ', insights: 'આરોગ્ય માહિતી અને સૂચનો', disclaimerTitle: 'તબીબી disclaimer' },
  pa: { report: 'ਸਰਲ ਮੈਡੀਕਲ ਰਿਪੋਰਟ', summary: 'ਰਿਪੋਰਟ ਸਾਰ', values: 'ਮੁੱਲ', abnormal: 'ਅਸਾਮਾਨਕ', parameter: 'ਪੈਰਾਮੀਟਰ', normal: 'ਸਧਾਰਨ', status: 'ਸਥਿਤੀ', insights: 'ਸਿਹਤ ਜਾਣਕਾਰੀ ਅਤੇ ਸਿਫਾਰਸ਼ਾਂ', disclaimerTitle: 'ਮੈਡੀਕਲ चेतਾਵनी' },
  or: { report: 'ସରଳ ଚିକିତ୍ସା ରିପୋର୍ଟ', summary: 'ରିପୋର୍ଟ ସାରାଂଶ', values: 'ମୂଲ୍ୟ', abnormal: 'ଅସାମାନ୍ୟ', parameter: 'ପାରାମିଟର', normal: 'ସାମାନ୍ୟ', status: 'ସ୍ଥିତି', insights: 'ସ୍ୱାସ୍ଥ୍ୟ ସୂଚନା ଓ ସୁପାରିଶ', disclaimerTitle: 'ଚିକିତ୍ସା ସୂଚନା' },
  ur: { report: 'آسان طبی رپورٹ', summary: 'رپورٹ کا خلاصہ', values: 'قدریں', abnormal: 'غیر معمولی', parameter: 'پیرامیٹر', normal: 'عام', status: 'حیثیت', insights: 'صحت کی بصیرت اور سفارشات', disclaimerTitle: 'طبی اعلان' },
}

const STATUS_COLORS = {
  normal:   { text: '#3A9E6E', bg: 'transparent',                     badge: '#EBF7F1', badgeText: '#2D7A56' },
  warning:  { text: '#D4924A', bg: 'transparent',                     badge: '#FEF3E8', badgeText: '#A96E2E' },
  critical: { text: '#C0574A', bg: 'rgba(192,87,74,0.05)',            badge: '#FDECEA', badgeText: '#A03020' },
}

export default function PdfExportContent({
  patientName,
  reportDate,
  language,
  sections,
  summary,
  detailedText,
  insights,
}: PdfExportContentProps) {
  const languageCode = language.toLowerCase().trim().startsWith('tamil') ? 'ta' :
    ({ tamil: 'ta', english: 'en', hindi: 'hi', telugu: 'te', kannada: 'kn', malayalam: 'ml', marathi: 'mr', bengali: 'bn', gujarati: 'gu', punjabi: 'pa', odia: 'or', urdu: 'ur' } as Record<string, string>)[language.toLowerCase().trim()] || language.toLowerCase().trim()
  const labels = PDF_LABELS[languageCode] || PDF_LABELS.en
  const allParams = sections.flatMap(section => section.params)
  const abnormalCount = allParams.filter(param => param.status !== 'normal').length
  const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      id="pdf-export-content"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 0,
        visibility: 'visible',
        width: '800px',
        minHeight: '1120px',
        background: '#FDFCFA',
        color: '#1A2420',
        fontFamily: "'Inter', 'DM Sans', Arial, sans-serif",
        fontSize: '13px',
        lineHeight: '1.6',
      }}
    >
      {/* ── PDF HEADER ── */}
      <div style={{
        background: '#1C2B2D',
        padding: '32px 40px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        color: '#F5F2EE',
      }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '22px', fontWeight: 500, color: '#F5F2EE', marginBottom: '4px' }}>
            ArogyaGPT
          </div>
          <div style={{ fontSize: '13px', color: '#8FA49E', letterSpacing: '0.04em' }}>
            {labels.report}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '16px', fontWeight: 500, color: '#F5F2EE', marginBottom: '4px' }}>
            {patientName}
          </div>
          <div style={{ fontSize: '13px', color: '#8FA49E', marginBottom: '8px' }}>
            {reportDate}
          </div>
          <span style={{
            display: 'inline-block',
            fontSize: '11px',
            padding: '2px 10px',
            borderRadius: '99px',
            background: 'rgba(120,211,188,0.15)',
            color: '#78D3BC',
            border: '1px solid rgba(120,211,188,0.25)',
          }}>
            {language}
          </span>
        </div>
      </div>

      {/* ── SUMMARY BOX ── */}
      <div style={{ padding: '0 40px', marginTop: '24px' }}>
        <div style={{
          background: '#EEF5F2',
          border: '1px solid rgba(46,125,107,0.15)',
          borderRadius: '12px',
          padding: '24px',
        }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8FA49E', marginBottom: '10px' }}>
            {labels.summary}
          </div>
          <p style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: '16px',
            fontStyle: 'italic',
            color: '#1A2420',
            margin: 0,
            lineHeight: '1.7',
          }}>
            "{summary}"
          </p>
        </div>
      </div>

      {/* ── PARAMETER SECTIONS ── */}
      <div style={{ padding: '24px 40px 0' }}>
        {sections.map(section => (
          <div key={section.name} className="pdf-section" style={{ marginBottom: '28px' }}>
            {/* Section heading */}
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1A2420',
              borderBottom: '1px solid rgba(46,125,107,0.12)',
              paddingBottom: '8px',
              marginBottom: '12px',
            }}>
              <div>{section.name}</div>
              <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 500, color: '#A96E2E' }}>
                {section.params.length} {labels.values} · {section.params.filter(param => param.status !== 'normal').length} {labels.abnormal}
              </div>
            </div>

            {/* Column headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 100px',
              gap: '8px',
              padding: '6px 0',
              borderBottom: '0.5px solid #E8E4DF',
              marginBottom: '2px',
            }}>
              {[labels.parameter, 'Your Value', labels.status].map(h => (
                <span key={h} style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8FA49E' }}>{h}</span>
              ))}
            </div>

            {/* Parameter rows or Detailed Text */}
            {section.params.length === 0 && detailedText ? (
              <div
                style={{
                  padding: '16px 20px',
                  background: '#EEF5F2',
                  borderRadius: '8px',
                  color: '#1A2420',
                  lineHeight: '1.7',
                  fontSize: '13px'
                }}
                dangerouslySetInnerHTML={{
                  __html: detailedText
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/\n/g, '<br/>')
                }}
              />
            ) : (
              section.params.map(param => {
                const colors = STATUS_COLORS[param.status]
                return (
                  <div
                    key={param.name}
                    style={{
                      background: colors.bg,
                      borderLeft: param.status === 'critical' ? '3px solid #C0574A' : '3px solid transparent',
                      borderBottomLeftRadius: 0,
                      borderTopLeftRadius: 0,
                      padding: '10px 0 10px 8px',
                      borderBottom: '0.5px solid #E8E4DF',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px', gap: '8px', alignItems: 'start' }}>
                      {/* Name */}
                      <div>
                        <div style={{ fontSize: '13px', color: '#1A2420', fontWeight: 500 }}>{param.name}</div>
                        <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#4A5E59', marginTop: '3px' }}>{param.plain}</div>
                        <div style={{ fontSize: '12px', color: '#2E7D6B', marginTop: '2px' }}>{param.translation}</div>
                      </div>
                      {/* Value */}
                      <div style={{ fontFamily: "'JetBrains Mono', Menlo, monospace", fontSize: '13px', fontWeight: 600, color: colors.text }}>
                        {param.value} {param.unit}
                        <div style={{ fontFamily: 'inherit', fontSize: '11px', color: '#8FA49E', fontWeight: 400 }}>Normal: {param.range}</div>
                      </div>
                      {/* Badge */}
                      <div>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '11px',
                          padding: '2px 10px',
                          borderRadius: '99px',
                          background: colors.badge,
                          color: colors.badgeText,
                          fontWeight: 500,
                        }}>
                          {param.status === 'normal' ? '✓ Normal' : param.status === 'warning' ? '~ Borderline' : '! High'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ))}
      </div>

      {/* ── HEALTH INSIGHTS ── (only if there are abnormal values) */}
      {insights.length > 0 && (
        <div style={{ padding: '8px 40px 24px' }} className="pdf-section">
          <div style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: '16px',
            color: '#1A2420',
            marginBottom: '16px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(46,125,107,0.12)',
          }}>
            Health Insights &amp; Recommendations
          </div>
          {insights.map(insight => (
            <div key={insight.title} style={{
              background: '#F5F2EE',
              border: '1px solid rgba(46,125,107,0.12)',
              borderRadius: '10px',
              padding: '16px 20px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A2420', marginBottom: '8px' }}>
                {insight.icon} {insight.title}
              </div>
              <div style={{ fontSize: '13px', color: '#4A5E59', lineHeight: '1.65' }}>
                {insight.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PDF FOOTER ── */}
      <div style={{
        borderTop: '1px solid rgba(46,125,107,0.15)',
        padding: '16px 40px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        gap: '12px',
        marginTop: '8px',
      }}>
        <div style={{ fontSize: '11px', color: '#8FA49E' }}>Generated by ArogyaGPT</div>
        <div style={{ fontSize: '11px', color: '#8FA49E', fontStyle: 'italic', textAlign: 'center', lineHeight: '1.5' }}>
          {PDF_DISCLAIMER_MAP[language] || PDF_DISCLAIMER_MAP.en}
        </div>
        <div style={{ fontSize: '11px', color: '#8FA49E', textAlign: 'right' }}>{generatedAt}</div>
      </div>
    </div>
  )
}
