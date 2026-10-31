import {
  ArrowRight,
  Bot,
  Brain,
  Languages,
  MapPin,
  Mic,
  Pause,
  Pill,
  Play,
  RotateCcw,
  ScanLine,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { assistantService } from "../components/assistant/assistantService";
import type {
  AssistantAction,
  AssistantMessage,
  SpeechState,
} from "../components/assistant/assistantTypes";
import { VoiceVisualizer } from "../components/assistant/VoiceVisualizer";
import { useElevenLabsTTS } from "../hooks/useElevenLabsTTS";
import { useLanguage } from "../i18n/LanguageContext";

function getActionLabel(action: AssistantAction, isHindi: boolean): string {
  if ("labelHi" in action && action.labelHi && action.labelEn) {
    return isHindi ? action.labelHi : action.labelEn;
  }
  return isHindi ? "विवरण देखें →" : "View Details →";
}

export function MedSaathiPage() {
  const navigate = useNavigate();
  const { locale, setLocale, tr, isHi } = useLanguage();

  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [inputText, setInputText] = useState("");
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [chatError, setChatError] = useState("");
  const [memoryConsent, setMemoryConsent] = useState(false);
  const [memoryUpdating, setMemoryUpdating] = useState(false);
  const requestInFlight = useRef(false);
  const voiceQueryPending = useRef(false);

  const tts = useElevenLabsTTS();

  useEffect(() => {
    if (tts.isLoading) {
      setSpeechState("generating");
    } else if (tts.isPlaying) {
      setSpeechState("speaking");
    } else if (speechState === "speaking" || speechState === "generating") {
      setSpeechState("idle");
    }
  }, [tts.isLoading, tts.isPlaying]);

  useEffect(() => {
    fetch("/api/memory/consent")
      .then((res) => res.json())
      .then((data: { consent?: boolean }) => {
        if (typeof data.consent === "boolean") {
          setMemoryConsent(data.consent);
        }
      })
      .catch(() => {});
  }, []);

  async function handleToggleMemoryConsent() {
    if (memoryUpdating) return;
    setMemoryUpdating(true);
    const nextConsent = !memoryConsent;
    try {
      const res = await fetch("/api/memory/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: nextConsent }),
      });
      const data = (await res.json()) as { consent?: boolean };
      if (typeof data.consent === "boolean") {
        setMemoryConsent(data.consent);
      }
    } catch {
      // Fail safely
    } finally {
      setMemoryUpdating(false);
    }
  }

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "medsaathi-welcome",
      role: "assistant",
      textEn:
        "Hello! I am MedSaathi, your voice and AI healthcare companion. You can speak to me in English or हिंदी to scan prescriptions, compare generic medicine prices, find Jan Aushadhi stores, or check batch safety. What can I do for you today?",
      textHi:
        "नमस्ते! मैं मेडसाथी (MedSaathi) हूँ, आपका वॉइस व AI स्वास्थ्य सहायक। आप मुझसे हिंदी या English में बोलकर पर्चा स्कैन करवा सकते हैं, सस्ती जेनेरिक दवाओं के दाम जान सकते हैं, पास के जन औषधि केंद्र खोज सकते हैं, या बैच सुरक्षा जांच सकते हैं। बताइए, मैं आपकी क्या सहायता करूँ?",
      timestamp: "Just now",
    },
  ]);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatContainerRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, transcriptPreview]);

  // Handle Voice Interaction
  function handleToggleVoice() {
    if (speechState === "listening") {
      assistantService.stopListening();
      setSpeechState("idle");
      return;
    }

    if (["speaking", "generating", "paused"].includes(speechState) || tts.isPlaying || tts.isLoading) {
      tts.stop();
      assistantService.stopSpeaking();
      setSpeechState("idle");
      return;
    }

    setTranscriptPreview("");
    setSpeechState("listening");

    assistantService.startListening(
      locale,
      (transcript) => {
        setTranscriptPreview(transcript);
        voiceQueryPending.current = true;
        handleSendQuery(transcript);
      },
      (error) => {
        setSpeechState("idle");
        if (error.includes("not-allowed") || error.includes("denied")) {
          addMessage(
            "Microphone permission was denied. Please allow microphone access or type your query below.",
            "माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया माइक्रोफ़ोन चालू करें या नीचे लिखकर पूछें।",
            "assistant"
          );
        } else if (error.includes("not supported") || error.includes("समर्थित नहीं")) {
          addMessage(
            "Voice recognition is not supported in this browser. Please type your query in the chat input below.",
            "आपके ब्राउज़र में वॉइस रिकग्निशन समर्थित नहीं है। कृपया नीचे लिखकर पूछें।",
            "assistant"
          );
        }
      },
      () => {
        setSpeechState((prev) => (prev === "listening" ? "idle" : prev));
      }
    );
  }

  // Handle Query Execution
  async function handleSendQuery(queryText: string) {
    if (!queryText.trim() || requestInFlight.current) return;

    requestInFlight.current = true;
    setChatError("");
    setStreamingText("");
    addMessage(queryText, queryText, "user");
    setInputText("");
    setTranscriptPreview("");
    setSpeechState("processing");

    try {
      const response = await assistantService.processUserInput(queryText, locale, chatSessionId, (delta) => setStreamingText((current) => current + delta));
      setChatSessionId(response.session_id);
      setStreamingText("");
      const newMsgId = `asst-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      addMessage(response.response, response.response, "assistant", response.action, response.safety_flags, response.usage, newMsgId);

      const speakThisVoiceTurn = voiceQueryPending.current;
      voiceQueryPending.current = false;
      if (speakThisVoiceTurn && !isVoiceMuted) {
        await tts.speak(newMsgId, isHi ? response.response : response.response, locale);
      } else {
        setSpeechState("idle");
      }
    } catch (error) {
      setSpeechState("idle");
      setStreamingText("");
      setChatError(error instanceof Error ? error.message : "The assistant request failed.");
    } finally {
      requestInFlight.current = false;
      voiceQueryPending.current = false;
    }
  }

  function addMessage(
    textEn: string,
    textHi: string,
    role: "user" | "assistant",
    action?: AssistantAction,
    safetyFlags?: string[],
    usage?: AssistantMessage["usage"],
    customId?: string
  ) {
    setMessages((prev) => [
      ...prev,
      {
        id: customId || Math.random().toString(36).substring(7),
        role,
        textEn,
        textHi,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        action,
        safetyFlags,
        usage,
      },
    ]);
  }

  function handleExecuteAction(action: AssistantAction) {
    if (action.type === "navigate" || action.type === "search") {
      navigate(action.path);
    } else if (action.type === "change_language") {
      setLocale(action.lang);
    }
  }

  function handleReset() {
    tts.stop();
    assistantService.stopSpeaking();
    assistantService.stopListening();
    requestInFlight.current = false;
    voiceQueryPending.current = false;
    setChatSessionId(null);
    setStreamingText("");
    setChatError("");
    setSpeechState("idle");
    setTranscriptPreview("");

    // Reset memory in backend (does NOT re-enable consent)
    void fetch("/api/memory/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});

    setMessages([
      {
        id: "reset-welcome",
        role: "assistant",
        textEn: "Conversation refreshed. How can I help you navigate MedEasy?",
        textHi: "बातचीत रीसेट हो गई है। MedEasy में मैं आपकी क्या मदद कर सकता हूँ?",
        timestamp: "Just now",
      },
    ]);
  }

  const quickPrompts = [
    {
      labelEn: "Scan my doctor's prescription",
      labelHi: "मेरा पर्चा स्कैन करो",
      icon: ScanLine,
      color: "brand",
    },
    {
      labelEn: "Check Paracetamol generic price",
      labelHi: "पैरासिटामोल के जेनेरिक दाम बताओ",
      icon: Pill,
      color: "emerald",
    },
    {
      labelEn: "Find nearby Jan Aushadhi stores",
      labelHi: "मेरे पास के जन औषधि केंद्र दिखाओ",
      icon: MapPin,
      color: "blue",
    },
    {
      labelEn: "Check medicine batch quality alert",
      labelHi: "दवाई का बैच नंबर चेक करो",
      icon: ShieldCheck,
      color: "amber",
    },
    {
      labelEn: "Show my enquiry cart",
      labelHi: "मेरी दवा सूची / कार्ट खोलो",
      icon: ShoppingCart,
      color: "purple",
    },
  ];

  return (
    <>
      <Helmet>
        <title>{tr("MedSaathi — Voice & AI Healthcare Assistant — MedEasy", "मेडसाथी — वॉइस व AI स्वास्थ्य सहायक — MedEasy")}</title>
        <meta
          name="description"
          content={tr(
            "MedSaathi is your friendly, multilingual AI healthcare assistant. Speak or type in English or Hindi to navigate medicine prices, scan prescriptions, and find Jan Aushadhi stores.",
            "मेडसाथी आपका दोभाषी AI स्वास्थ्य सहायक है। अंग्रेजी या हिंदी में बोलकर दवाइयों के दाम जानें, पर्चा स्कैन करें और जन औषधि केंद्र खोजें।"
          )}
        />
      </Helmet>

      <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f4f8fe_40%,#edf5ff_100%)] pb-24 pt-8">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          {/* Header Banner */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-[#eef5ff] px-4 py-1.5 text-xs font-bold text-brand shadow-xs">
              <Sparkles className="h-4 w-4 text-brand animate-pulse" />
              <span>{tr("Voice & Multimodal AI Healthcare Agent", "वॉइस व मल्टीमॉडल AI हेल्थकेयर साथी")}</span>
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-navy sm:text-5xl">
              {tr("Meet", "मिलिए")} <span className="text-brand">MedSaathi</span>
              {tr(" — Your Voice Healthcare Guide", " से — आपका आवाज़-संचालित स्वास्थ्य साथी")}
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {tr(
                "Designed for people of all ages and technical backgrounds. Speak or type in English or हिंदी to search affordable generic medicines, scan prescriptions, find nearby pharmacies, and verify drug batch quality.",
                "सभी आयु वर्ग और गैर-तकनीकी उपयोगकर्ताओं के लिए निर्मित। किफायती जेनेरिक दवाओं के दाम खोजने, पर्चा स्कैन करने, मेडिकल स्टोर ढूंढने और बैच गुणवत्ता जांचने के लिए आसानी से बोलें या लिखें।"
              )}
            </p>
          </div>

          {/* MAIN TWO-COLUMN AGENT CONSOLE */}
          <div className="mt-10 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN: Voice Interaction Pod (5 cols) */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_16px_40px_rgba(15,40,90,0.08)] lg:col-span-5 md:p-8">
              <div>
                {/* Pod Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-white shadow-md">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-navy">
                        {isHi ? "वॉइस कमांड सेंटर" : "Voice Command Hub"}
                      </h3>
                      <p className="text-[11px] font-medium text-slate-400">
                        {isHi ? "Gemini व ElevenLabs AI" : "Gemini & ElevenLabs Voice"}
                      </p>
                    </div>
                  </div>

                  {/* Language Toggle & Voice Mute */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLocale(locale === "en" ? "hi" : "en")}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-[#f8fbff] px-3 py-1 text-xs font-bold text-navy shadow-2xs hover:border-brand hover:text-brand"
                    >
                      <Languages className="h-3.5 w-3.5 text-brand" />
                      <span>{locale === "en" ? "हिंदी" : "English"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (["speaking", "generating", "paused"].includes(speechState)) assistantService.stopSpeaking();
                        setIsVoiceMuted((v) => !v);
                      }}
                      className={`rounded-full p-2 text-slate-500 hover:bg-slate-100 ${
                        isVoiceMuted ? "text-red-500" : "text-brand"
                      }`}
                      title={isVoiceMuted ? "Unmute Voice" : "Mute Voice"}
                    >
                      {isVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Live Waveform Visualizer */}
                <div className="mt-6">
                  <VoiceVisualizer state={speechState} />
                </div>

                {/* Central Interactive Glowing Microphone Orb */}
                <div className="my-8 flex flex-col items-center justify-center">
                  <div className="relative">
                    {speechState === "listening" && (
                      <div className="absolute -inset-6 rounded-full bg-emerald-400/30 animate-ping" />
                    )}
                    {["speaking", "generating"].includes(speechState) && (
                      <div className="absolute -inset-6 rounded-full bg-brand/30 animate-pulse" />
                    )}

                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      className={`relative flex h-36 w-36 items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300 active:scale-95 ${
                        speechState === "listening"
                          ? "bg-emerald-500 ring-8 ring-emerald-100 shadow-[0_0_48px_rgba(16,185,129,0.55)] scale-105"
                          : ["speaking", "generating", "paused"].includes(speechState)
                            ? "bg-brand ring-8 ring-blue-100 shadow-[0_0_48px_rgba(8,123,255,0.55)] scale-105"
                            : "bg-[linear-gradient(135deg,#087BFF_0%,#0056cc_100%)] ring-8 ring-blue-50 hover:scale-105"
                      }`}
                    >
                      {speechState === "listening" ? (
                        <Mic className="h-16 w-16 text-white animate-bounce" />
                      ) : ["speaking", "generating", "paused"].includes(speechState) ? (
                        <Volume2 className="h-16 w-16 text-white animate-pulse" />
                      ) : (
                        <Mic className="h-16 w-16 text-white" />
                      )}
                    </button>
                  </div>

                  <p className="mt-5 text-sm font-black text-navy">
                    {speechState === "listening"
                      ? isHi
                        ? "सुन रहे हैं... बोलिए"
                        : "Listening... speak now"
                      : ["speaking", "generating", "paused"].includes(speechState)
                        ? isHi
                          ? speechState === "generating" ? "आवाज़ तैयार हो रही है..." : "बोल रहे हैं (रोकने के लिए दबाएं)"
                          : speechState === "generating" ? "Generating voice..." : "Speaking aloud (Tap to stop)"
                        : isHi
                          ? "बोलने के लिए माइक दबाएं"
                          : "Tap microphone to speak"}
                  </p>
                  {speechState === "speaking" && <div className="mt-3 flex gap-2"><button type="button" onClick={() => { assistantService.pauseSpeaking(); setSpeechState("paused"); }} className="rounded-lg border px-3 py-1 text-xs"><Pause className="mr-1 inline h-3 w-3" />{tr("Pause", "रोकें")}</button><button type="button" onClick={() => { assistantService.stopSpeaking(); setSpeechState("idle"); }} className="rounded-lg border px-3 py-1 text-xs"><Square className="mr-1 inline h-3 w-3" />{tr("Stop", "बंद करें")}</button></div>}
                  {speechState === "paused" && <div className="mt-3 flex gap-2"><button type="button" onClick={() => { void assistantService.resumeSpeaking().then(() => setSpeechState("speaking")).catch(() => setSpeechState("idle")); }} className="rounded-lg border px-3 py-1 text-xs"><Play className="mr-1 inline h-3 w-3" />{tr("Resume", "फिर शुरू करें")}</button><button type="button" onClick={() => { assistantService.stopSpeaking(); setSpeechState("idle"); }} className="rounded-lg border px-3 py-1 text-xs"><Square className="mr-1 inline h-3 w-3" />{tr("Stop", "बंद करें")}</button></div>}
                  <p className="mt-1 text-xs text-slate-400">
                    {tr("Ask any question in English or Hindi", "हिंदी या अंग्रेजी में कोई भी सवाल पूछें")}
                  </p>
                </div>
              </div>

              {/* Sample Voice Queries to Try */}
              <div className="rounded-2xl border border-slate-100 bg-[#f8fbff] p-4 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  {tr("Try saying aloud:", "बोलकर आज़माएं:")}
                </span>
                <div className="mt-2 space-y-1.5 font-medium text-slate-700">
                  <p className="cursor-pointer hover:text-brand" onClick={() => handleSendQuery(tr("Scan my prescription", "मेरा पर्चा स्कैन करो"))}>
                    🎙️ &ldquo;{tr("Scan my doctor's prescription", "मेरा पर्चा स्कैन करो")}&rdquo;
                  </p>
                  <p className="cursor-pointer hover:text-brand" onClick={() => handleSendQuery(tr("What is the price of Paracetamol?", "पैरासिटामोल के जेनेरिक दाम बताओ"))}>
                    🎙️ &ldquo;{tr("What is the generic price of Paracetamol?", "पैरासिटामोल के जेनेरिक दाम बताओ")}&rdquo;
                  </p>
                  <p className="cursor-pointer hover:text-brand" onClick={() => handleSendQuery(tr("Find nearby Jan Aushadhi stores", "पास के जन औषधि केंद्र ढूंढो"))}>
                    🎙️ &ldquo;{tr("Find nearby Jan Aushadhi stores", "पास के जन औषधि केंद्र ढूंढो")}&rdquo;
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Interactive Task & Conversation Stream (7 cols) */}
            <div className="flex h-[620px] flex-col justify-between rounded-3xl border border-slate-200/90 bg-white shadow-[0_16px_40px_rgba(15,40,90,0.08)] lg:col-span-7">
              {/* Stream Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[#fafcff] px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-bold text-navy">
                    {tr("Live Task & Conversation Stream", "बातचीत व कार्य प्रवाह")}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  {/* Memory Consent Toggle */}
                  <div
                    className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-2.5 py-1 shadow-xs"
                    title={tr(
                      "Meko AI conversational memory stores non-clinical preferences across visits (off by default).",
                      "मेको AI याददाश्त आपकी गैर-चिकित्सीय प्राथमिकताएं याद रखती है (डिफ़ॉल्ट रूप से बंद)।"
                    )}
                  >
                    <Brain className={`h-3.5 w-3.5 ${memoryConsent ? "text-purple-600" : "text-slate-400"}`} />
                    <span className="text-[11px] font-bold text-slate-600">
                      {tr("Memory", "मेमोरी")}:
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleMemoryConsent}
                      disabled={memoryUpdating}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        memoryConsent ? "bg-purple-600" : "bg-slate-300"
                      }`}
                      aria-label="Toggle AI memory consent"
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                          memoryConsent ? "translate-x-3" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${memoryConsent ? "text-purple-700" : "text-slate-400"}`}>
                      {memoryConsent ? tr("Active", "चालू") : tr("Off", "बंद")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-navy"
                    title={tr("Clear conversation & memory", "बातचीत व मेमोरी साफ़ करें")}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{tr("Reset", "रीसेट")}</span>
                  </button>
                </div>
              </div>

              {/* Message History */}
              <div className="flex-1 space-y-4 overflow-y-auto p-6">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-sm leading-relaxed shadow-xs ${
                        msg.role === "user"
                          ? "bg-brand text-white rounded-br-xs"
                          : "bg-[#f8fbff] text-navy border border-slate-200/80 rounded-bl-xs"
                      }`}
                    >
                      <p>{isHi ? msg.textHi : msg.textEn}</p>
                      {msg.safetyFlags?.includes("potential_emergency") && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{tr("Potential emergency detected. Seek urgent local medical care.", "संभावित आपातस्थिति है। तुरंत स्थानीय चिकित्सा सहायता लें।")}</p>}
                      {msg.role === "assistant" && (
                        <button
                          type="button"
                          onClick={() => {
                            setChatError("");
                            tts.clearError();
                            const textToSpeak = isHi ? msg.textHi : msg.textEn;
                            void tts.speak(msg.id, textToSpeak, locale);
                          }}
                          className={`mt-2.5 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                            tts.activeId === msg.id && tts.isPlaying
                              ? "bg-brand text-white shadow-xs hover:bg-brand-dark"
                              : tts.activeId === msg.id && tts.isLoading
                                ? "bg-blue-100 text-brand animate-pulse"
                                : "border border-slate-200 bg-white text-brand hover:border-brand/40 hover:bg-blue-50/50"
                          }`}
                          title={
                            tts.activeId === msg.id && tts.isPlaying
                              ? tr("Stop speaking", "बोलना रोकें")
                              : tr("Listen to this response aloud", "यह जवाब आवाज़ में सुनें")
                          }
                        >
                          {tts.activeId === msg.id && tts.isLoading ? (
                            <>
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                              <span>{tr("Generating voice...", "आवाज़ तैयार हो रही है...")}</span>
                            </>
                          ) : tts.activeId === msg.id && tts.isPlaying ? (
                            <>
                              <Square className="h-3 w-3 fill-current" />
                              <span>{tr("Stop speaking", "बोलना रोकें")}</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5" />
                              <span>{tr("Speak response", "जवाब सुनें")}</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Interactive Execution Action */}
                      {msg.action && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => handleExecuteAction(msg.action!)}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-brand shadow-sm hover:bg-blue-50 hover:shadow-md transition"
                          >
                            <span>{getActionLabel(msg.action, isHi)}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="mt-1 px-1 text-[10px] text-slate-400">{msg.timestamp}</span>
                  </div>
                ))}

                {/* Live Transcript Bubble */}
                {transcriptPreview && (
                  <div className="flex flex-col items-end">
                    <div className="rounded-3xl bg-brand/20 px-5 py-3 text-sm italic text-brand">
                      {transcriptPreview}...
                    </div>
                  </div>
                )}
                {streamingText && <div className="flex flex-col items-start"><div className="max-w-[85%] rounded-3xl rounded-bl-xs border border-slate-200 bg-[#f8fbff] px-5 py-3.5 text-sm leading-relaxed text-navy">{streamingText}<span className="ml-1 animate-pulse">▍</span></div></div>}
                {(chatError || tts.error) && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{chatError || tts.error}</p>}
                <div ref={chatContainerRef} />
              </div>

              {/* Quick Actions Bar */}
              <div className="border-t border-slate-100 bg-[#fbfdff] px-4 py-2.5">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                  {quickPrompts.map((p, idx) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendQuery(isHi ? p.labelHi : p.labelEn)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700 shadow-2xs hover:border-brand hover:text-brand"
                      >
                        <Icon className="h-3.5 w-3.5 text-brand" />
                        <span>{isHi ? p.labelHi : p.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Input Field */}
              <div className="border-t border-slate-100 bg-white p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendQuery(inputText);
                  }}
                  className="flex items-center gap-2.5"
                >
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                      speechState === "listening"
                        ? "bg-emerald-500 text-white animate-pulse"
                        : "bg-[#eef5ff] text-brand hover:bg-brand hover:text-white"
                    }`}
                    title="Speak"
                  >
                    <Mic className="h-5 w-5" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      isHi
                        ? "बोलें या यहां अपना प्रश्न लिखें (उदा. पैरासिटामोल के दाम)..."
                        : "Speak or type your question (e.g., Scan prescription)..."
                    }
                    className="h-11 flex-1 rounded-2xl border border-slate-200 bg-[#f8fbff] px-4 text-sm font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-xs transition hover:bg-brand-dark disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
