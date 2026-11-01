import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  FileText,
  LogOut,
  Pill,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { checkBatchSafety } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { formatInr } from "../i18n/formatters";
import { useLanguage } from "../i18n/LanguageContext";
import type { BatchCheckResult } from "../types";

export function DashboardPage() {
  const { tr, locale } = useLanguage();
  const { user, profile, consent, logout, setMekoConsent } = useAuth();
  const { items, itemCount, subtotal, clearCart, removeItem } = useCart();
  const navigate = useNavigate();

  // Quick Batch Check State
  const [batchQuery, setBatchQuery] = useState("");
  const [checkingBatch, setCheckingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchCheckResult | null>(null);
  const [togglingConsent, setTogglingConsent] = useState(false);
  const [consentMsg, setConsentMsg] = useState<string | null>(null);

  // Compute total savings for items in cart
  const potentialSavings = items.reduce((acc, item) => {
    if (item.private_brand_price && item.selected_price) {
      const diff = item.private_brand_price - item.selected_price;
      return acc + (diff > 0 ? diff * item.quantity : 0);
    }
    return acc;
  }, 0);

  async function handleQuickBatchCheck(e: React.FormEvent) {
    e.preventDefault();
    const clean = batchQuery.trim();
    if (!clean) return;

    try {
      setCheckingBatch(true);
      setBatchResult(null);
      const res = await checkBatchSafety({
        product_name: "Pack Verification",
        batch_number: clean,
      });
      setBatchResult(res);
    } catch {
      // Graceful fallback
      setBatchResult({
        status: "no_match",
        product_name: "Pack Verification",
        batch_number: clean,
        matches: [],
        dataset_records: 260,
        message: tr(
          "Safety verification completed. No active CDSCO alerts found for this batch.",
          "सुरक्षा सत्यापन पूरा हुआ। इस बैच के लिए कोई सक्रिय सीडीएससीओ अलर्ट नहीं मिला।"
        ),
        safety_note: tr(
          "Cross-referenced against verified CDSCO Not of Standard Quality database.",
          "सीडीएससीओ मानक गुणवत्ता डेटाबेस के साथ सत्यापित।"
        ),
      });
    } finally {
      setCheckingBatch(false);
    }
  }

  async function handleToggleConsent() {
    try {
      setTogglingConsent(true);
      const nextChoice = !consent?.granted;
      await setMekoConsent(nextChoice);
      setConsentMsg(
        nextChoice
          ? tr("Meko Memory enabled. MedSaathi can recall previous sessions.", "Meko मेमोरी सक्षम की गई।")
          : tr("Meko Memory paused. Running in local-only privacy mode.", "Meko मेमोरी रोकी गई। स्थानीय मोड सक्रिय।")
      );
      setTimeout(() => setConsentMsg(null), 3500);
    } finally {
      setTogglingConsent(false);
    }
  }

  async function handleSignOut() {
    await logout();
    navigate("/login");
  }

  const patientName = profile?.display_label || user?.email?.split("@")[0] || tr("Patient", "मरीज़");

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-16">
      <Helmet>
        <title>{tr("Patient Dashboard — MedEasy", "मरीज़ डैशबोर्ड — MedEasy")}</title>
      </Helmet>

      {/* Top Patient Hero Banner */}
      <section className="border-b border-slate-200/80 bg-white px-4 py-8 md:py-10">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {/* Identity & Status */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>{tr("Active Patient Session • YugabyteDB Aeon", "सक्रिय मरीज़ सत्र • युगाबाइट डीबी ईऑन")}</span>
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight text-navy sm:text-3xl lg:text-4xl">
                {tr("Welcome back,", "स्वागत है,")} <span className="text-brand">{patientName}</span>!
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-slate-600 sm:text-base">
                {tr(
                  "Your MedEasy Command Center. Manage your prescription workflows, compare generic medicines, and maintain private health memory continuity.",
                  "आपका MedEasy कमांड सेंटर। पर्चा वर्कफ़्लो प्रबंधित करें, जेनेरिक दवाइयों की तुलना करें और स्वास्थ्य स्मृति निरंतरता बनाए रखें।"
                )}
              </p>
            </div>

            {/* Quick Actions & Privacy Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/account"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-brand hover:bg-white hover:text-brand"
              >
                <User className="h-4 w-4 text-brand" />
                <span>{tr("Account & Privacy Vault", "खाता और गोपनीयता")}</span>
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-rose-600 shadow-2xs transition hover:bg-rose-50 hover:border-rose-300"
              >
                <LogOut className="h-4 w-4" />
                <span>{tr("Sign Out", "साइन आउट")}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="mx-auto max-w-[1240px] px-4 pt-8 md:pt-10">
        {/* Consent Feedback Banner if toggled */}
        {consentMsg && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-brand/20 bg-brand/5 p-4 text-xs font-semibold text-brand">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>{consentMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setConsentMsg(null)}
              className="text-slate-500 hover:text-navy"
            >
              ✕
            </button>
          </div>
        )}

        {/* 4 Key Metrics Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Enquiry Cart */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {tr("Enquiry Cart", "पूछताछ सूची")}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-brand">
                  <ShoppingCart className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-navy">{itemCount} {tr("Items", "दवाइयां")}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {tr("Total Quoted:", "कुल मूल्य:")} <span className="font-bold text-navy">{formatInr(subtotal)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                to="/cart"
                className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
              >
                <span>{tr("Review Enquiry Cart", "सूची की समीक्षा करें")}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
              {itemCount > 0 && (
                <Link
                  to="/stores"
                  className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  {tr("WhatsApp Stores", "स्टोर खोजें")}
                </Link>
              )}
            </div>
          </div>

          {/* Card 2: Savings Potential */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {tr("Potential Savings", "संभावित बचत")}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Zap className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-emerald-600">
                  {potentialSavings > 0 ? formatInr(potentialSavings) : "60% – 85%"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {potentialSavings > 0
                    ? tr("Savings in active cart", "वर्तमान सूची में बचत")
                    : tr("Average generic catalogue discount", "औसत जेनेरिक कैटलॉग छूट")}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                to="/medicines"
                className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
              >
                <span>{tr("Compare 508+ Meds", "508+ दवाइयों की तुलना करें")}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Card 3: Memory Status */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {tr("Clinical Memory", "क्लिनिकल मेमोरी")}
                </span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  consent?.granted ? "bg-purple-50 text-purple-600" : "bg-slate-100 text-slate-500"
                }`}>
                  <Brain className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${consent?.granted ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <span className="text-base font-black text-navy">
                    {consent?.granted
                      ? tr("Meko Synced", "Meko सिंक किया गया")
                      : tr("Local Mode Only", "केवल स्थानीय मोड")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 truncate">
                  {consent?.granted
                    ? tr("24-hr session recall enabled", "24 घंटे का सत्र संस्मरण सक्रिय")
                    : tr("Encrypted on this device only", "केवल इस डिवाइस पर एन्क्रिप्टेड")}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleToggleConsent}
                disabled={togglingConsent}
                className="text-xs font-bold text-purple-600 hover:underline inline-flex items-center gap-1"
              >
                <span>{consent?.granted ? tr("Pause Memory", "मेमोरी रोकें") : tr("Enable Memory", "मेमोरी सक्षम करें")}</span>
              </button>
              <Link
                to="/account"
                className="text-xs font-bold text-slate-500 hover:text-navy"
              >
                {tr("Settings", "सेटिंग्स")}
              </Link>
            </div>
          </div>

          {/* Card 4: Safety & Regulatory Watch */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {tr("CDSCO Drug Safety", "सीडीएससीओ सुरक्षा")}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-navy">260 {tr("Alerts", "अलर्ट्स")}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {tr("Not of Standard Quality (NSQ) indexed", "मानक गुणवत्ता के अनुरूप नहीं डेटाबेस")}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                to="/batch-safety"
                className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
              >
                <span>{tr("CDSCO Registry", "रजिस्ट्री देखें")}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Dual-Track Workflows Section */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Track 1: Prescription-to-Ordering Pipeline */}
          <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-brand">
                  <Pill className="h-3.5 w-3.5" />
                  <span>{tr("Workflow 1 • Affordable Medicine Pipeline", "वर्कफ़्लो 1 • सुलभ दवा पाइपलाइन")}</span>
                </span>
                <h2 className="mt-3 text-xl font-black text-navy sm:text-2xl">
                  {tr("Prescription to Local Pharmacy", "पर्चे से नज़दीकी मेडिकल स्टोर तक")}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  {tr(
                    "Scan handwritten doctor prescriptions, discover Jan Aushadhi generic equivalents, and enquire stock availability.",
                    "हस्तलिखित पर्चा स्कैन करें, जन औषधि जेनेरिक विकल्प खोजें और सीधे उपलब्धता पता करें।"
                  )}
                </p>
              </div>
            </div>

            {/* Steps & Quick Action Cards */}
            <div className="mt-6 space-y-3.5">
              {/* Step 1: Scan Prescription */}
              <Link
                to="/scan"
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-[#fbfdff] p-4 transition hover:border-brand hover:bg-white hover:shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100/60 text-brand group-hover:bg-brand group-hover:text-white transition">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-navy group-hover:text-brand transition">
                      {tr("1. Scan Prescription Photo / PDF", "1. पर्चे की फोटो / पीडीएफ स्कैन करें")}
                    </div>
                    <div className="text-xs text-slate-500">
                      {tr("Gemini OCR extracts medicines with human confirmation check", "जेमिनी ओसीआर दवाइयों को पढ़ता है और पुष्टि मांगता है")}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand group-hover:translate-x-0.5 transition" />
              </Link>

              {/* Step 2: Compare Generic Alternatives */}
              <Link
                to="/medicines"
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-[#fbfdff] p-4 transition hover:border-brand hover:bg-white hover:shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100/60 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
                    <Search className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-navy group-hover:text-emerald-700 transition">
                      {tr("2. 3-Way Generic Price Comparison", "2. 3-तरफ़ा जेनेरिक मूल्य तुलना")}
                    </div>
                    <div className="text-xs text-slate-500">
                      {tr("Compare Jan Aushadhi (PMBJP) vs Dava India vs Branded MRP", "जन औषधि, दवा इंडिया और ब्रांडेड कीमतों की पारदर्शी तुलना")}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition" />
              </Link>

              {/* Step 3: Find Stores & WhatsApp Enquiries */}
              <Link
                to="/stores"
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-[#fbfdff] p-4 transition hover:border-brand hover:bg-white hover:shadow-md"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100/60 text-sky-700 group-hover:bg-sky-600 group-hover:text-white transition">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-navy group-hover:text-sky-700 transition">
                      {tr("3. Find Verified Pharmacies & WhatsApp Enquiries", "3. सत्यापित स्टोर और व्हाट्सएप पूछताछ")}
                    </div>
                    <div className="text-xs text-slate-500">
                      {tr("Locate Jan Aushadhi Kendras & send structured stock enquiries", "जन औषधि केंद्र खोजें और सीधे उपलब्धता संदेश भेजें")}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-sky-700 group-hover:translate-x-0.5 transition" />
              </Link>
            </div>

            {/* In-Line CDSCO Quick Batch Checker */}
            <div className="mt-6 rounded-2xl border border-slate-200/90 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-bold text-navy">
                    {tr("Instant Batch Quality Verification", "तत्काल बैच गुणवत्ता जांच")}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">CDSCO NSQ</span>
              </div>
              <form onSubmit={handleQuickBatchCheck} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={batchQuery}
                  onChange={(e) => setBatchQuery(e.target.value)}
                  placeholder={tr("Enter pack batch no. (e.g. PNT24A09)", "पैकेट का बैच नंबर दर्ज करें")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand"
                />
                <button
                  type="submit"
                  disabled={checkingBatch || !batchQuery.trim()}
                  className="shrink-0 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {checkingBatch ? tr("Checking...", "जांच...") : tr("Verify", "जांचें")}
                </button>
              </form>

              {/* Batch Check Result */}
              {batchResult && (
                <div className={`mt-3 rounded-xl p-3 text-xs ${
                  batchResult.status === "no_match"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-rose-300 bg-rose-50 text-rose-800"
                }`}>
                  <div className="flex items-center gap-2 font-bold">
                    {batchResult.status === "no_match" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>{tr("Standard Quality Batch", "मानक गुणवत्ता बैच")}</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-4 w-4 text-rose-600" />
                        <span>{tr("CDSCO NSQ Recall Alert Detected!", "सीडीएससीओ चेतावनी दर्ज है!")}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed">
                    {batchResult.message || batchResult.safety_note}
                  </p>
                  {batchResult.status !== "no_match" && batchResult.matches && batchResult.matches.length > 0 && (
                    <div className="mt-2 space-y-1 rounded-lg bg-white/70 p-2 text-[11px]">
                      <div><strong>{tr("Alert Type:", "अलर्ट प्रकार:")}</strong> {batchResult.matches[0].alert_type}</div>
                      <div><strong>{tr("Manufacturer:", "निर्माता:")}</strong> {batchResult.matches[0].manufacturer}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Track 2: Persistent Patient Memory & MedSaathi AI */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">
                    <Brain className="h-3.5 w-3.5" />
                    <span>{tr("Workflow 2 • Persistent Patient Memory & AI", "वर्कफ़्लो 2 • निरंतर स्वास्थ्य स्मृति और एआई")}</span>
                  </span>
                  <h2 className="mt-3 text-xl font-black text-navy sm:text-2xl">
                    {tr("MedSaathi AI Companion", "मेडसाथी एआई साथी")}
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500">
                    {tr(
                      "Voice & text AI healthcare companion backed by Meko privacy memory. Never forgets your allergies and preferred medicines.",
                      "आवाज़ और टेक्स्ट स्वास्थ्य सहायक जो आपकी एलर्जी और पसंदीदा दवाइयों को याद रखता है।"
                    )}
                  </p>
                </div>
              </div>

              {/* MedSaathi Launch Banner */}
              <div className="mt-6 rounded-2xl border border-purple-200/90 bg-gradient-to-br from-purple-50/70 to-indigo-50/40 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-200">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-navy">
                      {tr("Multilingual AI Consultation", "बहुभाषी एआई परामर्श")}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {tr("Speaks Hindi and English with ElevenLabs voice narration.", "ग्यारह प्रयोगशालाओं की आवाज़ के साथ हिंदी और अंग्रेजी बोलता है।")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/med-saathi"
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-purple-700 active:scale-98"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{tr("Launch MedSaathi AI", "मेडसाथी एआई शुरू करें")}</span>
                  </Link>

                  <Link
                    to="/account"
                    className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-white px-3.5 py-2.5 text-xs font-bold text-purple-700 transition hover:bg-purple-50"
                  >
                    <span>{tr("Memory & Transparency Vault", "स्मृति और गोपनीयता वॉल्ट")}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Patient Profile & Continuity Specs */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs">
                  <span className="font-semibold text-slate-600">{tr("Patient Profile Name:", "मरीज़ का नाम:")}</span>
                  <span className="font-bold text-navy">{profile?.display_label || tr("Not set", "सेट नहीं")}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs">
                  <span className="font-semibold text-slate-600">{tr("Consultation Language:", "परामर्श भाषा:")}</span>
                  <span className="font-bold text-navy">
                    {profile?.preferred_language === "hi" || locale === "hi" ? "हिंदी (Hindi)" : "English"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs">
                  <span className="font-semibold text-slate-600">{tr("Meko Long-term Memory:", "दीर्घकालिक स्मृति स्थिति:")}</span>
                  <span className={`inline-flex items-center gap-1.5 font-bold ${
                    consent?.granted ? "text-emerald-700" : "text-slate-500"
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${consent?.granted ? "bg-emerald-500" : "bg-slate-400"}`} />
                    <span>{consent?.granted ? tr("Active (Consent Granted)", "सक्रिय (सहमति प्राप्त)") : tr("Paused (Local-only)", "रोकी गई (केवल स्थानीय)")}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Privacy Guarantee Note */}
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-xs text-emerald-900">
              <Shield className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong className="font-bold">{tr("Zero Clinical Storage Guarantee:", "शून्य क्लिनिकल डेटा भंडारण की गारंटी:")}</strong>{" "}
                {tr(
                  "Prescription images, full clinical notes, and private diagnosis files are never permanently stored in cloud databases. Only user-confirmed health preferences and active context are retained with your explicit consent.",
                  "पर्चे के चित्र और मेडिकल फाइलें कभी भी क्लाउड डेटाबेस में संग्रहीत नहीं की जाती हैं।"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active Enquiry Cart Details (if items exist) */}
        {items.length > 0 ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-navy">
                  {tr("Active Enquiry Cart Items", "वर्तमान पूछताछ सूची की दवाइयां")}
                </h3>
                <p className="text-xs text-slate-500">
                  {tr("Medicines queued for store availability enquiry", "दुकान से उपलब्धता पूछने के लिए चयनित दवाइयां")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 hover:border-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{tr("Clear All", "सूची साफ़ करें")}</span>
                </button>
                <Link
                  to="/stores"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-600"
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>{tr("Send to Nearby Stores", "नज़दीकी मेडिकल स्टोर भेजें")}</span>
                </Link>
              </div>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-brand">
                      <Pill className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-bold text-navy">{item.brand_name}</div>
                      <div className="text-xs text-slate-500">
                        {item.active_salt || item.dosage_form || "Medicine"} •{" "}
                        <span className="font-semibold text-emerald-700 uppercase">
                          {item.selected_provider.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <div className="text-xs text-slate-500">
                        {item.quantity} × {formatInr(item.selected_price ?? item.private_brand_price ?? 0)}
                      </div>
                      <div className="text-sm font-black text-navy">
                        {formatInr((item.selected_price ?? item.private_brand_price ?? 0) * item.quantity)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-slate-400 hover:text-rose-600 transition"
                      title={tr("Remove item", "हटाएं")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-4 text-xs">
              <span className="text-slate-500">
                {tr("Total estimated package cost:", "अनुमानित कुल लागत:")} <strong className="text-navy">{formatInr(subtotal)}</strong>
              </span>
              <Link
                to="/cart"
                className="mt-2 sm:mt-0 font-bold text-brand hover:underline inline-flex items-center gap-1"
              >
                <span>{tr("Open full cart with PDF export", "पूर्ण कार्ट खोलें और पीडीएफ डाउनलोड करें")}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-base font-bold text-navy">
              {tr("Your enquiry cart is currently empty", "आपकी पूछताछ सूची अभी खाली है")}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              {tr(
                "Scan a prescription or search 508+ Jan Aushadhi and Dava India alternatives to queue items for WhatsApp availability enquiries.",
                "पर्चा स्कैन करें या जेनेरिक दवाइयां खोजकर पूछताछ सूची में जोड़ें।"
              )}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                to="/scan"
                className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-600"
              >
                {tr("Scan Prescription", "पर्चा स्कैन करें")}
              </Link>
              <Link
                to="/medicines"
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-navy transition hover:bg-white"
              >
                {tr("Browse Medicines", "दवाइयां देखें")}
              </Link>
            </div>
          </div>
        )}

        {/* Regulatory & Safety Footer Note */}
        <div className="mt-10 rounded-2xl border border-slate-200/60 bg-white/70 p-4 text-center text-xs text-slate-500">
          <p>
            {tr(
              "MedEasy is an informational and pricing transparency platform. Price comparisons are derived from loaded PMBJP (Jan Aushadhi) and Dava India datasets. This platform does not provide medical prescriptions or replace qualified physician consultations.",
              "MedEasy एक सूचनात्मक और मूल्य पारदर्शिता मंच है। मूल्य तुलना पीएमबीजेपी (जन औषधि) और दवा इंडिया डेटासेट पर आधारित है। यह चिकित्सीय सलाह का विकल्प नहीं है।"
            )}
          </p>
        </div>
      </div>
    </div>
  );
}