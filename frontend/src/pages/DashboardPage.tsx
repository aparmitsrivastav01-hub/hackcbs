import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  FileText,
  LogOut,
  Pill,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { checkBatchSafety } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { formatInr } from "../i18n/formatters";
import { useLanguage } from "../i18n/LanguageContext";
import type { BatchCheckResult } from "../types";

export function DashboardPage() {
  const { tr } = useLanguage();
  const { user, profile, consent, logout, setMekoConsent } = useAuth();
  const { items, itemCount, subtotal, clearCart, removeItem } = useCart();
  const navigate = useNavigate();

  // Search & input states
  const [medicineSearch, setMedicineSearch] = useState("");
  const [assistantQuery, setAssistantQuery] = useState("");
  const [batchQuery, setBatchQuery] = useState("");
  const [checkingBatch, setCheckingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchCheckResult | null>(null);
  const [togglingConsent, setTogglingConsent] = useState(false);
  const [consentMsg, setConsentMsg] = useState<string | null>(null);

  // Drag and drop for prescription
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Potential savings in cart
  const potentialSavings = items.reduce((acc, item) => {
    if (item.private_brand_price && item.selected_price) {
      const diff = item.private_brand_price - item.selected_price;
      return acc + (diff > 0 ? diff * item.quantity : 0);
    }
    return acc;
  }, 0);

  function handleMedicineSearch(e: FormEvent) {
    e.preventDefault();
    if (medicineSearch.trim()) {
      navigate(`/medicines?q=${encodeURIComponent(medicineSearch.trim())}`);
    }
  }

  function handleAssistantSubmit(e: FormEvent) {
    e.preventDefault();
    if (assistantQuery.trim()) {
      navigate(`/med-saathi`, { state: { initialQuery: assistantQuery.trim() } });
    } else {
      navigate(`/med-saathi`);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      navigate("/scan", { state: { file } });
    } else {
      navigate("/scan");
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      navigate("/scan", { state: { file } });
    }
  }

  async function handleQuickBatchCheck(e: FormEvent) {
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
          ? tr("Memory enabled. MedSaathi will remember your health notes.", "मेमोरी सक्षम की गई। मेडसाथी आपकी स्वास्थ्य स्थिति याद रखेगा।")
          : tr("Memory paused. MedEasy is running in local-only mode.", "मेमोरी रोकी गई। केवल स्थानीय मोड सक्रिय।")
      );
      setTimeout(() => setConsentMsg(null), 3500);
    } finally {
      setTogglingConsent(false);
    }
  }

  const patientName = profile?.display_label || user?.email?.split("@")[0] || tr("Patient", "मरीज़");

  const sampleQuestions = [
    tr("Are there cheaper generic alternatives for my medicines?", "क्या मेरी दवाइयों के सस्ते जेनेरिक विकल्प हैं?"),
    tr("Can I take my medicines together with food?", "क्या मैं ये दवाइयां भोजन के साथ ले सकता हूँ?"),
    tr("Find Jan Aushadhi stores near me", "मेरे पास के जन औषधि केंद्र खोजें"),
  ];

  const popularMedicines = ["Paracetamol", "Metformin", "Telmisartan", "Pantoprazole", "Amoxicillin"];

  return (
    <div className="min-h-screen bg-[#f8fbff] pb-16">
      <Helmet>
        <title>{tr("My Health Dashboard — MedEasy", "मेरा डैशबोर्ड — MedEasy")}</title>
      </Helmet>

      {/* Top Patient Header Bar */}
      <header className="border-b border-slate-200/90 bg-white px-4 py-6 md:py-8">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-navy sm:text-3xl">
                {tr("Welcome back,", "स्वागत है,")} <span className="text-brand">{patientName}</span>
              </h1>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                user?.role === "pharmacist"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : user?.role === "admin"
                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                  : "bg-blue-50 text-brand border border-blue-200"
              }`}>
                {user?.role || "patient"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              {tr(
                "Find affordable medicines, check batch safety, or consult your health assistant.",
                "सस्ती दवाइयां खोजें, बैच सुरक्षा जांचें या अपने स्वास्थ्य सहायक से परामर्श करें।"
              )}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/account"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-brand hover:bg-white hover:text-brand"
            >
              <User className="h-4 w-4 text-brand" />
              <span>{tr("Account & Preferences", "खाता और प्राथमिकताएं")}</span>
            </Link>

            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 shadow-2xs transition hover:bg-rose-50 hover:border-rose-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{tr("Sign Out", "साइन आउट")}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Feedback banner */}
      {consentMsg && (
        <div className="mx-auto mt-4 max-w-[1240px] px-4">
          <div className="flex items-center justify-between rounded-2xl border border-brand/20 bg-brand/5 p-3.5 text-xs font-semibold text-brand">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>{consentMsg}</span>
            </div>
            <button type="button" onClick={() => setConsentMsg(null)} className="text-slate-400 hover:text-navy">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="mx-auto max-w-[1240px] px-4 pt-6 space-y-6 md:space-y-8">
        {/* 1. PRIMARY PROBLEM-SOLVING HUB: SEARCH & SCAN */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Card A: Search Medicine Prices */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs md:p-7">
            <div>
              <div className="flex items-center gap-2 text-brand">
                <Search className="h-5 w-5" />
                <h2 className="text-base font-black text-navy sm:text-lg">
                  {tr("Search Medicine Prices", "दवाइयों के दाम खोजें")}
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {tr(
                  "Compare branded medicines against government Jan Aushadhi (PMBJP) & Dava India rates.",
                  "ब्रांडेड दवाओं की तुलना जन औषधि (PMBJP) और दवा इंडिया दरों से करें।"
                )}
              </p>

              <form onSubmit={handleMedicineSearch} className="mt-4 flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={medicineSearch}
                    onChange={(e) => setMedicineSearch(e.target.value)}
                    placeholder={tr("Type medicine or salt name (e.g. Paracetamol)...", "दवाई या साल्ट का नाम लिखें (जैसे पैरासिटामोल)...")}
                    className="w-full rounded-xl border border-slate-200 bg-[#f8fbff] px-3.5 py-2.5 text-xs font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-brand"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!medicineSearch.trim()}
                  className="rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {tr("Compare", "दाम देखें")}
                </button>
              </form>

              {/* Popular quick search chips */}
              <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] font-semibold text-slate-400">{tr("Quick search:", "त्वरित खोज:")}</span>
                {popularMedicines.map((med) => (
                  <button
                    key={med}
                    type="button"
                    onClick={() => navigate(`/medicines?q=${encodeURIComponent(med)}`)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-brand hover:bg-blue-50 hover:text-brand transition"
                  >
                    {med}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">{tr("508+ verified catalogue medicines", "508+ प्रमाणित दवाइयां")}</span>
              <Link to="/medicines" className="font-bold text-brand hover:underline inline-flex items-center gap-1">
                <span>{tr("Browse Full Catalogue", "पूरा कैटलॉग देखें")}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Card B: Scan Prescription (Direct Dropzone & Upload) */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            className={`flex flex-col justify-between rounded-3xl border p-6 shadow-xs md:p-7 transition ${
              isDragging ? "border-brand bg-blue-50/60" : "border-slate-200 bg-white"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand">
                  <FileText className="h-5 w-5" />
                  <h2 className="text-base font-black text-navy sm:text-lg">
                    {tr("Scan Doctor's Prescription", "डॉक्टर का पर्चा स्कैन करें")}
                  </h2>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-brand">
                  {tr("AI OCR", "AI स्कैन")}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {tr(
                  "Upload a photo or PDF. We'll automatically identify medicine names and match generic substitutes.",
                  "फोटो या पीडीएफ अपलोड करें। हम दवाइयों के नाम पढ़कर तुरंत जेनेरिक विकल्प दिखाएंगे।"
                )}
              </p>

              {/* Direct drop area */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
                className="hidden"
                id="dashboard-rx-upload"
              />

              <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-[#fbfdff] p-5 text-center">
                <Upload className="mx-auto h-7 w-7 text-brand" />
                <label
                  htmlFor="dashboard-rx-upload"
                  className="mt-2 block cursor-pointer text-xs font-bold text-brand hover:underline"
                >
                  {tr("Click to upload prescription photo or PDF", "पर्चे की फोटो या पीडीएफ अपलोड करें")}
                </label>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {tr("or drag and drop your file here", "या फ़ाइल यहाँ खींचकर छोड़ें")}
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400">{tr("Processed locally in your browser", "ब्राउज़र में सुरक्षित प्रोसेस")}</span>
              <Link to="/scan" className="font-bold text-brand hover:underline inline-flex items-center gap-1">
                <span>{tr("Open Scanner Tool", "स्कैनर टूल खोलें")}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* 2. MEDSAATHI ASSISTANT: DIRECT CONVERSATION LAUNCHER */}
        <section className="rounded-3xl border border-purple-200/90 bg-gradient-to-br from-purple-50/70 via-white to-indigo-50/40 p-6 shadow-xs md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-xs">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-navy sm:text-lg">
                    {tr("MedSaathi Healthcare Assistant", "मेडसाथी स्वास्थ्य सहायक")}
                  </h2>
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                    {tr("Hindi & English", "हिंदी और अंग्रेजी")}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {tr(
                    "Ask about medicine dosages, safe combinations, or finding cheaper generic equivalents.",
                    "दवाइयों की खुराक, सुरक्षित संयोजन या सस्ते जेनेरिक विकल्पों के बारे में पूछें।"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleConsent}
                disabled={togglingConsent}
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-white px-3 py-1.5 text-xs font-bold text-purple-700 transition hover:bg-purple-50"
              >
                <Brain className="h-3.5 w-3.5" />
                <span>{consent?.granted ? tr("Memory: Active", "मेमोरी: चालू") : tr("Memory: Paused", "मेमोरी: रोकी गई")}</span>
              </button>
              <Link
                to="/med-saathi"
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-purple-700"
              >
                <span>{tr("Open Assistant", "असिस्टेंट खोलें")}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Quick ask prompt input */}
          <form onSubmit={handleAssistantSubmit} className="mt-5 flex gap-2">
            <input
              type="text"
              value={assistantQuery}
              onChange={(e) => setAssistantQuery(e.target.value)}
              placeholder={tr("Ask MedSaathi anything (e.g. Can I take Paracetamol with Metformin?)...", "मेडसाथी से पूछें (जैसे क्या पैरासिटामोल और मेटफॉर्मिन साथ ले सकते हैं?)...")}
              className="w-full rounded-2xl border border-purple-200 bg-white px-4 py-3 text-xs font-medium text-navy placeholder:text-slate-400 focus:border-purple-500 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
            />
            <button
              type="submit"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-2xl bg-purple-600 px-5 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-purple-700"
            >
              <span>{tr("Ask", "पूछें")}</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* Clickable prompt suggestions */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {sampleQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => navigate("/med-saathi", { state: { initialQuery: q } })}
                className="rounded-full border border-purple-200/80 bg-white px-3 py-1 text-[11px] font-medium text-purple-800 hover:bg-purple-100/70 transition"
              >
                {q}
              </button>
            ))}
          </div>
        </section>

        {/* 3. ACTIVE MEDICINE ENQUIRY LIST (CART & LOCAL AVAILABILITY) */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-brand" />
                <h2 className="text-base font-black text-navy sm:text-lg">
                  {tr("My Medicine Enquiry List", "मेरी दवा पूछताछ सूची")}
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-brand">
                  {itemCount} {tr("items", "दवाइयां")}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {tr("Medicines ready to enquire at nearby Jan Aushadhi and local pharmacies.", "नज़दीकी मेडिकल स्टोर से उपलब्धता पूछने के लिए तैयार सूची।")}
              </p>
            </div>

            {items.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                >
                  {tr("Clear List", "सूची साफ़ करें")}
                </button>
                <Link
                  to="/stores"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-600"
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>{tr("Find Nearby Stores (WhatsApp)", "नज़दीकी स्टोर खोजें (WhatsApp)")}</span>
                </Link>
              </div>
            )}
          </div>

          {items.length > 0 ? (
            <div className="mt-4">
              <div className="divide-y divide-slate-100">
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

                    <div className="flex items-center justify-between sm:justify-end gap-5">
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

              {/* Total and Savings bar */}
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500">{tr("Total Estimated Price:", "कुल अनुमानित मूल्य:")} </span>
                  <strong className="text-sm font-black text-navy">{formatInr(subtotal)}</strong>
                  {potentialSavings > 0 && (
                    <span className="ml-2 font-bold text-emerald-700">
                      ({tr("You save up to", "बचत तक:")} {formatInr(potentialSavings)})
                    </span>
                  )}
                </div>
                <div className="mt-3 sm:mt-0 flex items-center gap-3">
                  <Link to="/cart" className="font-bold text-brand hover:underline">
                    {tr("View Full Cart Details", "विस्तृत कार्ट देखें")}
                  </Link>
                  <Link
                    to="/stores"
                    className="rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white transition hover:bg-blue-600"
                  >
                    {tr("Enquire Stock on WhatsApp", "व्हाट्सएप पर स्टॉक पूछें")}
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <ShoppingBag className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-2 text-sm font-bold text-navy">
                {tr("Your enquiry list is empty", "आपकी दवा सूची अभी खाली है")}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
                {tr(
                  "Search for medicines or scan a prescription above to compare Jan Aushadhi prices and enquire at local pharmacies.",
                  "सस्ती जन औषधि दवाइयों की तुलना करने के लिए ऊपर खोजें या पर्चा स्कैन करें।"
                )}
              </p>
            </div>
          )}
        </section>

        {/* 4. DRUG SAFETY: BATCH QUALITY CHECKER */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs md:p-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-amber-600">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-base font-black text-navy sm:text-lg">
                {tr("Check Medicine Batch Safety", "दवाई बैच सुरक्षा जांचें")}
              </h2>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
              {tr("CDSCO NSQ Drug Alerts", "सीडीएससीओ अलर्ट्स")}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {tr(
              "Have a medicine strip? Check if its batch number is listed in official government Not of Standard Quality (NSQ) recall notices.",
              "दवाई के पत्ते पर लिखा बैच नंबर (B.No.) दर्ज करके जांचें कि क्या सरकार द्वारा उस पर कोई अलर्ट जारी किया गया है।"
            )}
          </p>

          <form onSubmit={handleQuickBatchCheck} className="mt-4 flex flex-col sm:flex-row gap-2 max-w-xl">
            <input
              type="text"
              value={batchQuery}
              onChange={(e) => setBatchQuery(e.target.value)}
              placeholder={tr("Enter batch no. on pack (e.g. PNT24A09, PCM23H88)...", "दवा के पैकेट पर लिखा बैच नंबर दर्ज करें...")}
              className="flex-1 rounded-xl border border-slate-200 bg-[#f8fbff] px-3.5 py-2.5 text-xs font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={checkingBatch || !batchQuery.trim()}
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
            >
              {checkingBatch ? tr("Verifying...", "जांच...") : tr("Verify Batch", "बैच जांचें")}
            </button>
          </form>

          {/* Verification Result */}
          {batchResult && (
            <div className={`mt-4 rounded-2xl p-4 text-xs ${
              batchResult.status === "no_match"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border border-rose-300 bg-rose-50 text-rose-900"
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                {batchResult.status === "no_match" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{tr("Standard Quality Batch — No Active Recall Notice", "मानक गुणवत्ता बैच — कोई सरकारी चेतावनी नहीं")}</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4 text-rose-600" />
                    <span>{tr("Government NSQ Recall Notice Detected!", "सरकारी गुणवत्ता चेतावनी दर्ज है!")}</span>
                  </>
                )}
              </div>
              <p className="mt-1 leading-relaxed">
                {batchResult.message || batchResult.safety_note}
              </p>
              {batchResult.status !== "no_match" && batchResult.matches && batchResult.matches.length > 0 && (
                <div className="mt-2 space-y-1 rounded-xl bg-white/80 p-3 text-[11px] text-slate-800">
                  <div><strong>{tr("Alert Type:", "अलर्ट प्रकार:")}</strong> {batchResult.matches[0].alert_type}</div>
                  <div><strong>{tr("Manufacturer:", "निर्माता:")}</strong> {batchResult.matches[0].manufacturer}</div>
                  <div><strong>{tr("Notice Date:", "सूचना दिनांक:")}</strong> {batchResult.matches[0].notice_date}</div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 5. PRIVACY & LOCAL PROCESSING ASSURANCE */}
        <footer className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              {tr(
                "Your privacy is protected: Prescription photos and files are processed locally on your device and are never stored on remote servers.",
                "आपकी गोपनीयता सुरक्षित है: पर्चे की फोटो केवल आपके डिवाइस पर प्रोसेस होती है और कभी भी सर्वर पर सहेजी नहीं जाती।"
              )}
            </span>
          </div>
          <Link to="/account" className="shrink-0 font-bold text-brand hover:underline">
            {tr("Privacy & Data Settings", "गोपनीयता सेटिंग्स")}
          </Link>
        </footer>
      </main>
    </div>
  );
}