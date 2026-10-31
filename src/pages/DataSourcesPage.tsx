import { useEffect, useState } from "react";
import { getDatasetStatus, getStats } from "../api/client";
import type { CatalogueStats, DatasetStatus } from "../types";

export function DataSourcesPage() {
  const [stats, setStats] = useState<CatalogueStats | null>(null);
  const [dataset, setDataset] = useState<DatasetStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getStats(), getDatasetStatus()])
      .then(([s, d]) => {
        setStats(s);
        setDataset(d);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load sources"));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <h1 className="text-3xl font-extrabold text-navy">Data sources</h1>
      <p className="mt-3 text-muted">
        Figures on this page are returned by the FastAPI backend. If a number cannot be loaded, it is omitted rather than estimated.
      </p>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {stats ? (
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat label="Medicines in catalogue" value={String(stats.total_medicines)} />
          <Stat label="Categories" value={String(stats.categories)} />
          <Stat
            label="Price coverage"
            value={`Private ${stats.price_coverage.private_brand} · JA ${stats.price_coverage.jan_aushadhi} · Dava ${stats.price_coverage.dava_india}`}
          />
        </section>
      ) : (
        <p className="mt-8 text-sm text-muted">Loading catalogue statistics…</p>
      )}

      {stats ? (
        <section className="mt-8">
          <h2 className="font-bold text-navy">Category counts</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {Object.entries(stats.category_counts).map(([name, count]) => (
              <li key={name} className="flex justify-between px-4 py-2 text-sm">
                <span>{name}</span>
                <span className="font-semibold text-navy">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dataset ? (
        <section className="mt-8 rounded-2xl bg-slate-50 p-5 text-sm">
          <h2 className="font-bold text-navy">Batch-safety dataset</h2>
          <p className="mt-2 text-muted">{dataset.source_name}</p>
          <p className="mt-1">File: {dataset.dataset_file}</p>
          <p>Records loaded: {dataset.records_loaded}</p>
          <p>Last modified: {dataset.last_modified ?? "unavailable"}</p>
          <p className="mt-2 text-muted">{dataset.note}</p>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-navy">{value}</p>
    </div>
  );
}
