import {
  FileCheck,
  FileText,
  ImageIcon,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  ShoppingCart,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { extractPrescription, formatInr, searchConfirmed } from "../api/client";
import samplePrescriptionImg from "../assets/sample-prescription.jpg";
import { useLanguage } from "../i18n/LanguageContext";
import { useCart } from "../context/CartContext";
import type { ConfirmedSearchResult, ExtractedItem, ExtractionResponse } from "../types";

type EditableItem = {
  medicine_name: string;
  strength: string;
  dosage_form: string;
  raw_text: string;
  confidence: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

export function ScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, tr } = useLanguage();
  const { items: cartItems, addItem, removeItem } = useCart();
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationHandledRef = useRef(false);

  function addMatchedMedicine(res: ConfirmedSearchResult["results"][number], match: ConfirmedSearchResult["results"][number]["matches"][number]) {
    const medicine = match.medicine;
    const provider: "jan_aushadhi" | "dava_india" | "private_brand" =
      medicine.jan_aushadhi_price != null && (medicine.dava_india_price == null || medicine.jan_aushadhi_price <= medicine.dava_india_price)
        ? "jan_aushadhi"
        : medicine.dava_india_price != null ? "dava_india" : "private_brand";
    const price = provider === "jan_aushadhi" ? medicine.jan_aushadhi_price : provider === "dava_india" ? medicine.dava_india_price : medicine.private_brand_price;
    addItem({ medicine_id: medicine.id, brand_name: medicine.brand_name, active_salt: medicine.active_salt,
      dosage_form: medicine.dosage_form, selected_provider: provider, selected_price: price ?? null,
      private_brand_price: medicine.private_brand_price ?? null, quantity: 1, pack_info: medicine.dosage_form,
      prescribed_medicine_name: res.confirmed_input.medicine_name });
    setCartNotice("Added to cart");
    window.setTimeout(() => setCartNotice(null), 2200);
  }

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [results, setResults] = useState<ConfirmedSearchResult | null>(null);

  // File selection & validation
  const handleFile = useCallback((selectedFile: File) => {
    const ext = "." + selectedFile.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext) && !selectedFile.type.startsWith("image/") && selectedFile.type !== "application/pdf") {
      setError("Unsupported format. Please upload JPG, PNG, WEBP or PDF.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File is too large. Maximum allowed size is 10 MB.");
      return;
    }

    setError(null);
    setFile(selectedFile);
    setIsPdf(selectedFile.type === "application/pdf" || ext === ".pdf");

    setPreviewUrl((prev) => {
      if (prev && !prev.startsWith("/sample-")) {
        URL.revokeObjectURL(prev);
      }
      return selectedFile.type.startsWith("image/") ? URL.createObjectURL(selectedFile) : null;
    });
  }, []);

  // Handle incoming file from navigation state (e.g. from Home page upload / drop)
  useEffect(() => {
    if (locationHandledRef.current) return;
    const incomingFile = (location.state as { file?: File } | null)?.file;
    if (incomingFile && incomingFile instanceof File) {
      locationHandledRef.current = true;
      handleFile(incomingFile);
    }
  }, [location.state, handleFile]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      handleFile(selected);
    }
  }

  // Drag and drop handlers
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }

  // Remove file & return to empty state
  function handleRemove() {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setIsPdf(false);
    setError(null);
    setExtraction(null);
    setItems([]);
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Load sample prescription from screenshot
  function handleLoadSample() {
    setPreviewUrl(samplePrescriptionImg);
    setIsPdf(false);
    setError(null);
    fetch(samplePrescriptionImg)
      .then((res) => res.blob())
      .then((blob) => {
        setFile(new File([blob], "vijay_hospital_prescription.jpg", { type: "image/jpeg" }));
      })
      .catch(() => {
        // Preview is already active synchronously
      });
  }

  // Scan Prescription action
  async function handleScan() {
    if (!file && !previewUrl) {
      setError("Please choose or drag-and-drop a prescription first.");
      return;
    }

    setBusy(true);
    setError(null);
    setResults(null);

    try {
      let uploadFile = file;
      if (!uploadFile && previewUrl) {
        const res = await fetch(previewUrl);
        const blob = await res.blob();
        uploadFile = new File([blob], "prescription.jpg", { type: blob.type || "image/jpeg" });
      }

      if (!uploadFile) {
        throw new Error("No prescription file available to scan.");
      }

      // Real Gemini Vision + OCR extraction API call
      const data = await extractPrescription(uploadFile);
      setExtraction(data);
      const extractedList = (data.extraction?.items || []).map((item: ExtractedItem) => ({
        medicine_name: item.medicine_name ?? "",
        strength: item.strength ?? "",
        dosage_form: item.dosage_form ?? "",
        raw_text: item.raw_text,
        confidence: item.confidence,
      }));
      setItems(extractedList);
      if (extractedList.length === 0) {
        setError("No medicines could be clearly identified in this prescription. You can manually add medicines below.");
      } else {
        const payload = extractedList
          .filter((item) => item.medicine_name.trim())
          .map((item) => ({
            medicine_name: item.medicine_name.trim(),
            strength: item.strength.trim() || null,
            dosage_form: item.dosage_form.trim() || null,
          }));
        if (payload.length > 0) {
          try {
            const searchRes = await searchConfirmed(payload);
            setResults(searchRes);
          } catch {
            // Keep results null if automatic search encounters network error; user can retry with button
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Prescription scanning failed. Please try again or check connection.";
      setError(message);
      setExtraction(null);
      setItems([]);
    } finally {
      setBusy(false);
      setTimeout(() => {
        const target = document.getElementById("results-section") || document.getElementById("review-section");
        target?.scrollIntoView?.({ behavior: "smooth" });
      }, 150);
    }
  }

  // Search confirmed medicines
  async function handleSearchConfirmed(event: FormEvent) {
    event.preventDefault();
    const payload = items
      .filter((item) => item.medicine_name.trim())
      .map((item) => ({
        medicine_name: item.medicine_name.trim(),
        strength: item.strength.trim() || null,
        dosage_form: item.dosage_form.trim() || null,
      }));

    if (!payload.length) {
      setError("Please enter or confirm at least one medicine name.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const searchRes = await searchConfirmed(payload);
      setResults(searchRes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Catalogue search failed. Please try again.";
      setError(message);
      setResults(null);
    } finally {
      setBusy(false);
      setTimeout(() => {
        document.getElementById("results-section")?.scrollIntoView?.({ behavior: "smooth" });
      }, 150);
    }
  }

  // Add / remove items in the review list
  function handleAddItem() {
    setItems((prev) => [
      ...prev,
      {
        medicine_name: "",
        strength: "",
        dosage_form: "",
        raw_text: "Manual entry",
        confidence: "User entered",
      },
    ]);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <>
      <Helmet>
        <title>{tr("Scan Prescription — MedEasy", "पर्चा स्कैन करें — MedEasy")}</title>
        <meta
          name="description"
          content={tr(
            "Upload your prescription for AI-assisted medicine extraction and price comparison across Jan Aushadhi and generic options.",
            "AI सहायता से दवाइयों के नाम निकालने और जन औषधि जेनेरिक विकल्पों की तुलना के लिए अपना पर्चा अपलोड करें।"
          )}
        />
      </Helmet>
    <div className="min-h-[calc(100vh-76px)] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8fe_45%,#edf5ff_100%)]">
      <div className="mx-auto max-w-[1240px] px-5 py-6 md:px-8">
        {/* Hero Section */}
        <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-[620px]">
            {/* Top Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100/90 bg-[#eef5ff] px-3.5 py-1 text-[11px] font-bold tracking-[0.08em] text-brand">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              {t.eyebrow}
            </div>

            {/* Main Heading */}
            <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl lg:text-[46px] lg:leading-[1.1]">
              {tr("Scan Your", "अपना पर्चा")} <span className="text-brand">{tr("Prescription", "स्कैन करें")}</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-2.5 max-w-[540px] text-[15px] leading-relaxed text-slate-600">
              {tr(
                "Upload a clear photo of your prescription. We'll extract the medicines, dosage and key details for you to review.",
                "अपने पर्चे की स्पष्ट फोटो अपलोड करें। हम समीक्षा के लिए दवाइयों, खुराक और विवरण को पहचानेंगे।"
              )}
            </p>
          </div>

          {/* Right Hero Illustration (Rx sheet with subtle crosses) */}
          <div className="relative hidden w-[300px] items-center justify-end lg:flex" aria-hidden>
            {/* Soft background blue glow */}
            <div className="absolute right-4 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,#d7ebff_0%,#eef6ff_50%,rgba(255,255,255,0)_70%)]" />

            {/* Left medical cross (+) */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[#cbe2fe]">
              <div className="h-3.5 w-10 rounded-full bg-current" />
              <div className="absolute left-1/2 top-1/2 h-10 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
            </div>

            {/* Right medical cross (+) */}
            <div className="absolute right-2 top-6 text-[#d4e7fe]">
              <div className="h-3 w-8 rounded-full bg-current" />
              <div className="absolute left-1/2 top-1/2 h-8 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
            </div>

            {/* Stylized Rx Document */}
            <div className="relative z-10 w-[150px] rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_16px_36px_rgba(8,123,255,0.12)] rotate-[4deg]">
              <div className="mb-2.5">
                <span className="font-serif text-[24px] font-black tracking-tight text-brand leading-none">
                  Rx
                </span>
              </div>
              <div className="space-y-2">
                <div className="h-2 w-3/4 rounded-full bg-slate-200/80" />
                <div className="h-2 w-full rounded-full bg-slate-100" />
                <div className="h-2 w-5/6 rounded-full bg-slate-100" />
                <div className="h-2 w-2/3 rounded-full bg-slate-100" />
                <div className="h-2 w-4/5 rounded-full bg-slate-100" />
              </div>
            </div>

            {/* Script Text with Arrow */}
            <div className="absolute -bottom-4 right-0 z-20 flex flex-col items-end">
              <span className="rotate-[-8deg] font-semibold italic text-[12.5px] text-brand whitespace-nowrap">
                {tr("From prescription\nto better choices.", "पर्चे से लेकर\nबेहतर विकल्पों तक।")}
              </span>
              <svg className="mr-6 mt-1 h-6 w-6 text-brand" viewBox="0 0 32 32" fill="none">
                <path
                  d="M6 22 C14 24 22 18 24 8"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M18 8 L24 8 L24 14"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Error message banner */}
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-bold ml-3"
            >
              ×
            </button>
          </div>
        ) : null}

        {/* Main Content: Two-Column Layout */}
        <div className="mt-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
          {/* LEFT CARD: Upload Prescription */}
          <div className="flex flex-col justify-between rounded-[26px] border border-slate-100/90 bg-white p-6 shadow-[0_12px_32px_rgba(8,123,255,0.06)] sm:p-7">
            <div>
              {/* Heading */}
              <h2 className="text-[19px] font-bold text-navy">{tr("Upload Prescription", "पर्चा अपलोड करें")}</h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                {tr("Drag and drop your file here, or click to browse", "फ़ाइल यहां खींचें और छोड़ें, या चुनने के लिए क्लिक करें")}
              </p>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                  isDragging
                    ? "border-brand bg-[#eaf4ff] ring-4 ring-brand/10"
                    : "border-[#8bc0ff] bg-[#f9fcff] hover:border-brand hover:bg-[#f0f7ff]"
                }`}
              >
                {/* Cloud Upload Icon matching screenshot */}
                <div className="relative mb-2.5 flex h-14 w-14 items-center justify-center">
                  <svg
                    className="h-14 w-14 text-brand drop-shadow-[0_5px_12px_rgba(8,123,255,0.28)]"
                    viewBox="0 0 64 64"
                    fill="none"
                  >
                    <path
                      d="M48 24a14 14 0 0 0-26.6-4.5A16 16 0 0 0 10 34a16 16 0 0 0 16 16h24a14 14 0 0 0 0-28 14 14 0 0 0-2 2z"
                      fill="#087BFF"
                    />
                    <path
                      d="M32 25v17m0-17l-5.5 5.5M32 25l5.5 5.5"
                      stroke="white"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <p className="text-[14px] font-bold text-navy">
                  {tr("Click to upload", "अपलोड के लिए क्लिक करें")}{" "}
                  <span className="font-normal text-slate-600">{tr("or drag and drop", "या फ़ाइल यहां छोड़ें")}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">{tr("JPG, PNG, WEBP or PDF (max 10 MB)", "JPG, PNG, WEBP या PDF (अधिकतम 10 MB)")}</p>

                {/* Format Badges */}
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
                  {["JPG", "PNG", "WEBP", "PDF"].map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded-full border border-slate-200/90 bg-white px-3 py-0.5 text-[11px] font-semibold text-slate-600 shadow-2xs"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>

                {/* Uploaded file indicator if selected */}
                {file ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-0.5 text-[11.5px] font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <span className="text-[10px] text-emerald-600">
                      ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </div>
                ) : null}
              </div>

              {/* 4 Informational Blocks */}
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
                {/* Block 1 */}
                <div className="flex flex-col">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                    <ImageIcon className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <h4 className="text-[12.5px] font-bold text-navy">{tr("Clear image", "स्पष्ट फोटो")}</h4>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                    {tr("Make sure the text is readable", "लिखावट पढ़ने योग्य हो")}
                  </p>
                </div>

                {/* Block 2 */}
                <div className="flex flex-col">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                    <Sun className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <h4 className="text-[12.5px] font-bold text-navy">{tr("Good lighting", "अच्छा प्रकाश")}</h4>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                    {tr("Avoid shadows and glare", "छाया या चमक से बचें")}
                  </p>
                </div>

                {/* Block 3 */}
                <div className="flex flex-col">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                    <FileText className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <h4 className="text-[12.5px] font-bold text-navy">{tr("Include full page", "पूरा पर्चा")}</h4>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                    {tr("Capture the complete prescription", "पूरे पर्चे की फोटो लें")}
                  </p>
                </div>

                {/* Block 4 */}
                <div className="flex flex-col">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                    <FileCheck className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <h4 className="text-[12.5px] font-bold text-navy">{tr("Max 10 MB", "अधिकतम 10 MB")}</h4>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                    JPG, PNG, WEBP or PDF
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="mt-5 pt-1">
              <button
                type="button"
                onClick={handleScan}
                disabled={busy}
                className="flex h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-brand text-[14.5px] font-semibold text-white shadow-[0_8px_20px_rgba(8,123,255,0.28)] transition hover:bg-brand-dark disabled:opacity-60"
              >
                <ScanLine className="h-4.5 w-4.5" />
                <span>{busy ? tr("Analyzing your prescription...", "पर्चे का विश्लेषण हो रहा है...") : tr("Scan Prescription →", "पर्चा स्कैन करें →")}</span>
              </button>
            </div>
          </div>

          {/* RIGHT CARD: Uploaded Prescription */}
          <div className="flex flex-col justify-between rounded-[26px] border border-slate-100/90 bg-white p-6 shadow-[0_12px_32px_rgba(8,123,255,0.06)] sm:p-7">
            <div>
              {/* Header with Title & Remove Button */}
              <div className="flex items-center justify-between">
                <h2 className="text-[19px] font-bold text-navy">{tr("Uploaded Prescription", "अपलोड किया गया पर्चा")}</h2>
                {file || previewUrl ? (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>{tr("Remove", "हटाएं")}</span>
                  </button>
                ) : null}
              </div>

              {/* Preview Area */}
              <div className="my-4 flex min-h-[310px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-[#fbfdff] p-2">
                {previewUrl ? (
                  <div className="relative flex w-full items-center justify-center overflow-hidden rounded-xl">
                    <img
                      src={previewUrl}
                      alt="Uploaded Prescription Preview"
                      className="max-h-[300px] w-auto max-w-full rounded-xl object-contain shadow-xs"
                    />
                  </div>
                ) : isPdf ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-600 shadow-xs">
                      <FileText className="h-7 w-7" />
                    </div>
                    <p className="text-[14px] font-bold text-navy">{file?.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{tr("PDF Document ready to scan", "PDF दस्तावेज़ स्कैन के लिए तैयार")}</p>
                  </div>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-400 shadow-xs">
                      <FileText className="h-7 w-7 text-slate-400" />
                    </div>
                    <p className="text-[14.5px] font-bold text-navy">{tr("No prescription uploaded yet", "अभी कोई पर्चा अपलोड नहीं हुआ")}</p>
                    <p className="mt-1 max-w-[260px] text-xs text-slate-400">
                      {tr(
                        "Upload or drag & drop your prescription on the left to view the preview here.",
                        "पूर्वावलोकन देखने के लिए बाईं ओर पर्चा अपलोड करें।"
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-white px-4 py-1.5 text-xs font-semibold text-brand shadow-2xs transition hover:bg-sky/50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {tr("Try sample prescription", "सैंपल पर्चा आज़माएं")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Button */}
            <div className="mt-5 pt-1">
              <Link
                to="/medicines"
                className="flex h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-brand bg-white text-[14.5px] font-semibold text-brand transition hover:bg-sky/40"
              >
                <Search className="h-4.5 w-4.5" />
                <span>{tr("Go to Search Medicines →", "दवाइयां खोजें →")}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Loading state during scan */}
        {busy ? (
          <div className="mt-10 rounded-2xl border border-blue-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#eef5ff] text-brand animate-spin">
              <RotateCcw className="h-6 w-6" />
            </div>
            <p className="text-base font-bold text-navy">{tr("Analyzing your prescription...", "पर्चे का विश्लेषण हो रहा है...")}</p>
            <p className="mt-1 text-xs text-slate-500">
              Reading doctor&apos;s handwriting, medicine names and dosage schedules.
            </p>
          </div>
        ) : null}

        {/* Extracted Medicines Review Section */}
        {extraction ? (
          <div
            id="review-section"
            className="mt-12 rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_12px_32px_rgba(8,123,255,0.06)] sm:p-8"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {tr("Extracted from Prescription", "पर्चे से निकाली गई दवाइयां")}
                </span>
                <h3 className="mt-2 text-2xl font-bold text-navy">{tr("Review Extracted Medicines", "निकाली गई दवाइयों की समीक्षा करें")}</h3>
                <p className="text-sm text-slate-500">
                  {tr("Verify or edit names and strengths before searching catalogue matches.", "कैटलॉग में खोजने से पहले नाम और मात्रा की पुष्टि या संपादन करें।")}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-navy shadow-xs transition hover:border-brand hover:text-brand sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                {tr("Add medicine", "दवाई जोड़ें")}
              </button>
            </div>

            {/* Extracted hospital/doctor context if present */}
            {extraction.extraction.other_text.length ? (
              <div className="mt-4 rounded-xl border border-slate-100 bg-[#f8fafc] p-3.5 text-xs text-slate-600">
                <span className="font-bold text-navy">{tr("Prescription Details:", "पर्चे का विवरण:")} </span>
                {extraction.extraction.other_text.join(" · ")}
              </div>
            ) : null}

            {/* Editable Medicines List */}
            <form onSubmit={handleSearchConfirmed} className="mt-6 space-y-3.5">
              {items.map((item, index) => (
                <div
                  key={`${item.raw_text}-${index}`}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                    <span className="font-medium">
                      {tr("Raw script:", "पर्चे का मूल पाठ:")} <span className="font-bold text-navy">{item.raw_text || "—"}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        {tr("Confidence:", "सटीकता:")} {item.confidence || "Good"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-slate-400 hover:text-red-600"
                        title={tr("Delete item", "हटाएं")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold text-navy">{tr("Medicine Name", "दवाई का नाम")}</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-navy focus:border-brand focus:outline-none"
                        value={item.medicine_name}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, medicine_name: e.target.value };
                          setItems(next);
                        }}
                        placeholder={tr("e.g. Paracetamol", "उदा. पैरासिटामोल")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-navy">{tr("Strength / Composition", "मात्रा / सामग्री")}</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand focus:outline-none"
                        value={item.strength}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, strength: e.target.value };
                          setItems(next);
                        }}
                        placeholder={tr("e.g. 500 mg", "उदा. 500 mg")}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-navy">{tr("Dosage Form", "खुराक का प्रकार")}</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand focus:outline-none"
                        value={item.dosage_form}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, dosage_form: e.target.value };
                          setItems(next);
                        }}
                        placeholder={tr("e.g. Tablet", "उदा. टैबलेट")}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold text-white shadow-[0_8px_20px_rgba(8,123,255,0.28)] transition hover:bg-brand-dark disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  <span>{tr("Search Confirmed Medicines →", "पुष्टीकृत दवाइयां खोजें →")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs font-semibold text-slate-500 hover:text-navy"
                >
                  {tr("Reset / Scan Another", "रीसेट / दूसरा पर्चा स्कैन करें")}
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* Catalogue Matches Results Section */}
        {results ? (
          <div
            id="results-section"
            className="mt-10 rounded-[28px] border border-slate-100 bg-white p-6 shadow-[0_12px_32px_rgba(8,123,255,0.06)] sm:p-8"
          >
            <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-2xl font-bold text-navy">{tr("Available Generic Matches", "उपलब्ध जेनेरिक विकल्प")}</h3>
                <p className="text-sm text-slate-500">{results.note}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/medicines")}
                className="text-xs font-bold text-brand hover:underline"
              >
                {tr("Browse all medicines →", "सभी दवाइयां देखें →")}
              </button>
            </div>

            {results.results.some((result) => result.match_status === "Exact Match" && result.matches.length > 0) && (
              <button type="button" onClick={() => results.results.filter((result) => result.match_status === "Exact Match").forEach((result) => result.matches.slice(0, 1).forEach((match) => addMatchedMedicine(result, match)))}
                className="mt-4 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                {tr("Add All Matched Medicines", "सभी मिलान वाली दवाइयां जोड़ें")}
              </button>
            )}
            {cartNotice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{cartNotice}</p>}

            <div className="mt-6 space-y-6">
              {results.results.map((res) => (
                <div
                  key={res.confirmed_input.medicine_name}
                  className="rounded-2xl border border-slate-200/90 p-5 bg-[#fafcff]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {tr("Prescribed", "पर्चे में लिखी दवा")}
                      </span>
                      <p className="text-lg font-bold text-navy">
                        {res.confirmed_input.medicine_name}{" "}
                        <span className="text-sm font-normal text-slate-500">
                          {res.confirmed_input.strength}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          res.match_status === "Exact Match" ||
                          (!res.match_status && res.match_count > 0 && res.match_type !== "suggested_candidate" && res.match_type !== "strength_variant")
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : res.match_status === "Possible Match — Needs Review" ||
                              res.match_type === "suggested_candidate" ||
                              res.match_type === "strength_variant"
                            ? "bg-amber-50 border border-amber-200 text-amber-800"
                            : "bg-slate-100 border border-slate-200 text-slate-700"
                        }`}
                      >
                        {res.match_status === "Exact Match" ||
                        (!res.match_status && res.match_count > 0 && res.match_type !== "suggested_candidate" && res.match_type !== "strength_variant")
                          ? tr("✓ Exact Match", "✓ सटीक मिलान")
                          : res.match_status === "Possible Match — Needs Review" ||
                            res.match_type === "suggested_candidate" ||
                            res.match_type === "strength_variant"
                          ? tr("⚠ Possible Match — Needs Review", "⚠ संभावित मिलान — समीक्षा आवश्यक")
                          : tr("✕ No Match Found", "✕ कोई मिलान नहीं")}
                      </span>
                      <span className="rounded-full bg-sky px-3 py-1 text-xs font-bold text-brand">
                        {res.match_count} {tr("match(es) found", "विकल्प मिले")}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">{res.review_note}</p>

                  {res.matches.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs font-semibold text-amber-800">
                      {tr("No verified catalogue match found.", "कैटलॉग में कोई सत्यापित मिलान नहीं मिला।")}
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {res.matches.map((match) => (
                        <div key={`${res.confirmed_input.medicine_name}-${match.medicine.id}`} className="flex flex-col justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-bold text-brand">{tr("Generic Option", "जेनेरिक विकल्प")}</span>
                                {match.medicine.dosage_form ? (
                                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                    {match.medicine.dosage_form}
                                  </span>
                                ) : null}
                                {match.match_type ? (
                                  <span
                                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                      match.match_type === "strength_variant" || match.match_type === "suggested_candidate"
                                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                                        : "bg-blue-50 text-brand"
                                    }`}
                                  >
                                    {match.match_type === "exact_brand"
                                      ? tr("Exact Brand", "सटीक ब्रांड")
                                      : match.match_type === "exact_alias"
                                      ? tr("Verified Alias", "सत्यापित उपनाम")
                                      : match.match_type === "exact_composition"
                                      ? tr("Composition Match", "सामग्री मिलान")
                                      : match.match_type === "strength_variant"
                                      ? tr("Strength Variant", "खुराक भिन्नता")
                                      : match.match_type === "suggested_candidate"
                                      ? tr("Suggested Candidate", "सुझाया गया विकल्प")
                                      : tr("Possible Match", "संभावित मिलान")}
                                    {match.match_confidence ? ` (${Math.round(match.match_confidence * 100)}%)` : ""}
                                  </span>
                                ) : null}
                              </div>
                              {match.recommended_option?.savings_percent ? (
                                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  {match.recommended_option.savings_percent}% {tr("Cheaper", "सस्ता")}
                                </span>
                              ) : null}
                            </div>
                            <Link to={`/medicines/${match.medicine.id}`} className="mt-1 block text-base font-bold text-navy hover:text-brand">{match.medicine.brand_name}</Link>
                            <p className="text-xs text-slate-500">{match.medicine.active_salt}</p>

                            {/* Safety Notice Banner for suggested candidates or strength variants */}
                            {match.match_type === "strength_variant" ? (
                              <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-[11px] leading-relaxed text-amber-900">
                                <span className="font-bold">⚠️ {tr("Dosage Warning:", "खुराक चेतावनी:")} </span>
                                {tr(
                                  "Catalogue formulation strength differs from prescription. Verify exact dosage with your doctor before substitution.",
                                  "कैटलॉग खुराक पर्चे से भिन्न है। प्रतिस्थापन से पहले डॉक्टर से सत्यापित करें।"
                                )}
                              </div>
                            ) : match.match_type === "suggested_candidate" ? (
                              <div className="mt-2.5 rounded-lg border border-blue-200 bg-blue-50/80 p-2 text-[11px] leading-relaxed text-blue-900">
                                <span className="font-bold">ℹ️ {tr("Visual Match:", "दृश्य मिलान:")} </span>
                                {tr(
                                  "Suggested candidate based on handwriting/name similarity. Verify active salt with pharmacist.",
                                  "दवा के नाम की समानता पर आधारित सुझाव। फार्मासिस्ट से सत्यापित करें।"
                                )}
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <div>
                              <span className="block text-[10px] text-slate-400">{tr("Jan Aushadhi Price", "जन औषधि मूल्य")}</span>
                              <span className="text-lg font-extrabold text-emerald-600">
                                {match.medicine.jan_aushadhi_price != null ? formatInr(match.medicine.jan_aushadhi_price) : tr("Not available", "उपलब्ध नहीं")}
                              </span>
                            </div>
                            {match.medicine.dava_india_price != null ? (
                              <div>
                                <span className="block text-[10px] text-slate-400">{tr("Dava India", "दवा इंडिया")}</span>
                                <span className="text-sm font-bold text-slate-700">
                                  {formatInr(match.medicine.dava_india_price)}
                                </span>
                              </div>
                            ) : null}
                            <div className="text-right">
                              <span className="block text-[10px] text-slate-400">{tr("Market MRP", "बाजार MRP")}</span>
                              <span className="text-sm font-semibold text-slate-400 line-through">
                                {match.medicine.private_brand_price != null ? formatInr(match.medicine.private_brand_price) : tr("Not available", "उपलब्ध नहीं")}
                              </span>
                            </div>
                          </div>
                          {(() => {
                            const cartItem = cartItems.find((item) => item.medicine_id === match.medicine.id);
                            const needsReview = res.match_status === "Possible Match — Needs Review" || match.match_type === "suggested_candidate" || match.match_type === "strength_variant";
                            return cartItem ? (
                              <div className="mt-4 flex items-center justify-between">
                                <span className="text-sm font-bold text-emerald-700">Added ✓</span>
                                <button type="button" onClick={() => removeItem(cartItem.id)} className="text-sm font-semibold text-red-600 hover:underline">{tr("Remove", "हटाएं")}</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => {
                                if (needsReview && !window.confirm("This is a suggested match, not a confirmed equivalent. Confirm you want to add it?")) return;
                                addMatchedMedicine(res, match);
                              }} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-600">
                                <ShoppingCart className="h-4 w-4" />{tr("Add to Cart", "कार्ट में जोड़ें")}
                              </button>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
    </>
  );
}
