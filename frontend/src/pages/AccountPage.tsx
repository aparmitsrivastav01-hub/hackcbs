import {
  Brain,
  Check,
  CheckCircle,
  HardDrive,
  Lock,
  LogOut,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { ContextPanel } from "../components/meko/ContextPanel";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import { withdrawPrivacyConsent } from "../api/client";

export function AccountPage() {
  const { tr, setLocale } = useLanguage();
  const { user, profile, consent, logout, updateProfile, setMekoConsent } = useAuth();
  const navigate = useNavigate();

  const [displayLabel, setDisplayLabel] = useState(profile?.display_label ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferred_language ?? "en");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [togglingConsent, setTogglingConsent] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayLabel(profile.display_label ?? "");
      setPreferredLanguage(profile.preferred_language ?? "en");
    }
  }, [profile]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setProfileSuccess(false);
      await updateProfile({
        display_label: displayLabel.trim() || undefined,
        preferred_language: preferredLanguage,
      });
      if (preferredLanguage === "hi" || preferredLanguage === "en") {
        setLocale(preferredLanguage);
      }
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleToggleConsent() {
    try {
      setTogglingConsent(true);
      const newChoice = !consent?.granted;
      await setMekoConsent(newChoice);
      setStatusMessage(
        newChoice
          ? tr("Meko memory enabled. You can inspect or clear memories below.", "Meko मेमोरी सक्षम की गई।")
          : tr("Meko memory disabled. MedEasy is running in local-only mode.", "Meko मेमोरी अक्षम की गई।")
      );
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setTogglingConsent(false);
    }
  }

  async function handleWithdrawAndDelete() {
    if (
      !window.confirm(
        tr(
          "Are you sure you want to withdraw consent and permanently delete all Meko memories for your account?",
          "क्या आप सहमति वापस लेना चाहते हैं और Meko में सहेजी गई सभी स्मृतियों को हटाना चाहते हैं?"
        )
      )
    ) {
      return;
    }

    try {
      setWithdrawing(true);
      const res = await withdrawPrivacyConsent();
      await setMekoConsent(false);
      setStatusMessage(res.message);
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:py-12">
      <Helmet>
        <title>Account & Privacy Settings — MedEasy</title>
      </Helmet>

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-black text-navy md:text-3xl">
            {tr("Account & Privacy Vault", "खाता और गोपनीयता वॉल्ट")}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {tr(
              "Manage your patient profile, local storage guarantees, and Meko memory consent",
              "अपनी प्रोफ़ाइल, स्थानीय संग्रहण गारंटी और Meko मेमोरी सहमति प्रबंधित करें"
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          {tr("Sign Out", "साइन आउट")}
        </button>
      </div>

      {statusMessage && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-brand/20 bg-blue-50 p-4 text-xs font-semibold text-brand">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Profile Preferences & Identity */}
        <div className="space-y-6 lg:col-span-1">
          {/* Identity Card */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <User className="h-6 w-6" />
              </div>
              <div className="overflow-hidden">
                <h3 className="truncate font-bold text-navy">
                  {profile?.display_label || tr("Patient Profile", "रोगी प्रोफ़ाइल")}
                </h3>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 text-xs space-y-2 text-slate-500">
              <div className="flex justify-between">
                <span>{tr("Account ID:", "खाता आईडी:")}</span>
                <span className="font-mono text-[11px] text-slate-700">{user?.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span>{tr("Status:", "स्थिति:")}</span>
                <span className="font-semibold text-emerald-600">{tr("Active", "सक्रिय")}</span>
              </div>
              <div className="flex justify-between">
                <span>{tr("Database:", "डेटाबेस:")}</span>
                <span className="font-semibold text-slate-700">YugabyteDB YSQL</span>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-navy">
              {tr("Profile Preferences", "प्रोफ़ाइल प्राथमिकताएं")}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {tr("Update your alias or preferred language", "उपनाम या पसंदीदा भाषा बदलें")}
            </p>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {tr("Display Label / Alias", "प्रदर्शन उपनाम")}
                </label>
                <input
                  type="text"
                  value={displayLabel}
                  onChange={(e) => setDisplayLabel(e.target.value)}
                  placeholder="e.g. Grandma's Meds"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-navy focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {tr("Language", "भाषा")}
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-navy focus:border-brand focus:outline-none"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी (Hindi)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-600 disabled:opacity-60"
              >
                {savingProfile ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : profileSuccess ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {profileSuccess ? tr("Saved!", "सहेज लिया गया!") : tr("Save Preferences", "सहेजें")}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Privacy Boundary & Meko Management */}
        <div className="space-y-6 lg:col-span-2">
          {/* Strict Data Boundaries Card */}
          <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/40 p-6">
            <div className="flex items-center gap-2.5 text-emerald-950">
              <Shield className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-sm">
                {tr("MedEasy Data Architecture & Privacy Contract", "MedEasy डेटा संरचना और गोपनीयता अनुबंध")}
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-2xl bg-white p-4 border border-emerald-100 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <HardDrive className="h-4 w-4 text-emerald-600" />
                  <span>{tr("Stored Locally on Your Device", "डिवाइस पर स्थानीय रूप से सुरक्षित")}</span>
                </div>
                <ul className="mt-2 space-y-1 text-slate-600 list-disc list-inside">
                  <li>{tr("Original prescription images & PDFs", "मूल पर्चे की तस्वीरें और पीडीएफ")}</li>
                  <li>{tr("Detailed medication history", "विस्तृत दवा इतिहास")}</li>
                  <li>{tr("Full OCR extraction results", "संपूर्ण ओसीआर निष्कर्ष")}</li>
                </ul>
              </div>

              <div className="rounded-2xl bg-white p-4 border border-emerald-100 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-navy">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <span>{tr("Optional Meko Context Memory", "वैकल्पिक Meko संदर्भ मेमोरी")}</span>
                </div>
                <ul className="mt-2 space-y-1 text-slate-600 list-disc list-inside">
                  <li>{tr("Only explicit user-approved facts", "केवल उपयोगकर्ता द्वारा अनुमोदित तथ्य")}</li>
                  <li>{tr("Zero raw medical documents", "कोई मूल मेडिकल दस्तावेज नहीं")}</li>
                  <li>{tr("Isolated per-patient datapack", "सुरक्षित अलग डेटापैक")}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Meko Memory Consent Toggle */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-navy">
                  {tr("Persistent Meko AI Context Memory", "निरंतर Meko AI संदर्भ मेमोरी")}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {consent?.granted
                    ? tr("Currently Enabled: AI assistant can recall approved facts between sessions", "सक्षम: सहायक सत्रों के बीच स्वीकृत तथ्यों को याद रख सकता है")
                    : tr("Currently Disabled: MedEasy is operating in zero-cloud-memory local mode", "अक्षम: MedEasy शून्य-क्लाउड-मेमोरी स्थानीय मोड में काम कर रहा है")}
                </p>
              </div>

              <button
                type="button"
                disabled={togglingConsent}
                onClick={handleToggleConsent}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition active:scale-98 ${
                  consent?.granted
                    ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {togglingConsent ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : consent?.granted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {consent?.granted ? tr("Enabled (Click to Turn Off)", "सक्षम (बंद करने के लिए क्लिक करें)") : tr("Disabled (Click to Enable)", "अक्षम (सक्षम करने के लिए क्लिक करें)")}
              </button>
            </div>

            {/* Withdraw & Forget Action */}
            {consent?.granted && (
              <div className="mt-6 border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Right to be Forgotten: </span>
                  Withdraw consent and request immediate permanent deletion of remote Meko memories.
                </div>
                <button
                  type="button"
                  disabled={withdrawing}
                  onClick={handleWithdrawAndDelete}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-60"
                >
                  {withdrawing ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  {tr("Withdraw Consent & Delete Memories", "सहमति वापस लें और यादें मिटाएं")}
                </button>
              </div>
            )}
          </div>

          {/* Live Context Panel (Track A Transparency) */}
          <ContextPanel isMekoActive={consent?.granted ?? false} />
        </div>
      </div>
    </div>
  );
}
