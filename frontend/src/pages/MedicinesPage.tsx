import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Filter,
  Percent,
  Pill,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import {
  formatInr,
  formatSavingsText,
  getCategories,
  getMaximumSavings,
  searchMedicines,
} from "../api/client";
import { useCart } from "../context/CartContext";
import { Skeleton } from "../components/ui/Skeleton";
import { useLanguage } from "../i18n/LanguageContext";
import type { MaximumSavingsResponse, MedicineResponse } from "../types";

export function MedicinesPage() {
  const { tr, locale } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [q, setQ] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [results, setResults] = useState<MedicineResponse[]>([]);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Maximum savings widget state
  const [maxSavings, setMaxSavings] = useState<MaximumSavingsResponse | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"all" | "jan_aushadhi" | "dava_india">("all");
  const [savingsLoading, setSavingsLoading] = useState(false);

  // Cart integration
  const { addItem } = useCart();
  const [addedIds, setAddedIds] = useState<Record<number, boolean>>({});

  // Abort controller reference for debounced in-flight request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load categories and initial maximum savings on mount
  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));

    loadSavings("all");
  }, []);

  function loadSavings(provider: "all" | "jan_aushadhi" | "dava_india") {
    setSavingsLoading(true);
    getMaximumSavings(provider === "all" ? undefined : provider)
      .then((data) => setMaxSavings(data))
      .catch(() => setMaxSavings(null))
      .finally(() => setSavingsLoading(false));
  }

  function handleProviderChange(prov: "all" | "jan_aushadhi" | "dava_india") {
    setSelectedProvider(prov);
    loadSavings(prov);
  }

  // Typeahead debounce and search execution
  useEffect(() => {
    const trimmed = q.trim();

    // Cancel any previous pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!trimmed) {
      setResults([]);
      setTotalResults(null);
      setError(null);
      setLoading(false);
      setActiveQuery("");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      searchMedicines(trimmed, controller.signal)
        .then((data) => {
          setResults(data.results);
          setTotalResults(data.total_results);
          setActiveQuery(data.query);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") {
            return; // Ignore aborted requests
          }
          setError(err instanceof Error ? err.message : "Search request failed");
          setResults([]);
          setTotalResults(0);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) {
      setSearchParams({ q: q.trim() });
    } else {
      setSearchParams({});
    }
  }

  function handleQuickSearch(sample: string) {
    setQ(sample);
    setSearchParams({ q: sample });
  }

  function handleAddToCart(med: MedicineResponse) {
    // Choose cheapest alternative if present, else private brand
    const useJa = med.prices.jan_aushadhi != null;
    const useDi = med.prices.dava_india != null;
    let chosenProvider: "jan_aushadhi" | "dava_india" | "private_brand" = "private_brand";
    let chosenPrice: number | null = med.prices.private_brand;

    if (useJa && useDi) {
      if ((med.prices.jan_aushadhi ?? 0) <= (med.prices.dava_india ?? 0)) {
        chosenProvider = "jan_aushadhi";
        chosenPrice = med.prices.jan_aushadhi;
      } else {
        chosenProvider = "dava_india";
        chosenPrice = med.prices.dava_india;
      }
    } else if (useJa) {
      chosenProvider = "jan_aushadhi";
      chosenPrice = med.prices.jan_aushadhi;
    } else if (useDi) {
      chosenProvider = "dava_india";
      chosenPrice = med.prices.dava_india;
    }

    addItem({
      medicine_id: med.id,
      brand_name: med.brand_name,
      active_salt: med.active_salt,
      dosage_form: med.dosage_form,
      selected_provider: chosenProvider,
      selected_price: chosenPrice,
      private_brand_price: med.prices.private_brand,
      quantity: 1,
      pack_info: med.dosage_form,
    });

    setAddedIds((prev) => ({ ...prev, [med.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [med.id]: false }));
    }, 2000);
  }

  // Filter results by category if selected
  const filteredResults = category
    ? results.filter((r) => r.category.toLowerCase() === category.toLowerCase())
    : results;

  return (
    <>
      <Helmet>
        <title>{tr("Explore Medicines & Compare Prices — MedEasy", "दवाइयां खोजें और कीमतों की तुलना करें — MedEasy")}</title>
        <meta
          name="description"
          content="Search and compare medicine prices across Jan Aushadhi, Dava India, and private brands. Find generic alternatives and maximise your savings."
        />
      </Helmet>
    <div className="min-h-screen bg-[#f7faff] pb-20 pt-8">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
            <Pill className="h-3.5 w-3.5" />
            <span>{tr("Catalogue Search & Verified Pricing", "कैटलॉग खोज व सत्यापित मूल्य")}</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
            {tr("Explore medicines & compare prices", "दवाइयां खोजें और कीमतों की तुलना करें")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
            {tr(
              "Search 500+ verified medicines across private brands, Jan Aushadhi (PMBJP), and Dava India. Prices and savings are computed directly by the catalogue API.",
              "ब्रांडेड दवाओं, जन औषधि (PMBJP) और दवा इंडिया के 500+ सत्यापित विकल्पों में खोजें। कीमतें व बचत सीधे कैटलॉग डेटा से दर्शायी जाती हैं।"
            )}
          </p>
        </div>

        {/* Search Bar & Category Filter */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-[0_12px_36px_rgba(15,40,90,0.06)] md:p-6">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 md:flex-row">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tr("Search brand (e.g., Crocin, Zerodol), salt (Paracetamol), or form...", "दवाई का नाम, साल्ट (उदा. पैरासिटामोल) या रूप खोजें...")}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-[#f8fbff] pl-11 pr-4 text-sm font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs text-slate-400 hover:text-navy"
                >
                  {tr("Clear", "साफ़ करें")}
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="relative min-w-[200px]">
              <Filter className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-[#f8fbff] pl-10 pr-8 text-sm font-medium text-navy focus:border-brand focus:bg-white focus:outline-none"
              >
                <option value="">{tr("All Categories", "सभी श्रेणियां")} ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-sm font-bold text-white shadow-xs transition hover:bg-brand-dark"
            >
              <span>{tr("Search", "खोजें")}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick Suggestions */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span className="font-semibold text-slate-400">{tr("Popular searches:", "लोकप्रिय खोजें:")}</span>
            {["Paracetamol 500 mg", "Crocin Advance 500", "Azithromycin 500 mg", "Pantoprazole 40 mg", "Zerodol-P"].map(
              (term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleQuickSearch(term)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 transition hover:border-brand hover:text-brand"
                >
                  {term}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Search Status & Query Header */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-navy">
              {activeQuery ? `${tr("Results for", "परिणाम:")} "${activeQuery}"` : tr("Catalogue Top Savings Opportunities", "कैटलॉग में सबसे अधिक बचत के अवसर")}
            </h2>
            {loading && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-brand animate-pulse">
                <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
                {tr("Searching...", "खोज जारी है...")}
              </span>
            )}
          </div>
          {totalResults != null && (
            <span className="text-sm font-semibold text-muted">
              {filteredResults.length} {filteredResults.length === 1 ? tr("match", "विकल्प") : tr("matches", "विकल्प")} {tr("found", "मिले")}
              {category ? ` in ${category}` : ""}
            </span>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="font-bold">{tr("Search error", "खोज में त्रुटि")}</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* RESULTS SECTION */}
        {activeQuery ? (
          <div className="mt-6 space-y-4">
            {loading && (
              <>
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs md:p-6"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      <div className="flex-1 space-y-3">
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-20 rounded-full" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-7 w-48 rounded-lg" />
                        <Skeleton className="h-4 w-72" />
                      </div>
                      <Skeleton className="h-14 w-40 rounded-xl" />
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Skeleton className="h-24 rounded-xl" />
                      <Skeleton className="h-24 rounded-xl" />
                      <Skeleton className="h-24 rounded-xl" />
                    </div>
                    <div className="mt-5 flex justify-between border-t border-slate-100 pt-4">
                      <Skeleton className="h-4 w-32" />
                      <div className="flex gap-2">
                        <Skeleton className="h-9 w-24 rounded-full" />
                        <Skeleton className="h-9 w-32 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {!loading && filteredResults.map((med) => {
              const maxSaving = med.savings_comparison?.maximum_savings;
              const hasJa = med.prices.jan_aushadhi != null;
              const hasDi = med.prices.dava_india != null;
              const isAdded = !!addedIds[med.id];

              return (
                <article
                  key={med.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition hover:border-brand/40 hover:shadow-md"
                >
                  <div className="p-5 md:p-6">
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                      {/* Left: Info */}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#eef5ff] px-2.5 py-0.5 text-[11px] font-bold text-brand">
                            {med.category}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            {med.dosage_form}
                          </span>
                        </div>

                        <Link
                          to={`/medicines/${med.id}`}
                          className="mt-2 block group"
                        >
                          <h3 className="text-xl font-bold text-navy transition group-hover:text-brand">
                            {med.brand_name}
                          </h3>
                        </Link>
                        <p className="mt-1 text-sm font-medium text-slate-600">
                          Composition: <span className="text-navy">{med.active_salt}</span>
                        </p>
                      </div>

                      {/* Right: Savings Highlight */}
                      {maxSaving && maxSaving.amount > 0 ? (
                        <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-emerald-800">
                          <TrendingDown className="h-5 w-5 text-emerald-600" />
                          <div>
                            <span className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                              Save up to
                            </span>
                            <span className="text-base font-extrabold text-emerald-800">
                              {formatSavingsText(maxSaving.amount, maxSaving.percentage, locale)}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Three Price Columns */}
                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {/* Private Brand */}
                      <div className="rounded-xl border border-slate-100 bg-[#f8fafc] p-3.5">
                        <span className="block text-[11px] font-semibold text-slate-500">
                          Private Brand MRP
                        </span>
                        <span className="mt-1 block text-lg font-extrabold text-navy">
                          {formatInr(med.prices.private_brand)}
                        </span>
                        <span className="text-[10px] text-slate-400">{tr("Retail benchmark", "खुदरा मूल्य मानक")}</span>
                      </div>

                      {/* Jan Aushadhi */}
                      <div
                        className={`rounded-xl border p-3.5 ${
                          hasJa
                            ? "border-emerald-200 bg-emerald-50/60"
                            : "border-slate-100 bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-emerald-800">
                            {tr("Jan Aushadhi (PMBJP)", "जन औषधि (PMBJP)")}
                          </span>
                          {hasJa && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                              {tr("Govt generic", "सरकारी जेनेरिक")}
                            </span>
                          )}
                        </div>
                        <span className="mt-1 block text-lg font-extrabold text-navy">
                          {formatInr(med.prices.jan_aushadhi)}
                        </span>
                        <span className="text-[10.5px] font-medium text-emerald-700">
                          {med.savings_comparison?.jan_aushadhi?.savings_amount != null
                            ? formatSavingsText(
                                med.savings_comparison.jan_aushadhi.savings_amount,
                                med.savings_comparison.jan_aushadhi.savings_percentage,
                                locale,
                              )
                            : tr("No alternative listed", "कोई विकल्प सूचीबद्ध नहीं")}
                        </span>
                      </div>

                      {/* Dava India */}
                      <div
                        className={`rounded-xl border p-3.5 ${
                          hasDi
                            ? "border-blue-200 bg-blue-50/60"
                            : "border-slate-100 bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-brand">
                            {tr("Dava India Generic", "दवा इंडिया जेनेरिक")}
                          </span>
                          {hasDi && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-brand">
                              {tr("Pharmacy chain", "फार्मेसी चेन")}
                            </span>
                          )}
                        </div>
                        <span className="mt-1 block text-lg font-extrabold text-navy">
                          {formatInr(med.prices.dava_india)}
                        </span>
                        <span className="text-[10.5px] font-medium text-brand">
                          {med.savings_comparison?.dava_india?.savings_amount != null
                            ? formatSavingsText(
                                med.savings_comparison.dava_india.savings_amount,
                                med.savings_comparison.dava_india.savings_percentage,
                                locale,
                              )
                            : tr("No alternative listed", "कोई विकल्प सूचीबद्ध नहीं")}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <p className="text-[11.5px] text-slate-400">
                        {tr(
                          "Indicative catalogue prices. Consult your doctor or pharmacist before changing formulations.",
                          "कैटलॉग में अनुमानित कीमतें। दवा बदलने से पहले डॉक्टर या फार्मासिस्ट से परामर्श अवश्य लें।"
                        )}
                      </p>

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/medicines/${med.id}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-navy transition hover:border-brand hover:text-brand"
                        >
                          <span>{tr("Compare breakdown", "मूल्य विवरण देखें")}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(med)}
                          className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition ${
                            isAdded
                              ? "bg-emerald-600 text-white"
                              : "bg-navy text-white hover:bg-slate-800"
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>{tr("Added to enquiry!", "सूची में जोड़ा गया!")}</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="h-3.5 w-3.5" />
                              <span>{tr("Add to enquiry list", "पूछताछ सूची में जोड़ें")}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Empty Results State */}
            {!loading && filteredResults.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Pill className="mx-auto h-12 w-12 text-slate-300" />
                <h3 className="mt-3 text-lg font-bold text-navy">{tr("No exact catalogue matches found", "कैटलॉग में सटीक दवा नहीं मिली")}</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                  {tr("We couldn't find a medicine matching", "इससे मेल खाती दवा नहीं मिली")} &ldquo;{activeQuery}&rdquo;. {tr("Try searching by active composition (e.g., Paracetamol or Amoxicillin) or check spelling.", "सक्रिय घटक (जैसे पैरासिटामोल या एमॉक्सिसिलिन) से खोजें या वर्तनी जांचें।")}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQ("Paracetamol")}
                    className="rounded-full bg-brand px-5 py-2 text-xs font-bold text-white"
                  >
                    {tr("Try", "खोजें")} &ldquo;Paracetamol&rdquo;
                  </button>
                  <Link
                    to="/scan"
                    className="rounded-full border border-slate-200 px-5 py-2 text-xs font-semibold text-navy hover:border-brand"
                  >
                    {tr("Scan prescription instead", "इसके बजाय पर्चा स्कैन करें")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* DEFAULT VIEW: MAXIMUM SAVINGS OPPORTUNITIES */
          <div className="mt-8 space-y-6">
            {/* Filter Tabs for Maximum Savings */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand" />
                <span className="font-bold text-navy">{tr("Top Verified Savings Opportunities", "सबसे अधिक बचत के अवसर")}</span>
              </div>

              <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1">
                {(
                  [
                    { key: "all", label: tr("All Providers", "सभी प्रदाता") },
                    { key: "jan_aushadhi", label: tr("Jan Aushadhi", "जन औषधि") },
                    { key: "dava_india", label: tr("Dava India", "दवा इंडिया") },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleProviderChange(tab.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      selectedProvider === tab.key
                        ? "bg-white text-navy shadow-xs"
                        : "text-slate-500 hover:text-navy"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Top 2 Cards: Highest Amount & Highest Percentage */}
            {maxSavings?.highest_savings_amount && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Highest Amount Opportunity */}
                <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_100%)] p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      <TrendingDown className="h-3.5 w-3.5" />
                      {tr("Highest Rupee Saving", "सबसे अधिक रुपये की बचत")}
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      {maxSavings.highest_savings_amount.alternative_provider}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-navy">
                    {maxSavings.highest_savings_amount.medicine_name}
                  </h3>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <span className="block text-xs text-slate-500">{tr("Private brand:", "प्राइवेट ब्रांड:")} {formatInr(maxSavings.highest_savings_amount.private_brand_price)}</span>
                      <span className="text-xl font-extrabold text-emerald-700">
                        {tr("Alternative:", "विकल्प:")} {formatInr(maxSavings.highest_savings_amount.alternative_price)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-semibold text-emerald-600">{tr("Save amount", "बचत राशि")}</span>
                      <span className="text-xl font-black text-emerald-800">
                        {formatInr(maxSavings.highest_savings_amount.savings_amount)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-emerald-100 pt-3">
                    <Link
                      to={`/medicines/${maxSavings.highest_savings_amount.medicine_id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:underline"
                    >
                      <span>{tr("View medicine breakdown", "दवा की कीमतों का विवरण देखें")}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Highest Percentage Opportunity */}
                {maxSavings.highest_savings_percentage && (
                  <div className="rounded-2xl border border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)] p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-brand">
                        <Percent className="h-3.5 w-3.5" />
                        {tr("Highest Percentage Saving", "सबसे अधिक प्रतिशत बचत")}
                      </span>
                      <span className="text-xs font-bold text-brand">
                        {maxSavings.highest_savings_percentage.alternative_provider}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-navy">
                      {maxSavings.highest_savings_percentage.medicine_name}
                    </h3>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <span className="block text-xs text-slate-500">{tr("Private brand:", "प्राइवेट ब्रांड:")} {formatInr(maxSavings.highest_savings_percentage.private_brand_price)}</span>
                        <span className="text-xl font-extrabold text-brand">
                          {tr("Alternative:", "विकल्प:")} {formatInr(maxSavings.highest_savings_percentage.alternative_price)}
                        </span>
                      </div>
                      <div className="text-right">
                      <span className="block text-xs font-semibold text-brand">{tr("Discount", "छूट")}</span>
                        <span className="text-xl font-black text-brand">
                          {maxSavings.highest_savings_percentage.savings_percentage.toFixed(1)}% {tr("OFF", "की बचत")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-blue-100 pt-3">
                      <Link
                        to={`/medicines/${maxSavings.highest_savings_percentage.medicine_id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
                      >
                        <span>{tr("View medicine breakdown", "दवा की कीमतों का विवरण देखें")}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top Savings Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-navy">{tr("Top 10 Catalogue Opportunities", "कैटलॉग के 10 सर्वोत्तम अवसर")}</h3>
                  <p className="text-xs text-muted">
                    {tr("Ranked by absolute rupee savings per standard unit or pack.", "प्रति मानक इकाई या पैक रुपये की बचत के आधार पर क्रमबद्ध।")}
                  </p>
                </div>
                {savingsLoading && <span className="text-xs text-brand animate-pulse">{tr("Updating...", "अपडेट हो रहा है...")}</span>}
              </div>

              <div className="divide-y divide-slate-100">
                {savingsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-7 w-7 rounded-lg" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-44" />
                          <Skeleton className="h-3 w-60" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-3 w-14" />
                        </div>
                        <Skeleton className="h-8 w-20 rounded-xl" />
                      </div>
                    </div>
                  ))
                ) : (
                  maxSavings?.top_savings?.map((item, idx) => (
                  <div
                    key={`${item.medicine_id}_${idx}`}
                    className="flex flex-col justify-between gap-3 p-4 transition hover:bg-[#f8fbff] sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <Link
                          to={`/medicines/${item.medicine_id}`}
                          className="font-bold text-navy hover:text-brand truncate block"
                        >
                          {item.medicine_name}
                        </Link>
                        <span className="text-xs text-slate-500">
                          {item.alternative_provider} {tr("vs Private Brand", "बनाम प्राइवेट ब्रांड")} ({formatInr(item.private_brand_price)})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right">
                        <span className="block text-xs font-extrabold text-emerald-700">
                          {tr("Save", "बचत")} {formatInr(item.savings_amount)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ({item.savings_percentage.toFixed(0)}% {tr("lower", "कम")})
                        </span>
                      </div>

                      <Link
                        to={`/medicines/${item.medicine_id}`}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy transition hover:border-brand hover:text-brand"
                      >
                        {tr("Compare", "तुलना करें")}
                      </Link>
                    </div>
                  </div>
                )))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
