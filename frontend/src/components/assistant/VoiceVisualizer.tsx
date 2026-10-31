import type { SpeechState } from "./assistantTypes";

type VoiceVisualizerProps = {
  state: SpeechState;
  isHindi: boolean;
};

export function VoiceVisualizer({ state, isHindi }: VoiceVisualizerProps) {
  const isListening = state === "listening";
  const isSpeaking = state === "speaking";
  const isProcessing = state === "processing";
  const isGenerating = state === "generating";

  return (
    <div className="flex flex-col items-center justify-center py-2">
      {/* Animated Sound Waveform Bars */}
      <div className="flex h-12 items-center justify-center gap-1.5 px-4">
        {[
          { h: "h-3", activeH: "h-9", delay: "delay-75" },
          { h: "h-5", activeH: "h-12", delay: "delay-150" },
          { h: "h-7", activeH: "h-10", delay: "delay-300" },
          { h: "h-4", activeH: "h-11", delay: "delay-200" },
          { h: "h-8", activeH: "h-12", delay: "delay-100" },
          { h: "h-6", activeH: "h-9", delay: "delay-500" },
          { h: "h-3", activeH: "h-8", delay: "delay-200" },
        ].map((bar, i) => (
          <span
            key={i}
            className={`w-1.5 rounded-full transition-all duration-300 ${
              isListening
                ? `${bar.activeH} animate-pulse bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] ${bar.delay}`
                : isSpeaking
                  ? `${bar.activeH} animate-pulse bg-brand shadow-[0_0_8px_rgba(8,123,255,0.5)] ${bar.delay}`
                  : isProcessing || isGenerating
                    ? "h-4 animate-bounce bg-amber-400"
                    : "h-2 bg-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Real-time State Badge */}
      <div className="mt-2 text-center">
        {isListening && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            {isHindi ? "आपकी आवाज़ सुन रहे हैं..." : "Listening to your voice..."}
          </span>
        )}
        {isProcessing && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            {isHindi ? "Gemini सोच रहा है..." : "Processing with Gemini AI..."}
          </span>
        )}
        {isGenerating && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
            <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
            {isHindi ? "आवाज़ तैयार हो रही है..." : "Generating audio..."}
          </span>
        )}
        {isSpeaking && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand">
            <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
            {isHindi ? "ElevenLabs बोल रहा है..." : "Speaking via ElevenLabs..."}
          </span>
        )}
        {state === "idle" && (
          <span className="text-xs font-medium text-slate-400">
            {isHindi ? "बोलने के लिए माइक दबाएं" : "Tap microphone to speak"}
          </span>
        )}
        {state === "paused" && <span className="text-xs font-medium text-slate-400">{isHindi ? "आवाज़ रोकी गई है" : "Playback paused"}</span>}
      </div>
    </div>
  );
}

