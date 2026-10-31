import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/client";
import { BatchSafetyPage } from "./BatchSafetyPage";

function renderPage() { return render(<HelmetProvider><MemoryRouter><BatchSafetyPage /></MemoryRouter></HelmetProvider>); }
const extracted = {
  medicine_name: "Example tablet", strength: "500 mg", dosage_form: "Tablet", manufacturer: "Example Ltd",
  batch_number: "AB-12", manufacturing_date: "01/2025", expiry_date: "12/2027", mrp: "₹20", composition: null,
  raw_ocr_text: "B.No. AB-12", field_confidence: { medicine_name: 0.9, batch_number: 0.8, manufacturer: 0.9, expiry_date: 0.8 },
  needs_manual_review: false, warnings: [], extraction_status: "complete", model: "gemini-test",
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("BatchSafetyPage image review flow", () => {
  it("shows processing, extracted review fields, then a CDSCO result", async () => {
    vi.spyOn(api, "getBatchDatasetInfo").mockResolvedValue({ ready: true, records_loaded: 260, last_update_date: "2026-10" });
    vi.spyOn(api, "extractBatchDetails").mockImplementation(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); return extracted; });
    vi.spyOn(api, "verifyBatchDetails").mockResolvedValue({ status: "NO_MATCH", records: [], explanation: "No matching record was found in the currently loaded CDSCO NSQ dataset. Absence from this dataset is not proof of safety." });
    const { container } = renderPage();
    const file = new File([new Uint8Array([1,2,3])], "strip.png", { type: "image/png" });
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /Extract Medicine Details/i }));
    expect(await screen.findByText(/OCR and Gemini Vision processing/i)).toBeInTheDocument();
    await screen.findByDisplayValue("AB-12");
    expect(screen.getByRole("heading", { name: /Review extracted details/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Verify Against CDSCO Database/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /NO MATCH IN LOADED DATASET/i })).toBeInTheDocument());
  });
});
