import {
  ArrowRight,
  ChevronDown,
  Database,
  FileCheck,
  FileSearch,
  HelpCircle,
  Lock,
  MapPin,
  Pill,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";

export function LandingGuide() {
  const navigate = useNavigate();
  const { tr } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      badge: tr("AI-Assisted Scan", "AI स्कैन सहायता"),
      icon: ScanLine,
      color: "brand",
      description: tr(
        "Upload a photo or PDF of your doctor's prescription. Our optical OCR extracts medicine names for you to review and confirm before comparing catalogue prices.",
        "डॉक्टर के पर्चे का फोटो या पीडीएफ अपलोड करें। हमारा OCR दवाइयों के नाम निकालता है ताकि आप कीमतों की तुलना से पहले पुष्टि कर सकें।"
      ),
      cta: tr("Scan Prescription", "पर्चा स्कैन करें"),
      href: "/scan",
    },
    {
      title: tr("I know my medicine or salt name", "मुझे दवाई या साल्ट का नाम पता है"),
      badge: tr("Instant Price Compare", "तुरंत दाम तुलना"),
      icon: Search,
      color: "emerald",
      description: tr(
        "Search our indexed catalogue directly. Compare Jan Aushadhi (PMBJP), Dava India generic alternatives, and private brands side-by-side.",
        "सीधे हमारे कैटलॉग में खोजें। जन औषधि (PMBJP), दवा इंडिया जेनेरिक और ब्रांडेड दवाओं की साथ-साथ तुलना करें।"
      ),
      cta: tr("Search Medicines", "दवाइयां खोजें"),
      href: "/medicines",
    },
    {
      title: tr("I want to check batch safety", "मुझे बैच सुरक्षा की जांच करनी है"),
      badge: tr("CDSCO Quality Check", "CDSCO गुणवत्ता जांच"),
      icon: ShieldAlert,
      color: "amber",
      description: tr(
        "Verify your batch number against official monthly Central Drugs Standard Control Organisation (CDSCO) alerts for substandard or spurious drugs.",
        "मानक गुणवत्ता के अनुरूप न पाए गए अलर्ट के लिए अपने बैच नंबर की आधिकारिक CDSCO सूची में जांच करें।"
      ),
      cta: tr("Check Batch Alert", "बैच अलर्ट जांचें"),
      href: "/batch-safety",
    },
    {
      title: tr("I want to locate nearby stores", "मुझे नज़दीकी स्टोर ढूंढने हैं"),
      badge: tr("Pharmacy & WhatsApp", "फार्मेसी व व्हाट्सएप"),
      icon: MapPin,
      color: "blue",
      description: tr(
        "Locate Pradhan Mantri Jan Aushadhi Kendras and local licensed pharmacies around you. Export a structured medicine inquiry straight to WhatsApp.",
        "अपने आस-पास प्रधानमंत्री जन औषधि केंद्र और मेडिकल स्टोर खोजें। दवा उपलब्धता के लिए सीधा व्हाट्सएप संदेश तैयार करें।"
      ),
      cta: tr("Find Pharmacies", "मेडिकल स्टोर खोजें"),
      href: "/stores",
    },
  ];

  const journeySteps = [
    {
      step: "01",
      title: tr("Provide your medicine details", "अपनी दवाई का विवरण दें"),
      desc: tr(
        "Upload your prescription or type generic / branded medicine names directly. Everything runs locally in your browser session.",
        "अपना पर्चा अपलोड करें या सीधे दवाई का नाम लिखें। सब कुछ आपके ब्राउज़र सत्र में स्थानीय रूप से चलता है।"
      ),
      icon: FileSearch,
    },
    {
      step: "02",
      title: tr("Human-in-the-loop verification", "स्वयं समीक्षा और पुष्टि"),
      desc: tr(
        "Review and edit extracted items. You always have full oversight to correct strength, dosage form, or spelling before searching.",
        "निकाले गए नामों की समीक्षा और संपादन करें। खोज से पहले मात्रा, खुराक का रूप या वर्तनी सुधारने का पूरा नियंत्रण आपके पास है।"
      ),
      icon: FileCheck,
    },
    {
      step: "03",
      title: tr("Compare verified generic prices", "प्रमाणित जेनेरिक कीमतों की तुलना"),
      desc: tr(
        "View official benchmark prices from Pradhan Mantri Jan Aushadhi Pariyojana (PMBJP) and Dava India against commercial MRPs.",
        "कमर्शियल एमआरपी के मुकाबले प्रधानमंत्री जन औषधि परियोजना (PMBJP) और दवा इंडिया की आधिकारिक कीमतों की तुलना देखें।"
      ),
      icon: TrendingDown,
    },
    {
      step: "04",
      title: tr("Connect with local pharmacies", "स्थानीय मेडिकल स्टोर से जुड़ें"),
      desc: tr(
        "Find nearest PMBJP Kendras and open a pre-filled WhatsApp message to confirm stock availability with licensed pharmacists.",
        "निकटतम जन औषधि केंद्र खोजें और प्रमाणित फार्मासिस्ट के साथ स्टॉक उपलब्धता की पुष्टि के लिए पूर्व-लिखित व्हाट्सएप संदेश खोलें।"
      ),
      icon: MapPin,
    },
  ];

  const trustPillars = [
    {
      icon: Lock,
      title: tr("Zero Data Retention", "डेटा का कोई संचय नहीं"),
      desc: tr(
        "No account required. Uploaded prescription images are processed ephemerally in memory and never saved to databases or disk.",
        "किसी खाते की आवश्यकता नहीं है। अपलोड किए गए पर्चे केवल मेमोरी में अस्थायी रूप से प्रोसेस होते हैं और कभी भी डेटाबेस में सहेजे नहीं जाते।"
      ),
    },
    {
      icon: Database,
      title: tr("Official Government Data", "आधिकारिक सरकारी डेटा"),
      desc: tr(
        "Prices and batch notices are sourced from official PMBJP (Jan Aushadhi) catalogues and monthly CDSCO safety advisories.",
        "कीमतें और बैच सूचनाएं आधिकारिक जन औषधि (PMBJP) कैटलॉग और मासिक CDSCO सुरक्षा सलाह से ली गई हैं।"
      ),
    },
    {
      icon: ShieldCheck,
      title: tr("Informational & Independent", "केवल सूचनात्मक और स्वतंत्र"),
      desc: tr(
        "We don't sell medicines or take commissions from pharmaceutical companies. Our sole goal is transparent price benchmarking.",
        "हम दवाइयां नहीं बेचते और न ही कमीशन लेते हैं। हमारा एकमात्र लक्ष्य पारदर्शी मूल्य तुलना उपलब्ध कराना है।"
      ),
    },
    {
      icon: Users,
      title: tr("Doctor & Pharmacist First", "डॉक्टर व फार्मासिस्ट सर्वोपरि"),
      desc: tr(
        "We never recommend switching medications without clinical supervision. We empower patients to have informed conversations with clinicians.",
        "हम चिकित्सीय सलाह के बिना दवा बदलने की सलाह कभी नहीं देते। हम मरीज़ों को डॉक्टर से सूचित बातचीत करने में सक्षम बनाते हैं।"
      ),
    },
  ];

  const faqs = [
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
      q: tr("Does MedEasy sell or dispense medicines online?", "क्या MedEasy ऑनलाइन दवाइयां बेचता या डिलीवर करता है?"),
      a: tr(
        "No. MedEasy is strictly an informational and price transparency tool. We help you prepare enquiry lists to check availability at licensed local Jan Aushadhi Kendras or your neighborhood chemist.",
        "नहीं। MedEasy पूरी तरह से एक सूचनात्मक और मूल्य पारदर्शिता मंच है। हम केवल आपकी दवा सूची तैयार करने में मदद करते हैं ताकि आप नज़दीकी जन औषधि केंद्र या दवा दुकान से उपलब्धता जान सकें।"
      ),
    },
    {
      q: tr("Is my medical data and prescription kept private?", "क्या मेरी मेडिकल जानकारी और पर्चा गोपनीय रहता है?"),
      a: tr(
        "Yes, completely. MedEasy does not have user accounts or login walls. Prescriptions processed via OCR are handled ephemerally and discarded immediately after extraction. Your cart data stays only in your browser's temporary session.",
        "हाँ, पूर्णतः। MedEasy पर कोई खाता या लॉगिन नहीं होता। OCR द्वारा पढ़े जाने वाले पर्चे प्रोसेस होने के तुरंत बाद हटा दिए जाते हैं। आपका कार्ट डेटा केवल आपके ब्राउज़र में अस्थायी रूप से रहता है।"
      ),
    },
    {
      q: tr("What should I do if a medicine is not listed in the catalogue?", "यदि कोई दवाई कैटलॉग में न मिले तो क्या करें?"),
      a: tr(
        "Our catalogue indexes over 500 common essential medicines. If your specific medicine isn't present, search by its active salt composition, or consult a licensed pharmacist at a Jan Aushadhi Kendra who can look up government generic equivalents.",
        "हमारे कैटलॉग में 500 से अधिक सामान्य आवश्यक दवाइयां हैं। यदि आपकी विशिष्ट दवा सूची में नहीं है, तो उसके मूल साल्ट नाम से खोजें या जन औषधि केंद्र के फार्मासिस्ट से सरकारी जेनेरिक विकल्प जानें।"
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
                className="h-12 w-full rounded-2xl border border-slate-200 bg-[#f8fbff] pl-12 pr-4 text-sm font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand/10"
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
              "Whether you hold a doctor's paper slip or want to inspect generic pricing, choose your path below for a streamlined experience.",
              "चाहे आपके पास डॉक्टर का पर्चा हो या आप जेनेरिक कीमतें देखना चाहते हों, नीचे अपना विकल्प चुनें।"
            )}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {userPaths.map((path) => {
            const Icon = path.icon;
            return (
              <div
                key={path.title}
                className="group flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs transition hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef5ff] text-brand transition group-hover:bg-brand group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {path.badge}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-navy group-hover:text-brand">
                    {path.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {path.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <Link
                    to={path.href}
                    className="inline-flex w-full items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-navy transition group-hover:bg-brand group-hover:text-white"
                  >
                    <span>{path.cta}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. 4-STEP TRANSPARENT WORKFLOW */}
      <section className="mx-auto max-w-[1240px] px-5 py-14 md:px-8">
        <div className="rounded-3xl border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f9fcff_100%)] p-8 shadow-xs md:p-12">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
              <Pill className="h-3.5 w-3.5" />
              {tr("Transparent Clinical Workflow", "पारदर्शी क्लिनिकल प्रक्रिया")}
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
              {tr("How the platform works step-by-step", "मंच चरण-दर-चरण कैसे काम करता है")}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {tr(
                "Built with patient safety in mind. At every stage, you remain in complete control before any data is searched or shared.",
                "मरीज़ों की सुरक्षा को ध्यान में रखकर निर्मित। किसी भी डेटा को खोजने या साझा करने से पहले आप हर चरण में पूर्ण नियंत्रण में रहते हैं।"
              )}
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {journeySteps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="relative flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-brand/20">{s.step}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-navy">{s.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. TRUST & CLINICAL SAFETY BOUNDARIES */}
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

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {trustPillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef5ff] text-brand">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-navy">{p.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. FREQUENTLY ASKED QUESTIONS */}
      <section className="mx-auto max-w-[960px] px-5 py-14 md:px-8">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
            <HelpCircle className="h-3.5 w-3.5" />
            {tr("Frequently Asked Questions", "अक्सर पूछे जाने वाले प्रश्न")}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
            {tr("Common questions about medicine pricing", "दवाइयों के दाम से जुड़े सामान्य सवाल")}
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

      {/* 6. BOTTOM CALL TO ACTION BANNER */}
      <section className="mx-auto max-w-[1240px] px-5 pb-16 md:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0d5cdb_0%,#1769ff_100%)] p-8 text-white shadow-xl md:p-12">
          <div className="relative z-10 max-w-2xl">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold tracking-wide text-white">
              {tr("START SAVING TODAY", "आज ही बचत शुरू करें")}
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {tr(
                "Ready to verify medicine prices and save up to 80%?",
                "दवाइयों के दामों की जांच करने और 80% तक बचत करने के लिए तैयार हैं?"
              )}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-blue-100">
              {tr(
                "Zero registration. Free forever. Start by uploading a prescription photo or browsing our indexed catalogue.",
                "कोई पंजीकरण नहीं। सदैव निःशुल्क। पर्चे की फोटो अपलोड करके या हमारे कैटलॉग में देखकर शुरुआत करें।"
              )}
            </p>

            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
              <Link
                to="/scan"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-bold text-brand shadow-md transition hover:bg-blue-50"
              >
                <ScanLine className="h-4 w-4" />
                <span>{tr("Scan Prescription", "पर्चा स्कैन करें")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/medicines"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 text-sm font-bold text-white backdrop-blur-xs transition hover:bg-white/20"
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
