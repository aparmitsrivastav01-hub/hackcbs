import { Eye, EyeOff, Lock, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";

export function SignupPage() {
  const { tr, locale } = useLanguage();
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayLabel, setDisplayLabel] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState(locale || "en");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(tr("Please provide all required fields", "कृपया सभी आवश्यक फ़ील्ड भरें"));
      return;
    }

    if (password.length < 8) {
      setError(tr("Password must be at least 8 characters", "पासवर्ड कम से कम 8 वर्णों का होना चाहिए"));
      return;
    }

    if (password !== confirmPassword) {
      setError(tr("Passwords do not match", "पासवर्ड मेल नहीं खाते"));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await signup({
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
        display_label: displayLabel.trim() || undefined,
        preferred_language: preferredLanguage,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-4 py-12">
      <Helmet>
        <title>Create Account — MedEasy</title>
      </Helmet>

      <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-navy">
            {tr("Create MedEasy Account", "MedEasy खाता बनाएं")}
          </h1>
          <p className="mt-1.5 text-xs text-slate-500">
            {tr("Secure, private, and local-first health management", "सुरक्षित, निजी और स्थानीय-प्राथमिक स्वास्थ्य प्रबंधन")}
          </p>
        </div>

        {/* Privacy Highlight Banner */}
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <span>
            <strong>{tr("Privacy by Design: ", "गोपनीयता आश्वासन: ")}</strong>
            {tr(
              "Your prescriptions and medical files stay on your device. We only store your login identity and privacy preferences.",
              "आपकी पर्चियां और मेडिकल फाइलें आपके डिवाइस पर ही रहती हैं। हम केवल आपका लॉगिन खाता और प्राथमिकताएं सहेजते हैं।"
            )}
          </span>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              {tr("Email Address *", "ईमेल पता *")}
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-navy placeholder:text-slate-400 focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              {tr("Patient Alias or Display Label (Optional)", "रोगी उपनाम या प्रदर्शन नाम (वैकल्पिक)")}
            </label>
            <input
              type="text"
              value={displayLabel}
              onChange={(e) => setDisplayLabel(e.target.value)}
              placeholder="e.g. Grandma's Meds / My Profile"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-navy placeholder:text-slate-400 focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              {tr("Preferred Language", "पसंदीदा भाषा")}
            </label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value as "en" | "hi")}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-navy focus:border-brand focus:outline-none"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              {tr("Password (min 8 chars) *", "पासवर्ड (कम से कम 8 वर्ण) *")}
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-10 text-sm text-navy placeholder:text-slate-400 focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              {tr("Confirm Password *", "पासवर्ड की पुष्टि करें *")}
            </label>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-navy placeholder:text-slate-400 focus:border-brand focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition hover:bg-blue-600 active:scale-98 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {submitting ? tr("Creating account...", "खाता बन रहा है...") : tr("Create Account", "खाता बनाएं")}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          {tr("Already have an account?", "क्या आपके पास पहले से खाता है?")}{" "}
          <Link to="/login" className="font-bold text-brand hover:underline">
            {tr("Sign in instead", "साइन इन करें")}
          </Link>
        </div>
      </div>
    </div>
  );
}
