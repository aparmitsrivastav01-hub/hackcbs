import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  Info,
  Power,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import type { MekoContextItem } from "../../types";

type ContextPanelProps = {
  recalledItems?: MekoContextItem[];
  proposedMemory?: string | null;
  onApproveMemory?: (memoryText: string) => Promise<void>;
  onForgetItem?: (memoryId: string) => Promise<void>;
  isMekoActive?: boolean;
};

export function ContextPanel({
  recalledItems = [],
  proposedMemory,
  onApproveMemory,
  onForgetItem,
  isMekoActive = true,
}: ContextPanelProps) {
  const { consent } = useAuth();
  const [editingText, setEditingText] = useState(proposedMemory ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isConsentGranted = consent?.granted ?? false;
  const isEnabled = isMekoActive && isConsentGranted;

  async function handleApprove() {
    if (!onApproveMemory || !editingText.trim()) return;
    try {
      setIsSaving(true);
      await onApproveMemory(editingText.trim());
      setEditingText("");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleForget(memoryId: string) {
    if (!onForgetItem) return;
    try {
      setDeletingId(memoryId);
      await onForgetItem(memoryId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-navy">Meko Context & Recall Transparency</h4>
            <p className="text-xs text-slate-500">Live auditable patient context from isolated datapack</p>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isEnabled
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            <Power className="h-3 w-3" />
            {isEnabled ? "Meko Active" : !isConsentGranted ? "Consent Withheld (Local Only)" : "Meko OFF"}
          </span>
        </div>
      </div>

      {/* Recalled Context Section */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Recalled Patient Memories ({recalledItems.length})
          </span>
          <span className="text-[11px] text-slate-400">Exact facts returned by Meko</span>
        </div>

        {recalledItems.length === 0 ? (
          <div className="mt-2 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">
            {isEnabled
              ? "No previous memories recalled for this session yet."
              : "Meko memory is disabled. Responses use only the current screen context."}
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {recalledItems.map((item) => (
              <div
                key={item.memory_id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-[#fbfcfe] p-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-purple-100/70 px-1.5 py-0.5 font-mono text-[10px] text-purple-700">
                      ID: {item.memory_id.slice(0, 12)}...
                    </span>
                    {item.recorded_at && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {new Date(item.recorded_at).toLocaleDateString()}
                      </span>
                    )}
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      User Confirmed
                    </span>
                  </div>
                  <p className="font-medium text-slate-800">{item.text}</p>
                </div>

                {onForgetItem && (
                  <button
                    type="button"
                    disabled={deletingId === item.memory_id}
                    onClick={() => handleForget(item.memory_id)}
                    title="Permanently delete this memory from Meko"
                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                  >
                    {deletingId === item.memory_id ? (
                      <RefreshCw className="h-4 w-4 animate-spin text-rose-500" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proposed Memory Approval Gate (Show Before Save) */}
      {proposedMemory && isEnabled && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Proposed Memory Fact (Explicit Approval Required)</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            The assistant extracted this fact from your conversation. MedEasy will NOT save it to Meko unless you review and approve it.
          </p>

          <textarea
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            className="mt-2.5 w-full rounded-lg border border-amber-300 bg-white p-2.5 text-xs text-slate-800 focus:border-brand focus:outline-none"
            rows={2}
          />

          <div className="mt-2.5 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setEditingText("")}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={isSaving || !editingText.trim()}
              onClick={handleApprove}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-600 transition disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              {isSaving ? "Saving to Meko..." : "Approve & Remember"}
            </button>
          </div>
        </div>
      )}

      {/* Privacy Notice Footer */}
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>
          Meko memory is an AI context aid, not canonical medical records. Original prescriptions remain in local browser storage only.
        </span>
      </div>
    </div>
  );
}
