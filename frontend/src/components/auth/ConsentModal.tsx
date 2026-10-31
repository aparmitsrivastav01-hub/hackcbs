import { AlertCircle, CheckCircle2, Lock, Shield, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export function ConsentModal() {
  const { showConsentPrompt, dismissConsentPrompt, setMekoConsent } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (!showConsentPrompt) return null;

  async function handleChoice(granted: boolean) {
    try {
      setSubmitting(true);
      await setMekoConsent(granted);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl md:p-8">
        {/* Dismiss Button */}
        <button
          type="button"
          onClick={dismissConsentPrompt}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-brand">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-navy">Patient Privacy & Memory Consent</h3>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Policy Version: 2026-10-v1
            </p>
          </div>
        </div>

        {/* Core Guarantee */}
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
          <div className="flex items-start gap-2.5">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <span className="font-semibold text-emerald-950">Local-First Guarantee: </span>
              Your prescription images, scanned PDFs, and detailed medical records remain strictly in your device's local vault. They are never uploaded to our cloud database.
            </div>
          </div>
        </div>

        {/* Meko Memory Explanation */}
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <p>
            MedEasy offers an optional context memory feature powered by Meko. You choose whether to enable it:
          </p>

          <div className="space-y-2 rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand mt-0.5" />
              <span>
                <strong>Opt-in only:</strong> Only short, user-approved pseudonymous summary facts are remembered (e.g. reported allergies).
              </span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-brand mt-0.5" />
              <span>
                <strong>Transparent & Revocable:</strong> You can view, correct, or delete recalled memories at any time from your account settings.
              </span>
            </div>
            <div className="flex items-start gap-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              <span>
                <strong>Hosted service:</strong> Memorized facts are processed by Meko's secure cloud service in an isolated patient datapack.
              </span>
            </div>
          </div>
        </div>

        {/* Choices */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleChoice(false)}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-98 disabled:opacity-60"
          >
            No thanks (Strict Local-Only)
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleChoice(true)}
            className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand/20 hover:bg-blue-600 transition active:scale-98 disabled:opacity-60"
          >
            {submitting ? "Saving choice..." : "Enable Meko Memory"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          You can change or revoke this consent at any time in your Account settings.
        </p>
      </div>
    </div>
  );
}
