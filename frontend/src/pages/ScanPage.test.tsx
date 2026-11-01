import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "../api/client";
import { LanguageProvider } from "../i18n/LanguageContext";
import { ScanPage } from "./ScanPage";
import type { ConfirmedSearchResult, ExtractionResponse } from "../types";

describe("ScanPage — Prescription Scanning & Catalogue Matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  function renderScanPage() {
    return render(
      <HelmetProvider>
        <MemoryRouter>
          <LanguageProvider>
            <ScanPage />
          </LanguageProvider>
        </MemoryRouter>
      </HelmetProvider>
    );
  }

  it("renders upload card and empty state initially", () => {
    renderScanPage();
    expect(screen.getByText(/Scan Your/i)).toBeInTheDocument();
    expect(screen.getByText(/Uploaded Prescription/i)).toBeInTheDocument();
    expect(screen.getByText(/No prescription uploaded yet/i)).toBeInTheDocument();
  });

  it("displays verified matches for Razod, Ambulox, Petril Plus, and Placida", async () => {
    const mockExtraction: ExtractionResponse = {
      status: "success",
      message: "4 medicines extracted",
      search_performed: false,
      model: "Gemini Vision",
      file_name: "test_rx.jpg",
      extraction: {
        document_language: "en",
        items: [
          {
            raw_text: "Cap Razod",
            medicine_name: "Razod",
            strength: "20 mg + 30 mg",
            dosage_form: "Capsule",
            instructions: "1 daily",
            confidence: "High",
            uncertain_parts: [],
            needs_user_confirmation: true,
          },
          {
            raw_text: "Tab Ambulox",
            medicine_name: "Ambulox",
            strength: "0.25 mg + 20 mg",
            dosage_form: "Tablet",
            instructions: "1 at night",
            confidence: "High",
            uncertain_parts: [],
            needs_user_confirmation: true,
          },
          {
            raw_text: "Tab Petril Plus",
            medicine_name: "Petril Plus",
            strength: "0.5 mg + 10 mg",
            dosage_form: "Tablet",
            instructions: "1 daily",
            confidence: "High",
            uncertain_parts: [],
            needs_user_confirmation: true,
          },
          {
            raw_text: "Tab Placida",
            medicine_name: "Placida",
            strength: "0.5 mg + 10 mg",
            dosage_form: "Tablet",
            instructions: "1 daily",
            confidence: "High",
            uncertain_parts: [],
            needs_user_confirmation: true,
          },
        ],
        other_text: [],
        warnings: [],
      },
    };

    const mockSearchResults: ConfirmedSearchResult = {
      status: "success",
      note: "Price comparisons matching loaded public generic catalogue.",
      results: [
        {
          confirmed_input: {
            medicine_name: "Razod",
            strength: "20 mg + 30 mg",
            dosage_form: "Capsule",
          },
          match_count: 1,
          match_type: "exact_alias",
          match_confidence: 0.96,
          review_note: "Direct active generic substitutes available in PMBJP catalogue.",
          matches: [
            {
              medicine: {
                id: 504,
                brand_name: "Rozad / Razod / Razo-D",
                active_salt: "Rabeprazole 20 mg + Domperidone 30 mg SR Caps",
                dosage_form: "Capsule",
                category: "GIT",
                private_brand_price: 198.0,
                jan_aushadhi_price: 10.71,
                dava_india_price: 22.0,
              },
              match_type: "exact_alias",
              match_confidence: 0.96,
              price_options: [],
              recommended_option: {
                provider: "Jan Aushadhi",
                price: 10.71,
                savings: 187.29,
                savings_percent: 94.59,
              },
              comparison_note: "Save up to 95% with generic options.",
            },
          ],
        },
        {
          confirmed_input: {
            medicine_name: "Ambulox",
            strength: "0.25 mg + 20 mg",
            dosage_form: "Tablet",
          },
          match_count: 1,
          match_type: "exact_alias",
          match_confidence: 0.96,
          review_note: "Direct active generic substitutes available in PMBJP catalogue.",
          matches: [
            {
              medicine: {
                id: 505,
                brand_name: "Ambulox / Ambulax / Ambulax M",
                active_salt: "Alprazolam 0.25 mg + Propranolol 10 mg / 20 mg Tab",
                dosage_form: "Tablet",
                category: "CNS & Neurology",
                private_brand_price: 91.5,
                jan_aushadhi_price: 12.0,
                dava_india_price: 20.0,
              },
              match_type: "exact_alias",
              match_confidence: 0.96,
              price_options: [],
              recommended_option: {
                provider: "Jan Aushadhi",
                price: 12.0,
                savings: 79.5,
                savings_percent: 86.89,
              },
              comparison_note: "Save up to 87% with generic options.",
            },
          ],
        },
        {
          confirmed_input: {
            medicine_name: "Petril Plus",
            strength: "0.5 mg + 10 mg",
            dosage_form: "Tablet",
          },
          match_count: 1,
          match_type: "exact_brand",
          match_confidence: 0.98,
          review_note: "Direct active generic substitutes available in PMBJP catalogue.",
          matches: [
            {
              medicine: {
                id: 506,
                brand_name: "Petril Plus",
                active_salt: "Clonazepam 0.5 mg + Escitalopram Oxalate 10 mg Tab",
                dosage_form: "Tablet",
                category: "CNS & Neurology",
                private_brand_price: 159.0,
                jan_aushadhi_price: 18.0,
                dava_india_price: 30.0,
              },
              match_type: "exact_brand",
              match_confidence: 0.98,
              price_options: [],
              recommended_option: {
                provider: "Jan Aushadhi",
                price: 18.0,
                savings: 141.0,
                savings_percent: 88.68,
              },
              comparison_note: "Save up to 89% with generic options.",
            },
          ],
        },
        {
          confirmed_input: {
            medicine_name: "Placida",
            strength: "0.5 mg + 10 mg",
            dosage_form: "Tablet",
          },
          match_count: 1,
          match_type: "exact_brand",
          match_confidence: 0.98,
          review_note: "Direct active generic substitutes available in PMBJP catalogue.",
          matches: [
            {
              medicine: {
                id: 507,
                brand_name: "Placida",
                active_salt: "Flupenthixol 0.5 mg + Melitracen 10 mg Tab",
                dosage_form: "Tablet",
                category: "CNS & Neurology",
                private_brand_price: 99.32,
                jan_aushadhi_price: 14.5,
                dava_india_price: 24.0,
              },
              match_type: "exact_brand",
              match_confidence: 0.98,
              price_options: [],
              recommended_option: {
                provider: "Jan Aushadhi",
                price: 14.5,
                savings: 84.82,
                savings_percent: 85.4,
              },
              comparison_note: "Save up to 85% with generic options.",
            },
          ],
        },
      ],
    };

    vi.spyOn(apiClient, "extractPrescription").mockResolvedValueOnce(mockExtraction);
    vi.spyOn(apiClient, "searchConfirmed").mockResolvedValueOnce(mockSearchResults);

    renderScanPage();

    // Trigger upload / scan
    const file = new File(["dummy content"], "rx.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const scanBtn = screen.getByRole("button", { name: /Scan Prescription/i });
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByText(/Review Extracted Medicines/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue("Razod")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Ambulox")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Petril Plus")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Placida")).toBeInTheDocument();
    });

    // Click "Search Confirmed Medicines →"
    const searchConfirmedBtn = screen.getByRole("button", { name: /Search Confirmed Medicines →/i });
    fireEvent.click(searchConfirmedBtn);

    await waitFor(() => {
      expect(screen.getByText(/Available Generic Matches/i)).toBeInTheDocument();
    });

    // Verify all four medicines and their matched details are displayed
    expect(screen.getByText(/Rozad \/ Razod \/ Razo-D/i)).toBeInTheDocument();
    expect(screen.getByText(/Ambulox \/ Ambulax \/ Ambulax M/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Petril Plus/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Placida/i).length).toBeGreaterThan(0);

    // Verify dosage forms displayed
    expect(screen.getAllByText(/Capsule/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tablet/i).length).toBeGreaterThan(0);

    // Verify active salts displayed
    expect(screen.getByText(/Rabeprazole 20 mg \+ Domperidone 30 mg SR Caps/i)).toBeInTheDocument();
    expect(screen.getByText(/Alprazolam 0.25 mg \+ Propranolol 10 mg \/ 20 mg Tab/i)).toBeInTheDocument();
    expect(screen.getByText(/Clonazepam 0.5 mg \+ Escitalopram Oxalate 10 mg Tab/i)).toBeInTheDocument();
    expect(screen.getByText(/Flupenthixol 0.5 mg \+ Melitracen 10 mg Tab/i)).toBeInTheDocument();

    // Verify match confidence / match types displayed
    expect(screen.getAllByText(/Verified Alias/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Exact Brand/i).length).toBeGreaterThan(0);
  });

  it("displays 'No verified catalogue match found.' when no valid match exists", async () => {
    const mockExtraction: ExtractionResponse = {
      status: "success",
      message: "1 medicine extracted",
      search_performed: false,
      model: "Gemini Vision",
      file_name: "test_rx.jpg",
      extraction: {
        document_language: "en",
        items: [
          {
            raw_text: "Tab UnknownFormula123",
            medicine_name: "UnknownFormula123",
            strength: "100 mg",
            dosage_form: "Tablet",
            instructions: "1 daily",
            confidence: "High",
            uncertain_parts: [],
            needs_user_confirmation: true,
          },
        ],
        other_text: [],
        warnings: [],
      },
    };

    const mockSearchResults: ConfirmedSearchResult = {
      status: "success",
      note: "Price comparisons matching loaded public generic catalogue.",
      results: [
        {
          confirmed_input: {
            medicine_name: "UnknownFormula123",
            strength: "100 mg",
            dosage_form: "Tablet",
          },
          match_count: 0,
          match_type: null,
          match_confidence: null,
          review_note: "No verified catalogue match found.",
          matches: [],
        },
      ],
    };

    vi.spyOn(apiClient, "extractPrescription").mockResolvedValueOnce(mockExtraction);
    vi.spyOn(apiClient, "searchConfirmed").mockResolvedValueOnce(mockSearchResults);

    renderScanPage();

    const file = new File(["dummy content"], "rx.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const scanBtn = screen.getByRole("button", { name: /Scan Prescription/i });
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue("UnknownFormula123")).toBeInTheDocument();
    });

    const searchConfirmedBtn = screen.getByRole("button", { name: /Search Confirmed Medicines →/i });
    fireEvent.click(searchConfirmedBtn);

    await waitFor(() => {
      expect(screen.getByText(/0 match\(es\) found/i)).toBeInTheDocument();
      expect(screen.getAllByText(/No verified catalogue match found\./i).length).toBeGreaterThan(0);
    });
  });

  it("displays Suggested Candidate for OCR mismatch such as Pantil Plus", async () => {
    const mockExtraction: ExtractionResponse = {
      status: "success",
      message: "1 medicine extracted",
      search_performed: false,
      model: "Gemini Vision",
      file_name: "test_rx.jpg",
      extraction: {
        document_language: "en",
        items: [
          {
            raw_text: "Tab Pantil Plus",
            medicine_name: "Pantil Plus",
            strength: "0.5 mg + 10 mg",
            dosage_form: "Tablet",
            instructions: "1 daily",
            confidence: "Medium",
            uncertain_parts: [],
            needs_user_confirmation: true,
          },
        ],
        other_text: [],
        warnings: [],
      },
    };

    const mockSearchResults: ConfirmedSearchResult = {
      status: "success",
      note: "Price comparisons matching loaded public generic catalogue.",
      results: [
        {
          confirmed_input: {
            medicine_name: "Pantil Plus",
            strength: "0.5 mg + 10 mg",
            dosage_form: "Tablet",
          },
          match_count: 1,
          match_type: "suggested_candidate",
          match_confidence: 0.78,
          review_note: "Suggested candidate found based on visual similarity. Requires confirmation.",
          matches: [
            {
              medicine: {
                id: 506,
                brand_name: "Petril Plus",
                active_salt: "Clonazepam 0.5 mg + Escitalopram Oxalate 10 mg Tab",
                dosage_form: "Tablet",
                category: "CNS & Neurology",
                private_brand_price: 159.0,
                jan_aushadhi_price: 18.0,
                dava_india_price: 30.0,
              },
              match_type: "suggested_candidate",
              match_confidence: 0.78,
              price_options: [],
              recommended_option: {
                provider: "Jan Aushadhi",
                price: 18.0,
                savings: 141.0,
                savings_percent: 88.68,
              },
              comparison_note: "Save up to 89% with generic options.",
            },
          ],
        },
      ],
    };

    vi.spyOn(apiClient, "extractPrescription").mockResolvedValueOnce(mockExtraction);
    vi.spyOn(apiClient, "searchConfirmed").mockResolvedValueOnce(mockSearchResults);

    renderScanPage();

    const file = new File(["dummy content"], "rx.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const scanBtn = screen.getByRole("button", { name: /Scan Prescription/i });
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Pantil Plus")).toBeInTheDocument();
    });

    const searchConfirmedBtn = screen.getByRole("button", { name: /Search Confirmed Medicines →/i });
    fireEvent.click(searchConfirmedBtn);

    await waitFor(() => {
      expect(screen.getByText(/1 match\(es\) found/i)).toBeInTheDocument();
      expect(screen.getByText(/Petril Plus/i)).toBeInTheDocument();
      expect(screen.getByText(/Suggested Candidate \(\d+%\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Requires confirmation/i)).toBeInTheDocument();
    });
  });

  it("displays three-tier match status badges and dosage warning for Enotet 40", async () => {
    const mockExtraction = {
      status: "success",
      message: "3 medicines extracted",
      search_performed: false,
      model: "Gemini Vision",
      file_name: "prescription.jpg",
      extraction: {
        document_language: "en",
        items: [
          { raw_text: "Tab Petril Plus", medicine_name: "Petril Plus", strength: null, dosage_form: "Tablet", instructions: null, confidence: "High", uncertain_parts: [], needs_user_confirmation: true },
          { raw_text: "T. Placida", medicine_name: "Placida", strength: null, dosage_form: "Tablet", instructions: null, confidence: "High", uncertain_parts: [], needs_user_confirmation: true },
          { raw_text: "Enotet 40", medicine_name: "Enotet 40", strength: null, dosage_form: "Tablet", instructions: null, confidence: "Medium", uncertain_parts: [], needs_user_confirmation: true },
        ],
        other_text: [],
        warnings: [],
      },
    };

    const mockSearchResults = {
      status: "success",
      note: "Price comparisons",
      results: [
        {
          confirmed_input: { medicine_name: "Petril Plus", strength: null, dosage_form: "Tablet" },
          match_count: 1,
          match_status: "Exact Match",
          match_type: "exact_brand",
          match_confidence: 0.98,
          review_note: "Direct active generic substitutes available in PMBJP catalogue.",
          matches: [
            {
              medicine: {
                id: 506,
                brand_name: "Petril Plus",
                active_salt: "Clonazepam 0.5 mg + Escitalopram Oxalate 10 mg Tab",
                dosage_form: "Tablet",
                category: "CNS & Neurology",
                private_brand_price: 159.0,
                jan_aushadhi_price: 18.0,
                dava_india_price: 30.0,
              },
              match_type: "exact_brand",
              match_confidence: 0.98,
              price_options: [],
              recommended_option: { provider: "Jan Aushadhi", price: 18.0, savings: 141.0, savings_percent: 88.68 },
              comparison_note: "Save up to 89% with generic options.",
            },
          ],
        },
        {
          confirmed_input: { medicine_name: "Placida", strength: null, dosage_form: "Tablet" },
          match_count: 1,
          match_status: "Exact Match",
          match_type: "exact_brand",
          match_confidence: 0.98,
          review_note: "Direct active generic substitutes available in PMBJP catalogue.",
          matches: [
            {
              medicine: {
                id: 507,
                brand_name: "Placida",
                active_salt: "Flupenthixol 0.5 mg + Melitracen 10 mg Tab",
                dosage_form: "Tablet",
                category: "CNS & Neurology",
                private_brand_price: 99.32,
                jan_aushadhi_price: 14.5,
                dava_india_price: 24.0,
              },
              match_type: "exact_brand",
              match_confidence: 0.98,
              price_options: [],
              recommended_option: { provider: "Jan Aushadhi", price: 14.5, savings: 84.82, savings_percent: 85.4 },
              comparison_note: "Save up to 85% with generic options.",
            },
          ],
        },
        {
          confirmed_input: { medicine_name: "Enotet 40", strength: null, dosage_form: "Tablet" },
          match_count: 1,
          match_status: "Possible Match — Needs Review",
          match_type: "strength_variant",
          match_confidence: 0.72,
          review_note: "Catalogue record found for brand 'Enotet / Etojet / Etojet-90', but strength differs. Verification required.",
          matches: [
            {
              medicine: {
                id: 508,
                brand_name: "Enotet / Etojet / Etojet-90",
                active_salt: "Etoricoxib 90 mg Tab",
                dosage_form: "Tablet",
                category: "Analgesics",
                private_brand_price: 119.0,
                jan_aushadhi_price: 25.99,
                dava_india_price: 38.0,
              },
              match_type: "strength_variant",
              match_confidence: 0.72,
              price_options: [],
              recommended_option: { provider: "Jan Aushadhi", price: 25.99, savings: 93.01, savings_percent: 78.16 },
              comparison_note: "Strength difference detected. Verify prescribed dosage with doctor/pharmacist.",
            },
          ],
        },
      ],
    };

    vi.spyOn(apiClient, "extractPrescription").mockResolvedValueOnce(mockExtraction);
    vi.spyOn(apiClient, "searchConfirmed").mockResolvedValueOnce(mockSearchResults);

    renderScanPage();

    const file = new File(["dummy"], "rx.jpg", { type: "image/jpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const scanBtn = screen.getByRole("button", { name: /Scan Prescription/i });
    fireEvent.click(scanBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Petril Plus")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Placida")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Enotet 40")).toBeInTheDocument();
    });

    const searchConfirmedBtn = screen.getByRole("button", { name: /Search Confirmed Medicines →/i });
    fireEvent.click(searchConfirmedBtn);

    await waitFor(() => {
      // Both Petril Plus and Placida show Exact Match badges
      expect(screen.getAllByText(/✓ Exact Match/i).length).toBe(2);

      // Enotet 40 shows Possible Match badge and Strength Variant badge
      expect(screen.getByText(/⚠ Possible Match — Needs Review/i)).toBeInTheDocument();
      expect(screen.getByText(/Strength Variant/i)).toBeInTheDocument();
      expect(screen.getByText(/Dosage Warning:/i)).toBeInTheDocument();
    });
  });
});
