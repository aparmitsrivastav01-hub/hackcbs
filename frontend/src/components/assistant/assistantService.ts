import type { AssistantAction } from "./assistantTypes";

interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

type GeminiChatResult = {
  response: string;
  session_id: string;
  safety_flags: string[];
  usage: { prompt_tokens: number | null; response_tokens: number | null; total_tokens: number | null };
};

function actionForQuery(rawText: string): AssistantAction | undefined {
  const query = rawText.toLowerCase();
  if (/\b(scan|prescription|upload)\b|पर्चा|स्कैन|अपलोड/.test(query)) {
    return { type: "navigate", path: "/scan", labelEn: "Open prescription scanner →", labelHi: "पर्चा स्कैनर खोलें →" };
  }
  if (/\b(pharmacy|chemist|store|jan aushadhi|nearby)\b|फार्मेसी|दुकान|केंद्र|नज़दीक|नजदीक/.test(query)) {
    return { type: "navigate", path: "/stores", labelEn: "Open nearby pharmacies →", labelHi: "नज़दीकी फ़ार्मेसी खोलें →" };
  }
  if (/\b(batch|cdsco|nsq|alert)\b|बैच|सीडीएससीओ|अलर्ट/.test(query)) {
    return { type: "navigate", path: "/batch-safety", labelEn: "Open batch safety checker →", labelHi: "बैच सुरक्षा जांच खोलें →" };
  }
  if (/\b(cart|enquiry|enquiry list)\b|कार्ट|सूची/.test(query)) {
    return { type: "navigate", path: "/cart", labelEn: "Open enquiry list →", labelHi: "दवा सूची खोलें →" };
  }
  if (/\b(price|prices|cost|compare|catalogue|generic)\b|दाम|कीमत|जेनेरिक/.test(query)) {
    const search = rawText
      .replace(/\b(what is|what are|the|price|prices|cost|compare|generic|medicine|medicines|please|tell me|show me|find|search for)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      type: "search",
      query: search,
      path: `/medicines${search ? `?q=${encodeURIComponent(search)}` : ""}`,
      labelEn: search ? `Search catalogue for ${search} →` : "Open medicine catalogue →",
      labelHi: search ? `${search} कैटलॉग में खोजें →` : "दवा कैटलॉग खोलें →",
    };
  }
  return undefined;
}

async function errorFromResponse(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) return new Error(body.detail);
  } catch {
    // Use the status-based error below.
  }
  return new Error(`Request failed (${response.status})`);
}

export class AssistantService {
  private recognition: any = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private speechController: AbortController | null = null;
  private finishPlayback: (() => void) | null = null;
  private isListening = false;

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    if (typeof window === "undefined") return;
    const win = window as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
    }
  }

  public startListening(
    locale: "en" | "hi",
    onResult: (transcript: string) => void,
    onError: (err: string) => void,
    onEnd: () => void,
  ) {
    if (!this.recognition) {
      onError(locale === "hi"
        ? "आपके ब्राउज़र में वॉइस रिकग्निशन समर्थित नहीं है। कृपया नीचे लिखकर पूछें।"
        : "Voice recognition is not supported in this browser. Please type your question.");
      onEnd();
      return;
    }
    if (this.isListening) this.stopListening();
    this.stopSpeaking();
    this.recognition.lang = locale === "hi" ? "hi-IN" : "en-IN";
    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) onResult(transcript);
    };
    this.recognition.onerror = (event: any) => {
      onError(event.error || "Speech recognition error");
      this.isListening = false;
      onEnd();
    };
    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };
    try {
      this.recognition.start();
      this.isListening = true;
    } catch {
      this.isListening = false;
      onEnd();
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // The browser may already have ended recognition.
      }
      this.isListening = false;
    }
  }

  public stopSpeaking() {
    this.speechController?.abort();
    this.speechController = null;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.removeAttribute("src");
      this.currentAudio.load();
      this.currentAudio = null;
    }
    if (this.currentAudioUrl) URL.revokeObjectURL(this.currentAudioUrl);
    this.currentAudioUrl = null;
    this.finishPlayback?.();
    this.finishPlayback = null;
  }

  public pauseSpeaking() {
    this.currentAudio?.pause();
  }

  public async resumeSpeaking() {
    if (this.currentAudio) await this.currentAudio.play();
  }

  public async speakText(
    text: string,
    locale: "en" | "hi",
    onGenerating?: () => void,
    onSpeaking?: () => void,
    onEnd?: () => void,
  ): Promise<void> {
    this.stopSpeaking();
    const controller = new AbortController();
    this.speechController = controller;
    onGenerating?.();
    try {
      const response = await fetch("/api/voice/elevenlabs/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 2500), language: locale }),
        signal: controller.signal,
      });
      if (!response.ok) throw await errorFromResponse(response);
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      this.currentAudioUrl = audioUrl;
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (this.currentAudio === audio) this.currentAudio = null;
          if (this.currentAudioUrl === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            this.currentAudioUrl = null;
          }
          this.finishPlayback = null;
          onEnd?.();
          resolve();
        };
        this.finishPlayback = finish;
        audio.onended = finish;
        audio.onerror = () => {
          if (settled) return;
          settled = true;
          if (this.currentAudio === audio) this.currentAudio = null;
          if (this.currentAudioUrl === audioUrl) {
            URL.revokeObjectURL(audioUrl);
            this.currentAudioUrl = null;
          }
          this.finishPlayback = null;
          reject(new Error("ElevenLabs audio could not be played by this browser."));
        };
        void audio.play().then(() => onSpeaking?.()).catch(reject);
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        onEnd?.();
        return;
      }
      onEnd?.();
      throw err;
    } finally {
      if (this.speechController === controller) this.speechController = null;
    }
  }

  public async processUserInput(
    query: string,
    locale: "en" | "hi",
    sessionId: string | null,
    onDelta?: (text: string) => void,
  ): Promise<GeminiChatResult & { action?: AssistantAction }> {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ message: query, session_id: sessionId, language: locale, stream: true }),
    });
    if (!response.ok) throw await errorFromResponse(response);
    if (!response.body) throw new Error("Gemini response stream is unavailable.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: GeminiChatResult | null = null;

    const handleFrame = (frame: string) => {
      const data = frame.split(/\r?\n/).find((line) => line.startsWith("data:"))?.slice(5).trim();
      if (!data) return;
      const event = JSON.parse(data) as { type: string; text?: string; detail?: string; session_id?: string } & Partial<GeminiChatResult>;
      if (event.type === "delta" && event.text) onDelta?.(event.text);
      if (event.type === "error") throw new Error(event.detail || "Gemini response failed.");
      if (event.type === "done") {
        result = {
          response: event.response ?? "",
          session_id: event.session_id ?? "",
          safety_flags: event.safety_flags ?? [],
          usage: event.usage ?? { prompt_tokens: null, response_tokens: null, total_tokens: null },
        };
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) handleFrame(frame);
      if (done) break;
    }
    if (buffer.trim()) handleFrame(buffer);
    const finalResult = result as GeminiChatResult | null;
    if (!finalResult) throw new Error("Gemini ended the response before sending a final result.");
    return { ...finalResult, action: actionForQuery(query) };
  }
}

export const assistantService = new AssistantService();
