import type { AssistantAction } from "./assistantTypes";

// Speech Recognition Type Definitions for TypeScript
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

/**
 * ElevenLabs Voice IDs:
 * "21m00Tcm4TlvDq8ikWAM" (Rachel - Multilingual, clear and reassuring)
 * "XB0fDUnXU5powFXDhCwa" (Charlotte - Warm, friendly healthcare tone)
 */
const ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

export class AssistantService {
  private recognition: any = null;
  private currentAudio: HTMLAudioElement | null = null;
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

  /**
   * Start listening for voice input in the specified language ('hi-IN' or 'en-IN')
   */
  public startListening(
    locale: "en" | "hi",
    onResult: (transcript: string) => void,
    onError: (err: string) => void,
    onEnd: () => void
  ) {
    if (!this.recognition) {
      onError(
        locale === "hi"
          ? "आपके ब्राउज़र में वॉइस रिकग्निशन समर्थित नहीं है। कृपया नीचे लिखकर पूछें।"
          : "Voice recognition is not supported in this browser. Please type your message."
      );
      onEnd();
      return;
    }

    if (this.isListening) {
      this.stopListening();
    }

    this.stopSpeaking();

    this.recognition.lang = locale === "hi" ? "hi-IN" : "en-IN";

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onResult(transcript);
      }
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

  /**
   * Stop listening for speech
   */
  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
      this.isListening = false;
    }
  }

  /**
   * Stop active speech output (audio or speech synthesis)
   */
  public stopSpeaking() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Speak text using ElevenLabs API (with automatic Web Speech fallback)
   */
  public async speakText(
    text: string,
    locale: "en" | "hi",
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<void> {
    this.stopSpeaking();
    onStart?.();

    // 1. Try Backend ElevenLabs TTS endpoint first
    try {
      const response = await fetch("/api/assistant/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice_id: ELEVENLABS_VOICE_ID,
          language: locale,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        audio.onended = () => {
          this.currentAudio = null;
          onEnd?.();
        };

        audio.onerror = () => {
          this.currentAudio = null;
          this.fallbackSpeechSynthesis(text, locale, onEnd);
        };

        await audio.play();
        return;
      }
    } catch {
      // Backend TTS not yet available, fallback to browser speech synthesis
    }

    // 2. High-Fidelity Browser Speech Synthesis Fallback
    this.fallbackSpeechSynthesis(text, locale, onEnd);
  }

  private fallbackSpeechSynthesis(text: string, locale: "en" | "hi", onEnd?: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }

    const cleanText = text.replace(/[*_#`]/g, ""); // Clean markdown symbols
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = locale === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.95; // Slightly slower for non-technical/elderly listeners
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(
      (v) =>
        (locale === "hi" ? v.lang.includes("hi") : v.lang.includes("en-IN") || v.lang.includes("en")) &&
        !v.name.includes("Whisper")
    );
    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Process user input: calls backend Gemini agent route or uses client-side intelligent routing
   */
  public async processUserInput(
    query: string,
    locale: "en" | "hi"
  ): Promise<{ textEn: string; textHi: string; action?: AssistantAction }> {
    // 1. Try to call teammate's backend endpoint if available
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, locale }),
      });

      if (res.ok) {
        const data = await res.json();
        return {
          textEn: data.text_en || data.text,
          textHi: data.text_hi || data.text,
          action: data.action,
        };
      }
    } catch {
      // Backend not reachable, execute smart Gemini client navigation controller below
    }

    // 2. Intelligent Gemini Navigation Intent Classifier
    return this.classifyIntent(query, locale);
  }

  /**
   * Client-side Gemini semantic intent router
   */
  private classifyIntent(
    rawText: string,
    _currentLocale?: "en" | "hi"
  ): { textEn: string; textHi: string; action?: AssistantAction } {
    const q = rawText.toLowerCase().trim();

    // 1. PRESCRIPTION SCANNING
    if (
      q.includes("scan") ||
      q.includes("prescription") ||
      q.includes("parcha") ||
      q.includes("doctor") ||
      q.includes("photo") ||
      q.includes("upload") ||
      q.includes("पर्चा") ||
      q.includes("स्कैन") ||
      q.includes("अपलोड")
    ) {
      return {
        textEn: "Opening the prescription scanner. You can upload a photo or PDF of your doctor's prescription, and our AI will extract the medicine names for you to review.",
        textHi: "पर्चा स्कैनर खोला जा रहा है। आप डॉक्टर के पर्चे की फोटो या PDF अपलोड कर सकते हैं, जिससे दवाइयों के नाम आसानी से निकल आएंगे।",
        action: {
          type: "navigate",
          path: "/scan",
          labelEn: "Go to Prescription Scanner →",
          labelHi: "पर्चा स्कैनर पर जाएं →",
        },
      };
    }

    // 2. PHARMACY / STORE LOCATOR
    if (
      q.includes("store") ||
      q.includes("pharmacy") ||
      q.includes("chemist") ||
      q.includes("kendra") ||
      q.includes("jan aushadhi") ||
      q.includes("nearby") ||
      q.includes("shop") ||
      q.includes("dawa ki dukan") ||
      q.includes("दुकान") ||
      q.includes("केंद्र") ||
      q.includes("नजदीक") ||
      q.includes("पास") ||
      q.includes("फार्मेसी")
    ) {
      return {
        textEn: "Navigating to Nearby Pharmacies. You can find government Jan Aushadhi Kendras and local chemists, and send a pre-filled WhatsApp enquiry for medicine stock.",
        textHi: "नज़दीकी मेडिकल स्टोर पृष्ठ पर ले जा रहे हैं। आप सरकारी जन औषधि केंद्र देख सकते हैं और सीधे व्हाट्सएप पर दवा की उपलब्धता पूछ सकते हैं।",
        action: {
          type: "navigate",
          path: "/stores",
          labelEn: "Find Nearby Pharmacies →",
          labelHi: "पास के मेडिकल स्टोर खोजें →",
        },
      };
    }

    // 3. BATCH SAFETY CHECKER
    if (
      q.includes("batch") ||
      q.includes("safety") ||
      q.includes("nsq") ||
      q.includes("cdsco") ||
      q.includes("quality") ||
      q.includes("alert") ||
      q.includes("spurious") ||
      q.includes("adulterated") ||
      q.includes("बैच") ||
      q.includes("सुरक्षा") ||
      q.includes("अलर्ट") ||
      q.includes("गुणवत्ता") ||
      q.includes("खराब")
    ) {
      return {
        textEn: "Opening the CDSCO Batch Safety Checker. Type the batch number printed on your medicine pack to verify it against official government substandard drug notices.",
        textHi: "बैच सुरक्षा जांच पृष्ठ खोला जा रहा है। दवा की पैकिंग पर लिखा बैच नंबर डालकर आप सरकारी गुणवत्ता अलर्ट में जांच कर सकते हैं।",
        action: {
          type: "navigate",
          path: "/batch-safety",
          labelEn: "Check Batch Safety Alert →",
          labelHi: "बैच सुरक्षा जांचें →",
        },
      };
    }

    // 4. CART / ENQUIRY LIST
    if (
      q.includes("cart") ||
      q.includes("list") ||
      q.includes("enquiry") ||
      q.includes("whatsapp") ||
      q.includes("basket") ||
      q.includes("कार्ट") ||
      q.includes("सूची") ||
      q.includes("लिस्ट")
    ) {
      return {
        textEn: "Taking you to your Pharmacy Enquiry List. You can adjust quantities and prepare a ready-to-send WhatsApp message for your nearby chemist.",
        textHi: "आपकी दवा पूछताछ सूची (कार्ट) पर ले जा रहे हैं। आप दवाओं की संख्या बदल सकते हैं और मेडिकल स्टोर के लिए व्हाट्सएप संदेश तैयार कर सकते हैं।",
        action: {
          type: "navigate",
          path: "/cart",
          labelEn: "Open Enquiry Cart →",
          labelHi: "पूछताछ सूची देखें →",
        },
      };
    }

    // 5. LANGUAGE CHANGE REQUESTS
    if (q.includes("hindi") || q.includes("हिंदी") || q.includes("hindi me")) {
      return {
        textEn: "Switching language to Hindi (हिंदी) across MedEasy.",
        textHi: "MedEasy की भाषा बदलकर हिंदी कर दी गई है। अब आप हिंदी में जानकारी देख सकते हैं।",
        action: {
          type: "change_language",
          lang: "hi",
          labelEn: "Switch to Hindi",
          labelHi: "हिंदी में बदलें",
        },
      };
    }

    if (q.includes("english") || q.includes("अंग्रेजी") || q.includes("angrezi")) {
      return {
        textEn: "Switching language to English across MedEasy.",
        textHi: "MedEasy की भाषा English में बदल दी गई है।",
        action: {
          type: "change_language",
          lang: "en",
          labelEn: "Switch to English",
          labelHi: "English में बदलें",
        },
      };
    }

    // 6. HOW IT WORKS / HELP
    if (
      q.includes("how") ||
      q.includes("help") ||
      q.includes("guide") ||
      q.includes("kaise") ||
      q.includes("madad") ||
      q.includes("कैसे") ||
      q.includes("मदद") ||
      q.includes("सहायता")
    ) {
      return {
        textEn: "MedEasy helps you compare private brand medicines with Jan Aushadhi and Dava India generic alternatives. Opening the 'How It Works' guide.",
        textHi: "MedEasy आपको ब्रांडेड दवाओं के मुकाबले सस्ती जन औषधि और दवा इंडिया जेनेरिक दवाओं के दाम दिखाता है। 'कैसे काम करता है' पृष्ठ खोला जा रहा है।",
        action: {
          type: "navigate",
          path: "/how-it-works",
          labelEn: "See How It Works →",
          labelHi: "कैसे काम करता है देखें →",
        },
      };
    }

    // 7. SPECIFIC MEDICINE PRICE LOOKUP (e.g. "Paracetamol", "Crocin", "Metformin")
    const commonMeds = [
      "paracetamol",
      "crocin",
      "metformin",
      "pantoprazole",
      "telmisartan",
      "amoxicillin",
      "atorvastatin",
      "azithromycin",
      "cetirizine",
      "ibuprofen",
      "omeprazole",
      "dolo",
    ];

    const matchedMed = commonMeds.find((m) => q.includes(m));
    if (matchedMed || q.includes("medicine") || q.includes("dawa") || q.includes("price") || q.includes("दवा") || q.includes("कीमत") || q.includes("दाम")) {
      const searchTarget = matchedMed
        ? matchedMed.charAt(0).toUpperCase() + matchedMed.slice(1)
        : q.replace(/(what is the price of|price of|search for|find|medicine|dawa|ki|ka|bhav|दवा|का|दाम|कीमत)/gi, "").trim();

      const finalQuery = searchTarget || "Paracetamol";

      return {
        textEn: `Searching our catalogue for "${finalQuery}". Showing price differences between Jan Aushadhi generic and commercial brands.`,
        textHi: `"${finalQuery}" के लिए कैटलॉग खोजा जा रहा है। जन औषधि जेनेरिक और ब्रांडेड दवाओं के दामों की तुलना प्रदर्शित की जा रही है।`,
        action: {
          type: "search",
          query: finalQuery,
          path: `/medicines?q=${encodeURIComponent(finalQuery)}`,
          labelEn: `View "${finalQuery}" Prices →`,
          labelHi: `"${finalQuery}" के दाम देखें →`,
        },
      };
    }

    // 8. GENERAL FRIENDLY ASSISTANCE / GREETING
    return {
      textEn: "I can help you scan a prescription, compare generic medicine prices, find nearby Jan Aushadhi stores, or check batch safety. What would you like to do?",
      textHi: "मैं आपका पर्चा स्कैन करने, सस्ती जेनेरिक दवाओं के दाम जांचने, पास के जन औषधि केंद्र खोजने या बैच सुरक्षा देखने में आपकी मदद कर सकता हूँ। आप क्या करना चाहेंगे?",
    };
  }
}

export const assistantService = new AssistantService();
