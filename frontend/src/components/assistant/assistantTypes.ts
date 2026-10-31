export type AssistantMessageRole = "user" | "assistant" | "system";

export type AssistantAction =
  | { type: "navigate"; path: string; labelEn: string; labelHi: string }
  | { type: "search"; query: string; path: string; labelEn: string; labelHi: string }
  | { type: "change_language"; lang: "en" | "hi"; labelEn: string; labelHi: string }
  | { type: "info"; text: string; labelEn?: string; labelHi?: string };

export type AssistantMessage = {
  id: string;
  role: AssistantMessageRole;
  textEn: string;
  textHi: string;
  timestamp: string;
  action?: AssistantAction;
  spoken?: boolean;
};

export type SpeechState = "idle" | "listening" | "processing" | "speaking";

export type AssistantMode = "voice" | "chat";
