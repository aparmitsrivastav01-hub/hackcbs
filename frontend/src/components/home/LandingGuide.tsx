import {
  ArrowRight,
  Bot,
  Brain,
  ChevronDown,
  Database,
  FileCheck,
  FileSearch,
  HelpCircle,
  Lock,
  MapPin,
  Mic,
  Pill,
  ScanLine,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingDown,
  Users,
  Volume2,
  Zap,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";

export function LandingGuide() {
  const navigate = useNavigate();
  const { tr, locale } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<"both" | "wf1" | "wf2">("both");

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/medicines?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  const popularMedicines = [
    "Paracetamol 500mg",
    "Metformin 500mg",
    "Telmisartan 40mg",
    "Pantoprazole 40mg",
    "Amoxicillin 500mg",
    "Atorvastatin 10mg",
  ];

  const userPaths = [
    {
      title: tr("I have a paper prescription", "मेरे पास डॉक्टर का पर्चा है"),
      badge: tr("Workflow 1 • AI Scan", "वर्कफ़्लो 1 • AI स्कैन"),
      icon: ScanLine,
      color: "brand",
      description: tr(
        "Upload a photo or PDF of your doctor's prescription. Optical OCR extracts medicine names for you to review and confirm before comparing generic prices.",
        "डॉक्टर के पर्चे का फोटो या पीडीएफ अपलोड करें। OCR दवाइयों के नाम निकालता है ताकि आप कीमतों की तुलना से पहले पुष्टि कर सकें।"
      ),
      cta: tr("Scan Prescription", "पर्चा स्कैन करें"),
      href: "/scan",
    },
    {
      title: tr("I want to compare generic prices", "मुझे जेनेरिक दामों की तुलना करनी है"),
      badge: tr("Workflow 1 • 3-Way Compare", "वर्कफ़्लो 1 • 3-तरफ़ा तुलना"),
      icon: Search,
      color: "emerald",
      description: tr(
        "Search our 508+ catalogue medicines directly. Compare Jan Aushadhi (PMBJP), Dava India generic alternatives, and private brands side-by-side.",
        "सीधे 508+ दवाइयों में खोजें। जन औषधि (PMBJP), दवा इंडिया जेनेरिक और ब्रांडेड दवाओं की साथ-साथ तुलना करें।"
      ),
      cta: tr("Search Medicines", "दवाइयां खोजें"),
      href: "/medicines",
    },
    {
      title: tr("I want an AI health consultation with memory", "मुझे AI स्वास्थ्य परामर्श और निरंतरता चाहिए"),
      badge: tr("Workflow 2 • MedSaathi + Meko", "वर्कफ़्लो 2 • मेडसाथी + Meko"),
      icon: Bot,
      color: "purple",
      description: tr(
        "Voice and text assistant in Hindi & English with ElevenLabs speech. MedSaathi safely recalls your allergies and health context across sessions via Meko memory.",
        "ग्यारह प्रयोगशालाओं की आवाज़ के साथ हिंदी और अंग्रेजी में AI सहायक। मेडसाथी आपकी एलर्जी और प्राथमिकताओं को सुरक्षित रूप से याद रखता है।"
      ),
      cta: tr("Consult MedSaathi", "मेडसाथी से पूछें"),
      href: "/med-saathi",
    },
    {
      title: tr("I want to check batch safety", "मुझे बैच सुरक्षा की जांच करनी है"),
      badge: tr("Workflow 1 • CDSCO Quality", "वर्कफ़्लो 1 • CDSCO गुणवत्ता"),
      icon: ShieldAlert,
      color: "amber",
      description: tr(
        "Verify your batch number against 260 official Central Drugs Standard Control Organisation (CDSCO) alerts for substandard or spurious drugs.",
        "मानक गुणवत्ता के अनुरूप न पाए गए अलर्ट के लिए अपने बैच नंबर की आधिकारिक CDSCO सूची में तत्काल जांच करें।"
      ),
      cta: tr("Check Batch Alert", "बैच अलर्ट जांचें"),
      href: "/batch-safety",
    },
    {
      title: tr("I want to locate nearby stores", "मुझे नज़दीकी स्टोर ढूंढने हैं"),
      badge: tr("Workflow 1 • WhatsApp Enquiry", "वर्कफ़्लो 1 • व्हाट्सएप पूछताछ"),
      icon: MapPin,
      color: "blue",
      description: tr(
        "Locate Pradhan Mantri Jan Aushadhi Kendras and local licensed pharmacies around you. Export a structured medicine inquiry straight to WhatsApp.",
        "अपने आस-पास जन औषधि केंद्र और मेडिकल स्टोर खोजें। दवा उपलब्धता के लिए सीधा व्हाट्सएप संदेश तैयार करें।"
      ),
      cta: tr("Find Pharmacies", "मेडिकल स्टोर खोजें"),
      href: "/stores",
    },
  ];

  const workflow1Steps = [
    {
      step: "01",
      title: tr("Multimodal OCR Extraction", "मल्टीमॉडल ओसीआर निष्कर्षण"),
      desc: tr(
        "Upload handwritten prescriptions. Gemini Vision identifies active molecules, dosage forms, and strengths with zero clinical cloud retention.",
        "पर्चे का फोटो अपलोड करें। जेमिनी विज़न दवाइयों और मात्रा की पहचान करता है बिना डेटाबेस में चित्र सहेजे।"
      ),
      icon: FileSearch,
    },
    {
      step: "02",
      title: tr("Human Confirmation Guardrail", "स्वयं समीक्षा और मानवीय पुष्टि"),
      desc: tr(
        "Review extracted items before searching. Correct spelling, quantity, or dosage to eliminate OCR hallucinations.",
        "खोज से पहले निकाले गए नामों की स्वयं पुष्टि करें ताकि किसी भी त्रुटि की संभावना समाप्त हो सके।"
      ),
      icon: FileCheck,
    },
    {
      step: "03",
      title: tr("3-Way Generic Price Benchmarking", "3-तरफ़ा जेनेरिक मूल्य तुलना"),
      desc: tr(
        "Compare Jan Aushadhi (PMBJP) and Dava India government-subsidized rates against commercial MRPs (saving 60%–85%).",
        "जन औषधि, दवा इंडिया और ब्रांडेड कीमतों की पारदर्शी तुलना देखें और 60% से 85% तक बचत करें।"
      ),
      icon: TrendingDown,
    },
    {
      step: "04",
      title: tr("CDSCO Batch Quality Verification", "सीडीएससीओ बैच सुरक्षा जांच"),
      desc: tr(
        "Cross-reference medicine pack batch numbers against 260 official government Not of Standard Quality (NSQ) recall notices.",
        "दवाइयों के बैच नंबर को सरकार द्वारा जारी मानक गुणवत्ता के अनुरूप न पाए गए अलर्ट से सत्यापित करें।"
      ),
      icon: ShieldCheck,
    },
    {
      step: "05",
      title: tr("Local Store WhatsApp Availability", "नज़दीकी स्टोर व्हाट्सएप पूछताछ"),
      desc: tr(
        "Find nearby Jan Aushadhi Kendras and dispatch pre-filled WhatsApp enquiry cards to confirm physical stock availability.",
        "निकटतम जन औषधि केंद्र खोजें और प्रमाणित फार्मासिस्ट को उपलब्धता पुष्टि के लिए सीधा संदेश भेजें।"
      ),
      icon: Store,
    },
  ];

  const workflow2Steps = [
    {
      step: "01",
      title: tr("Multilingual AI Consultation", "बहुभाषी एआई परामर्श"),
      desc: tr(
        "Ask health questions in Hindi or English using voice or text. Powered by LangChain medical orchestration and ElevenLabs voice narration.",
        "हिंदी या अंग्रेजी में बोलकर या लिखकर सवाल पूछें। ग्यारह प्रयोगशालाओं की आवाज़ से स्वाभाविक संवाद।"
      ),
      icon: Mic,
    },
    {
      step: "02",
      title: tr("Persistent Memory via Meko MCP", "Meko MCP निरंतर स्मृति"),
      desc: tr(
        "MedSaathi recalls your known drug allergies, chronic conditions, and preferred generic brands across sessions so you don't repeat yourself.",
        "मेडसाथी आपकी पिछली बातचीत, एलर्जी और स्वास्थ्य प्राथमिकताओं को याद रखता है ताकि बेहतर सलाह दे सके।"
      ),
      icon: Brain,
    },
    {
      step: "03",
      title: tr("Zero Clinical Storage Guarantee", "शून्य क्लिनिकल डेटा भंडारण"),
      desc: tr(
        "Original prescription scans, diagnosis files, and private medical documents are processed strictly in browser memory — never saved in cloud databases.",
        "पर्चे के चित्र और मेडिकल रिकॉर्ड कभी भी क्लाउड डेटाबेस में संग्रहीत नहीं होते — पूर्णतः स्थानीय।"
      ),
      icon: Lock,
    },
    {
      step: "04",
      title: tr("Context & Transparency Vault", "पारदर्शिता और स्मृति नियंत्रण"),
      desc: tr(
        "Inspect what MedSaathi recalls in real-time with the ContextPanel. Approve new memories, forget specific entries, or wipe data with 1 click.",
        "कंटेक्स्ट पैनल में देखें कि मेडसाथी को क्या याद है। किसी भी तथ्य को एक क्लिक से हटाएं या संपादित करें।"
      ),
      icon: Shield,
    },
    {
      step: "05",
      title: tr("Enterprise YugabyteDB Security", "युगाबाइट डीबी ईऑन सुरक्षा"),
      desc: tr(
        "User authentication and consent gates are stored in distributed YugabyteDB Aeon with Argon2id cryptographic hashing and cross-region resilience.",
        "मरीज़ खाते और सहमति विकल्प युगाबाइट डीबी ईऑन में आर्गन2आईडी एन्क्रिप्शन के साथ सुरक्षित रहते हैं।"
      ),
      icon: Database,
    },
  ];

  const trustPillars = [
    {
      icon: Lock,
      title: tr("Zero Clinical Document Retention", "क्लिनिकल दस्तावेज़ का कोई संचय नहीं"),
      desc: tr(
        "Prescriptions and medical files are processed ephemerally in browser memory. They are never uploaded or persisted to remote databases.",
        "अपलोड किए गए पर्चे केवल मेमोरी में अस्थायी रूप से प्रोसेस होते हैं और कभी भी डेटाबेस में सहेजे नहीं जाते।"
      ),
    },
    {
      icon: Brain,
      title: tr("User-Controlled Memory (Meko)", "उपयोगकर्ता नियंत्रित मेमोरी (Meko)"),
      desc: tr(
        "Memory continuity requires explicit consent. You can inspect recalled facts, pause memory, or permanently erase your history anytime.",
        "मेमोरी निरंतरता केवल आपकी स्पष्ट सहमति से चलती है। आप कभी भी सहेजे गए तथ्यों को देख या स्थायी रूप से हटा सकते हैं।"
      ),
    },
    {
      icon: Database,
      title: tr("Official Government Data", "आधिकारिक सरकारी डेटा"),
      desc: tr(
        "Prices and batch safety notices are sourced directly from official PMBJP (Jan Aushadhi) catalogues and monthly CDSCO advisories.",
        "कीमतें और बैच सूचनाएं आधिकारिक जन औषधि (PMBJP) कैटलॉग और मासिक CDSCO सुरक्षा सलाह से ली गई हैं।"
      ),
    },
    {
      icon: ShieldCheck,
      title: tr("Independent & Non-Commercial", "स्वतंत्र और गैर-व्यावसायिक"),
      desc: tr(
        "We do not sell medicines or accept pharmaceutical commissions. Our sole objective is public price transparency and patient safety.",
        "हम दवाइयां नहीं बेचते और न ही कमीशन लेते हैं। हमारा एकमात्र लक्ष्य पारदर्शी मूल्य तुलना उपलब्ध कराना है।"
      ),
    },
    {
      icon: Users,
      title: tr("Doctor & Pharmacist First", "डॉक्टर व फार्मासिस्ट सर्वोपरि"),
      desc: tr(
        "MedEasy empowers informed conversations. We never recommend changing prescribed regimens without consulting your physician or pharmacist.",
        "हम चिकित्सीय सलाह के बिना दवा बदलने की सिफारिश कभी नहीं करते। हम मरीज़ों को डॉक्टर से सूचित बातचीत करने में सक्षम बनाते हैं।"
      ),
    },
  ];

  const faqs = [
    {
      q: tr(
        "What are the two core workflows of MedEasy?",
        "MedEasy के दो मुख्य वर्कफ़्लो कौन-से हैं?"
      ),
      a: tr(
        "Workflow 1 is the Prescription-to-Pharmacy Pipeline: OCR prescription scanning, human confirmation, 3-way generic price benchmarking (Jan Aushadhi vs Dava India vs Branded), CDSCO batch safety checks, and WhatsApp availability enquiries. Workflow 2 is Persistent Patient Memory & AI Clinical Continuity: voice/text consultations with MedSaathi AI in Hindi/English, backed by Meko privacy-preserving memory that recalls allergies and conditions without ever uploading raw medical files.",
        "वर्कफ़्लो 1 पर्चे से मेडिकल स्टोर की पाइपलाइन है (स्कैन, पुष्टि, 3-तरफ़ा दाम तुलना, बैच सुरक्षा और व्हाट्सएप पूछताछ)। वर्कफ़्लो 2 निरंतर स्वास्थ्य स्मृति और एआई परामर्श है (मेडसाथी एआई साथी, हिंदी/अंग्रेजी आवाज़, और Meko मेमोरी जो बिना मेडिकल फाइलें अपलोड किए आपकी एलर्जी याद रखती है)।"
      ),
    },
    {
      q: tr(
        "What is MedSaathi AI and how does it assist patients?",
        "मेडसाथी एआई क्या है और यह मरीज़ों की कैसे सहायता करता है?"
      ),
      a: tr(
        "MedSaathi is our AI health assistant. It answers questions about medicine uses, common side effects, timing, and generic alternatives in natural Hindi or English. Powered by LangChain and Gemini multimodal intelligence, with natural ElevenLabs voice synthesis for listening to responses.",
        "मेडसाथी हमारा स्वास्थ्य एआई साथी है। यह दवाइयों के उपयोग, खुराक के समय और जेनेरिक विकल्पों के बारे में सहज हिंदी या अंग्रेजी में जानकारी देता है। इसमें उत्तर सुनने के लिए ElevenLabs आवाज़ तकनीक भी उपलब्ध है।"
      ),
    },
    {
      q: tr(
        "How does persistent patient memory work without compromising privacy?",
        "गोपनीयता से समझौता किए बिना निरंतर स्वास्थ्य मेमोरी कैसे काम करती है?"
      ),
      a: tr(
        "MedEasy adheres to a strict Zero-Clinical-Storage policy. Original prescription photos, PDFs, and diagnostic documents are processed in local browser memory and never stored in cloud storage. When you enable Meko memory, only user-approved structured preferences (e.g., 'Allergy: Penicillin', 'Condition: Type-2 Diabetes') are retained. You have full transparency in your Account vault to inspect, edit, or wipe memories at any moment.",
        "MedEasy शून्य-क्लिनिकल-डेटा नीति का पालन करता है। पर्चे के चित्र और पीडीएफ कभी भी क्लाउड पर सहेजे नहीं जाते। जब आप Meko मेमोरी सक्षम करते हैं, तो केवल आपकी स्वीकृत प्राथमिकताएं (जैसे 'एलर्जी: पेनिसिलिन') ही याद रखी जाती हैं, जिन्हें आप खाता सेटिंग्स में कभी भी देख या हटा सकते हैं।"
      ),
    },
    {
      q: tr(
        "How are Jan Aushadhi medicines 50% to 80% more affordable?",
        "जन औषधि की दवाइयां 50% से 80% तक सस्ती कैसे होती हैं?"
      ),
      a: tr(
        "Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP) is an initiative of the Government of India. Generics contain the exact same active pharmaceutical ingredients (APIs) but eliminate high marketing, brand promotion, and middleman markups, passing pure savings to the public.",
        "प्रधानमंत्री भारतीय जनऔषधि परियोजना (PMBJP) भारत सरकार की एक पहल है। जेनेरिक दवाओं में वही समान सक्रिय औषधीय तत्व (API) होते हैं, परंतु भारी विपणन और ब्रांडिंग खर्च न होने से सीधी बचत जनता तक पहुंचती है।"
      ),
    },
    {
      q: tr("Can I talk to MedSaathi in Hindi using my voice?", "क्या मैं मेडसाथी से हिंदी में बोलकर बात कर सकता हूँ?"),
      a: tr(
        "Yes! MedSaathi includes built-in microphone speech recognition in both Hindi and English. It also offers live audio playback using ElevenLabs natural voice so you can listen to healthcare explanations comfortably.",
        "हाँ! मेडसाथी में हिंदी और अंग्रेजी दोनों में वॉयस इनपुट की सुविधा है। आप अपना सवाल बोल सकते हैं और 'उत्तर सुनें' बटन दबाकर उच्च-गुणवत्ता वाली आवाज़ में सुन सकते हैं।"
      ),
    },
    {
      q: tr("Does MedEasy sell or dispense medicines online?", "क्या MedEasy ऑनलाइन दवाइयां बेचता या डिलीवर करता है?"),
      a: tr(
        "No. MedEasy is strictly an informational and price transparency tool. We help you prepare enquiry lists to check availability at licensed local Jan Aushadhi Kendras or your neighborhood chemist via WhatsApp.",
        "नहीं। MedEasy पूरी तरह से एक सूचनात्मक और मूल्य पारदर्शिता मंच है। हम केवल आपकी दवा सूची तैयार करने में मदद करते हैं ताकि आप नज़दीकी जन औषधि केंद्र या दवा दुकान से व्हाट्सएप पर उपलब्धता जान सकें।"
      ),
    },
    {
      q: tr("What is the CDSCO Batch Safety check?", "सीडीएससीओ बैच सुरक्षा जांच क्या है?"),
      a: tr(
        "The Central Drugs Standard Control Organisation (CDSCO) regularly tests pharmaceutical batches across India and publishes Not of Standard Quality (NSQ) alerts. MedEasy indexes 260 official recall records so you can verify if a batch in your medicine cabinet has been flagged by government drug inspectors.",
        "केंद्रीय औषधि मानक नियंत्रण संगठन (CDSCO) नियमित रूप से दवाइयों के नमूनों की जांच करता है और मानक के अनुरूप न पाए जाने पर अलर्ट जारी करता है। MedEasy 260 आधिकारिक रिकॉर्ड्स को स्कैन करके आपको तुरंत बताता है कि क्या आपके बैच पर कोई सरकारी चेतावनी है।"
      ),
    },
  ];

  return (
    <div className="border-t border-slate-100 bg-[#f7faff]">
      {/* 1. QUICK SEARCH SECTION */}
      <section className="mx-auto max-w-[1240px] px-5 py-12 md:px-8">
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_36px_rgba(15,40,90,0.05)] md:p-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-bold text-brand">
              <Search className="h-3.5 w-3.5" />
              {tr("Quick Catalogue Search", "त्वरित कैटलॉग खोज")}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold text-navy sm:text-3xl">
              {tr("Search any medicine to check price differences", "दामों में अंतर देखने के लिए किसी भी दवाई को खोजें")}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              {tr(
                "Instantly find Jan Aushadhi and Dava India alternatives for your regular prescriptions.",
                "अपने नियमित पर्चे के लिए तुरंत जन औषधि और दवा इंडिया विकल्प खोजें।"
              )}
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(
                  "Try 'Paracetamol', 'Metformin', 'Telmisartan' or brand name...",
                  "पैरासिटामोल, मेटफॉर्मिन, टेल्मिसर्टन या ब्रांड नाम खोजें..."
                )}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-[#f8fbff] pl-12 pr-4 text-sm font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-hidden focus:ring-3 focus:ring-brand/10"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-7 text-sm font-bold text-white shadow-xs transition hover:bg-brand-dark"
            >
              <span>{tr("Compare Prices", "कीमतों की तुलना करें")}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Popular pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-400">
              {tr("Popular searches:", "लोकप्रिय खोजें:")}
            </span>
            {popularMedicines.map((med) => (
              <button
                key={med}
                type="button"
                onClick={() => navigate(`/medicines?q=${encodeURIComponent(med)}`)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 transition hover:border-brand/40 hover:bg-[#eef5ff] hover:text-brand"
              >
                {med}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. CHOOSE YOUR PATH (HOW TO UTILIZE MEDEASY FOR YOUR NEED) */}
      <section className="mx-auto max-w-[1240px] px-5 py-12 md:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            {tr("Designed For Your Specific Needs", "आपकी विशिष्ट ज़रूरतों के लिए निर्मित")}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
            {tr("How can MedEasy help you today?", "आज MedEasy आपकी कैसे सहायता कर सकता है?")}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {tr(
              "Whether you hold a doctor's paper slip, need AI consultation, or want to inspect generic pricing, choose your path below.",
              "चाहे आपके पास डॉक्टर का पर्चा हो, AI परामर्श चाहिए या जेनेरिक कीमतें देखना चाहते हों, नीचे अपना विकल्प चुनें।"
            )}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {userPaths.map((path) => {
            const Icon = path.icon;
            const isPurple = path.color === "purple";
            return (
              <div
                key={path.title}
                className={`group flex flex-col justify-between rounded-3xl border bg-white p-5 shadow-xs transition hover:-translate-y-1 hover:shadow-lg ${
                  isPurple
                    ? "border-purple-200/90 hover:border-purple-400"
                    : "border-slate-200/90 hover:border-brand/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                      isPurple
                        ? "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white"
                        : "bg-[#eef5ff] text-brand group-hover:bg-brand group-hover:text-white"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      isPurple ? "bg-purple-100/70 text-purple-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {path.badge}
                    </span>
                  </div>

                  <h3 className={`mt-4 text-base font-bold text-navy ${
                    isPurple ? "group-hover:text-purple-700" : "group-hover:text-brand"
                  }`}>
                    {path.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {path.description}
                  </p>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100">
                  <Link
                    to={path.href}
                    className={`inline-flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition ${
                      isPurple
                        ? "bg-purple-50 text-purple-700 group-hover:bg-purple-600 group-hover:text-white"
                        : "bg-slate-50 text-navy group-hover:bg-brand group-hover:text-white"
                    }`}
                  >
                    <span>{path.cta}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. DUAL-ENGINE ARCHITECTURE: THE TWO WORKFLOWS OF MEDEASY */}
      <section className="mx-auto max-w-[1240px] px-5 py-14 md:px-8">
        <div className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-sm md:p-10">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1 text-xs font-black text-brand">
              <Zap className="h-3.5 w-3.5" />
              <span>{tr("DUAL-ENGINE HEALTHCARE ARCHITECTURE", "दोहरी स्वास्थ्य कार्यप्रणाली")}</span>
            </span>
            <h2 className="mt-3 text-3xl font-black text-navy sm:text-4xl">
              {tr("Two Workflows. Complete Patient Empowerment.", "दो मुख्य वर्कफ़्लो। सम्पूर्ण स्वास्थ्य सशक्तिकरण।")}
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              {tr(
                "MedEasy bridges immediate prescription price discovery with long-term, privacy-preserving clinical continuity. Choose a workflow or explore both together.",
                "MedEasy तत्काल पर्चा दाम तुलना को दीर्घकालिक सुरक्षित स्वास्थ्य मेमोरी से जोड़ता है।"
              )}
            </p>

            {/* Workflow selector pills */}
            <div className="mt-6 inline-flex items-center rounded-2xl bg-slate-100 p-1.5 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveWorkflowTab("both")}
                className={`rounded-xl px-4 py-1.5 transition ${
                  activeWorkflowTab === "both" ? "bg-white text-navy shadow-xs" : "text-slate-600 hover:text-navy"
                }`}
              >
                {tr("Show Both Workflows", "दोनों वर्कफ़्लो देखें")}
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkflowTab("wf1")}
                className={`rounded-xl px-4 py-1.5 transition ${
                  activeWorkflowTab === "wf1" ? "bg-brand text-white shadow-xs" : "text-slate-600 hover:text-navy"
                }`}
              >
                {tr("Workflow 1: Prescription & Savings", "वर्कफ़्लो 1: पर्चा व बचत")}
              </button>
              <button
                type="button"
                onClick={() => setActiveWorkflowTab("wf2")}
                className={`rounded-xl px-4 py-1.5 transition ${
                  activeWorkflowTab === "wf2" ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 hover:text-navy"
                }`}
              >
                {tr("Workflow 2: AI & Memory", "वर्कफ़्लो 2: एआई व मेमोरी")}
              </button>
            </div>
          </div>

          {/* Dual Columns Container */}
          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* WORKFLOW 1 COLUMN */}
            {(activeWorkflowTab === "both" || activeWorkflowTab === "wf1") && (
              <div className="flex flex-col justify-between rounded-3xl border border-blue-200/80 bg-white p-6 shadow-sm md:p-8">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-brand">
                      <Pill className="h-3.5 w-3.5" />
                      <span>{tr("WORKFLOW 1", "वर्कफ़्लो 1")}</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                      {tr("Save 60%–85%", "60%–85% बचत")}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-black text-navy sm:text-2xl">
                    {tr("Prescription-to-Pharmacy Pipeline", "पर्चे से नज़दीकी मेडिकल स्टोर तक")}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
                    {tr(
                      "From handwriting on a paper slip to verified generic alternatives, CDSCO safety checks, and WhatsApp pharmacy enquiries.",
                      "हस्तलिखित पर्चे से प्रमाणित जेनेरिक दवाओं, बैच सुरक्षा जांच और सीधे स्टोर उपलब्धता तक।"
                    )}
                  </p>

                  {/* 5 Sequential Steps */}
                  <div className="mt-6 space-y-4">
                    {workflow1Steps.map((s) => {
                      const Icon = s.icon;
                      return (
                        <div key={s.step} className="flex items-start gap-3.5 rounded-2xl border border-slate-100 bg-[#fbfdff] p-3.5 transition hover:bg-white hover:border-brand/30">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100/60 text-xs font-black text-brand">
                            {s.step}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-brand" />
                              <h4 className="text-xs font-black text-navy">{s.title}</h4>
                            </div>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{s.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-2.5">
                  <Link
                    to="/scan"
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-600"
                  >
                    <ScanLine className="h-3.5 w-3.5" />
                    <span>{tr("Start Prescription Scan", "पर्चा स्कैन शुरू करें")}</span>
                  </Link>
                  <Link
                    to="/medicines"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-navy transition hover:bg-white"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>{tr("Explore 508+ Meds", "508+ दवाइयां देखें")}</span>
                  </Link>
                </div>
              </div>
            )}

            {/* WORKFLOW 2 COLUMN */}
            {(activeWorkflowTab === "both" || activeWorkflowTab === "wf2") && (
              <div className="flex flex-col justify-between rounded-3xl border border-purple-200/80 bg-white p-6 shadow-sm md:p-8">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">
                      <Brain className="h-3.5 w-3.5" />
                      <span>{tr("WORKFLOW 2", "वर्कफ़्लो 2")}</span>
                    </span>
                    <span className="text-xs font-bold text-purple-700 bg-purple-100/70 px-2.5 py-0.5 rounded-full">
                      {tr("Meko Privacy Memory", "Meko सुरक्षित मेमोरी")}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-black text-navy sm:text-2xl">
                    {tr("Persistent Patient Memory & MedSaathi AI", "निरंतर स्वास्थ्य स्मृति व मेडसाथी AI")}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
                    {tr(
                      "Multilingual AI health companion with ElevenLabs voice synthesis. Never forgets your allergies and health context across sessions.",
                      "आवाज़ और टेक्स्ट से स्वास्थ्य साथी जो आपकी एलर्जी और पुरानी बीमारियों को याद रखता है।"
                    )}
                  </p>

                  {/* 5 Sequential Steps */}
                  <div className="mt-6 space-y-4">
                    {workflow2Steps.map((s) => {
                      const Icon = s.icon;
                      return (
                        <div key={s.step} className="flex items-start gap-3.5 rounded-2xl border border-slate-100 bg-[#fbfdff] p-3.5 transition hover:bg-white hover:border-purple-300">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-100/70 text-xs font-black text-purple-700">
                            {s.step}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5 text-purple-600" />
                              <h4 className="text-xs font-black text-navy">{s.title}</h4>
                            </div>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{s.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-2.5">
                  <Link
                    to="/med-saathi"
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-purple-700 active:scale-98"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tr("Talk to MedSaathi AI", "मेडसाथी से बात करें")}</span>
                  </Link>
                  <Link
                    to="/account"
                    className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/50 px-4 py-2.5 text-xs font-bold text-purple-700 transition hover:bg-purple-100"
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>{tr("Memory & Context Vault", "मेमोरी और वॉल्ट")}</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE MEDSAATHI & MEKO MEMORY SIMULATION SHOWCASE */}
      <section className="mx-auto max-w-[1240px] px-5 py-12 md:px-8">
        <div className="rounded-3xl border border-purple-200/90 bg-gradient-to-br from-purple-50/60 via-white to-blue-50/40 p-6 shadow-sm md:p-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100/80 px-3 py-1 text-xs font-black text-purple-700">
              <Bot className="h-3.5 w-3.5" />
              <span>{tr("LIVE SIMULATION • PERSISTENT CLINICAL MEMORY", "लाइव प्रदर्शन • निरंतर क्लिनिकल मेमोरी")}</span>
            </span>
            <h2 className="mt-3 text-2xl font-black text-navy sm:text-3xl">
              {tr("See How MedSaathi Remembers Your Health Context", "देखें कि मेडसाथी आपकी स्वास्थ्य स्थिति कैसे याद रखता है")}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600">
              {tr(
                "In traditional chatbots, you have to re-explain your conditions every time. With Meko privacy memory, MedSaathi cross-checks past sessions automatically.",
                "साधारण बॉट में आपको हर बार अपनी बीमारी बतानी पड़ती है। Meko मेमोरी के साथ मेडसाथी आपकी पिछली बातों को याद रखकर सुरक्षित मार्गदर्शन देता है।"
              )}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left: Chat Simulation Bubble */}
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              {/* Patient Query */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-xs text-navy">
                  YOU
                </div>
                <div className="rounded-2xl rounded-tl-xs bg-slate-100 p-3.5 text-xs text-navy font-medium leading-relaxed">
                  <p>
                    {locale === "hi"
                      ? "“क्या मैं अपनी शुगर की दवा (Metformin) के साथ Dolo 650 ले सकता हूँ? और क्या इसका कोई जन औषधि विकल्प है?”"
                      : "“Can I take Dolo 650 alongside my regular Metformin for fever? And is there an affordable generic option?”"}
                  </p>
                </div>
              </div>

              {/* MedSaathi Response */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white font-bold text-xs">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-tl-xs border border-purple-100 bg-purple-50/70 p-4 text-xs text-navy leading-relaxed">
                  <div className="mb-2 flex items-center justify-between border-b border-purple-100 pb-2">
                    <span className="font-black text-purple-700">MedSaathi AI</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 bg-white px-2 py-0.5 rounded-full">
                      <Volume2 className="h-3 w-3" />
                      <span>{tr("ElevenLabs Audio Narration", "ग्यारह प्रयोगशालाओं की आवाज़")}</span>
                    </span>
                  </div>
                  <p>
                    {locale === "hi"
                      ? "हाँ, मेटफॉर्मिन और पैरासिटामोल (Dolo 650) को साथ लेना आम तौर पर सुरक्षित है। आपकी सहेजी गई प्रोफ़ाइल में सल्फोनामाइड एलर्जी दर्ज है, जिसका इस दवा से कोई विरोध नहीं है।"
                      : "Yes, taking Metformin and Paracetamol (Dolo 650) together is generally safe for fever. Your saved profile notes a Sulfonamide allergy, which does not conflict with Paracetamol."}
                  </p>
                  <div className="mt-3 rounded-xl bg-white p-2.5 border border-purple-100">
                    <div className="text-[11px] font-bold text-emerald-700">
                      💰 {tr("Generic Alternative Identified:", "जेनेरिक विकल्प पाया गया:")}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600">
                      {tr(
                        "Jan Aushadhi Paracetamol 650mg is available for ₹12 (vs Dolo 650 branded MRP ₹32) — saving you ₹20 (62%)!",
                        "जन औषधि केंद्र में Paracetamol 650mg ₹12 में उपलब्ध है (Dolo 650 के ₹32 के मुकाबले) — आप 62% बचा सकते हैं!"
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Meko Memory Inspector Card */}
            <div className="flex flex-col justify-between rounded-2xl border border-purple-200 bg-white p-5 shadow-2xs">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-black text-navy">{tr("Meko Live Context Inspector", "Meko लाइव संदर्भ निरीक्षक")}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{tr("Memory Synced", "मेमोरी सक्रिय")}</span>
                  </span>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {tr("Active Chronic Condition:", "सक्रिय पुरानी बीमारी:")}
                    </div>
                    <div className="mt-0.5 font-bold text-navy">Type-2 Diabetes Mellitus (Metformin 500mg)</div>
                  </div>

                  <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-2.5 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                      {tr("Known Drug Allergy Alert:", "दवा एलर्जी चेतावनी:")}
                    </div>
                    <div className="mt-0.5 font-bold text-rose-800">Sulfonamide Antibiotics (Sulfa drugs)</div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-2.5 text-xs">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      {tr("Affordability Preference:", "मूल्य प्राथमिकता:")}
                    </div>
                    <div className="mt-0.5 font-bold text-emerald-900">PMBJP Jan Aushadhi generic alternatives first</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{tr("Zero raw PDFs uploaded", "शून्य फाइल अपलोड")}</span>
                <Link
                  to="/med-saathi"
                  className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:underline"
                >
                  <span>{tr("Try MedSaathi Voice Assistant", "मेडसाथी वॉयस आज़माएं")}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. TRUST & CLINICAL SAFETY BOUNDARIES */}
      <section className="mx-auto max-w-[1240px] px-5 py-12 md:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
            <ShieldCheck className="h-3.5 w-3.5" />
            {tr("Trust & Clinical Boundaries", "विश्वास और सुरक्षा सीमाएं")}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
            {tr("Why patients trust MedEasy", "मरीज़ MedEasy पर भरोसा क्यों करते हैं")}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            {tr(
              "Healthcare requires absolute integrity. Here are our strict commitments to your privacy and clinical safety.",
              "स्वास्थ्य सेवा में पूर्ण निष्ठा आवश्यक है। आपकी गोपनीयता और सुरक्षा के प्रति ये हमारी प्रतिबद्धताएं हैं।"
            )}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {trustPillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef5ff] text-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-bold text-navy">{p.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. FREQUENTLY ASKED QUESTIONS */}
      <section className="mx-auto max-w-[960px] px-5 py-14 md:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
            <HelpCircle className="h-3.5 w-3.5" />
            {tr("Frequently Asked Questions", "अक्सर पूछे जाने वाले प्रश्न")}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
            {tr("Common questions about pricing, memory & safety", "मूल्य, मेमोरी और सुरक्षा से जुड़े सामान्य सवाल")}
          </h2>
        </div>

        <div className="mt-8 space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left font-bold text-navy transition hover:text-brand"
                >
                  <span className="text-sm md:text-base">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
                      isOpen ? "rotate-180 text-brand" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-[#fbfdff] px-5 pb-5 pt-3 text-xs leading-relaxed text-muted md:text-sm">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. BOTTOM CALL TO ACTION BANNER */}
      <section className="mx-auto max-w-[1240px] px-5 pb-16 md:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0d5cdb_0%,#1769ff_100%)] p-8 text-white shadow-xl md:p-12">
          <div className="relative z-10 max-w-2xl">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold tracking-wide text-white">
              {tr("START SAVING & CONSULTING TODAY", "आज ही बचत और परामर्श शुरू करें")}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {tr(
                "Ready to verify medicine prices and consult MedSaathi?",
                "दवाइयों के दामों की जांच करने और मेडसाथी से परामर्श के लिए तैयार हैं?"
              )}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-blue-100">
              {tr(
                "Save up to 85% with verified Jan Aushadhi generic alternatives, check CDSCO batch safety alerts, or talk to your voice AI healthcare companion.",
                "जन औषधि जेनेरिक विकल्पों के साथ 85% तक बचत करें, सीडीएससीओ बैच सुरक्षा जांचें या अपने वॉयस एआई साथी से बात करें।"
              )}
            </p>

            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                to="/scan"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-bold text-brand shadow-md transition hover:bg-blue-50"
              >
                <ScanLine className="h-4 w-4" />
                <span>{tr("Scan Prescription", "पर्चा स्कैन करें")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/med-saathi"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-7 text-sm font-bold text-white backdrop-blur-xs transition hover:bg-white/20"
              >
                <Sparkles className="h-4 w-4" />
                <span>{tr("Talk to MedSaathi AI", "मेडसाथी AI से बात करें")}</span>
              </Link>
              <Link
                to="/medicines"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-sm font-bold text-white backdrop-blur-xs transition hover:bg-white/15"
              >
                <Search className="h-4 w-4" />
                <span>{tr("Explore Medicines", "दवाइयां देखें")}</span>
              </Link>
            </div>
          </div>

          {/* Decorative background circle */}
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        </div>
      </section>
    </div>
  );
}