import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Home, Search, ScanLine, ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Page Not Found — MedEasy</title>
        <meta name="description" content="The page you're looking for doesn't exist. Head back to MedEasy to compare medicine prices, scan prescriptions, or find nearby pharmacies." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="flex min-h-[70vh] flex-col items-center justify-center px-5 py-20 text-center">
        {/* Large 404 */}
        <div className="relative mb-8 select-none">
          <span className="text-[120px] font-extrabold leading-none tracking-tight text-slate-100 sm:text-[160px]">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand shadow-[0_12px_28px_rgba(23,105,255,0.32)]">
              <span className="text-2xl font-extrabold text-white">+</span>
            </div>
          </div>
        </div>

        {/* Heading */}
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          Page not found
        </h1>
        <p className="mb-10 max-w-md text-[16px] leading-7 text-muted">
          The page you're looking for doesn't exist or may have been moved.
          Let's get you back on track.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            to="/"
            className="inline-flex h-[50px] items-center gap-2.5 rounded-full bg-brand px-7 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(23,105,255,0.25)] transition hover:bg-brand-dark"
          >
            <Home className="h-4 w-4" />
            Go to Home
          </Link>
          <Link
            to="/scan"
            className="inline-flex h-[50px] items-center gap-2.5 rounded-full border border-slate-200 bg-white px-7 text-[15px] font-semibold text-navy transition hover:border-brand/40 hover:text-brand"
          >
            <ScanLine className="h-4 w-4" />
            Scan Prescription
          </Link>
          <Link
            to="/medicines"
            className="inline-flex h-[50px] items-center gap-2.5 rounded-full border border-slate-200 bg-white px-7 text-[15px] font-semibold text-navy transition hover:border-brand/40 hover:text-brand"
          >
            <Search className="h-4 w-4" />
            Explore Medicines
          </Link>
        </div>

        {/* Back link */}
        <button
          onClick={() => window.history.back()}
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
      </main>
    </>
  );
}
