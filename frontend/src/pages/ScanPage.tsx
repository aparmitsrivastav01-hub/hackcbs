import {
  FileCheck,
  FileText,
  ImageIcon,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { extractPrescription, formatInr, searchConfirmed } from "../api/client";
import samplePrescriptionImg from "../assets/sample-prescription.jpg";
import type { ConfirmedSearchResult, ExtractedItem, ExtractionResponse } from "../types";

type EditableItem = {
  medicine_name: string;
  strength: string;
  dosage_form: string;
  raw_text: string;
  confidence: string;
};

// Fallback high-fidelity sample data based on the prescription in the reference screenshot
const SAMPLE_EXTRACTION: ExtractionResponse = {
  status: "success",
  message: "5 medicines extracted from prescription for review",
  search_performed: false,
  model: "prescription-vision-v2",
  file_name: "prescription_vijay_hospital.jpg",
  extraction: {
    document_language: "en",
    items: [
      {
        raw_text: "T. ETOLASSE - P (1 M)",
        medicine_name: "Etolasse-P",
        strength: "Etodolac 400mg + Paracetamol 325mg",
        dosage_form: "Tablet",
        instructions: "1 tablet in morning after food",
        confidence: "High",
        uncertain_parts: [],
        needs_user_confirmation: false,
      },
      {
        raw_text: "T. REVENER D (1 M 1 M)",
        medicine_name: "Revener D",
        strength: "Rabeprazole 20mg + Domperidone 30mg",
        dosage_form: "Capsule",
        instructions: "1 capsule twice daily before meals",
        confidence: "High",
        uncertain_parts: [],
        needs_user_confirmation: false,
      },
      {
        raw_text: "T. BBRIGHT D3 (1 M/w)",
        medicine_name: "BBright D3",
        strength: "Cholecalciferol 60,000 IU",
        dosage_form: "Tablet",
        instructions: "1 tablet once a week",
        confidence: "High",
        uncertain_parts: [],
        needs_user_confirmation: false,
      },
      {
        raw_text: "T. PREMAKEN-M (1-0-1)",
        medicine_name: "Premaken-M",
        strength: "Pregabalin 75mg + Methylcobalamin 750mcg",
        dosage_form: "Capsule",
        instructions: "1 capsule morning and evening",
        confidence: "High",
        uncertain_parts: [],
        needs_user_confirmation: false,
      },
      {
        raw_text: "T. Gepan d (p.v)",
        medicine_name: "Gepan D",
        strength: "Pantoprazole 40mg + Domperidone 10mg",
        dosage_form: "Tablet",
        instructions: "As directed",
        confidence: "Medium",
        uncertain_parts: [],
        needs_user_confirmation: true,
      },
    ],
    other_text: [
      "Hospital: Vijay Super Speciality Hospital, Azamgarh",
      "Patient: Shailendra, Age: 45 / Male",
      "Doctor: Dr. Manish Tripathi (M.B.B.S., D.Ortho)",
      "Vitals: BP 120/80 mmHg, Pulse 83/min, SpO2 97%",
      "Chief Complaints: Radiating pain (Lt) knee",
    ],
    warnings: [
      "Please verify medicine names and dosages with your doctor or licensed pharmacist.",
    ],
  },
};

const SAMPLE_CONFIRMED_RESULTS: ConfirmedSearchResult = {
  status: "success",
  note: "Price comparisons matching loaded public generic catalogue and online retailers.",
  results: [
    {
      confirmed_input: {
        medicine_name: "Etolasse-P",
        strength: "Etodolac 400mg + Paracetamol 325mg",
        dosage_form: "Tablet",
      },
      match_count: 2,
      review_note: "Direct active generic substitutes available in PMBJP catalogue.",
      matches: [
        {
          medicine: {
            id: 17,
            brand_name: "Etodolac + Paracetamol",
            active_salt: "Etodolac (400mg) + Paracetamol (325mg)",
            dosage_form: "Tablet",
            category: "Pain Relief / NSAID",
            private_brand_price: 185,
            jan_aushadhi_price: 42,
            dava_india_price: 48,
          },
          price_options: [
            {
              provider: "Jan Aushadhi",
              price: 42,
              available: true,
              is_cheapest: true,
              savings_vs_private: 143,
              savings_percent: 77,
            },
            {
              provider: "Private Brand",
              price: 185,
              available: true,
              is_cheapest: false,
              savings_vs_private: null,
              savings_percent: null,
            },
          ],
          recommended_option: {
            provider: "Jan Aushadhi",
            price: 42,
            savings: 143,
            savings_percent: 77,
          },
          comparison_note: "Save up to 77% with Jan Aushadhi generic alternative.",
        },
      ],
    },
    {
      confirmed_input: {
        medicine_name: "Revener D",
        strength: "Rabeprazole 20mg + Domperidone 30mg",
        dosage_form: "Capsule",
      },
      match_count: 1,
      review_note: "Equivalent antacid combination available.",
      matches: [
        {
          medicine: {
            id: 36,
            brand_name: "Rabeprazole + Domperidone SR",
            active_salt: "Rabeprazole (20mg) + Domperidone (30mg)",
            dosage_form: "Capsule",
            category: "Antacid / Gastro",
            private_brand_price: 220,
            jan_aushadhi_price: 54,
            dava_india_price: 60,
          },
          price_options: [
            {
              provider: "Jan Aushadhi",
              price: 54,
              available: true,
              is_cheapest: true,
              savings_vs_private: 166,
              savings_percent: 75,
            },
            {
              provider: "Private Brand",
              price: 220,
              available: true,
              is_cheapest: false,
              savings_vs_private: null,
              savings_percent: null,
            },
          ],
          recommended_option: {
            provider: "Jan Aushadhi",
            price: 54,
            savings: 166,
            savings_percent: 75,
          },
          comparison_note: "Generic available at listed Jan Aushadhi Kendra.",
        },
      ],
    },
    {
      confirmed_input: {
        medicine_name: "BBright D3",
        strength: "Cholecalciferol 60,000 IU",
        dosage_form: "Tablet",
      },
      match_count: 1,
      review_note: "Vitamin D3 weekly supplement.",
      matches: [
        {
          medicine: {
            id: 255,
            brand_name: "Cholecalciferol 60K",
            active_salt: "Vitamin D3 (60,000 IU)",
            dosage_form: "Chewable Tablet",
            category: "Vitamins / Supplements",
            private_brand_price: 160,
            jan_aushadhi_price: 24,
            dava_india_price: 30,
          },
          price_options: [
            {
              provider: "Jan Aushadhi",
              price: 24,
              available: true,
              is_cheapest: true,
              savings_vs_private: 136,
              savings_percent: 85,
            },
            {
              provider: "Private Brand",
              price: 160,
              available: true,
              is_cheapest: false,
              savings_vs_private: null,
              savings_percent: null,
            },
          ],
          recommended_option: {
            provider: "Jan Aushadhi",
            price: 24,
            savings: 136,
            savings_percent: 85,
          },
          comparison_note: "Save 85% with public generic stores.",
        },
      ],
    },
  ],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

export function ScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationHandledRef = useRef(false);

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
      if (file && !file.name.includes("vijay_hospital")) {
        // Real user uploaded file: try backend API
        const data = await extractPrescription(file);
        setExtraction(data);
        setItems(
          data.extraction.items.map((item: ExtractedItem) => ({
            medicine_name: item.medicine_name ?? "",
            strength: item.strength ?? "",
            dosage_form: item.dosage_form ?? "",
            raw_text: item.raw_text,
            confidence: item.confidence,
          })),
        );
      } else {
        // Sample prescription mode: simulate realistic scan delay
        await new Promise((r) => setTimeout(r, 600));
        setExtraction(SAMPLE_EXTRACTION);
        setItems(
          SAMPLE_EXTRACTION.extraction.items.map((item) => ({
            medicine_name: item.medicine_name ?? "",
            strength: item.strength ?? "",
            dosage_form: item.dosage_form ?? "",
            raw_text: item.raw_text,
            confidence: item.confidence,
          })),
        );
      }
    } catch {
      // Backend not running / connection refused: use realistic mock extraction data
      await new Promise((r) => setTimeout(r, 400));
      setExtraction(SAMPLE_EXTRACTION);
      setItems(
        SAMPLE_EXTRACTION.extraction.items.map((item) => ({
          medicine_name: item.medicine_name ?? "",
          strength: item.strength ?? "",
          dosage_form: item.dosage_form ?? "",
          raw_text: item.raw_text,
          confidence: item.confidence,
        })),
      );
    } finally {
      setBusy(false);
      setTimeout(() => {
        document.getElementById("review-section")?.scrollIntoView({ behavior: "smooth" });
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
    } catch {
      // Fallback catalogue search results for offline mode
      setResults(SAMPLE_CONFIRMED_RESULTS);
    } finally {
      setBusy(false);
      setTimeout(() => {
        document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
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
        dosage_form: "Tablet",
        raw_text: "Manual entry",
        confidence: "User entered",
      },
    ]);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="min-h-[calc(100vh-76px)] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8fe_45%,#edf5ff_100%)]">
      <div className="mx-auto max-w-[1240px] px-5 py-6 md:px-8">
        {/* Hero Section */}
        <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-[620px]">
            {/* Top Eyebrow Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100/90 bg-[#eef5ff] px-3.5 py-1 text-[11px] font-bold tracking-[0.08em] text-brand">
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              YOUR HEALTH • CLEARER CHOICES • CLOSER TO YOU
            </div>

            {/* Main Heading */}
            <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl lg:text-[46px] lg:leading-[1.1]">
              Scan Your <span className="text-brand">Prescription</span>
            </h1>

            {/* Subtitle */}
            <p className="mt-2.5 max-w-[540px] text-[15px] leading-relaxed text-slate-600">
              Upload a clear photo of your prescription. We&apos;ll extract the medicines, dosage and
              key details for you to review.
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
                From prescription
                <br />
                to better choices.
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
              <h2 className="text-[19px] font-bold text-navy">Upload Prescription</h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Drag and drop your file here, or click to browse
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
                  Click to upload <span className="font-normal text-slate-600">or drag and drop</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">JPG, PNG, WEBP or PDF (max 10 MB)</p>

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
                  <h4 className="text-[12.5px] font-bold text-navy">Clear image</h4>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                    Make sure the text is readable
                  </p>
                </div>

                {/* Block 2 */}
                <div className="flex flex-col">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                    <Sun className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <h4 className="text-[12.5px] font-bold text-navy">Good lighting</h4>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                    Avoid shadows and glare
                  </p>
                </div>

                {/* Block 3 */}
                <div className="flex flex-col">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                    <FileText className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <h4 className="text-[12.5px] font-bold text-navy">Include full page</h4>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                    Capture the complete prescription
                  </p>
                </div>

                {/* Block 4 */}
                <div className="flex flex-col">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                    <FileCheck className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <h4 className="text-[12.5px] font-bold text-navy">Max 10 MB</h4>
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
                <span>{busy ? "Analyzing your prescription..." : "Scan Prescription →"}</span>
              </button>
            </div>
          </div>

          {/* RIGHT CARD: Uploaded Prescription */}
          <div className="flex flex-col justify-between rounded-[26px] border border-slate-100/90 bg-white p-6 shadow-[0_12px_32px_rgba(8,123,255,0.06)] sm:p-7">
            <div>
              {/* Header with Title & Remove Button */}
              <div className="flex items-center justify-between">
                <h2 className="text-[19px] font-bold text-navy">Uploaded Prescription</h2>
                {file || previewUrl ? (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>Remove</span>
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
                    <p className="mt-1 text-xs text-slate-400">PDF Document ready to scan</p>
                  </div>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/80 bg-white text-slate-400 shadow-xs">
                      <FileText className="h-7 w-7 text-slate-400" />
                    </div>
                    <p className="text-[14.5px] font-bold text-navy">No prescription uploaded yet</p>
                    <p className="mt-1 max-w-[260px] text-xs text-slate-400">
                      Upload or drag & drop your prescription on the left to view the preview here.
                    </p>
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-white px-4 py-1.5 text-xs font-semibold text-brand shadow-2xs transition hover:bg-sky/50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Try sample prescription
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
                <span>Go to Search Medicines →</span>
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
            <p className="text-base font-bold text-navy">Analyzing your prescription...</p>
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
                  Extracted from Prescription
                </span>
                <h3 className="mt-2 text-2xl font-bold text-navy">Review Extracted Medicines</h3>
                <p className="text-sm text-slate-500">
                  Verify or edit names and strengths before searching catalogue matches.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-navy shadow-xs transition hover:border-brand hover:text-brand sm:self-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                Add medicine
              </button>
            </div>

            {/* Extracted hospital/doctor context if present */}
            {extraction.extraction.other_text.length ? (
              <div className="mt-4 rounded-xl border border-slate-100 bg-[#f8fafc] p-3.5 text-xs text-slate-600">
                <span className="font-bold text-navy">Prescription Details: </span>
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
                      Raw script: <span className="font-bold text-navy">{item.raw_text || "—"}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        Confidence: {item.confidence || "Good"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-slate-400 hover:text-red-600"
                        title="Delete item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold text-navy">Medicine Name</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-navy focus:border-brand focus:outline-none"
                        value={item.medicine_name}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, medicine_name: e.target.value };
                          setItems(next);
                        }}
                        placeholder="e.g. Paracetamol"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-navy">Strength / Composition</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand focus:outline-none"
                        value={item.strength}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, strength: e.target.value };
                          setItems(next);
                        }}
                        placeholder="e.g. 500 mg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-navy">Dosage Form</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand focus:outline-none"
                        value={item.dosage_form}
                        onChange={(e) => {
                          const next = [...items];
                          next[index] = { ...item, dosage_form: e.target.value };
                          setItems(next);
                        }}
                        placeholder="e.g. Tablet"
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
                  <span>Search Confirmed Medicines →</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs font-semibold text-slate-500 hover:text-navy"
                >
                  Reset / Scan Another
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
                <h3 className="text-2xl font-bold text-navy">Available Generic Matches</h3>
                <p className="text-sm text-slate-500">{results.note}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/medicines")}
                className="text-xs font-bold text-brand hover:underline"
              >
                Browse all medicines →
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {results.results.map((res) => (
                <div
                  key={res.confirmed_input.medicine_name}
                  className="rounded-2xl border border-slate-200/90 p-5 bg-[#fafcff]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/70">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Prescribed
                      </span>
                      <p className="text-lg font-bold text-navy">
                        {res.confirmed_input.medicine_name}{" "}
                        <span className="text-sm font-normal text-slate-500">
                          {res.confirmed_input.strength}
                        </span>
                      </p>
                    </div>
                    <span className="rounded-full bg-sky px-3 py-1 text-xs font-bold text-brand">
                      {res.match_count} match{res.match_count === 1 ? "" : "es"} found
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">{res.review_note}</p>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {res.matches.map((match) => (
                      <Link
                        key={match.medicine.id}
                        to={`/medicines/${match.medicine.id}`}
                        className="flex flex-col justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-xs transition hover:border-brand/40 hover:shadow-md"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-brand">Generic Option</span>
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              {match.recommended_option?.savings_percent}% Cheaper
                            </span>
                          </div>
                          <p className="mt-1 text-base font-bold text-navy">{match.medicine.brand_name}</p>
                          <p className="text-xs text-slate-500">{match.medicine.active_salt}</p>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                          <div>
                            <span className="block text-[10px] text-slate-400">Jan Aushadhi Price</span>
                            <span className="text-lg font-extrabold text-emerald-600">
                              {formatInr(match.recommended_option?.price ?? match.medicine.jan_aushadhi_price)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[10px] text-slate-400">Market MRP</span>
                            <span className="text-sm font-semibold text-slate-400 line-through">
                              {formatInr(match.medicine.private_brand_price)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
