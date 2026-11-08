/**
 * Backward compatibility re-export.
 * Replaced ElevenLabs with Gnani AI Timbre TTS.
 */
export {
  useGnaniTTS as useElevenLabsTTS,
  useGnaniTTS,
  clearTTSCache,
  type UseGnaniTTSResult as UseElevenLabsTTSResult,
  type UseGnaniTTSResult,
} from "./useGnaniTTS";
