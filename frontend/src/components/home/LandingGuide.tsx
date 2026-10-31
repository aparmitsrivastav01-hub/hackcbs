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

export function LandingGuide() {
  const navigate = useNavigate();
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
      title: "I have a paper prescription",
      badge: "AI-Assisted Scan",
      icon: ScanLine,
      color: "brand",
      description:
        "Upload a photo or PDF of your doctor's prescription. Our optical OCR extracts medicine names for you to review and confirm before comparing catalogue prices.",
      cta: "Scan Prescription",
      href: "/scan",
    },
    {
      title: "I know my medicine or salt name",
      badge: "Instant Price Compare",
      icon: Search,
      color: "emerald",
      description:
        "Search our indexed catalogue directly. Compare Jan Aushadhi (PMBJP), Dava India generic alternatives, and private brands side-by-side.",
      cta: "Search Medicines",
      href: "/medicines",
    },
    {
      title: "I want to check batch safety",
      badge: "CDSCO Quality Check",
      icon: ShieldAlert,
      color: "amber",
      description:
        "Verify your batch number against official monthly Central Drugs Standard Control Organisation (CDSCO) alerts for substandard or spurious drugs.",
      cta: "Check Batch Alert",
      href: "/batch-safety",
    },
    {
      title: "I want to locate nearby stores",
      badge: "Pharmacy & WhatsApp",
      icon: MapPin,
      color: "blue",
      description:
        "Locate Pradhan Mantri Jan Aushadhi Kendras and local licensed pharmacies around you. Export a structured medicine inquiry straight to WhatsApp.",
      cta: "Find Pharmacies",
      href: "/stores",
    },
  ];

  const journeySteps = [
    {
      step: "01",
      title: "Provide your medicine details",
      desc: "Upload your prescription or type generic / branded medicine names directly. Everything runs locally in your browser session.",
      icon: FileSearch,
    },
    {
      step: "02",
      title: "Human-in-the-loop verification",
      desc: "Review and edit extracted items. You always have full oversight to correct strength, dosage form, or spelling before searching.",
      icon: FileCheck,
    },
    {
      step: "03",
      title: "Compare verified generic prices",
      desc: "View official benchmark prices from Pradhan Mantri Jan Aushadhi Pariyojana (PMBJP) and Dava India against commercial MRPs.",
      icon: TrendingDown,
    },
    {
      step: "04",
      title: "Connect with local pharmacies",
      desc: "Find nearest PMBJP Kendras and open a pre-filled WhatsApp message to confirm stock availability with licensed pharmacists.",
      icon: MapPin,
    },
  ];

  const trustPillars = [
    {
      icon: Lock,
      title: "Zero Data Retention",
      desc: "No account required. Uploaded prescription images are processed ephemerally in memory and never saved to databases or disk.",
    },
    {
      icon: Database,
      title: "Official Government Data",
      desc: "Prices and batch notices are sourced from official PMBJP (Jan Aushadhi) catalogues and monthly CDSCO safety advisories.",
    },
    {
      icon: ShieldCheck,
      title: "Informational & Independent",
      desc: "We don't sell medicines or take commissions from pharmaceutical companies. Our sole goal is transparent price benchmarking.",
    },
    {
      icon: Users,
      title: "Doctor & Pharmacist First",
      desc: "We never recommend switching medications without clinical supervision. We empower patients to have informed conversations with clinicians.",
    },
  ];

  const faqs = [
    {
      q: "How are Jan Aushadhi medicines 50% to 80% more affordable?",
      a: "Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBJP) is an initiative of the Government of India. Generics contain the exact same active pharmaceutical ingredients (APIs) but eliminate high marketing, brand promotion, and middleman markups, passing pure savings to the public.",
    },
    {
      q: "Does MedEasy sell or dispense medicines online?",
      a: "No. MedEasy is strictly an informational and price transparency tool. We help you prepare enquiry lists to check availability at licensed local Jan Aushadhi Kendras or your neighborhood chemist.",
    },
    {
      q: "Is my medical data and prescription kept private?",
      a: "Yes, completely. MedEasy does not have user accounts or login walls. Prescriptions processed via OCR are handled ephemerally and discarded immediately after extraction. Your cart data stays only in your browser's temporary session.",
    },
    {
      q: "What should I do if a medicine is not listed in the catalogue?",
      a: "Our catalogue indexes over 500 common essential medicines. If your specific medicine isn't present, search by its active salt composition, or consult a licensed pharmacist at a Jan Aushadhi Kendra who can look up government generic equivalents.",
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
              Quick Catalogue Search
            </span>
            <h2 className="mt-3 text-2xl font-extrabold text-navy sm:text-3xl">
              Search any medicine to check price differences
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Instantly find Jan Aushadhi and Dava India alternatives for your regular prescriptions.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Try 'Paracetamol', 'Metformin', 'Telmisartan' or brand name..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-[#f8fbff] pl-12 pr-4 text-sm font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-3 focus:ring-brand/10"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-7 text-sm font-bold text-white shadow-xs transition hover:bg-brand-dark"
            >
              <span>Compare Prices</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Popular pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-400">Popular searches:</span>
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
            Designed For Your Specific Needs
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
            How can MedEasy help you today?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Whether you hold a doctor's paper slip or want to inspect generic pricing, choose your path below for a streamlined experience.
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
              Transparent Clinical Workflow
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
              How the platform works step-by-step
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
              Built with patient safety in mind. At every stage, you remain in complete control before any data is searched or shared.
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
            Trust & Clinical Boundaries
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
            Why patients trust MedEasy
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Healthcare requires absolute integrity. Here are our strict commitments to your privacy and clinical safety.
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
            Frequently Asked Questions
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
            Common questions about medicine pricing
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
              START SAVING TODAY
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Ready to verify medicine prices and save up to 80%?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-blue-100">
              Zero registration. Free forever. Start by uploading a prescription photo or browsing our indexed catalogue.
            </p>

            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
              <Link
                to="/scan"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-bold text-brand shadow-md transition hover:bg-blue-50"
              >
                <ScanLine className="h-4 w-4" />
                <span>Scan Prescription</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/medicines"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 text-sm font-bold text-white backdrop-blur-xs transition hover:bg-white/20"
              >
                <Search className="h-4 w-4" />
                <span>Explore Medicines</span>
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
