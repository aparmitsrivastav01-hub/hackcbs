import { useCallback, useEffect, useRef, useState } from "react";

// In-memory audio blob cache for current page session to avoid duplicate API calls
const audioCache = new Map<string, Blob>();

export function clearTTSCache() {
  audioCache.clear();
}

export interface UseElevenLabsTTSResult {
  activeId: string | null;
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  speak: (id: string, text: string, locale: "en" | "hi") => Promise<void>;
  stop: () => void;
  clearError: () => void;
}

export function useElevenLabsTTS(): UseElevenLabsTTSResult {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    // 1. Abort any pending fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Pause and clean up current audio element
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.removeAttribute("src");
        currentAudioRef.current.load();
      } catch {
        /* Ignore audio cleanup errors */
      }
      currentAudioRef.current = null;
    }

    // 3. Revoke object URL
    if (currentUrlRef.current) {
      try {
        URL.revokeObjectURL(currentUrlRef.current);
      } catch {
        /* Ignore revoke errors */
      }
      currentUrlRef.current = null;
    }

    setActiveId(null);
    setIsLoading(false);
    setIsPlaying(false);
  }, []);

  const speak = useCallback(
    async (id: string, text: string, locale: "en" | "hi") => {
      // If currently playing or loading this exact ID, clicking it toggles playback off
      if (activeId === id && (isPlaying || isLoading)) {
        stop();
        return;
      }

      // Stop any existing playback first to prevent overlapping audio
      stop();
      setError(null);

      const cleanText = text.trim();
      if (!cleanText) return;

      setActiveId(id);
      setIsLoading(true);

      const cacheKey = `${locale}:${cleanText}`;

      try {
        let blob: Blob;

        if (audioCache.has(cacheKey)) {
          blob = audioCache.get(cacheKey)!;
        } else {
          const controller = new AbortController();
          abortControllerRef.current = controller;

          const res = await fetch("/api/voice/elevenlabs/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: cleanText.slice(0, 2500),
              language: locale,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            let detail = "Speech generation request failed.";
            try {
              const errJson = (await res.json()) as { detail?: string };
              if (errJson.detail) detail = errJson.detail;
            } catch {
              detail = `Server error (${res.status})`;
            }
            throw new Error(detail);
          }

          blob = await res.blob();
          audioCache.set(cacheKey, blob);
        }

        // Check if aborted while waiting for fetch
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        const audioUrl = URL.createObjectURL(blob);
        currentUrlRef.current = audioUrl;

        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onplay = () => {
          setIsLoading(false);
          setIsPlaying(true);
        };

        audio.onended = () => {
          stop();
        };

        audio.onerror = () => {
          stop();
          setError("Audio could not be played by this browser.");
        };

        await audio.play();
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // Normal abort, do not set error
          return;
        }
        stop();
        const msg = err instanceof Error ? err.message : "Voice playback failed.";
        setError(msg);
      }
    },
    [activeId, isLoading, isPlaying, stop]
  );

  const clearError = useCallback(() => setError(null), []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    activeId,
    isLoading,
    isPlaying,
    error,
    speak,
    stop,
    clearError,
  };
}
