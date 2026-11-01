import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/client";
import { CartProvider } from "../context/CartContext";
import { LanguageProvider } from "../i18n/LanguageContext";
import { DashboardPage } from "./DashboardPage";

// Mock Auth Context module partially
vi.mock("../context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../context/AuthContext")>();
  return {
    ...actual,
    useAuth: () => ({
      user: {
        id: "usr_test123",
        email: "yashraj@medeasy.org",
        role: "patient",
        is_active: true,
        created_at: "2026-10-31T20:00:00Z",
      },
      profile: {
        user_id: "usr_test123",
        display_label: "Yashraj R.",
        preferred_language: "en",
        country_code: "IN",
      },
      consent: {
        user_id: "usr_test123",
        scope: "meko_patient_memory",
        granted: true,
        granted_at: "2026-10-31T20:00:00Z",
        updated_at: "2026-10-31T20:00:00Z",
      },
      logout: vi.fn(),
      setMekoConsent: vi.fn().mockResolvedValue(true),
      updateProfile: vi.fn(),
      isAuthenticated: true,
      loading: false,
    }),
  };
});

function renderDashboard() {
  return render(
    <HelmetProvider>
      <LanguageProvider>
        <CartProvider>
          <MemoryRouter>
            <DashboardPage />
          </MemoryRouter>
        </CartProvider>
      </LanguageProvider>
    </HelmetProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DashboardPage", () => {
  it("renders patient greeting and active session status", () => {
    renderDashboard();

    expect(screen.getByText(/Welcome back,/i)).toBeInTheDocument();
    expect(screen.getAllByText("Yashraj R.")[0]).toBeInTheDocument();
    expect(screen.getByText(/Active Patient Session • YugabyteDB Aeon/i)).toBeInTheDocument();
  });

  it("renders both Workflow 1 and Workflow 2 sections", () => {
    renderDashboard();

    // Workflow 1
    expect(screen.getByText(/Workflow 1 • Affordable Medicine Pipeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Prescription to Local Pharmacy/i)).toBeInTheDocument();
    expect(screen.getByText(/1. Scan Prescription Photo \/ PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/2. 3-Way Generic Price Comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/3. Find Verified Pharmacies & WhatsApp Enquiries/i)).toBeInTheDocument();

    // Workflow 2
    expect(screen.getByText(/Workflow 2 • Persistent Patient Memory & AI/i)).toBeInTheDocument();
    expect(screen.getByText(/MedSaathi AI Companion/i)).toBeInTheDocument();
    expect(screen.getByText(/Launch MedSaathi AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero Clinical Storage Guarantee:/i)).toBeInTheDocument();
  });

  it("performs quick batch verification against CDSCO database", async () => {
    vi.spyOn(api, "checkBatchSafety").mockResolvedValue({
      status: "no_match",
      product_name: "Pack Verification",
      batch_number: "PCM23H88",
      dataset_records: 260,
      matches: [],
      message: "Standard quality verified.",
      safety_note: "No CDSCO alerts found.",
    });

    renderDashboard();

    const input = screen.getByPlaceholderText(/Enter pack batch no\./i);
    fireEvent.change(input, { target: { value: "PCM23H88" } });

    const verifyBtn = screen.getByRole("button", { name: /Verify/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Standard Quality Batch/i)).toBeInTheDocument();
      expect(screen.getByText(/Standard quality verified\./i)).toBeInTheDocument();
    });
  });

  it("handles toggling Meko memory consent", async () => {
    renderDashboard();

    const toggleBtn = screen.getByRole("button", { name: /Pause Memory/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Meko Memory/i)).toBeInTheDocument();
    });
  });
});
