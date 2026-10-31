import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";

export function HowItWorksPage() {
  const { tr } = useLanguage();

  const steps = [
    {
      title: tr("Scan a prescription", "पर्चा स्कैन करें"),
      body: tr(
        "Upload an image or PDF. Gemini extracts visible medicine lines for review. Search does not run automatically.",
        "एक फोटो या PDF अपलोड करें। AI समीक्षा के लिए दवाई के नामों को पहचानता है। सीधे खोज अपने आप शुरू नहीं होती।"
      ),
      to: "/scan",
      cta: tr("Open scanner", "स्कैनर खोलें"),
    },
    {
      title: tr("Confirm, then search", "पुष्टि करें, फिर खोजें"),
      body: tr(
        "Correct names, strength and form. Only confirmed items are matched against the catalogue.",
        "नाम, मात्रा और दवा के प्रकार को सही करें। केवल आपके द्वारा पुष्टि की गई दवाइयां ही कैटलॉग में जांची जाती हैं।"
      ),
      to: "/scan",
      cta: tr("Review flow", "समीक्षा प्रक्रिया"),
    },
    {
      title: tr("Compare listed prices", "सूचीबद्ध कीमतों की तुलना करें"),
      body: tr(
        "Private Brand, Jan Aushadhi and Dava India prices come from the loaded CSV. Missing prices are shown as unavailable.",
        "प्राइवेट ब्रांड, जन औषधि और दवा इंडिया की कीमतें आधिकारिक डेटा से आती हैं। जो कीमतें उपलब्ध नहीं हैं, वे अनुपलब्ध दिखाई जाती हैं।"
      ),
      to: "/medicines",
      cta: tr("Browse catalogue", "कैटलॉग देखें"),
    },
    {
      title: tr("Find nearby pharmacies", "नज़दीकी मेडिकल स्टोर खोजें"),
      body: tr(
        "Open Google Maps around your location. Save an enquiry if you want to ask a shop about stock — WhatsApp is never sent by the server.",
        "अपनी लोकेशन के पास गूगल मैप्स खोलें। यदि आप उपलब्धता पूछना चाहते हैं तो संदेश तैयार करें — सर्वर द्वारा कोई संदेश सीधे नहीं भेजा जाता।"
      ),
      to: "/stores",
      cta: tr("Nearby stores", "नज़दीकी स्टोर"),
    },
  ];

  return (
    <>
      <Helmet>
        <title>{tr("How It Works — MedEasy Price Comparison Flow", "यह कैसे काम करता है — MedEasy प्रक्रिया")}</title>
        <meta
          name="description"
          content={tr(
            "Step-by-step guide on how MedEasy works: upload prescriptions, confirm extracted medicines, compare Jan Aushadhi generic prices, and connect with local stores.",
            "चरण-दर-चरण मार्गदर्शिका: पर्चा अपलोड करें, निकाली गई दवाओं की पुष्टि करें, जन औषधि जेनेरिक दामों की तुलना करें और स्थानीय स्टोर से जुड़ें।"
          )}
        />
      </Helmet>
      <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
        <h1 className="text-3xl font-extrabold text-navy">
          {tr("How it works", "यह कैसे काम करता है")}
        </h1>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-2xl border border-slate-100 p-6 shadow-sm">
              <p className="text-sm font-semibold text-brand">
                {tr(`Step ${index + 1}`, `चरण ${index + 1}`)}
              </p>
              <h2 className="mt-2 text-xl font-bold text-navy">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
              <Link to={step.to} className="mt-4 inline-block text-sm font-semibold text-brand">
                {step.cta} →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
