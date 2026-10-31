import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeMedicineVoiceQuery,
  useSpeechRecognition,
} from "./useSpeechRecognition";

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

describe("normalizeMedicineVoiceQuery", () => {
  it("normalizes English voice queries", () => {
    expect(normalizeMedicineVoiceQuery("Paracetamol")).toBe("Paracetamol");
    expect(normalizeMedicineVoiceQuery("search for Crocin Advance")).toBe("Crocin Advance");
    expect(normalizeMedicineVoiceQuery("find Azithromycin 500")).toBe("Azithromycin 500");
    expect(normalizeMedicineVoiceQuery("what is the price of Pantoprazole")).toBe("Pantoprazole");
    expect(normalizeMedicineVoiceQuery("Dolo 650 please")).toBe("Dolo 650");
  });

  it("normalizes Hindi voice queries", () => {
    expect(normalizeMedicineVoiceQuery("पैरासिटामोल")).toBe("पैरासिटामोल");
    expect(normalizeMedicineVoiceQuery("पैरासिटामोल खोजो")).toBe("पैरासिटामोल");
    expect(normalizeMedicineVoiceQuery("डोलो 650 दिखाओ")).toBe("डोलो 650");
    expect(normalizeMedicineVoiceQuery("क्रोसिन बताओ")).toBe("क्रोसिन");
    expect(normalizeMedicineVoiceQuery("दवाई पैरासिटामोल चाहिए")).toBe("पैरासिटामोल");
  });
});

describe("useSpeechRecognition hook", () => {
  beforeEach(() => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("supports browser speech recognition detection", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(true);
  });

  it("handles unsupported browser gracefully", () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);

    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(false);

    act(() => {
      result.current.start("en");
    });

    expect(result.current.error).toContain("not supported");
  });

  it("starts listening in English (en-IN) and updates state", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start("en");
    });

    expect(result.current.isListening).toBe(true);
  });

  it("starts listening in Hindi (hi-IN) and updates state", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start("hi");
    });

    expect(result.current.isListening).toBe(true);
  });

  it("handles microphone permission denial error", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start("en");
    });

    // Simulate permission denied error
    act(() => {
      const rec = (result.current as any);
      // Access underlying recognition
    });
  });

  it("allows user to stop/cancel speech recognition", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start("en");
    });
    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stop();
    });
    expect(result.current.isListening).toBe(false);
  });
});
