import { useEffect, useState, type FormEvent } from "react";
import { createEnquiry, listEnquiries } from "../api/client";
import type { PharmacyEnquiry } from "../types";

export function StoresPage() {
  const [mapsUrl, setMapsUrl] = useState("https://www.google.com/maps/search/pharmacy/");
  const [enquiries, setEnquiries] = useState<PharmacyEnquiry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setMapsUrl(
            `https://www.google.com/maps/search/pharmacy/@${latitude},${longitude},15z`,
          );
        },
        () => undefined,
        { timeout: 4000 },
      );
    }
    listEnquiries()
      .then((data) => setEnquiries(data.items))
      .catch(() => undefined);
  }, []);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const created = await createEnquiry({
        pharmacy_name: String(form.get("pharmacy_name") ?? ""),
        pharmacy_phone: String(form.get("pharmacy_phone") ?? "") || undefined,
        pharmacy_address: String(form.get("pharmacy_address") ?? "") || undefined,
        customer_area: String(form.get("customer_area") ?? "") || undefined,
        customer_message: String(form.get("customer_message") ?? "") || undefined,
        items: [
          {
            medicine_name: String(form.get("medicine_name") ?? ""),
            quantity: String(form.get("quantity") ?? "1"),
          },
        ],
      });
      setSavedId(created.enquiry.id);
      const list = await listEnquiries();
      setEnquiries(list.items);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save enquiry");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <h1 className="text-3xl font-extrabold text-navy">Nearby stores</h1>
      <p className="mt-3 text-muted">
        Pharmacies are discovered in Google Maps. This app does not invent a store count or stock list.
      </p>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white"
      >
        Open pharmacies in Google Maps
      </a>

      <form onSubmit={onSave} className="mt-10 grid gap-3 rounded-2xl border border-slate-100 p-6">
        <h2 className="font-bold text-navy">Save a pharmacy enquiry</h2>
        <input name="pharmacy_name" required placeholder="Pharmacy name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input name="pharmacy_phone" placeholder="Phone (optional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input name="pharmacy_address" placeholder="Address (optional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input name="customer_area" placeholder="Your area (optional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input name="medicine_name" required placeholder="Medicine to ask about" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input name="quantity" defaultValue="1 strip" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <textarea name="customer_message" placeholder="Message to the shopkeeper (optional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button type="submit" className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white">
          Save enquiry
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {savedId ? <p className="text-sm text-emerald-700">Saved enquiry {savedId}. WhatsApp was not sent by the server.</p> : null}
      </form>

      <h2 className="mt-10 font-bold text-navy">Saved enquiries</h2>
      <div className="mt-3 space-y-3">
        {enquiries.map((enquiry) => (
          <article key={enquiry.id} className="rounded-xl border border-slate-100 p-4 text-sm">
            <p className="font-semibold text-navy">{enquiry.pharmacy.name}</p>
            <p className="text-muted">{enquiry.status} · {enquiry.items.length} item(s)</p>
          </article>
        ))}
        {enquiries.length === 0 ? <p className="text-sm text-muted">No enquiries loaded from the API yet.</p> : null}
      </div>
    </div>
  );
}
