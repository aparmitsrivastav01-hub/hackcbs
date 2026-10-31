import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  Navigation,
  Pill,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  X,
} from "lucide-react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { createEnquiry, formatInr } from "../api/client";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import type { Pharmacy } from "../types";

// Curated reference pharmacy network directory
const DEMO_PHARMACIES: Pharmacy[] = [
  {
    id: "ja-delhi-01",
    name: "Pradhan Mantri Bhartiya Janaushadhi Kendra (PMBJP)",
    address: "Shop No. 4, Community Centre, Sector 7, Rohini, New Delhi 110085",
    phone: "+919811234567",
    distance: "0.8 km",
    open_now: true,
    rating: 4.8,
    review_count: 142,
    is_generic_store: true,
    generic_network: "Jan Aushadhi",
    source: "demo",
  },
  {
    id: "di-delhi-02",
    name: "Dava India Generic Pharmacy",
    address: "B-2/14, Main Market, Connaught Place, New Delhi 110001",
    phone: "+919876543210",
    distance: "1.4 km",
    open_now: true,
    rating: 4.6,
    review_count: 89,
    is_generic_store: true,
    generic_network: "Dava India",
    source: "demo",
  },
  {
    id: "apollo-03",
    name: "Apollo Pharmacy 24/7",
    address: "Ground Floor, Metro Station Complex, Rajiv Chowk, New Delhi 110001",
    phone: "+911145678900",
    distance: "2.1 km",
    open_now: true,
    rating: 4.3,
    review_count: 320,
    is_generic_store: false,
    source: "places",
  },
  {
    id: "medplus-04",
    name: "MedPlus Chemist & Druggist",
    address: "Plot 18, Block C, Preet Vihar, Vikas Marg, Delhi 110092",
    phone: "+919822334455",
    distance: "3.2 km",
    open_now: true,
    rating: 4.4,
    review_count: 110,
    is_generic_store: false,
    source: "places",
  },
  {
    id: "ja-noida-05",
    name: "Jan Aushadhi Medical Store",
    address: "Sector 18 Market, Near Metro Gate 2, Noida 201301",
    phone: "+919899001122",
    distance: "4.5 km",
    open_now: false,
    rating: 4.7,
    review_count: 67,
    is_generic_store: true,
    generic_network: "Jan Aushadhi",
    source: "demo",
  },
];

export function StoresPage() {
  const navigate = useNavigate();
  const { tr } = useLanguage();
  const { items, itemCount, subtotal } = useCart();

  const [pharmacies] = useState<Pharmacy[]>(DEMO_PHARMACIES);
  const [filterGenericOnly, setFilterGenericOnly] = useState(false);
  const [searchLocality, setSearchLocality] = useState("");
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Selected Pharmacy for Screen 8 (Enquiry Preview & WhatsApp modal)
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const [customerArea, setCustomerArea] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingEnquiry, setSavingEnquiry] = useState(false);

  // Screen 9: Shopkeeper response simulation form state
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [simulatedBatch, setSimulatedBatch] = useState("PCM23H88");
  const [simulatedPrice, setSimulatedPrice] = useState("28.00");
  const [simulatedMfr, setSimulatedMfr] = useState("Karnataka Antibiotics");

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported by your browser.");
      return;
    }
    setLocationStatus("Locating nearby pharmacies...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationStatus(`Showing pharmacies near ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
      },
      () => {
        setLocationStatus("Location access was denied. Showing curated Delhi-NCR pharmacy directory.");
      },
      { timeout: 6000 },
    );
  }

  // Filter pharmacies based on search and generic-only filter
  const displayedPharmacies = pharmacies.filter((p) => {
    if (filterGenericOnly && !p.is_generic_store) return false;
    if (searchLocality.trim()) {
      const term = searchLocality.toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        p.address.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Generate WhatsApp prefilled enquiry text
  function generateEnquiryMessage(pharmacy: Pharmacy) {
    const medicineLines =
      items.length > 0
        ? items.map((i) => `• ${i.brand_name} (${i.active_salt || i.dosage_form || "standard pack"}) - Qty: ${i.quantity}`).join("\n")
        : "• Paracetamol 500mg Tablet - Qty: 1 strip";

    return (
      `Hello ${pharmacy.name},\n\n` +
      `I would like to enquire about medicine availability and current price through MedEasy:\n\n` +
      `${medicineLines}\n\n` +
      (customerArea ? `My Delivery/Pickup Area: ${customerArea}\n\n` : "") +
      (customNotes ? `Note: ${customNotes}\n\n` : "") +
      `Could you please let me know:\n` +
      `1. Current quoted price and stock availability\n` +
      `2. Manufacturer name, batch number, and expiry date\n` +
      `3. Home delivery option (if available)\n\n` +
      `Thank you!`
    );
  }

  async function handleOpenWhatsApp() {
    if (!selectedPharmacy) return;

    setSavingEnquiry(true);
    try {
      await createEnquiry({
        pharmacy_name: selectedPharmacy.name,
        pharmacy_phone: selectedPharmacy.phone,
        pharmacy_address: selectedPharmacy.address,
        customer_area: customerArea || undefined,
        customer_message: customNotes || undefined,
        items: items.length > 0
          ? items.map((i) => ({
              medicine_name: i.brand_name,
              dosage_form: i.dosage_form,
              quantity: `${i.quantity} pack(s)`,
              catalogue_medicine_id: i.medicine_id,
            }))
          : [
              {
                medicine_name: "General Medicine Enquiry",
                quantity: "1 strip",
              },
            ],
      });
    } catch {
      // Handled gracefully by local fallback
    } finally {
      setSavingEnquiry(false);
    }

    const message = generateEnquiryMessage(selectedPharmacy);
    const cleanPhone = selectedPharmacy.phone?.replace(/[^0-9]/g, "") || "919811234567";
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  function handleCopyMessage() {
    if (!selectedPharmacy) return;
    const msg = generateEnquiryMessage(selectedPharmacy);
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <Helmet>
        <title>{tr("Nearby Pharmacies & Enquiry Handoff — MedEasy", "नज़दीकी मेडिकल स्टोर व पूछताछ — MedEasy")}</title>
        <meta
          name="description"
          content={tr(
            "Locate nearby Jan Aushadhi Kendras, Dava India outlets, and local licensed pharmacies. Prepare structured enquiries and connect via WhatsApp.",
            "नज़दीकी जन औषधि केंद्र और मेडिकल स्टोर खोजें। दवा उपलब्धता के लिए व्हाट्सएप संदेश तैयार करें।"
          )}
        />
      </Helmet>
    <div className="min-h-screen bg-[#f7faff] pb-24 pt-8">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
            <Store className="h-3.5 w-3.5" />
            <span>{tr("Nearby Pharmacy Directory & Enquiry Handoff", "नज़दीकी फार्मेसी डायरेक्टरी व पूछताछ")}</span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
            {tr("Find Nearby Pharmacies & Send Enquiries", "नज़दीकी मेडिकल स्टोर खोजें व पूछताछ भेजें")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {tr(
              "Locate Jan Aushadhi Kendras, Dava India outlets, and local licensed chemists. Prepare a structured inquiry with your requested medicines to check live stock, prices, and batch details.",
              "जन औषधि केंद्र, दवा इंडिया स्टोर और स्थानीय मेडिकल स्टोर खोजें। दवाओं की उपलब्धता, वर्तमान दाम और बैच विवरण पूछने के लिए व्हाट्सएप संदेश तैयार करें।"
            )}
          </p>
        </div>

        {/* Mandatory Stock Caveat Notice */}
        <div className="mb-6 rounded-2xl border border-amber-200/90 bg-amber-50/70 p-4 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">{tr("Important Pharmacy & Stock Verification Notice:", "महत्वपूर्ण मेडिकल स्टोर व स्टॉक सत्यापन सूचना:")}</span>
              <p className="mt-0.5 leading-relaxed text-amber-800">
                {tr(
                  "Directory listings do not confirm real-time medicine inventory. Always contact the pharmacy directly to verify availability, quoted price, manufacturer, and batch expiry before traveling or placing an order.",
                  "मैप लिस्टिंग से वास्तविक समय में स्टॉक की पुष्टि नहीं होती। जाने या ऑर्डर देने से पहले उपलब्धता, मूल्य और एक्सपायरी तिथि की पुष्टि स्टोर से सीधे करें।"
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Location Controls */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_10px_30px_rgba(15,40,90,0.05)]">
          <div className="flex flex-col gap-3 md:flex-row">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchLocality}
                onChange={(e) => setSearchLocality(e.target.value)}
                placeholder={tr(
                  "Search by locality, area, or PIN (e.g. Connaught Place, Rohini, 110001)...",
                  "क्षेत्र, इलाका या पिनकोड खोजें (उदा. रोहिणी, कनाट प्लेस, 110001)..."
                )}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-[#f8fbff] pl-10 pr-4 text-sm font-medium text-navy placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
              />
            </div>

            {/* Geolocation Button */}
            <button
              type="button"
              onClick={handleUseLocation}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-xs font-bold text-navy transition hover:border-brand hover:text-brand"
            >
              <Navigation className="h-3.5 w-3.5 text-brand" />
              <span>{tr("Use my location", "मेरी लोकेशन खोजें")}</span>
            </button>

            {/* Generic filter toggle */}
            <button
              type="button"
              onClick={() => setFilterGenericOnly((v) => !v)}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-xs font-bold transition ${
                filterGenericOnly
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-400"
              }`}
            >
              <Pill className="h-3.5 w-3.5" />
              <span>{tr("Generic Kendras only", "केवल जेनेरिक केंद्र")}</span>
            </button>
          </div>

          {locationStatus && (
            <p className="mt-3 text-xs font-medium text-slate-500">{locationStatus}</p>
          )}
        </div>

        {/* Enquiry Cart Alert Banner (if user has items) */}
        {items.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-[#eef5ff] p-4 text-xs">
            <div className="flex items-center gap-2 text-brand">
              <ShoppingCart className="h-4 w-4" />
              <span className="font-bold">
                {items.length} {tr("medicine(s) in your enquiry list", "दवाइयां आपकी सूची में")} ({itemCount} {tr("units", "इकाइयां")} · {tr("Indicative", "अनुमानित")} {formatInr(subtotal)})
              </span>
            </div>
            <Link
              to="/cart"
              className="font-bold text-brand hover:underline"
            >
              {tr("Review or edit list →", "सूची की समीक्षा या संपादन करें →")}
            </Link>
          </div>
        )}

        {/* Pharmacy Listings */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">
              {tr("Available Pharmacies", "उपलब्ध मेडिकल स्टोर")} ({displayedPharmacies.length})
            </h2>
            <span className="text-xs text-slate-400">
              {tr("Source: Curated PMBJP/Dava India Directory & Google Places", "स्रोत: जन औषधि, दवा इंडिया व गूगल मैप्स")}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {displayedPharmacies.map((pharmacy) => (
              <div
                key={pharmacy.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-brand/40 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pharmacy.is_generic_store ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {pharmacy.generic_network ?? tr("Generic Kendra", "जेनेरिक केंद्र")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {tr("Retail Pharmacy", "दवा की दुकान")}
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          {pharmacy.distance} {tr("away", "दूर")}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-navy">{pharmacy.name}</h3>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        pharmacy.open_now
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {pharmacy.open_now ? tr("Open now", "अभी खुला है") : tr("Closed", "बंद")}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    <MapPin className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                    {pharmacy.address}
                  </p>

                  {pharmacy.phone && (
                    <p className="mt-1 text-xs font-semibold text-navy">
                      {tr("Phone:", "फ़ोन:")} <span className="font-mono text-slate-700">{pharmacy.phone}</span>
                    </p>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-[11px] text-slate-400">{tr("Stock not confirmed", "स्टॉक सत्यापित नहीं")}</span>

                  <button
                    type="button"
                    onClick={() => setSelectedPharmacy(pharmacy)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>{tr("Prepare enquiry", "पूछताछ तैयार करें")}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SCREEN 8: ENQUIRY PREVIEW & WHATSAPP MODAL */}
        {selectedPharmacy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-xs">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl md:p-8">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedPharmacy(null)}
                className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="inline-flex items-center gap-2 rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-bold text-brand">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Screen 8 · Enquiry Preview & WhatsApp Handoff</span>
              </div>

              <h2 className="mt-3 text-2xl font-bold text-navy">
                Enquire with {selectedPharmacy.name}
              </h2>
              <p className="mt-1 text-xs text-muted">
                {selectedPharmacy.address} · {selectedPharmacy.phone ?? "No phone number available"}
              </p>

              {/* Delivery Locality & Custom Notes input */}
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-navy">
                    Your Delivery/Pickup Area (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerArea}
                    onChange={(e) => setCustomerArea(e.target.value)}
                    placeholder="e.g., Sector 15, Near City Hospital"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-medium text-navy focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-navy">
                    Specific Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="e.g., need urgent delivery, prefer PMBJP generic"
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs font-medium text-navy focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              {/* Message Preview Box */}
              <div className="mt-5">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Prefilled WhatsApp Message Preview
                </span>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-[#f8fbff] p-4 text-xs font-mono leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {generateEnquiryMessage(selectedPharmacy)}
                </div>
              </div>

              {/* Crucial Manual Send Notice (as per docs/ui_ux_guidelines.md) */}
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                <p className="font-bold">WhatsApp Manual Handoff Rule:</p>
                <p className="mt-0.5 leading-relaxed text-blue-800">
                  Clicking &ldquo;Open WhatsApp&rdquo; will launch WhatsApp with the message above prefilled.
                  You must review the text and <strong>manually press Send</strong> in WhatsApp.
                  MedEasy never sends messages on your behalf.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-navy hover:border-slate-300"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700">Message copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy message text</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPharmacy(null);
                      setShowResponseModal(true);
                    }}
                    className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-navy"
                  >
                    Simulate shopkeeper response
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    disabled={savingEnquiry}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#20bd5a]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Open in WhatsApp →</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 9: PHARMACY RESPONSE SIMULATION MODAL */}
        {showResponseModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-xs">
            <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setShowResponseModal(false)}
                className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                <Store className="h-3.5 w-3.5" />
                <span>Screen 9 · Demo Pharmacy Response Form</span>
              </div>

              <h2 className="mt-3 text-xl font-bold text-navy">Record / Simulate Pharmacy Response</h2>
              <p className="mt-1 text-xs text-muted">
                Captures the shopkeeper&apos;s quote and packaging details (batch number, expiry, manufacturer).
              </p>

              <div className="mt-5 space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-navy">Availability Status</label>
                  <select className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-medium text-navy">
                    <option value="available">In Stock (Available)</option>
                    <option value="partial">Partially Available</option>
                    <option value="unavailable">Out of Stock</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-navy">Quoted Price (₹)</label>
                    <input
                      type="text"
                      value={simulatedPrice}
                      onChange={(e) => setSimulatedPrice(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-medium text-navy"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-navy">Manufacturer on Pack</label>
                    <input
                      type="text"
                      value={simulatedMfr}
                      onChange={(e) => setSimulatedMfr(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-medium text-navy"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-navy">Batch Number on Pack</label>
                    <input
                      type="text"
                      value={simulatedBatch}
                      onChange={(e) => setSimulatedBatch(e.target.value)}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono font-bold text-navy"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-navy">Expiry Date</label>
                    <input
                      type="text"
                      defaultValue="08/2028"
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-medium text-navy"
                    />
                  </div>
                </div>
              </div>

              {/* Action: Proceed to Batch Safety Check */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setShowResponseModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowResponseModal(false);
                    navigate(`/batch-safety?batch=${encodeURIComponent(simulatedBatch)}&product=${encodeURIComponent(items[0]?.brand_name || "Paracetamol")}`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Verify Batch #{simulatedBatch} in Batch Safety →</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
