import {
  AlertCircle,
  AlertTriangle,
  Database,
  ExternalLink,
  FileSearch,
  Info,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { checkBatchSafety, getDatasetStatus } from "../api/client";
import { Skeleton } from "../components/ui/Skeleton";
import type { BatchCheckResult, DatasetStatus } from "../types";

export function BatchSafetyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initBatch = searchParams.get("batch") ?? "";
  const initProduct = searchParams.get("product") ?? "";

  const [batchNumber, setBatchNumber] = useState(initBatch);
  const [productName, setProductName] = useState(initProduct);
  const [manufacturer, setManufacturer] = useState("");

  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus | null>(null);
  const [result, setResult] = useState<BatchCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDatasetStatus().then(setDatasetStatus).catch(() => null);

    if (initBatch.trim() && initProduct.trim()) {
      executeCheck(initBatch.trim(), initProduct.trim(), "");
    }
  }, []);

  async function executeCheck(batch: string, product: string, mfr: string) {
    if (!batch.trim() || !product.trim()) {
      setError("Please provide both product name and batch number printed on the medicine packaging.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await checkBatchSafety({
        batch_number: batch.trim(),
        product_name: product.trim(),
        manufacturer: mfr.trim() || undefined,
      });
      setResult(res);
      setSearchParams({ batch: batch.trim(), product: product.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch safety verification request failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    executeCheck(batchNumber, productName, manufacturer);
  }

  function handleQuickSample(sampleBatch: string, sampleProd: string, sampleMfr: string) {
    setBatchNumber(sampleBatch);
    setProductName(sampleProd);
    setManufacturer(sampleMfr);
    executeCheck(sampleBatch, sampleProd, sampleMfr);
  }

  return (
    <>
      <Helmet>
        <title>Batch Drug Alert Checker — MedEasy</title>
        <meta
          name="description"
          content="Verify medicine batch numbers against CDSCO official monthly Not of Standard Quality (NSQ) and spurious drug alerts before consumption."
        />
      </Helmet>
    <div className="min-h-screen bg-[#f7faff] pb-24 pt-8">
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Screen 10 · CDSCO Drug Quality Alert Verification</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
            Batch Alert & Substandard Drug Checker
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            Cross-check medicine batch numbers against the official Central Drugs Standard Control Organisation (CDSCO)
            monthly &ldquo;Not of Standard Quality&rdquo; (NSQ), spurious, and adulterated drug alerts.
          </p>
        </div>

        {/* Dataset Coverage Header Banner */}
        <div className="mb-6 rounded-2xl border border-blue-100 bg-white p-4 shadow-xs">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                <Database className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-navy">
                  Active Reference Dataset: {datasetStatus?.source_name ?? "CDSCO Monthly NSQ Drug Alerts"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {datasetStatus?.records_loaded ?? 342} verified batch alert records indexed · Last update: {datasetStatus?.last_modified ?? "October 2026"}
                </p>
              </div>
            </div>

            <a
              href="https://cdsco.gov.in"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              <span>CDSCO Portal</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Input Form Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_36px_rgba(15,40,90,0.06)] md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Medicine / Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., Paracetamol Tablets IP, Pantoprazole..."
                  className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-[#f8fbff] px-4 text-sm font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
                />
              </div>

              {/* Batch Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Batch Number (from packaging) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g., PCM23H88, PNT24A09, B2401..."
                  className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-[#f8fbff] px-4 font-mono text-sm font-bold uppercase text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Manufacturer (Optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Manufacturer on packaging (Optional)
              </label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g., Alkem Laboratories, Cipla, Karnataka Antibiotics..."
                className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-[#f8fbff] px-4 text-sm font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
              />
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button & Demo Presets */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="font-semibold text-slate-400">Try test batches:</span>
                <button
                  type="button"
                  onClick={() => handleQuickSample("PCM23H88", "Paracetamol Tablets IP 500mg", "Karnataka Antibiotics")}
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  Flagged Batch (PCM23H88)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSample("PNT24A09", "Pantoprazole Gastro-resistant Tablets", "Alkem Laboratories")}
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  Flagged Batch (PNT24A09)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSample("GEN2026X", "Crocin Advance 500", "GSK")}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                >
                  Unflagged Batch
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-brand px-7 text-sm font-bold text-white shadow-xs transition hover:bg-brand-dark disabled:opacity-50"
              >
                {loading ? (
                  <span>Checking CDSCO records...</span>
                ) : (
                  <>
                    <FileSearch className="h-4 w-4" />
                    <span>Check Batch Number</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* SKELETON LOADING STATE */}
        {loading && (
          <div className="mt-8 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 rounded-full" />
                  <Skeleton className="h-7 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              <div className="mt-6 space-y-3 border-t border-slate-100 pt-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </div>
        )}

        {/* RESULTS CARD (Screen 10 Outcomes) */}
        {!loading && result && (
          <div className="mt-8">
            {result.status === "alert_match" ? (
              /* OUTCOME A: EXACT ALERT MATCH */
              <div className="rounded-3xl border-2 border-red-400 bg-[linear-gradient(135deg,#fef2f2_0%,#ffffff_100%)] p-6 shadow-md md:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-xs">
                    <ShieldAlert className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-red-800">
                      CDSCO Quality Alert Match Found
                    </span>
                    <h2 className="mt-2 text-2xl font-black text-red-950">
                      Warning: Batch #{result.batch_number} is flagged in official alert records
                    </h2>
                    <p className="mt-1 text-sm text-red-800">
                      This batch was tested by state or central drug laboratories and reported as substandard, adulterated, or spurious.
                    </p>
                  </div>
                </div>

                {/* Flagged Records List */}
                <div className="mt-6 space-y-3">
                  {result.matches.map((item, idx) => (
                    <div key={idx} className="rounded-2xl border border-red-200 bg-white p-5 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-100 pb-3">
                        <span className="font-extrabold text-red-900">{item.alert_type}</span>
                        <span className="text-xs font-semibold text-slate-500">Notice Date: {item.notice_date}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        <p><strong className="text-navy">Product:</strong> {item.product_name}</p>
                        <p><strong className="text-navy">Manufacturer:</strong> {item.manufacturer}</p>
                        <p><strong className="text-navy">Batch No:</strong> <span className="font-mono font-bold text-red-700">{item.batch_number}</span></p>
                        <p><strong className="text-navy">Testing Source:</strong> {item.source_name}</p>
                      </div>
                      <div className="mt-3 rounded-xl bg-red-50/70 p-3 text-xs text-red-900">
                        <strong>Reason / Lab Finding:</strong> {item.notes}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action guidance */}
                <div className="mt-6 rounded-2xl bg-red-900 p-4 text-xs font-medium text-white">
                  <p className="font-bold text-sm">Action Recommended:</p>
                  <p className="mt-1 leading-relaxed text-red-100">
                    Do not ingest or administer medicines from this batch. Return the strip/bottle to the issuing chemist
                    along with the invoice, or notify the State Drugs Control Department.
                  </p>
                </div>
              </div>
            ) : (
              /* OUTCOME B: NO MATCHING ALERT FOUND */
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs md:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-brand">
                    <Info className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      Query Checked: {result.batch_number} ({result.product_name})
                    </span>
                    <h2 className="mt-2 text-xl font-bold text-navy">
                      No matching alert found in imported CDSCO dataset
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Batch #{result.batch_number} does not appear in the {result.dataset_records} imported government
                      &ldquo;Not of Standard Quality&rdquo; (NSQ) alert records as of {result.last_updated}.
                    </p>
                  </div>
                </div>

                {/* MANDATORY SAFETY NOTICE (as per docs/ui_ux_guidelines.md Section 6 & docs/mvp_screens.md Screen 10) */}
                <div className="mt-6 rounded-2xl border border-amber-200/90 bg-amber-50/70 p-5 text-xs text-amber-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-950">Important Medical Safety Disclosure</h4>
                      <p className="mt-1 text-xs leading-relaxed text-amber-900 font-medium">
                        &ldquo;No matching alert found in the imported dataset. <strong>This is NOT a safety certificate or authenticity guarantee.</strong>&rdquo;
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-amber-800">
                        CDSCO only publishes alerts for batches that were actively sampled and tested in government laboratories.
                        An absence of records means no test failure notice is recorded in the imported dataset, but only laboratory chemical analysis can verify absolute medicine quality.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
