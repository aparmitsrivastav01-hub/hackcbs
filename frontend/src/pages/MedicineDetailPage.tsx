import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronRight,
  Info,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";
import { formatInr, formatSavingsText, getMedicine } from "../api/client";
import { Skeleton } from "../components/ui/Skeleton";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import type { MedicineResponse } from "../types";

export function MedicineDetailPage() {
  const { id } = useParams();
  const { tr } = useLanguage();
  const { addItem } = useCart();

  const [medicine, setMedicine] = useState<MedicineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"jan_aushadhi" | "dava_india" | "private_brand">("jan_aushadhi");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setError("Invalid medicine ID. Please select a valid medicine from the catalogue.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getMedicine(numericId)
      .then((data) => {
        setMedicine(data);
        // Default to cheapest available provider
        if (data.prices.jan_aushadhi != null && (data.prices.dava_india == null || data.prices.jan_aushadhi <= data.prices.dava_india)) {
          setSelectedProvider("jan_aushadhi");
        } else if (data.prices.dava_india != null) {
          setSelectedProvider("dava_india");
        } else {
          setSelectedProvider("private_brand");
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Medicine not found in catalogue");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  function handleAddToCart() {
    if (!medicine) return;

    let chosenPrice: number | null = null;
    if (selectedProvider === "jan_aushadhi") chosenPrice = medicine.prices.jan_aushadhi;
    else if (selectedProvider === "dava_india") chosenPrice = medicine.prices.dava_india;
    else chosenPrice = medicine.prices.private_brand;

    addItem({
      medicine_id: medicine.id,
      brand_name: medicine.brand_name,
      active_salt: medicine.active_salt,
      dosage_form: medicine.dosage_form,
      selected_provider: selectedProvider,
      selected_price: chosenPrice,
      private_brand_price: medicine.prices.private_brand,
      quantity: 1,
      pack_info: medicine.dosage_form,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Loading Medicine Details — MedEasy</title>
        </Helmet>
        <div className="min-h-screen bg-[#f7faff] pb-24 pt-8">
          <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb Skeleton */}
            <div className="mb-6 flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Hero Card Skeleton */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-9 w-64 rounded-xl" />
                  <Skeleton className="h-5 w-80" />
                </div>
                <Skeleton className="h-24 w-48 rounded-2xl" />
              </div>

              {/* 3 Price Cards Skeleton */}
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="mt-3 h-8 w-24" />
                  <Skeleton className="mt-2 h-4 w-36" />
                  <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/20 p-5">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="mt-3 h-8 w-24" />
                  <Skeleton className="mt-2 h-4 w-36" />
                  <div className="mt-6 space-y-2 border-t border-emerald-100 pt-4">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/20 p-5">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="mt-3 h-8 w-24" />
                  <Skeleton className="mt-2 h-4 w-36" />
                  <div className="mt-6 space-y-2 border-t border-blue-100 pt-4">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </div>

              {/* Action Bar Skeleton */}
              <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-12 w-48 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !medicine) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-navy">Medicine not found</h2>
        <p className="mt-2 text-sm text-muted">{error ?? "Unable to load catalogue record."}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/medicines"
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-xs"
          >
            Back to catalogue
          </Link>
          <Link
            to="/scan"
            className="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-navy"
          >
            Scan prescription
          </Link>
        </div>
      </div>
    );
  }

  const maxSaving = medicine.savings_comparison?.maximum_savings;
  const jaSavings = medicine.savings_comparison?.jan_aushadhi;
  const diSavings = medicine.savings_comparison?.dava_india;

  // Render provider display name when single or tie
  const formatProviderName = (prov: string | string[] | undefined) => {
    if (!prov) return "Alternative Provider";
    if (Array.isArray(prov)) return prov.join(" & ");
    return prov;
  };

  return (
    <>
      <Helmet>
        <title>{medicine.brand_name} Price Comparison — MedEasy</title>
        <meta
          name="description"
          content={`Compare ${medicine.brand_name} prices across Jan Aushadhi, Dava India, and private brands. Find the most affordable option for ${medicine.active_salt ?? medicine.brand_name}.`}
        />
      </Helmet>
    <div className="min-h-screen bg-[#f7faff] pb-24 pt-8">
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link to="/medicines" className="flex items-center gap-1 hover:text-brand">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{tr("All medicines", "सभी दवाइयां")}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-slate-400">{medicine.category}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-navy">{medicine.brand_name}</span>
        </div>

        {/* Hero Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_36px_rgba(15,40,90,0.06)] md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-bold text-brand">
                  {medicine.category}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {medicine.dosage_form}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono text-slate-500">
                  ID: #{medicine.id}
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
                {medicine.brand_name}
              </h1>
              <p className="mt-2 text-base font-medium text-slate-600">
                {tr("Active Salt / Composition:", "सक्रिय साल्ट / घटक:")} <span className="font-bold text-navy">{medicine.active_salt}</span>
              </p>
            </div>

            {/* Maximum Savings Pill */}
            {maxSaving && maxSaving.amount > 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_100%)] p-4 text-right shadow-xs">
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <TrendingDown className="h-4 w-4" />
                  {tr("Maximum Potential Savings", "अधिकतम संभावित बचत")}
                </span>
                <p className="mt-1 text-2xl font-black text-emerald-800">
                  {formatSavingsText(maxSaving.amount, maxSaving.percentage)}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  via {formatProviderName(maxSaving.provider)}
                </p>
              </div>
            ) : null}
          </div>

          {/* Side-by-side Pricing Comparison */}
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Private Brand */}
            <div
              onClick={() => setSelectedProvider("private_brand")}
              className={`cursor-pointer rounded-2xl border p-5 transition ${
                selectedProvider === "private_brand"
                  ? "border-navy bg-slate-50 ring-2 ring-navy/10"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {tr("Private Brand", "प्राइवेट ब्रांड")}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {tr("Market MRP", "बाजार MRP")}
                </span>
              </div>
              <p className="mt-3 text-3xl font-extrabold text-navy">
                {formatInr(medicine.prices.private_brand)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{tr("Standard retail benchmark", "मानक खुदरा बेंचमार्क")}</p>

              <div className="mt-4 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">{tr("Baseline price for comparison", "तुलना के लिए आधार मूल्य")}</span>
              </div>
            </div>

            {/* Jan Aushadhi (PMBJP) */}
            <div
              onClick={() => setSelectedProvider("jan_aushadhi")}
              className={`cursor-pointer rounded-2xl border p-5 transition ${
                selectedProvider === "jan_aushadhi"
                  ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20"
                  : "border-slate-200 bg-white hover:border-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  {tr("Jan Aushadhi (PMBJP)", "जन औषधि (PMBJP)")}
                </span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {tr("Govt Generic", "सरकारी जेनेरिक")}
                </span>
              </div>
              <p className="mt-3 text-3xl font-extrabold text-navy">
                {formatInr(medicine.prices.jan_aushadhi)}
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                {jaSavings?.savings_amount != null
                  ? formatSavingsText(jaSavings.savings_amount, jaSavings.savings_percentage)
                  : tr("Not available in catalogue", "कैटलॉग में उपलब्ध नहीं")}
              </p>

              <div className="mt-4 border-t border-emerald-100 pt-3">
                <span className="text-xs text-slate-500">
                  {tr("Available at PMBJP Kendras across India", "पूरे भारत में जन औषधि केंद्रों पर उपलब्ध")}
                </span>
              </div>
            </div>

            {/* Dava India */}
            <div
              onClick={() => setSelectedProvider("dava_india")}
              className={`cursor-pointer rounded-2xl border p-5 transition ${
                selectedProvider === "dava_india"
                  ? "border-brand bg-blue-50/70 ring-2 ring-brand/20"
                  : "border-slate-200 bg-white hover:border-blue-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand">
                  {tr("Dava India", "दवा इंडिया")}
                </span>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-brand">
                  {tr("Pharmacy Network", "फार्मेसी नेटवर्क")}
                </span>
              </div>
              <p className="mt-3 text-3xl font-extrabold text-navy">
                {formatInr(medicine.prices.dava_india)}
              </p>
              <p className="mt-1 text-xs font-semibold text-brand">
                {diSavings?.savings_amount != null
                  ? formatSavingsText(diSavings.savings_amount, diSavings.savings_percentage)
                  : tr("Not available in catalogue", "कैटलॉग में उपलब्ध नहीं")}
              </p>

              <div className="mt-4 border-t border-blue-100 pt-3">
                <span className="text-xs text-slate-500">
                  {tr("Available at Dava India retail outlets", "दवा इंडिया के मेडिकल स्टोरों पर उपलब्ध")}
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-8 flex flex-col gap-3 rounded-2xl bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-navy">
                Selected option:{" "}
                <span className="capitalize text-brand">
                  {selectedProvider.replace("_", " ")}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                Add this medicine to your pharmacy enquiry list to request availability and quotes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAddToCart}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold shadow-xs transition ${
                  added
                    ? "bg-emerald-600 text-white"
                    : "bg-brand text-white hover:bg-brand-dark"
                }`}
              >
                {added ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Added to enquiry!</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    <span>Add to enquiry list</span>
                  </>
                )}
              </button>

              <Link
                to="/stores"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-navy transition hover:border-brand hover:text-brand"
              >
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>Find nearby stores</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Caveats and Medical Disclaimers Section */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Pack comparability notice */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 shrink-0 text-slate-400" />
              <div>
                <h3 className="font-bold text-navy">Pack Size & Comparability Caveat</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Prices displayed are catalogue reference values. Pack sizes (e.g. 10 tablets vs. 15 tablets)
                  or specific excipients may differ between brands. Always verify pack counts with your chemist.
                </p>
              </div>
            </div>
          </div>

          {/* Safety & Non-substitution notice */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h3 className="font-bold text-amber-900">Medical Safety & Substitution Notice</h3>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  This comparison is for price discovery only. It is not a prescription or clinical recommendation.
                  Do not substitute prescribed medications without consulting your prescribing doctor or licensed pharmacist.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Batch Safety Verification Link */}
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-navy">Have a pack of {medicine.brand_name} at home?</p>
              <p className="text-xs text-muted">Check its batch number against official CDSCO drug quality alerts.</p>
            </div>
          </div>
          <Link
            to="/batch-safety"
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-navy hover:border-brand hover:text-brand"
          >
            Check Batch Number →
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
