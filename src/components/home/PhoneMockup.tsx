import { Bell, ChevronRight, Pill, Plus, ScanLine, ShieldCheck, Sparkle } from "lucide-react";
import { Link } from "react-router-dom";
import { formatInr } from "../../api/client";
import { useLanguage } from "../../i18n/LanguageContext";
import type { Comparison, Medicine } from "../../types";

type Props = {
  medicines?: Medicine[];
  comparison?: Comparison | null;
};

const DEFAULT_ROWS = [
  { id: 17, name: "Paracetamol 500 mg", form: "Tablet", status: "matched" },
  { id: 36, name: "Azithromycin 500 mg", form: "Tablet", status: "matched" },
  { id: 255, name: "Pantoprazole 40 mg", form: "Tablet", status: "check" },
];

const DEFAULT_PHARMACIES = [
  { name: "Apollo Pharmacy", price: 28, inStock: true, icon: "cross" },
  { name: "Tata 1mg", price: 32, inStock: true, icon: "sparkle" },
  { name: "Netmeds", price: 30, inStock: true, icon: "cross" },
];

export function PhoneMockup({ medicines = [], comparison }: Props) {
  const { t } = useLanguage();

  const rows =
    medicines.length >= 3
      ? medicines.slice(0, 3).map((m, idx) => ({
          id: m.id,
          name: m.brand_name,
          form: m.dosage_form || "Tablet",
          status: idx < 2 ? "matched" : "check",
        }))
      : DEFAULT_ROWS;

  const compareMedicineName = comparison?.medicine?.brand_name || "Paracetamol 500 mg";
  const compareMedicinePackage = "Strip of 10 tablets";

  const pharmacyOptions =
    comparison && comparison.price_options.length >= 3
      ? comparison.price_options.slice(0, 3).map((opt, idx) => ({
          name: opt.provider,
          price: opt.price ?? 28,
          inStock: opt.available ?? true,
          icon: idx === 1 ? "sparkle" : "cross",
        }))
      : DEFAULT_PHARMACIES;

  return (
    <div className="relative mx-auto h-[648px] w-[316px] rounded-[48px] bg-[#111827] p-[10px] shadow-[0_36px_72px_rgba(15,40,100,0.22)] ring-1 ring-slate-800/80">
      {/* Dynamic Island */}
      <div className="absolute left-1/2 top-[13px] z-20 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black flex items-center justify-end pr-2.5">
        <span className="h-2 w-2 rounded-full bg-[#1c2333]/80 border border-slate-700/50" />
      </div>

      {/* Phone Screen */}
      <div className="relative h-full overflow-hidden rounded-[38px] bg-[#f5f8fc] flex flex-col justify-between p-3.5 pt-2">
        <div>
          {/* iOS Status Bar */}
          <div className="flex items-center justify-between px-2 pt-1 pb-1 text-[11px] font-semibold text-navy">
            <span>9:41</span>
            <div className="flex items-center gap-1.5 text-navy">
              {/* Cellular signal bars */}
              <div className="flex items-end gap-[1.5px] h-2.5">
                <span className="w-[2.5px] h-1 bg-current rounded-xs" />
                <span className="w-[2.5px] h-1.5 bg-current rounded-xs" />
                <span className="w-[2.5px] h-2 bg-current rounded-xs" />
                <span className="w-[2.5px] h-2.5 bg-current rounded-xs" />
              </div>
              {/* Wi-Fi Icon */}
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98A16.88 16.88 0 0012 4z" />
              </svg>
              {/* Battery */}
              <div className="flex items-center">
                <div className="w-5 h-2.5 rounded-[3px] border border-current p-[1px] flex items-center">
                  <div className="w-full h-full bg-current rounded-[1px]" />
                </div>
                <div className="w-[1.5px] h-1 bg-current rounded-r-xs -ml-[0.5px]" />
              </div>
            </div>
          </div>

          {/* App Header inside phone */}
          <div className="flex items-center justify-between px-1 pb-2 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand shadow-xs">
                <Plus className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />
              </span>
              <span className="text-[13.5px] font-extrabold text-navy">MedEasy</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-xs border border-slate-100">
                <Bell className="h-3.5 w-3.5 text-slate-600" />
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white shadow-xs">
                A
              </span>
            </div>
          </div>

          {/* Prescription Scan Card */}
          <Link
            to="/scan"
            className="mb-2.5 flex items-center justify-between gap-2.5 rounded-2xl border border-slate-100/80 bg-white p-2.5 shadow-[0_4px_14px_rgba(15,40,90,0.04)] transition hover:shadow-md"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                <ScanLine className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <span className="block text-[12px] font-bold text-navy leading-snug">
                  {t.phoneScanTitle}
                </span>
                <span className="block text-[10px] text-slate-500 leading-tight">
                  {t.phoneScanBody}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-brand" />
          </Link>

          {/* Medicine found Section */}
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-[12px] font-bold text-navy">
              {t.medicineFound} ({rows.length})
            </p>
            <Link to="/medicines" className="text-[11px] font-semibold text-brand hover:underline">
              {t.viewAll}
            </Link>
          </div>

          <div className="mb-2.5 space-y-1.5">
            {rows.map((med) => (
              <Link
                key={med.id}
                to={`/medicines/${med.id}`}
                className="flex items-center justify-between gap-1.5 rounded-2xl border border-slate-100/70 bg-white px-2.5 py-1.5 shadow-[0_3px_10px_rgba(15,40,90,0.03)] transition hover:shadow-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg bg-[#eef5ff] text-brand">
                    <Pill className="h-3 w-3" />
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[11px] font-bold text-navy leading-tight">
                      {med.name}
                    </span>
                    <span className="text-[9.5px] text-slate-400 leading-none">{med.form}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                      med.status === "matched"
                        ? "bg-[#e8f7ee] text-[#16a34a]"
                        : "bg-[#fff4e5] text-[#d97706]"
                    }`}
                  >
                    {med.status === "matched" ? t.matched : t.check}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                </div>
              </Link>
            ))}
          </div>

          {/* Compare Prices Section */}
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-[12px] font-bold text-navy">{t.comparePrices}</p>
            <Link to="/medicines" className="text-[11px] font-semibold text-brand hover:underline">
              {t.seeAll}
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-100/70 bg-white p-2.5 shadow-[0_4px_14px_rgba(15,40,90,0.04)]">
            {/* Target medicine header */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg bg-[#eef5ff] text-brand">
                  <Pill className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-navy leading-tight">
                    {compareMedicineName}
                  </p>
                  <p className="text-[9px] text-slate-400 leading-none">{compareMedicinePackage}</p>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            </div>

            {/* Pharmacy list */}
            <div className="space-y-1.5 border-t border-slate-100 pt-2">
              {pharmacyOptions.map((opt) => (
                <div key={opt.name} className="flex items-center justify-between text-[10.5px]">
                  <span className="flex items-center gap-1.5 text-slate-700 font-medium truncate pr-1">
                    {opt.icon === "cross" ? (
                      <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-xs bg-[#eef5ff] text-brand text-[9px] font-bold">
                        +
                      </span>
                    ) : (
                      <Sparkle className="h-3 w-3 shrink-0 fill-sky-400 text-sky-400" />
                    )}
                    <span className="truncate">{opt.name}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-navy whitespace-nowrap">{formatInr(opt.price)}</span>
                    <span className="rounded bg-[#e8f7ee] px-1.5 py-0.5 text-[8.5px] font-semibold text-[#16a34a] whitespace-nowrap">
                      In stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Phone Footer */}
        <p className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" />
          <span>{t.phoneFooter}</span>
        </p>
      </div>
    </div>
  );
}
