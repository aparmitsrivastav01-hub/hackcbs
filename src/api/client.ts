import type {
  CatalogueStats,
  Comparison,
  ConfirmedSearchResult,
  DatasetStatus,
  ExtractionResponse,
  Medicine,
  PharmacyEnquiry,
} from "../types";

const API = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const body = (await response.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        /* keep default */
      }
      throw new Error(detail);
    }
    return response.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export function getApiBase() {
  return API;
}

export function getStats() {
  return request<CatalogueStats>("/api/stats");
}

export function getCategories() {
  return request<{ categories: string[]; count: number }>("/api/categories");
}

export function listMedicines(params: {
  q?: string;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  search.set("limit", String(params.limit ?? 50));
  search.set("offset", String(params.offset ?? 0));
  return request<{ items: Medicine[]; total: number; limit: number; offset: number }>(
    `/api/medicines?${search.toString()}`,
  );
}

export function searchMedicines(q: string, limit = 20) {
  return request<{ query: string; count: number; items: Medicine[] }>(
    `/api/medicines/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  );
}

export function getMedicine(id: number) {
  return request<Medicine>(`/api/medicines/${id}`);
}

export function compareMedicine(id: number) {
  return request<Comparison>(`/api/medicines/${id}/compare`);
}

export function extractPrescription(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<ExtractionResponse>("/api/prescriptions/extract", {
    method: "POST",
    body: form,
  });
}

export function searchConfirmed(items: Array<{
  medicine_name: string;
  strength?: string | null;
  dosage_form?: string | null;
}>) {
  return request<ConfirmedSearchResult>("/api/prescriptions/search-confirmed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

export function createEnquiry(payload: {
  pharmacy_name: string;
  pharmacy_phone?: string;
  pharmacy_address?: string;
  customer_area?: string;
  customer_message?: string;
  items: Array<{
    medicine_name: string;
    strength?: string | null;
    dosage_form?: string | null;
    quantity: string;
    catalogue_medicine_id?: number | null;
  }>;
}) {
  return request<{ status: string; whatsapp_sent: boolean; enquiry: PharmacyEnquiry }>(
    "/api/pharmacy-enquiries",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export function listEnquiries() {
  return request<{ count: number; items: PharmacyEnquiry[] }>("/api/pharmacy-enquiries");
}

export function getDatasetStatus() {
  return request<DatasetStatus>("/api/batch-safety/dataset-status");
}

export function checkBatchSafety(payload: {
  product_name: string;
  manufacturer?: string;
  batch_number: string;
}) {
  return request<{
    status: string;
    alert_match: boolean | null;
    matches: Array<Record<string, string | null>>;
    dataset_records: number;
    message: string;
    safety_note: string;
  }>("/api/batch-safety/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function formatInr(value: number | null | undefined) {
  if (value == null) return "Unavailable";
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
