/**
 * Browser Audio Recorder for Gnani Prisma Speech-to-Text.
 * Records 16kHz mono 16-bit PCM WAV audio directly in the browser
 * with zero external dependencies.
 */

export interface ActiveRecording {
  stop: () => Promise<Blob>;
  cancel: () => void;
}

/**
 * Encodes Float32Array PCM samples into a valid standard RIFF/WAVE 16-bit PCM Blob.
 */
export function encodeWAV(samples: Float32Array, sampleRate = 16000): Blob {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  // File length minus 8
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, "WAVE");
  // format chunk identifier
  writeString(view, 12, "fmt ");
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is uncompressed PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate
  view.setUint32(28, byteRate, true);
  // block align
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, "data");
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Starts recording microphone input into a 16kHz mono WAV audio file.
 */
export async function startAudioRecording(): Promise<ActiveRecording> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone recording is not supported in this environment.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("AudioContext is not supported by this browser.");
  }

  const audioContext = new AudioContextClass({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const bufferSize = 4096;
  const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(inputData));
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  let isFinished = false;

  const cleanup = async () => {
    if (isFinished) return;
    isFinished = true;
    try {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close();
    } catch {
      /* ignore audio close errors */
    }
  };

  return {
    stop: async (): Promise<Blob> => {
      await cleanup();

      // Merge collected chunks
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      return encodeWAV(merged, 16000);
    },
    cancel: () => {
      void cleanup();
    },
  };
}
