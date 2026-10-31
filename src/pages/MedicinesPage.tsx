import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { formatInr, getCategories, listMedicines } from "../api/client";
import type { Medicine } from "../types";

export function MedicinesPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<Medicine[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(nextQ = q, nextCategory = category) {
    setBusy(true);
    setError(null);
    try {
      const data = await listMedicines({
        q: nextQ || undefined,
        category: nextCategory || undefined,
        limit: 50,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load medicines");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
    void load("", "");
  }, []);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    void load(q, category);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8">
      <h1 className="text-3xl font-extrabold text-navy">Explore medicines</h1>
      <p className="mt-2 text-muted">
        Search the loaded catalogue. Totals below come from the API, not placeholder counts.
      </p>

      <form onSubmit={onSearch} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Brand, salt, form or category"
          className="h-11 flex-1 rounded-full border border-slate-200 px-4 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-11 rounded-full border border-slate-200 px-4 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-11 rounded-full bg-brand px-5 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <p className="mt-4 text-sm text-slate-500">
        {busy ? "Loading…" : total == null ? "—" : `${total} result${total === 1 ? "" : "s"}`}
      </p>

      <div className="mt-6 space-y-3">
        {items.map((med) => (
          <Link
            key={med.id}
            to={`/medicines/${med.id}`}
            className="flex flex-col justify-between gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-brand/30 sm:flex-row sm:items-center"
          >
            <div>
              <p className="font-bold text-navy">{med.brand_name}</p>
              <p className="text-sm text-muted">{med.active_salt}</p>
              <p className="mt-1 text-xs text-slate-400">
                {med.dosage_form} · {med.category}
              </p>
            </div>
            <div className="text-sm text-navy">
              Private {formatInr(med.private_brand_price)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
