import {
  ArrowRight,
  Bot,
  Languages,
  MapPin,
  Mic,
  Pill,
  RotateCcw,
  ScanLine,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Maximize2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { assistantService } from "./assistantService";
import type {
  AssistantAction,
  AssistantMessage,
  AssistantMode,
  SpeechState,
} from "./assistantTypes";
import { VoiceVisualizer } from "./VoiceVisualizer";

function getActionLabel(action: AssistantAction, isHindi: boolean): string {
  if ("labelHi" in action && action.labelHi && action.labelEn) {
    return isHindi ? action.labelHi : action.labelEn;
  }
  return isHindi ? "विवरण देखें →" : "View Details →";
}

export function VoiceAssistant() {
  const navigate = useNavigate();
  const { locale, setLocale, isHi } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>("voice");
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [inputText, setInputText] = useState("");
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [showTooltip, setShowTooltip] = useState(true);

  // Initial welcome greeting
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      textEn:
        "Hello! I am MedEasy Saathi. You can talk to me in English or हिंदी to scan prescriptions, compare medicine prices, or find nearby Jan Aushadhi stores.",
      textHi:
        "नमस्ते! मैं MedEasy साथी हूँ। आप मुझसे हिंदी या English में बोलकर दवाइयों के दाम पूछ सकते हैं, पर्चा स्कैन कर सकते हैं, या पास के मेडिकल स्टोर ढूंढ सकते हैं।",
      timestamp: "Just now",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, transcriptPreview]);

  // Handle Voice Toggle (Mic Press)
  function handleToggleVoice() {
    if (speechState === "listening") {
      assistantService.stopListening();
      setSpeechState("idle");
      return;
    }

    if (speechState === "speaking") {
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
        handleSendQuery(transcript);
      },
      (error) => {
        setSpeechState("idle");
        // Show guidance message if permission denied
        if (error.includes("not-allowed") || error.includes("denied")) {
          addMessage(
            "Microphone permission was denied. Please allow microphone access or type your query below.",
            "माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया माइक्रोफ़ोन चालू करें या नीचे लिखकर पूछें।",
            "assistant"
          );
        }
      },
      () => {
        setSpeechState((prev) => (prev === "listening" ? "idle" : prev));
      }
    );
  }

  // Handle Query Execution (Voice or Text)
  async function handleSendQuery(queryText: string) {
    if (!queryText.trim()) return;

    // 1. Add User message
    addMessage(queryText, queryText, "user");
    setInputText("");
    setTranscriptPreview("");
    setSpeechState("processing");

    // 2. Process with Gemini / Semantic Intent Engine
    try {
      const response = await assistantService.processUserInput(queryText, locale, null);

      addMessage(response.response, response.response, "assistant", response.action);

      // 3. Spoken Response via ElevenLabs / Web Speech
      const spokenText = response.response;

      if (!isVoiceMuted) {
        setSpeechState("speaking");
        await assistantService.speakText(
          spokenText,
          locale,
          () => setSpeechState("processing"),
          () => setSpeechState("speaking"),
          () => setSpeechState("idle")
        );
      } else {
        setSpeechState("idle");
      }

      // 4. Auto-execute Action if navigation is requested
      if (response.action) {
        handleExecuteAction(response.action, false);
      }
    } catch (error) {
      setSpeechState("idle");
      addMessage(error instanceof Error ? error.message : "Assistant request failed.", error instanceof Error ? error.message : "सहायक अनुरोध विफल हुआ।", "assistant");
    }
  }

  function addMessage(
    textEn: string,
    textHi: string,
    role: "user" | "assistant",
    action?: AssistantAction
  ) {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        role,
        textEn,
        textHi,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        action,
      },
    ]);
  }

  // Execute Navigation / Action
  function handleExecuteAction(action: AssistantAction, autoClose = true) {
    if (action.type === "navigate" || action.type === "search") {
      setTimeout(() => {
        navigate(action.path);
        if (autoClose) {
          setIsOpen(false);
        }
      }, 700);
    } else if (action.type === "change_language") {
      setLocale(action.lang);
    }
  }

  // Reset conversation
  function handleReset() {
    assistantService.stopSpeaking();
    assistantService.stopListening();
    setSpeechState("idle");
    setTranscriptPreview("");
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

  const latestAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* 1. FLOATING ACTION BUTTON (LAUNCHER) */}
      {!isOpen && (
        <div className="relative flex items-center">
          {/* Friendly Tooltip for First-time Users */}
          {showTooltip && (
            <div className="mr-3 hidden items-center gap-2 rounded-2xl border border-blue-100 bg-white/95 px-4 py-2.5 text-xs font-bold text-navy shadow-xl backdrop-blur-md transition sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef5ff] text-brand">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span>{isHi ? "बोलकर पूछें / Voice Assistant" : "Ask by Voice / आवाज़ से पूछें"}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTooltip(false);
                }}
                className="ml-1 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
          )}

          {/* Main Launcher Button with Pulse Ring */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setShowTooltip(false);
            }}
            aria-label="Open Voice AI Assistant"
            className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#087BFF_0%,#0056cc_100%)] text-white shadow-[0_12px_28px_rgba(8,123,255,0.42)] transition-all hover:scale-105 hover:shadow-[0_16px_36px_rgba(8,123,255,0.55)] active:scale-95"
          >
            {/* Animated Outer Pulse Ring */}
            <span className="absolute -inset-1 rounded-full bg-brand/30 animate-ping opacity-75" />

            <div className="relative flex items-center justify-center">
              <Mic className="h-7 w-7 text-white transition-transform group-hover:scale-110" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 border-2 border-white" />
            </div>
          </button>
        </div>
      )}

      {/* 2. MAIN ASSISTANT MODAL / DRAWER */}
      {isOpen && (
        <div className="flex h-[580px] w-[380px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[30px] border border-slate-200/90 bg-white shadow-[0_24px_60px_rgba(15,40,90,0.18)] transition-all sm:w-[420px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_6px_16px_rgba(8,123,255,0.3)]">
                <Bot className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-navy">
                  {isHi ? "MedEasy साथी (AI)" : "MedEasy Saathi (AI)"}
                </h3>
                <p className="text-[10.5px] font-medium text-slate-500">
                  {isHi ? "Gemini व ElevenLabs संचालित" : "Powered by Gemini & ElevenLabs"}
                </p>
              </div>
            </div>

            {/* Controls: Language, Mute, Close */}
            <div className="flex items-center gap-1.5">
              {/* Language Pill */}
              <button
                type="button"
                onClick={() => setLocale(locale === "en" ? "hi" : "en")}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-2xs hover:border-brand hover:text-brand"
                title="Toggle Language"
              >
                <Languages className="h-3 w-3 text-brand" />
                <span>{locale === "en" ? "हिंदी" : "EN"}</span>
              </button>

              {/* Spoken Voice Mute Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (speechState === "speaking") assistantService.stopSpeaking();
                  setIsVoiceMuted((v) => !v);
                }}
                className={`rounded-full p-2 text-slate-500 transition hover:bg-slate-100 ${
                  isVoiceMuted ? "text-red-500" : "text-brand"
                }`}
                title={isVoiceMuted ? "Unmute Voice" : "Mute Voice"}
              >
                {isVoiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              {/* Refresh / Reset */}
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Reset Conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* Expand to Full Page */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/med-saathi");
                }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-brand"
                title={isHi ? "पूरा मेडसाथी पेज खोलें" : "Open Full MedSaathi Page"}
              >
                <Maximize2 className="h-4 w-4" />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => {
                  assistantService.stopListening();
                  assistantService.stopSpeaking();
                  setSpeechState("idle");
                  setIsOpen(false);
                }}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-navy"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-slate-100 bg-[#f8fbff] p-1.5">
            <button
              type="button"
              onClick={() => setMode("voice")}
              className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                mode === "voice"
                  ? "bg-white text-brand shadow-xs"
                  : "text-slate-500 hover:text-navy"
              }`}
            >
              🎙️ {isHi ? "आवाज़ मोड (Voice)" : "Voice Mode (आवाज़)"}
            </button>
            <button
              type="button"
              onClick={() => setMode("chat")}
              className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                mode === "chat"
                  ? "bg-white text-brand shadow-xs"
                  : "text-slate-500 hover:text-navy"
              }`}
            >
              💬 {isHi ? "चैट मोड (Text)" : "Chat Mode (टेक्स्ट)"}
            </button>
          </div>

          {/* CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-4">
            {mode === "voice" ? (
              /* VOICE MODE: Giant Accessible Voice Interface */
              <div className="flex h-full flex-col items-center justify-between py-2 text-center">
                {/* Voice Visualizer Waveform */}
                <VoiceVisualizer state={speechState} isHindi={isHi} />

                {/* Central Interactive Voice Orb */}
                <div className="my-auto flex flex-col items-center">
                  <div className="relative">
                    {/* Pulsing Backlight Ring when active */}
                    {speechState === "listening" && (
                      <div className="absolute -inset-4 rounded-full bg-emerald-400/30 animate-ping" />
                    )}
                    {speechState === "speaking" && (
                      <div className="absolute -inset-4 rounded-full bg-brand/30 animate-pulse" />
                    )}

                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      className={`relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-2xl transition-all duration-300 active:scale-95 ${
                        speechState === "listening"
                          ? "bg-emerald-500 ring-8 ring-emerald-100 shadow-[0_0_36px_rgba(16,185,129,0.5)]"
                          : speechState === "speaking"
                            ? "bg-brand ring-8 ring-blue-100 shadow-[0_0_36px_rgba(8,123,255,0.5)]"
                            : "bg-[linear-gradient(135deg,#087BFF_0%,#0056cc_100%)] ring-8 ring-blue-50/80 hover:scale-105"
                      }`}
                    >
                      {speechState === "listening" ? (
                        <Mic className="h-12 w-12 text-white animate-bounce" />
                      ) : speechState === "speaking" ? (
                        <Volume2 className="h-12 w-12 text-white animate-pulse" />
                      ) : (
                        <Mic className="h-12 w-12 text-white" />
                      )}
                    </button>
                  </div>

                  <p className="mt-4 text-xs font-bold text-navy">
                    {speechState === "listening"
                      ? isHi
                        ? "सुन रहे हैं... बोलिए"
                        : "Listening... speak now"
                      : speechState === "speaking"
                        ? isHi
                          ? "बोल रहे हैं (रोकने के लिए दबाएं)"
                          : "Speaking (Tap to stop)"
                        : isHi
                          ? "बोलने के लिए माइक दबाएं"
                          : "Tap microphone to speak"}
                  </p>
                </div>

                {/* Latest Interaction Card */}
                <div className="w-full rounded-2xl border border-slate-100 bg-[#f8fbff] p-3.5 text-left text-xs shadow-2xs">
                  {transcriptPreview ? (
                    <p className="font-semibold text-slate-700 italic">
                      &ldquo;{transcriptPreview}&rdquo;
                    </p>
                  ) : latestAssistantMessage ? (
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {isHi ? "सहायक उत्तर:" : "Assistant Response:"}
                      </span>
                      <p className="mt-1 leading-relaxed text-navy">
                        {isHi ? latestAssistantMessage.textHi : latestAssistantMessage.textEn}
                      </p>

                      {/* Action Pill if suggested */}
                      {latestAssistantMessage.action && (
                        <button
                          type="button"
                          onClick={() => handleExecuteAction(latestAssistantMessage.action!)}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark"
                        >
                          <span>{getActionLabel(latestAssistantMessage.action, isHi)}</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              /* CHAT MODE: Bubble Stream */
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                        msg.role === "user"
                          ? "bg-brand text-white rounded-br-xs"
                          : "bg-[#f8fbff] text-navy border border-slate-200/80 rounded-bl-xs"
                      }`}
                    >
                      <p>{isHi ? msg.textHi : msg.textEn}</p>

                      {/* Interactive Action Card inside Bubble */}
                      {msg.action && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => handleExecuteAction(msg.action!)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-brand shadow-xs hover:bg-blue-50"
                          >
                            <span>{getActionLabel(msg.action, isHi)}</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="mt-1 px-1 text-[9.5px] text-slate-400">{msg.timestamp}</span>
                  </div>
                ))}

                {/* In-flight listening preview in Chat */}
                {transcriptPreview && (
                  <div className="flex flex-col items-end">
                    <div className="rounded-2xl bg-brand/30 px-3.5 py-2 text-xs italic text-brand">
                      {transcriptPreview}...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* QUICK PROMPT CHIPS */}
          <div className="border-t border-slate-100 bg-[#fafcff] px-3 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isHi ? "त्वरित विकल्प:" : "Quick Actions:"}
            </span>
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              <button
                type="button"
                onClick={() => handleSendQuery(isHi ? "पर्चा स्कैन करो" : "Scan my prescription")}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-2xs hover:border-brand hover:text-brand"
              >
                <ScanLine className="h-3 w-3 text-brand" />
                <span>{isHi ? "पर्चा स्कैन करें" : "Scan Rx"}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSendQuery(
                    isHi
                      ? "पैरासिटामोल के जेनेरिक दाम बताओ"
                      : "Find Paracetamol generic price"
                  )
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-2xs hover:border-brand hover:text-brand"
              >
                <Pill className="h-3 w-3 text-emerald-600" />
                <span>{isHi ? "पैरासिटामोल दाम" : "Paracetamol Price"}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSendQuery(
                    isHi ? "नज़दीकी जन औषधि केंद्र दिखाओ" : "Find nearby Jan Aushadhi stores"
                  )
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-2xs hover:border-brand hover:text-brand"
              >
                <MapPin className="h-3 w-3 text-blue-600" />
                <span>{isHi ? "नज़दीकी केंद्र" : "Nearby Stores"}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSendQuery(isHi ? "दवाई का बैच नंबर चेक करो" : "Check batch safety")
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-2xs hover:border-brand hover:text-brand"
              >
                <ShieldCheck className="h-3 w-3 text-amber-600" />
                <span>{isHi ? "बैच सुरक्षा" : "Batch Safety"}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleSendQuery(isHi ? "मेरी पूछताछ सूची दिखाओ" : "Show my enquiry cart")
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-2xs hover:border-brand hover:text-brand"
              >
                <ShoppingCart className="h-3 w-3 text-purple-600" />
                <span>{isHi ? "मेरी कार्ट" : "My Cart"}</span>
              </button>
            </div>
          </div>

          {/* INPUT BAR (Text & Mic) */}
          <div className="border-t border-slate-100 bg-white p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuery(inputText);
              }}
              className="flex items-center gap-2"
            >
              {/* Mic Button in Input Bar */}
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                  speechState === "listening"
                    ? "bg-emerald-500 text-white animate-pulse"
                    : "bg-[#eef5ff] text-brand hover:bg-brand hover:text-white"
                }`}
                title="Speak"
              >
                <Mic className="h-5 w-5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isHi
                    ? "बोलें या यहां लिखकर पूछें..."
                    : "Speak or type your question..."
                }
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-[#f8fbff] px-3 text-xs font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-xs transition hover:bg-brand-dark disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
