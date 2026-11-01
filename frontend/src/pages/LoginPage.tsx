import { Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";

export function LoginPage() {
  const { tr } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(tr("Please provide both email and password", "कृपया ईमेल और पासवर्ड दोनों दर्ज करें"));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <Helmet>
        <title>Sign In — MedEasy</title>
      </Helmet>

      <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-navy">
            {tr("Sign in to MedEasy", "MedEasy में साइन इन करें")}
          </h1>
          <p className="mt-1.5 text-xs text-slate-500">
            {tr("Manage your health profile and privacy settings", "अपने स्वास्थ्य प्रोफ़ाइल और गोपनीयता सेटिंग्स प्रबंधित करें")}
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              {tr("Email Address", "ईमेल पता")}
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
              {tr("Password", "पासवर्ड")}
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
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

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition hover:bg-blue-600 active:scale-98 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {submitting ? tr("Signing in...", "साइन इन हो रहा है...") : tr("Sign In", "साइन इन करें")}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500">
          {tr("Don't have an account?", "क्या आपका खाता नहीं है?")}{" "}
          <Link to="/signup" className="font-bold text-brand hover:underline">
            {tr("Create an account", "खाता बनाएं")}
          </Link>
        </div>
      </div>
    </div>
  );
}
