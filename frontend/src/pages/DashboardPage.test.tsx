import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/client";
import { CartProvider } from "../context/CartContext";
import { LanguageProvider } from "../i18n/LanguageContext";
import { DashboardPage } from "./DashboardPage";

// Mock Auth Context
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

describe("DashboardPage (Product-Centric Flow)", () => {
  it("renders patient greeting and core utility actions", () => {
    renderDashboard();

    expect(screen.getByText(/Welcome back,/i)).toBeInTheDocument();
    expect(screen.getByText("Yashraj R.")).toBeInTheDocument();
    expect(screen.getByText(/Search Medicine Prices/i)).toBeInTheDocument();
    expect(screen.getByText(/Scan Doctor's Prescription/i)).toBeInTheDocument();
    expect(screen.getByText(/MedSaathi Healthcare Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/My Medicine Enquiry List/i)).toBeInTheDocument();
    expect(screen.getByText(/Check Medicine Batch Safety/i)).toBeInTheDocument();
  });

  it("allows searching for medicine prices", () => {
    renderDashboard();

    const searchInput = screen.getByPlaceholderText(/Type medicine or salt name/i);
    expect(searchInput).toBeInTheDocument();
    fireEvent.change(searchInput, { target: { value: "Paracetamol" } });
    expect(searchInput).toHaveValue("Paracetamol");

    const compareBtn = screen.getByRole("button", { name: /Compare/i });
    expect(compareBtn).toBeEnabled();
  });

  it("renders MedSaathi query input and prompt suggestions", () => {
    renderDashboard();

    const assistantInput = screen.getByPlaceholderText(/Ask MedSaathi anything/i);
    expect(assistantInput).toBeInTheDocument();
    fireEvent.change(assistantInput, { target: { value: "Can I take Paracetamol?" } });
    expect(assistantInput).toHaveValue("Can I take Paracetamol?");

    expect(screen.getByText(/Are there cheaper generic alternatives for my medicines\?/i)).toBeInTheDocument();
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

    const input = screen.getByPlaceholderText(/Enter batch no\. on pack/i);
    fireEvent.change(input, { target: { value: "PCM23H88" } });

    const verifyBtn = screen.getByRole("button", { name: /Verify Batch/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Standard Quality Batch — No Active Recall Notice/i)).toBeInTheDocument();
      expect(screen.getByText(/Standard quality verified\./i)).toBeInTheDocument();
    });
  });

  it("handles toggling health memory preference", async () => {
    renderDashboard();

    const toggleBtn = screen.getByRole("button", { name: /Memory: Active/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Memory paused/i)).toBeInTheDocument();
    });
  });
});
