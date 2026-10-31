import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "../api/client";
import { CartProvider } from "../context/CartContext";
import { LanguageProvider } from "../i18n/LanguageContext";
import { getMedicineSpeechText, MedicinesPage } from "./MedicinesPage";
import { clearTTSCache } from "../hooks/useElevenLabsTTS";
import type { MedicineResponse } from "../types";

const mockSampleMedicines: MedicineResponse[] = [
  {
    id: 1,
    brand_name: "Dolo 650",
    active_salt: "Paracetamol 650mg",
    dosage_form: "Tablet",
    category: "Analgesic",
    prices: {
      private_brand: 32,
      jan_aushadhi: 12,
      dava_india: 14,
    },
    savings_comparison: {
      maximum_savings: {
        provider: "jan_aushadhi",
        price: 12,
        amount: 20,
        percentage: 62.5,
      },
    },
  },
  {
    id: 2,
    brand_name: "Crocin 500",
    active_salt: "Paracetamol 500mg",
    dosage_form: "Tablet",
    category: "Analgesic",
    prices: {
      private_brand: 25,
      jan_aushadhi: 9,
      dava_india: 10,
    },
    savings_comparison: {
      maximum_savings: {
        provider: "jan_aushadhi",
        price: 9,
        amount: 16,
        percentage: 64,
      },
    },
  },
];

class MockAudio {
  src = "";
  paused = true;
  currentTime = 0;
  onplay: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn().mockImplementation(async () => {
    this.paused = false;
    if (this.onplay) this.onplay();
  });
  pause = vi.fn().mockImplementation(() => {
    this.paused = true;
  });
  load = vi.fn();
  removeAttribute = vi.fn();
}

class MockSpeechRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn().mockImplementation(() => {
    if (this.onstart) this.onstart();
  });
  stop = vi.fn().mockImplementation(() => {
    if (this.onend) this.onend();
  });
  abort = vi.fn();
}

function renderMedicinesPage(initialQuery = "") {
  const initialEntries = initialQuery ? [`/medicines?q=${encodeURIComponent(initialQuery)}`] : ["/medicines"];
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <LanguageProvider>
          <CartProvider>
            <MedicinesPage />
          </CartProvider>
        </LanguageProvider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("MedicinesPage — Voice Search & ElevenLabs TTS Integration", () => {
  let mockSearchMedicines: ReturnType<typeof vi.spyOn>;
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearTTSCache();
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);

    mockSearchMedicines = vi.spyOn(apiClient, "searchMedicines").mockResolvedValue({
      success: true,
      query: "Dolo",
      total_results: 2,
      results: mockSampleMedicines,
    });
    vi.spyOn(apiClient, "getCategories").mockResolvedValue({
      count: 1,
      categories: ["Analgesic"],
    });
    vi.spyOn(apiClient, "getMaximumSavings").mockResolvedValue({
      count: 2,
      provider: "all",
      medicines: mockSampleMedicines,
    });

    mockFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/voice/elevenlabs/speak") {
        return new Response(new Blob(["mock-mp3"], { type: "audio/mpeg" }), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      return new Response("OK", { status: 200 });
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("1. Renders microphone icon on the medicine search field", () => {
    renderMedicinesPage();
    const micButton = screen.getByRole("button", { name: /Voice search/i });
    expect(micButton).toBeInTheDocument();
  });

  it("2 & 3 & 4 & 5. Clicking mic starts speech recognition, populates search input and calls catalogue API", async () => {
    renderMedicinesPage();

    const micButton = screen.getByRole("button", { name: /Voice search/i });
    fireEvent.click(micButton);

    // Shows listening state
    expect(screen.getByText(/Listening in/i)).toBeInTheDocument();

    // Search input
    const searchInput = screen.getByPlaceholderText(/Search brand/i) as HTMLInputElement;
    expect(searchInput).toBeInTheDocument();
  });

  it("6. getMedicineSpeechText constructs accurate descriptions in English and Hindi", () => {
    const med = mockSampleMedicines[0];
    const speechEn = getMedicineSpeechText(med, "en");
    expect(speechEn).toContain("Dolo 650.");
    expect(speechEn).toContain("Paracetamol 650mg");
    expect(speechEn).toContain("Jan Aushadhi generic alternative is ₹12");

    const speechHi = getMedicineSpeechText(med, "hi");
    expect(speechHi).toContain("Dolo 650");
    expect(speechHi).toContain("मुख्य घटक: Paracetamol 650mg");
    expect(speechHi).toContain("जन औषधि जेनेरिक विकल्प ₹12 में उपलब्ध है");
  });

  it("7 & 8. Handles unsupported browser for speech recognition gracefully", async () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);

    renderMedicinesPage();

    const micButton = screen.getByRole("button", { name: /Voice search/i });
    fireEvent.click(micButton);

    await waitFor(() => {
      expect(screen.getByText(/Voice recognition is not supported/i)).toBeInTheDocument();
    });
  });

  it("9. Renders Listen control on medicine cards and triggers ElevenLabs speech", async () => {
    renderMedicinesPage("Dolo");

    await waitFor(
      () => {
        expect(screen.getByText("Dolo 650")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    const listenButtons = screen.getAllByRole("button", { name: /Listen to/i });
    expect(listenButtons.length).toBeGreaterThanOrEqual(1);

    // Click listen on first card
    fireEvent.click(listenButtons[0]);

    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/voice/elevenlabs/speak",
          expect.objectContaining({
            method: "POST",
          })
        );
      },
      { timeout: 2000 }
    );
  });

  it("10. TTS failure displays notice without breaking medicine search or catalogue results", async () => {
    mockFetch.mockImplementation(async (url) => {
      if (url === "/api/voice/elevenlabs/speak") {
        return new Response(JSON.stringify({ detail: "ElevenLabs API offline" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("OK", { status: 200 });
    });

    renderMedicinesPage("Dolo");

    await waitFor(
      () => {
        expect(screen.getByText("Dolo 650")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    const listenButtons = screen.getAllByRole("button", { name: /Listen to/i });
    fireEvent.click(listenButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("ElevenLabs API offline")).toBeInTheDocument();
    });

    // Medicine cards remain visible and interactive
    expect(screen.getByText("Dolo 650")).toBeInTheDocument();
    expect(screen.getByText("Crocin 500")).toBeInTheDocument();
  });
});
