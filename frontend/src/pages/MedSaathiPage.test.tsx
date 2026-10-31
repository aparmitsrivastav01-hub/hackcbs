import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../context/CartContext";
import { LanguageProvider } from "../i18n/LanguageContext";
import { clearTTSCache } from "../hooks/useElevenLabsTTS";
import { MedSaathiPage } from "./MedSaathiPage";

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

function renderMedSaathiPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <LanguageProvider>
          <CartProvider>
            <MedSaathiPage />
          </CartProvider>
        </LanguageProvider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("MedSaathiPage — ElevenLabs TTS Integration", () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    clearTTSCache();
    vi.stubGlobal("Audio", MockAudio);

    mockFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr === "/api/memory/consent") {
        return new Response(JSON.stringify({ consent: false }), { status: 200 });
      }
      if (urlStr === "/api/voice/elevenlabs/speak") {
        const body = JSON.parse((init?.body as string) || "{}");
        return new Response(new Blob([`audio-for-${body.language}`], { type: "audio/mpeg" }), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      return new Response("OK", { status: 200 });
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    clearTTSCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("1 & 2 & 4. Shows 'Speak response' button on assistant message and triggers ElevenLabs TTS", async () => {
    renderMedSaathiPage();

    // Default welcome message has Speak Response button
    const speakButtons = screen.getAllByRole("button", { name: /Speak response/i });
    expect(speakButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(speakButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/voice/elevenlabs/speak",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"language":"en"'),
        })
      );
    });

    // Shows Stop speaking button while audio is active
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Stop speaking/i })).toBeInTheDocument();
    });
  });

  it("3. Supports Hindi TTS requests when language is switched", async () => {
    renderMedSaathiPage();

    // Switch language to Hindi
    const langButton = screen.getByRole("button", { name: /हिंदी/i });
    fireEvent.click(langButton);

    const speakButtons = screen.getAllByRole("button", { name: /जवाब सुनें/i });
    expect(speakButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(speakButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/voice/elevenlabs/speak",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"language":"hi"'),
        })
      );
    });
  });

  it("5. Allows users to stop playback by clicking the active button", async () => {
    renderMedSaathiPage();

    const speakButton = screen.getAllByRole("button", { name: /Speak response/i })[0];
    fireEvent.click(speakButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Stop speaking/i })).toBeInTheDocument();
    });

    // Click stop button
    const stopButton = screen.getByRole("button", { name: /Stop speaking/i });
    fireEvent.click(stopButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Speak response/i })).toBeInTheDocument();
    });
  });

  it("6. API failure shows fallback error banner", async () => {
    mockFetch.mockImplementation(async (url: any) => {
      if (String(url) === "/api/voice/elevenlabs/speak") {
        return new Response(JSON.stringify({ detail: "Voice synthesis service unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ consent: false }), { status: 200 });
    });

    renderMedSaathiPage();

    const speakButton = screen.getAllByRole("button", { name: /Speak response/i })[0];
    fireEvent.click(speakButton);

    await waitFor(() => {
      expect(screen.getByText("Voice synthesis service unavailable")).toBeInTheDocument();
    });
  });
});
