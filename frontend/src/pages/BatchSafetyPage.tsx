import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Camera, FileImage, LoaderCircle, ShieldAlert, ShieldCheck, Trash2, UploadCloud, XCircle } from "lucide-react";
import { extractBatchDetails, getBatchDatasetInfo, verifyBatchDetails, type BatchExtraction, type BatchVerification } from "../api/client";

const fields: Array<[keyof BatchExtraction, string]> = [
  ["medicine_name", "Medicine name"], ["strength", "Strength"], ["dosage_form", "Dosage form"],
  ["batch_number", "Batch number"], ["manufacturer", "Manufacturer"], ["manufacturing_date", "Manufacturing date"],
  ["expiry_date", "Expiry date"], ["mrp", "MRP"],
];
const accepted = ".jpg,.jpeg,.png,.webp,.pdf";

export function BatchSafetyPage() {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [extraction, setExtraction] = useState<BatchExtraction | null>(null);
  const [dataset, setDataset] = useState<Record<string, unknown> | null>(null);
  const [result, setResult] = useState<BatchVerification | null>(null);
  const [stage, setStage] = useState<"idle" | "extract" | "verify">("idle");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  useEffect(() => { getBatchDatasetInfo().then(setDataset).catch(() => setDataset(null)); }, []);
  useEffect(() => {
    const urls = files.map((file) => file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
    setPreviews(urls);
    return () => urls.forEach((url) => url && URL.revokeObjectURL(url));
  }, [files]);
  function addFiles(list: FileList | File[]) {
    const valid = Array.from(list).filter((file) => /\.(jpe?g|png|webp|pdf)$/i.test(file.name) && file.size <= 10 * 1024 * 1024);
    if (valid.length !== list.length) setError("Use JPG, PNG, WEBP or PDF files up to 10 MB each.");
    setFiles((old) => [...old, ...valid].slice(0, 5)); setExtraction(null); setResult(null);
  }
  function update(key: keyof BatchExtraction, value: string) { if (extraction) setExtraction({ ...extraction, [key]: value || null }); }
  async function extract() {
    if (!files.length || stage !== "idle") return;
    setStage("extract"); setError(""); setResult(null);
    try { setExtraction(await extractBatchDetails(files)); } catch (e) { setError(e instanceof Error ? e.message : "Extraction failed. Please retry."); }
    finally { setStage("idle"); }
  }
  async function verify() {
    if (!extraction || stage !== "idle") return;
    if (!extraction.batch_number?.trim()) { setError("Enter the batch number from the packaging before verification."); return; }
    setStage("verify"); setError("");
    try { setResult(await verifyBatchDetails({ medicine_name: extraction.medicine_name || undefined, batch_number: extraction.batch_number, manufacturer: extraction.manufacturer || undefined })); }
    catch (e) { setError(e instanceof Error ? e.message : "Verification failed. Please retry."); }
    finally { setStage("idle"); }
  }
  return <>
    <Helmet><title>Batch Safety Verification — MedEasy</title><meta name="description" content="Check a medicine batch against loaded CDSCO NSQ alert records." /></Helmet>
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-2 text-sm font-bold uppercase tracking-wider text-blue-700">MedEasy · Batch check</p><h1 className="text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">Batch Safety Verification</h1><p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">Upload your medicine packaging to check whether its batch appears in official CDSCO NSQ alerts.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"><div className="flex items-center gap-2 font-bold text-navy"><span className={`h-2 w-2 rounded-full ${dataset?.ready ? "bg-emerald-500" : "bg-amber-400"}`} />CDSCO Monthly NSQ Dataset</div><p className="mt-1 text-slate-500">{dataset ? `${String(dataset.records_loaded ?? 0)} records · Updated ${String(dataset.last_update_date ?? "date unavailable")}` : "Dataset status unavailable"}</p></div>
      </header>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-5"><h2 className="text-xl font-bold">Add medicine packaging photos</h2><p className="mt-1 text-sm text-slate-500">Include the front and the side showing batch details for clearer extraction.</p></div>
        <input ref={input} className="hidden" type="file" accept={accepted} multiple capture="environment" onChange={(e) => e.target.files && addFiles(e.target.files)} />
        <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }} onClick={() => input.current?.click()} className={`cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition sm:p-12 ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"}`}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><UploadCloud className="h-7 w-7" /></div><h3 className="mt-4 text-lg font-bold">Drop photos or browse files</h3><p className="mt-1 text-sm text-slate-500">Medicine strip, box or package · JPG, JPEG, PNG, WEBP, PDF · Up to 10 MB each</p><span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white"><Camera className="h-4 w-4" />Choose photos</span>
        </div>
        {files.length > 0 && <div className="mt-5 grid gap-3 sm:grid-cols-2">{files.map((file, i) => <div key={`${file.name}-${i}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">{previews[i] ? <img src={previews[i]} alt={`Packaging ${i + 1}`} className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100"><FileImage /></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p></div><button aria-label={`Remove ${file.name}`} onClick={(e) => { e.stopPropagation(); setFiles((old) => old.filter((_, idx) => idx !== i)); }} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>)}</div>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
        <button onClick={extract} disabled={!files.length || stage !== "idle"} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-6 py-4 font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{stage === "extract" ? <><LoaderCircle className="h-5 w-5 animate-spin" />OCR and Gemini Vision processing…</> : "Extract Medicine Details"}</button>
        {stage === "extract" && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" /></div><p className="mt-2 text-sm text-slate-500">Validating files → preprocessing → OCR → Gemini Vision</p></div>}
      </section>
      {extraction && <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Review extracted details</h2><p className="mt-1 text-sm text-slate-500">Check each value against your packaging and correct anything unclear.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{extraction.extraction_status === "complete" ? "Review recommended" : "Review required"}</span></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(([key,label]) => <label key={key} className="block text-sm font-semibold text-slate-700">{label}{key === "batch_number" && !extraction.batch_number && <span className="ml-2 text-amber-700">Please enter this from the package</span>}<input value={String(extraction[key] ?? "")} onChange={(e) => update(key,e.target.value)} className={`mt-1.5 w-full rounded-xl border px-3 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${key === "batch_number" && !extraction.batch_number ? "border-amber-400 bg-amber-50" : "border-slate-200"}`} />{["medicine_name","batch_number","manufacturer","expiry_date"].includes(key) && <span className="mt-1 block text-xs text-slate-500">Confidence: {extraction.field_confidence[key] == null ? "not available" : `${Math.round(extraction.field_confidence[key]! * 100)}%`}</span>}</label>)}</div>
        {extraction.warnings.length > 0 && <ul className="mt-4 space-y-1 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{extraction.warnings.map((w,i) => <li key={i}>• {w}</li>)}</ul>}
        <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold text-slate-600">View OCR text</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{extraction.raw_ocr_text || "No local OCR text was available."}</pre></details>
        <button onClick={verify} disabled={stage !== "idle"} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-navy px-6 py-3.5 font-bold text-white hover:bg-navy-soft disabled:opacity-50">{stage === "verify" ? <><LoaderCircle className="h-5 w-5 animate-spin" />Matching batch…</> : "Verify Against CDSCO Database"}</button>
      </section>}
      {result && <section aria-live="polite" className={`mt-7 rounded-3xl border-2 p-5 sm:p-8 ${result.status === "MATCH_FOUND" ? "border-red-300 bg-red-50" : result.status === "NO_MATCH" ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <div className="flex items-start gap-3">{result.status === "MATCH_FOUND" ? <ShieldAlert className="h-7 w-7 shrink-0 text-red-700" /> : result.status === "NO_MATCH" ? <ShieldCheck className="h-7 w-7 shrink-0 text-emerald-700" /> : <XCircle className="h-7 w-7 shrink-0 text-amber-700" />}<div><h2 className="text-xl font-extrabold">{result.status === "MATCH_FOUND" ? "NSQ ALERT MATCH FOUND" : result.status === "NO_MATCH" ? "NO MATCH IN LOADED DATASET" : "MANUAL REVIEW REQUIRED"}</h2><p className="mt-2 text-sm leading-6">{result.explanation}</p>{result.match_type && <p className="mt-2 text-sm font-semibold">Match: {result.match_type.replaceAll("_"," ")}</p>}</div></div>
        {result.records.map((record,i) => <article key={String(record.alert_id ?? i)} className="mt-5 rounded-2xl border border-black/10 bg-white p-4"><h3 className="font-bold">{String(record.product_name ?? "CDSCO record")}</h3><dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{(["batch_number","manufacturer","notice_month","nsq_result","reported_by","source_pdf"] as const).map((key) => <div key={key}><dt className="text-xs font-semibold uppercase text-slate-500">{key.replaceAll("_"," ")}</dt><dd className="mt-0.5 break-words text-slate-800">{String(record[key] ?? "—")}</dd></div>)}</dl></article>)}
      </section>}
      <p className="mt-6 text-center text-xs leading-5 text-slate-500">A missing record in this dataset does not prove that a medicine is safe, authentic, approved, or free from defects.</p>
    </div>
  </>;
}
