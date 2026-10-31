import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantService } from "./assistantService";

class MockSpeechRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

describe("AssistantService — Native Web Speech API STT & Voice Integration", () => {
  beforeEach(() => {
    vi.stubGlobal("SpeechRecognition", MockSpeechRecognition);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("identifies browser support for Web Speech API", () => {
    const service = new AssistantService();
    expect(service.isSpeechSupported()).toBe(true);
  });

  it("handles unsupported browser gracefully without throwing", () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);

    const service = new AssistantService();
    expect(service.isSpeechSupported()).toBe(false);

    const onResult = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();

    service.startListening("en", onResult, onError, onEnd);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("not supported"));
    expect(onEnd).toHaveBeenCalled();
  });

  it("configures hi-IN locale when Hindi is requested", () => {
    const service = new AssistantService();
    const onResult = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();

    service.startListening("hi", onResult, onError, onEnd);
    // Access private recognition for verification
    const recognition = (service as any).recognition as MockSpeechRecognition;
    expect(recognition.lang).toBe("hi-IN");
    expect(recognition.start).toHaveBeenCalled();
  });

  it("configures en-IN locale when English is requested", () => {
    const service = new AssistantService();
    const onResult = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();

    service.startListening("en", onResult, onError, onEnd);
    const recognition = (service as any).recognition as MockSpeechRecognition;
    expect(recognition.lang).toBe("en-IN");
    expect(recognition.start).toHaveBeenCalled();
  });

  it("handles microphone permission denial gracefully", () => {
    const service = new AssistantService();
    const onResult = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();

    service.startListening("en", onResult, onError, onEnd);
    const recognition = (service as any).recognition as MockSpeechRecognition;

    recognition.onerror?.({ error: "not-allowed" });
    expect(onError).toHaveBeenCalledWith("not-allowed");
    expect(onEnd).toHaveBeenCalled();
  });

  it("handles speech transcription results", () => {
    const service = new AssistantService();
    const onResult = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();

    service.startListening("en", onResult, onError, onEnd);
    const recognition = (service as any).recognition as MockSpeechRecognition;

    recognition.onresult?.({
      results: [[{ transcript: "Dolo 650 alternative" }]],
    });
    expect(onResult).toHaveBeenCalledWith("Dolo 650 alternative");
  });
});
