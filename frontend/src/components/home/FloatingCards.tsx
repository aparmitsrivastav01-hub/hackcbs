import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatInr } from "../../api/client";
import { useLanguage } from "../../i18n/LanguageContext";
import type { Comparison } from "../../types";

export function PrescriptionCard() {
  return (
    <Link
      to="/scan"
      title="Click to scan prescription"
      className="absolute -right-4 top-6 z-20 hidden w-[174px] rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_18px_40px_rgba(15,40,90,0.12)] transition hover:scale-105 hover:shadow-lg lg:block cursor-pointer"
      style={{
        transform: "rotate(6deg)",
        backgroundImage:
          "repeating-linear-gradient(#ffffff, #ffffff 24px, #f0f4f9 24px, #f0f4f9 25px)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-serif text-[24px] font-black tracking-tight text-slate-900 leading-none">
          Rx
        </span>
        <span className="rounded-full bg-[#eef5ff] px-2 py-0.5 text-[9px] font-bold text-brand">
          Scan →
        </span>
      </div>
      <ol className="space-y-2 text-[10.5px] font-medium leading-[1.3] text-slate-700">
        <li>
          <span className="font-semibold text-slate-900">1. Paracetamol 500 mg</span>
          <br />
          <span className="pl-3 text-slate-500">1 - 0 - 1</span>
        </li>
        <li>
          <span className="font-semibold text-slate-900">2. Azithromycin 500 mg</span>
          <br />
          <span className="pl-3 text-slate-500">1 - 0 - 0</span>
        </li>
        <li>
          <span className="font-semibold text-slate-900">3. Pantoprazole 40 mg</span>
          <br />
          <span className="pl-3 text-slate-500">1 - 0 - 1</span>
        </li>
      </ol>
    </Link>
  );
}

export function CurvedArrow() {
  return (
    <svg
      className="pointer-events-none absolute right-[18px] top-[215px] z-20 hidden h-20 w-24 text-brand lg:block"
      viewBox="0 0 96 80"
      fill="none"
      aria-hidden
    >
      <path
        d="M84 6 C76 36 50 56 16 48"
        stroke="#0866FF"
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      <path
        d="M26 38 L14 48 L22 60"
        stroke="#0866FF"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PriceCompareCard({ comparison }: { comparison?: Comparison | null }) {
  const { t } = useLanguage();
  const privateOpt = comparison?.price_options.find((o) => o.provider === "Private Brand");
  const cheapest = comparison?.recommended_option;

  const title = comparison?.medicine?.brand_name
    ? `${comparison.medicine.brand_name} (${comparison.medicine.dosage_form || "Tablet"})`
    : "Paracetamol 500 mg (Tablet)";
  const brandedName = "Crocin 500";
  const brandedPrice = privateOpt?.price ?? 240;
  const genericName = "Paracetamol 500";
  const genericPrice = cheapest?.price ?? 28;
  const savings = cheapest?.savings ?? (brandedPrice - genericPrice);

  return (
    <div className="absolute -right-14 bottom-12 z-20 hidden w-[252px] rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_20px_48px_rgba(15,40,90,0.16)] lg:block">
      <p className="mb-2.5 text-[13px] font-bold text-navy">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-[#f8fafc] p-2.5">
          <p className="text-[10px] font-semibold text-brand">{t.branded}</p>
          <p className="mt-0.5 text-[11px] font-bold text-navy">{brandedName}</p>
          <p className="mt-1.5 text-[20px] font-extrabold leading-none text-navy">
            {formatInr(brandedPrice)}
          </p>
          <p className="mt-1 text-[8.5px] text-slate-400">MRP (10 tablets)</p>
        </div>
        <div className="flex flex-col justify-between rounded-xl border border-emerald-100 bg-[#f0fdf4] p-2.5">
          <p className="text-[10px] font-semibold text-[#16a34a]">{t.generic}</p>
          <p className="mt-0.5 text-[11px] font-bold text-navy">{genericName}</p>
          <p className="mt-1.5 text-[20px] font-extrabold leading-none text-[#16a34a]">
            {formatInr(genericPrice)}
          </p>
          <p className="mt-1 text-[8.5px] text-slate-400">Jan Aushadhi (10 tablets)</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-[#e8f7ee] py-2 px-3 text-[11.5px] font-bold text-[#16a34a]">
        <ArrowUpRight className="h-3.5 w-3.5 stroke-[2.5]" />
        <span>
          {t.saveUpTo} {formatInr(savings)}
        </span>
      </div>
    </div>
  );
}
