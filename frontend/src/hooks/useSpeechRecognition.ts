import { useCallback, useEffect, useRef, useState } from "react";

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export function normalizeMedicineVoiceQuery(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();

  // Strip common English conversational wrappers
  clean = clean.replace(
    /^(please\s+)?(search\s+for|find|look\s+for|show\s+me|show|check|what\s+is\s+the\s+price\s+of|price\s+of|tell\s+me\s+about|do\s+you\s+have)\s+/i,
    ""
  );
  clean = clean.replace(
    /\s+(please|medicine|tablet|tablets|syrup|capsule|capsules)$/i,
    ""
  );

  // Strip leading conversational phrases in Hindi
  clean = clean.replace(
    /^(कृपया\s+)?(मुझे\s+)?(दवा\s+|दवाई\s+)?(खोजो|ढूंढो|दिखाओ|बताओ|कीमत\s+बताओ|दाम\s+बताओ)?\s*(दवा\s+|दवाई\s+)?/u,
    ""
  );

  // Strip trailing conversational words in Hindi
  clean = clean.replace(
    /\s+(खोजो|ढूंढो|दिखाओ|बताओ|चाहिए|कीमत\s+बताओ|के\s+दाम\s+बताओ|की\s+दवा|की\s+दवाई|दवा|दवाई)$/u,
    ""
  );

  // Collapse whitespace and trim punctuation
  return clean.replace(/[?.!,]+$/g, "").replace(/\s+/g, " ").trim();
}

export interface UseSpeechRecognitionResult {
  isListening: boolean;
  transcript: string;
  normalizedTranscript: string;
  error: string | null;
  isSupported: boolean;
  start: (
    locale: "en" | "hi",
    onResult?: (raw: string, normalized: string) => void
  ) => void;
  stop: () => void;
  reset: () => void;
  clearError: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [normalizedTranscript, setNormalizedTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const onResultCallbackRef = useRef<
    ((raw: string, normalized: string) => void) | null
  >(null);

  const isSupported =
    typeof window !== "undefined" &&
    Boolean(
      (window as IWindow).SpeechRecognition ||
        (window as IWindow).webkitSpeechRecognition
    );

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* Already stopped */
      }
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript("");
    setNormalizedTranscript("");
    setError(null);
  }, [stop]);

  const clearError = useCallback(() => setError(null), []);

  const start = useCallback(
    (
      locale: "en" | "hi",
      onResult?: (raw: string, normalized: string) => void
    ) => {
      if (typeof window === "undefined") return;

      const win = window as IWindow;
      const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (!SpeechRec) {
        setError(
          locale === "hi"
            ? "आपके ब्राउज़र में वॉइस रिकग्निशन समर्थित नहीं है। कृपया लिखकर खोजें।"
            : "Voice recognition is not supported in this browser. Please type your search query."
        );
        return;
      }

      // Stop previous instance if running
      stop();
      setError(null);
      setTranscript("");
      setNormalizedTranscript("");
      onResultCallbackRef.current = onResult || null;

      try {
        const recognition = new SpeechRec();
        recognitionRef.current = recognition;

        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = locale === "hi" ? "hi-IN" : "en-IN";

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          const raw = event.results?.[0]?.[0]?.transcript ?? "";
          if (!raw) return;

          setTranscript(raw);
          const normalized = normalizeMedicineVoiceQuery(raw);
          setNormalizedTranscript(normalized);

          // If final result
          if (event.results?.[0]?.isFinal) {
            onResultCallbackRef.current?.(raw, normalized);
          }
        };

        recognition.onerror = (event: any) => {
          setIsListening(false);
          const errCode = event?.error;
          if (errCode === "no-speech") {
            // Graceful, user just didn't speak
            return;
          }
          if (errCode === "not-allowed" || errCode === "permission-denied") {
            setError(
              locale === "hi"
                ? "माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया ब्राउज़र सेटिंग्स में माइक्रोफ़ोन चालू करें।"
                : "Microphone permission denied. Please allow microphone access in your browser."
            );
            return;
          }
          setError(
            locale === "hi"
              ? "वॉइस इनपुट में त्रुटि हुई। कृपया पुनः प्रयास करें या लिखकर खोजें।"
              : "Voice input error. Please try again or type your query."
          );
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (err: unknown) {
        setIsListening(false);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to start speech recognition"
        );
      }
    },
    [stop]
  );

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* Ignore */
        }
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    normalizedTranscript,
    error,
    isSupported,
    start,
    stop,
    reset,
    clearError,
  };
}
