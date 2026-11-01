import { ArrowRight, Lock, Sparkles, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  featureName?: string;
  redirectPath?: string;
}

export function AuthPromptModal({
  isOpen,
  onClose,
  title,
  description,
  featureName = "MedSaathi AI Memory",
  redirectPath = "/med-saathi",
}: AuthPromptModalProps) {
  const { tr } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 mb-4">
          <Sparkles className="h-6 w-6" />
        </div>

        <h3 className="text-xl font-black text-navy tracking-tight">
          {title || tr("Sign In Required for Memory", "मेमोरी के लिए साइन इन आवश्यक है")}
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {description ||
            tr(
              `To protect your health privacy, ${featureName} is encrypted and securely tied to your personal account. Sign in or register to remember your preferences across sessions.`,
              `आपकी स्वास्थ्य गोपनीयता की रक्षा के लिए, ${featureName} एन्क्रिप्टेड है और आपके व्यक्तिगत खाते से सुरक्षित रूप से जुड़ा है। सत्रों में अपनी प्राथमिकताओं को याद रखने के लिए साइन इन या पंजीकरण करें।`
            )}
        </p>

        <div className="mt-5 rounded-2xl border border-purple-100 bg-purple-50/60 p-3.5 text-xs text-purple-900 flex items-start gap-2.5">
          <Lock className="h-4 w-4 shrink-0 text-purple-600 mt-0.5" />
          <span>
            {tr(
              "Zero Raw File Uploads: Prescription images remain strictly local on your device. Only consented conversational notes are preserved.",
              "शून्य कच्ची फ़ाइल अपलोड: पर्चे की छवियां आपके डिवाइस पर ही सुरक्षित रहती हैं।"
            )}
          </span>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            {tr("Continue as Guest", "अतिथि के रूप में जारी रखें")}
          </button>

          <Link
            to={`/login?redirect=${encodeURIComponent(redirectPath)}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-brand/20 hover:bg-blue-600 transition"
          >
            <span>{tr("Sign In / Register", "साइन इन / रजिस्टर")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
