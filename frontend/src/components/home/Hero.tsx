import {
  Bot,
  Brain,
  FileText,
  HeartPulse,
  MapPin,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { compareMedicine, getMedicine } from "../../api/client";
import { useLanguage } from "../../i18n/LanguageContext";
import type { Comparison, Medicine } from "../../types";
import { CurvedArrow, PrescriptionCard, PriceCompareCard } from "./FloatingCards";
import { HeroDecor } from "./HeroDecor";
import { PhoneMockup } from "./PhoneMockup";

const DEMO_IDS = [17, 36, 255];

export function Hero() {
  const { t, locale, tr } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(DEMO_IDS.map((id) => getMedicine(id)))
      .then((items) => {
        if (!cancelled && items.length > 0) setMedicines(items);
      })
      .catch(() => {
        // Fallback default demo data handles offline gracefully
      });

    compareMedicine(17)
      .then((data) => {
        if (!cancelled && data) setComparison(data);
      })
      .catch(() => {
        // Fallback default demo data handles offline gracefully
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      navigate("/scan", { state: { file } });
    }
  }

  const features = [
    { icon: FileText, title: t.feat1Title, body: t.feat1Body, to: "/scan" },
    { icon: Tag, title: t.feat2Title, body: t.feat2Body, to: "/medicines" },
    {
      icon: Bot,
      title: tr("MedSaathi Voice AI", "मेडसाथी वॉयस AI"),
      body: tr(
        "Multilingual voice & text consultations in Hindi & English with ElevenLabs speech.",
        "ग्यारह प्रयोगशालाओं की आवाज़ के साथ हिंदी और अंग्रेजी में परामर्श।"
      ),
      to: "/med-saathi",
    },
    {
      icon: Brain,
      title: tr("Persistent Memory", "सुरक्षित हेल्थ मेमोरी"),
      body: tr(
        "Privacy-preserving recall of allergies & health notes via Meko MCP.",
        "Meko द्वारा एलर्जी और स्वास्थ्य प्राथमिकताओं का सुरक्षित संस्मरण।"
      ),
      to: "/account",
    },
    { icon: MapPin, title: t.feat3Title, body: t.feat3Body, to: "/stores" },
    { icon: ShieldCheck, title: t.feat4Title, body: t.feat4Body, to: "/batch-safety" },
  ];

  return (
    <section
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="relative overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_55%,#ffffff_100%)]"
    >
      {/* Drag & drop prescription upload overlay */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-brand/10 backdrop-blur-xs border-4 border-dashed border-brand">
          <div className="rounded-2xl bg-white px-8 py-6 shadow-2xl text-center flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-brand animate-bounce" />
            <p className="text-lg font-bold text-navy">{t.dropToScan}</p>
            <p className="text-xs text-slate-500">{t.subhead}</p>
          </div>
        </div>
      )}
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-10 px-5 pb-16 pt-8 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:pb-20 lg:pt-12">
        {/* Left Column: Headlines & Features */}
        <div className="relative z-10 max-w-[640px]">
          {/* Eyebrow & Dual Workflow Badges */}
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100/80 bg-[#eef5ff] px-3.5 py-1.5 text-[11px] font-bold tracking-[0.08em] text-brand">
              <HeartPulse className="h-3.5 w-3.5 text-brand" />
              {t.eyebrow}
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-bold text-purple-700">
              <Sparkles className="h-3 w-3 text-purple-600" />
              <span>{tr("Two Core Workflows: Generic Savings + MedSaathi AI Memory", "दो मुख्य वर्कफ़्लो: जेनेरिक बचत + मेडसाथी एआई मेमोरी")}</span>
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-[44px] font-extrabold leading-[1.08] tracking-[-0.035em] text-navy sm:text-[58px] lg:text-[68px]">
            {t.headline1}
            <br />
            <span>{t.headlineMore}</span>
            <span className="text-brand">{t.headline2}</span>
          </h1>

          {/* Subhead */}
          <p className="mt-6 max-w-[520px] text-[17px] leading-7 text-muted">
            {t.subhead}
          </p>

          {/* Action CTAs: Scan + Explore + MedSaathi */}
          <div className="mt-8 flex flex-wrap gap-3 sm:flex-row">
            <Link
              to="/scan"
              className="inline-flex h-[50px] items-center justify-center gap-2 rounded-full bg-brand px-6 text-[14.5px] font-semibold text-white shadow-[0_12px_24px_rgba(8,102,255,0.28)] transition hover:bg-brand-dark"
            >
              <ScanLine className="h-[18px] w-[18px]" />
              {t.scanCta}
              <span aria-hidden className="text-base font-bold">→</span>
            </Link>
            <Link
              to="/medicines"
              className="inline-flex h-[50px] items-center justify-center gap-2 rounded-full border border-slate-200/90 bg-white px-5 text-[14.5px] font-semibold text-navy shadow-xs transition hover:border-brand/40 hover:text-brand"
            >
              <Search className="h-[18px] w-[18px] text-slate-500" />
              {t.exploreCta}
            </Link>
            <Link
              to="/med-saathi"
              className="inline-flex h-[50px] items-center justify-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-5 text-[14.5px] font-bold text-purple-700 shadow-xs transition hover:bg-purple-100 hover:border-purple-300 active:scale-98"
            >
              <Sparkles className="h-[18px] w-[18px] text-purple-600" />
              <span>{locale === "hi" ? "मेडसाथी (AI)" : "MedSaathi Voice AI"}</span>
            </Link>
          </div>

          {/* Direct File Upload helper with hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/*,application/pdf"
            className="hidden"
            id="hero-file-upload"
          />
          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
            <span>or</span>
            <label
              htmlFor="hero-file-upload"
              className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-brand transition hover:text-brand-dark hover:underline"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>{t.uploadLink}</span>
            </label>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400">{t.dragDropAnywhere}</span>
          </div>

          {/* Trust Badge */}
          <p className="mt-5 flex items-center gap-2 text-[13px] text-slate-500">
            <ShieldCheck className="h-4 w-4 text-brand" />
            {t.trustLine}
          </p>

          {/* 6 Feature Items (Covering Both Workflows) */}
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {features.map((feature) => (
              <Link
                key={feature.title}
                to={feature.to}
                className="group flex flex-col rounded-2xl border border-slate-100/80 bg-white/60 p-3.5 transition hover:bg-white hover:shadow-xs hover:border-brand/20 hover:translate-y-[-2px]"
              >
                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef5ff] text-brand transition group-hover:bg-brand group-hover:text-white">
                  <feature.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="text-[13.5px] font-bold text-navy transition group-hover:text-brand">{feature.title}</h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{feature.body}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Column: Phone Mockup & Floating Showcase */}
        <div className="relative z-10 mx-auto flex min-h-[660px] w-full max-w-[560px] items-center justify-center lg:mx-0">
          <HeroDecor />
          <PhoneMockup medicines={medicines} comparison={comparison} />
          <PrescriptionCard />
          <CurvedArrow />
          <PriceCompareCard comparison={comparison} />
        </div>
      </div>
    </section>
  );
}
