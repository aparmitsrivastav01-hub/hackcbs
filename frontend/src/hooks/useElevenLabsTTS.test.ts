import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElevenLabsTTS } from "./useElevenLabsTTS";

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

describe("useElevenLabsTTS hook", () => {
  let mockFetch: ReturnType<typeof vi.spyOn>;
  let mockCreateObjectURL: ReturnType<typeof vi.spyOn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal("Audio", MockAudio);
    mockCreateObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-audio-url");
    mockRevokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    mockFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/voice/elevenlabs/speak") {
        return new Response(new Blob(["mock-mp3-bytes"], { type: "audio/mpeg" }), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      return new Response("Not found", { status: 404 });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("calls /api/voice/elevenlabs/speak with language and text and starts playback", async () => {
    const { result } = renderHook(() => useElevenLabsTTS());

    await act(async () => {
      await result.current.speak("msg-1", "Paracetamol 500 mg", "en");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/voice/elevenlabs/speak",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "Paracetamol 500 mg", language: "en" }),
      })
    );
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.activeId).toBe("msg-1");
  });

  it("supports Hindi language TTS requests", async () => {
    const { result } = renderHook(() => useElevenLabsTTS());

    await act(async () => {
      await result.current.speak("msg-hi", "पैरासिटामोल 500 एमजी", "hi");
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/voice/elevenlabs/speak",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "पैरासिटामोल 500 एमजी", language: "hi" }),
      })
    );
    expect(result.current.isPlaying).toBe(true);
  });

  it("stops playback when stop() is called or when same ID is toggled", async () => {
    const { result } = renderHook(() => useElevenLabsTTS());

    await act(async () => {
      await result.current.speak("msg-1", "Paracetamol 500 mg", "en");
    });
    expect(result.current.isPlaying).toBe(true);

    // Click same ID again -> toggles off!
    await act(async () => {
      await result.current.speak("msg-1", "Paracetamol 500 mg", "en");
    });
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.activeId).toBe(null);
  });

  it("prevents overlapping audio: starting a new item stops previous playback", async () => {
    const { result } = renderHook(() => useElevenLabsTTS());

    await act(async () => {
      await result.current.speak("item-1", "First item", "en");
    });
    expect(result.current.activeId).toBe("item-1");

    await act(async () => {
      await result.current.speak("item-2", "Second item", "en");
    });
    expect(result.current.activeId).toBe("item-2");
    expect(result.current.isPlaying).toBe(true);
  });

  it("handles backend API failures gracefully with error state", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "ElevenLabs rate limit reached" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { result } = renderHook(() => useElevenLabsTTS());

    await act(async () => {
      await result.current.speak("fail-1", "Will fail", "en");
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.error).toBe("ElevenLabs rate limit reached");
  });
});
