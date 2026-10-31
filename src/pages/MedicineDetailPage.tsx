import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { compareMedicine, formatInr } from "../api/client";
import type { Comparison } from "../types";

export function MedicineDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const medicineId = Number(id);
    if (!Number.isInteger(medicineId)) {
      setError("Invalid medicine id");
      return;
    }
    compareMedicine(medicineId)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Not found"));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-red-600">{error}</p>
        <Link to="/medicines" className="mt-4 inline-block text-brand">Back to catalogue</Link>
      </div>
    );
  }
  if (!data) return <div className="px-5 py-12 text-muted">Loading comparison…</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <Link to="/medicines" className="text-sm font-semibold text-brand">← Catalogue</Link>
      <h1 className="mt-3 text-3xl font-extrabold text-navy">{data.medicine.brand_name}</h1>
      <p className="mt-2 text-muted">{data.medicine.active_salt}</p>
      <p className="mt-1 text-sm text-slate-500">
        {data.medicine.dosage_form} · {data.medicine.category}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {data.price_options.map((option) => (
          <div
            key={option.provider}
            className={`rounded-2xl border p-4 ${option.is_cheapest ? "border-emerald-200 bg-emerald-50" : "border-slate-100 bg-slate-50"}`}
          >
            <p className="text-sm text-slate-500">{option.provider}</p>
            <p className="mt-2 text-2xl font-extrabold text-navy">{formatInr(option.price)}</p>
            {option.savings_vs_private != null ? (
              <p className="mt-1 text-xs text-emerald-700">
                Save {formatInr(option.savings_vs_private)} ({option.savings_percent}%)
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {data.recommended_option ? (
        <p className="mt-6 rounded-xl bg-sky px-4 py-3 text-sm text-navy">
          Cheapest listed alternative: {data.recommended_option.provider} at {formatInr(data.recommended_option.price)}
          {data.recommended_option.savings != null ? ` · save ${formatInr(data.recommended_option.savings)}` : ""}.
        </p>
      ) : null}

      <p className="mt-6 text-sm text-muted">{data.comparison_note}</p>
    </div>
  );
}
