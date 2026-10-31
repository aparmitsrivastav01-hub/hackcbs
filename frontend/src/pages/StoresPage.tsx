import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
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
import { createEnquiry, formatInr, getShopWhatsAppContact } from "../api/client";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import type { Pharmacy, ShopWhatsAppContactRequest } from "../types";

// Curated reference pharmacy network directory (no hardcoded fake contacts)
const REFERENCE_PHARMACIES: Pharmacy[] = [
  {
    id: "ja-delhi-01",
    name: "Pradhan Mantri Bhartiya Janaushadhi Kendra (PMBJP)",
    address: "Shop No. 4, Community Centre, Sector 7, Rohini, New Delhi 110085",
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
    distance: "4.5 km",
    open_now: false,
    rating: 4.7,
    review_count: 67,
    is_generic_store: true,
    generic_network: "Jan Aushadhi",
    source: "demo",
  },
];

type DiscoveryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "verified"; whatsappNumber: string; sourceUrl?: string | null; message: string }
  | { status: "phone_only"; phoneNumber: string; sourceUrl?: string | null; message: string }
  | { status: "not_found"; message: string }
  | { status: "ambiguous"; message: string }
  | { status: "error"; error: string; isTimeout?: boolean; isUnavailable?: boolean };

export function StoresPage() {
  const navigate = useNavigate();
  const { tr } = useLanguage();
  const { items, itemCount, subtotal } = useCart();

  const [pharmacies] = useState<Pharmacy[]>(REFERENCE_PHARMACIES);
  const [filterGenericOnly, setFilterGenericOnly] = useState(false);
  const [searchLocality, setSearchLocality] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Selected Pharmacy for Screen 8 (Enquiry Preview & WhatsApp modal)
  const [selectedPharmacy, setSelectedPharmacy] = useState<Pharmacy | null>(null);
  const [customerArea, setCustomerArea] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingEnquiry, setSavingEnquiry] = useState(false);

  // Discovery state for on-demand TinyFish WhatsApp discovery
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>({ status: "idle" });

  // Custom shop input for shops discovered on Google Maps
  const [showCustomShopForm, setShowCustomShopForm] = useState(false);
  const [customShopName, setCustomShopName] = useState("");
  const [customShopAddress, setCustomShopAddress] = useState("");
  const [customShopCity, setCustomShopCity] = useState("");
  const [customShopMapsUrl, setCustomShopMapsUrl] = useState("");
  const [customShopError, setCustomShopError] = useState<string | null>(null);

  // Screen 9: Shopkeeper response simulation form state
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [simulatedBatch, setSimulatedBatch] = useState("PCM23H88");
  const [simulatedPrice, setSimulatedPrice] = useState("28.00");
  const [simulatedMfr, setSimulatedMfr] = useState("Karnataka Antibiotics");

  // Dynamic Google Maps Search URL generation without requiring an API key
  function getMapSearchQuery(): string {
    const categoryTerms = filterGenericOnly
      ? "Jan Aushadhi stores"
      : "pharmacies, Jan Aushadhi stores and medical shops";

    if (coords) {
      return `${categoryTerms} near ${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}`;
    }
    if (searchLocality.trim()) {
      return `${categoryTerms} near ${searchLocality.trim()}`;
    }
    return `${categoryTerms} near New Delhi`;
  }

  const mapQuery = getMapSearchQuery();
  const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`;
  const openInGoogleMapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}`;

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setLocationStatus(
        tr(
          "Geolocation is not supported by your browser.",
          "आपके ब्राउज़र द्वारा जियोलोकेशन समर्थित नहीं है।"
        )
      );
      return;
    }
    setLocationStatus(
      tr("Locating nearby pharmacies...", "नज़दीकी मेडिकल स्टोर खोज रहे हैं...")
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setSearchLocality("");
        setLocationStatus(
          tr(
            `Showing pharmacies near ${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`,
            `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)} के पास मेडिकल स्टोर दिखाए जा रहे हैं`
          )
        );
      },
      () => {
        setLocationStatus(
          tr(
            "Location access was denied. Showing pharmacies for default area.",
            "लोकेशन की अनुमति नहीं मिली। डिफ़ॉल्ट क्षेत्र के मेडिकल स्टोर दिखाए जा रहे हैं।"
          )
        );
      },
      { timeout: 8000 },
    );
  }

  function handleSearchChange(value: string) {
    setSearchLocality(value);
    if (coords) {
      setCoords(null);
    }
    if (locationStatus) {
      setLocationStatus(null);
    }
  }

  // Filter reference pharmacies based on search and generic-only filter
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
        ? items
            .map(
              (i) =>
                `• ${i.brand_name} (${i.active_salt || i.dosage_form || "standard pack"}) - Qty: ${i.quantity}`
            )
            .join("\n")
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

  function handleSelectPharmacy(pharmacy: Pharmacy) {
    setSelectedPharmacy(pharmacy);
    setDiscoveryState({ status: "idle" });
  }

  function handleCloseModal() {
    setSelectedPharmacy(null);
    setDiscoveryState({ status: "idle" });
  }

  async function handleOpenWhatsApp() {
    if (!selectedPharmacy) return;
    if (discoveryState.status === "loading") return;

    // If verified WhatsApp number was already discovered, launch wa.me directly
    if (discoveryState.status === "verified" && discoveryState.whatsappNumber) {
      const cleanPhone = discoveryState.whatsappNumber.replace(/[^0-9]/g, "");
      const message = generateEnquiryMessage(selectedPharmacy);
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setDiscoveryState({ status: "loading" });
    setSavingEnquiry(true);

    try {
      await createEnquiry({
        pharmacy_name: selectedPharmacy.name,
        pharmacy_phone: selectedPharmacy.phone,
        pharmacy_address: selectedPharmacy.address,
        customer_area: customerArea || undefined,
        customer_message: customNotes || undefined,
        items:
          items.length > 0
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
      // Local fallback handled gracefully
    } finally {
      setSavingEnquiry(false);
    }

    try {
      const payload: ShopWhatsAppContactRequest = {
        shop_name: selectedPharmacy.name,
        shop_address: selectedPharmacy.address,
        city: customerArea || searchLocality || undefined,
        locality: customerArea || searchLocality || undefined,
        maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPharmacy.name} ${selectedPharmacy.address}`)}`,
        query: `${selectedPharmacy.name} ${selectedPharmacy.address} pharmacy contact phone whatsapp`,
      };

      const contactRes = await getShopWhatsAppContact(payload);

      if (
        (contactRes.verification_status === "verified" || contactRes.verification_status === "verified_whatsapp") &&
        contactRes.whatsapp_number
      ) {
        setDiscoveryState({
          status: "verified",
          whatsappNumber: contactRes.whatsapp_number,
          sourceUrl: contactRes.source_url,
          message: contactRes.message,
        });
        const cleanPhone = contactRes.whatsapp_number.replace(/[^0-9]/g, "");
        const message = generateEnquiryMessage(selectedPharmacy);
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank", "noopener,noreferrer");
      } else if (contactRes.verification_status === "phone_only" && contactRes.phone_number) {
        setDiscoveryState({
          status: "phone_only",
          phoneNumber: contactRes.phone_number,
          sourceUrl: contactRes.source_url,
          message: contactRes.message,
        });
      } else if (contactRes.verification_status === "ambiguous") {
        setDiscoveryState({
          status: "ambiguous",
          message: contactRes.message || "Multiple shops match this name. Please verify the exact shop address.",
        });
      } else {
        setDiscoveryState({
          status: "not_found",
          message: contactRes.message || "WhatsApp number could not be verified for this shop.",
        });
      }
    } catch (err: unknown) {
      const errDetail = err instanceof Error ? err.message : "Contact discovery request failed.";
      const isTimeout = errDetail.toLowerCase().includes("timed out") || errDetail.toLowerCase().includes("timeout");
      const isUnavailable = errDetail.includes("503") || errDetail.toLowerCase().includes("not configured");
      setDiscoveryState({
        status: "error",
        error: errDetail,
        isTimeout,
        isUnavailable,
      });
    }
  }

  function handleCopyMessage() {
    if (!selectedPharmacy) return;
    const msg = generateEnquiryMessage(selectedPharmacy);
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleAddCustomShop(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = customShopName.trim();
    const cleanAddress = customShopAddress.trim();
    if (!cleanName || !cleanAddress) {
      setCustomShopError(
        tr(
          "Both pharmacy name and full shop address are required to identify the shop.",
          "दुकान की पहचान के लिए नाम और पूरा पता दोनों आवश्यक हैं।"
        )
      );
      return;
    }
    setCustomShopError(null);
    const customPharmacy: Pharmacy = {
      id: `custom-${Date.now()}`,
      name: cleanName,
      address: cleanAddress,
      distance: customShopCity.trim() || searchLocality || "Local Area",
      open_now: true,
      is_generic_store: false,
      source: "places",
    };
    setShowCustomShopForm(false);
    setCustomShopName("");
    setCustomShopAddress("");
    const chosenCity = customShopCity.trim() || searchLocality || "";
    setCustomShopCity("");
    setCustomShopMapsUrl("");
    if (chosenCity) {
      setCustomerArea(chosenCity);
    }
    handleSelectPharmacy(customPharmacy);
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
                  onChange={(e) => handleSearchChange(e.target.value)}
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

          {/* GOOGLE MAPS EMBED SECTION */}
          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-[0_10px_30px_rgba(15,40,90,0.05)]">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-sm font-bold text-navy">
                  <MapPin className="h-4 w-4 text-brand" />
                  <span>{tr("Google Maps Pharmacy Discovery", "गूगल मैप्स फार्मेसी खोज")}</span>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {mapQuery}
                </span>
              </div>

              {/* Separate Open in Google Maps Link */}
              <a
                href={openInGoogleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-brand transition hover:border-brand hover:bg-[#eef5ff]"
                aria-label="Open search in Google Maps in a new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{tr("Open in Google Maps ↗", "Google Maps में खोलें ↗")}</span>
              </a>
            </div>

            {/* Responsive Google Maps Search iframe */}
            <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-80 md:h-[380px]">
              <iframe
                title={tr("Google Maps Pharmacy Search", "गूगल मैप्स फार्मेसी खोज")}
                src={mapEmbedUrl}
                className="h-full w-full border-0"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* Clear Caveat */}
            <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <p>
                {tr(
                  "Google Maps Embed displays real-time search results directly from Google. MedEasy does not parse or claim structured pharmacy data from this map embed. To enquire with any pharmacy shown on the map, select a shop below or enter its name to verify contact via TinyFish.",
                  "गूगल मैप्स एम्बेड सीधे गूगल से लाइव परिणाम प्रदर्शित करता है। मेडईज़ी इस मैप से कोई संरचित स्टोर डेटा प्राप्त नहीं करता है। मैप में दिखने वाले किसी भी स्टोर से पूछताछ करने के लिए नीचे स्टोर चुनें या उसका नाम दर्ज करें।"
                )}
              </p>
            </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-navy">
                  {tr("Available Pharmacies", "उपलब्ध मेडिकल स्टोर")} ({displayedPharmacies.length})
                </h2>
                <span className="text-xs text-slate-400">
                  {tr(
                    "WhatsApp contacts discovered on demand via TinyFish when you prepare an enquiry",
                    "पूछताछ तैयार करते समय TinyFish द्वारा WhatsApp संपर्क खोजा जाता है"
                  )}
                </span>
              </div>

              {/* Option to enquire with a store found on Google Maps */}
              <button
                type="button"
                onClick={() => setShowCustomShopForm((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-white px-3 py-1.5 text-xs font-bold text-brand hover:bg-[#eef5ff]"
              >
                <Store className="h-3.5 w-3.5" />
                <span>
                  {showCustomShopForm
                    ? tr("Close custom shop form", "कस्टम दुकान फॉर्म बंद करें")
                    : tr("Enquire with shop from map", "मैप से दुकान का नाम दर्ज करें")}
                </span>
              </button>
            </div>

            {/* Custom shop enquiry input form */}
            {showCustomShopForm && (
              <form
                onSubmit={handleAddCustomShop}
                className="rounded-2xl border border-brand/20 bg-[#f4f8ff] p-5 text-xs shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-brand" />
                    <p className="font-bold text-navy">
                      {tr(
                        "Enquire with any Pharmacy seen on Google Maps",
                        "Google Maps में दिखने वाली किसी भी दुकान से पूछताछ करें"
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomShopForm(false);
                      setCustomShopError(null);
                    }}
                    className="text-slate-400 hover:text-navy"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-slate-500">
                  {tr(
                    "Enter the exact shop name and full address from the map. TinyFish will search public records to discover verified WhatsApp and phone contacts.",
                    "मैप से दुकान का सही नाम व पूरा पता दर्ज करें। TinyFish सार्वजनिक रिकॉर्ड्स से सत्यापित WhatsApp व फोन संपर्क खोजेगा।"
                  )}
                </p>

                {customShopError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                    {customShopError}
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block font-semibold text-slate-700">
                      {tr("Pharmacy / Shop Name", "फार्मेसी / दुकान का नाम")} *
                    </label>
                    <input
                      type="text"
                      required
                      value={customShopName}
                      onChange={(e) => {
                        setCustomShopName(e.target.value);
                        if (customShopError) setCustomShopError(null);
                      }}
                      placeholder={tr("e.g., Apollo Pharmacy, Green Park", "उदा. अपोलो फार्मेसी, ग्रीन पार्क")}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 font-medium text-navy focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">
                      {tr("Address or Locality", "पता या इलाका")} *
                    </label>
                    <input
                      type="text"
                      required
                      value={customShopAddress}
                      onChange={(e) => {
                        setCustomShopAddress(e.target.value);
                        if (customShopError) setCustomShopError(null);
                      }}
                      placeholder={tr("e.g., Main Market, Green Park, New Delhi", "उदा. मुख्य बाजार, ग्रीन पार्क, नई दिल्ली")}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 font-medium text-navy focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">
                      {tr("Locality / City", "इलाका / शहर")}
                    </label>
                    <input
                      type="text"
                      value={customShopCity}
                      onChange={(e) => setCustomShopCity(e.target.value)}
                      placeholder={tr("e.g., Lucknow", "उदा. लखनऊ")}
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 font-medium text-navy focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">
                      {tr("Optional Google Maps URL", "वैकल्पिक Google Maps लिंक")}
                    </label>
                    <input
                      type="url"
                      value={customShopMapsUrl}
                      onChange={(e) => setCustomShopMapsUrl(e.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 font-medium text-navy focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomShopForm(false);
                      setCustomShopError(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {tr("Cancel", "रद्द करें")}
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-brand px-4 py-1.5 text-xs font-bold text-white transition hover:bg-brand-dark"
                  >
                    {tr("Prepare Enquiry →", "पूछताछ तैयार करें →")}
                  </button>
                </div>
              </form>
            )}

            {displayedPharmacies.length === 0 && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 text-center md:text-left">
                <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
                  <div className="rounded-2xl bg-white p-3 shadow-xs">
                    <MapPin className="h-6 w-6 text-brand" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-navy">
                      {searchLocality.trim()
                        ? tr(`Live Google Maps Discovery for "${searchLocality}"`, `"${searchLocality}" के लिए लाइव Google Maps खोज`)
                        : tr("Explore Local Pharmacies on the Map", "मैप पर स्थानीय मेडिकल स्टोर देखें")}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-2xl">
                      {tr(
                        "Google Maps above is currently displaying live pharmacies, Jan Aushadhi Kendras, and medical shops in this search area. Since Google Maps Embed is for interactive map discovery, select or enter any pharmacy seen on the map to discover its WhatsApp contact and send your enquiry.",
                        "ऊपर Google Maps इस क्षेत्र के सभी सक्रिय जन औषधि केंद्र और मेडिकल स्टोर दिखा रहा है। मैप पर दिख रही किसी भी दुकान से संपर्क के लिए नीचे दिए गए बटन पर क्लिक करें।"
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomShopCity(searchLocality.trim());
                        setShowCustomShopForm(true);
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark"
                    >
                      <Store className="h-4 w-4" />
                      <span>{tr("Enquire with shop from map", "मैप से दुकान चुनें व पूछताछ करें")}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                          {pharmacy.distance && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              {pharmacy.distance} {tr("away", "दूर")}
                            </span>
                          )}
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

                    <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      <span>{tr("WhatsApp & phone verified on demand via TinyFish", "TinyFish द्वारा ऑन-डिमांड संपर्क सत्यापन")}</span>
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-[11px] text-slate-400">{tr("Stock not confirmed", "स्टॉक सत्यापित नहीं")}</span>

                    <button
                      type="button"
                      onClick={() => handleSelectPharmacy(pharmacy)}
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
                  onClick={handleCloseModal}
                  className="absolute right-5 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="inline-flex items-center gap-2 rounded-full bg-[#eef5ff] px-3 py-1 text-xs font-bold text-brand">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{tr("Screen 8 · Enquiry Preview & WhatsApp Handoff", "स्क्रीन 8 · पूछताछ और WhatsApp संदेश")}</span>
                </div>

                <h2 className="mt-3 text-2xl font-bold text-navy">
                  Enquire with {selectedPharmacy.name}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {selectedPharmacy.address}
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
                      placeholder={tr("e.g., Sector 15, Near City Hospital", "उदा. सेक्टर 15, सिटी अस्पताल के पास")}
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
                      placeholder={tr("e.g., need urgent delivery, prefer PMBJP generic", "उदा. तुरंत चाहिए, PMBJP जेनेरिक पसंद है")}
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

                {/* Mandatory WhatsApp Manual Send Notice */}
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                  <p className="font-bold">{tr("WhatsApp Manual Handoff Rule:", "WhatsApp संदेश भेजने का नियम:")}</p>
                  <p className="mt-0.5 leading-relaxed text-blue-800">
                    Clicking &ldquo;Open WhatsApp&rdquo; will verify official public listings for this shop and launch WhatsApp with the message above prefilled.
                    You must review the text and <strong>manually press Send</strong> in WhatsApp.
                    MedEasy never sends messages on your behalf.
                  </p>
                </div>

                {/* ON-DEMAND TINYFISH CONTACT DISCOVERY UI STATES */}
                {discoveryState.status === "loading" && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
                    <div className="flex items-center gap-2 font-bold text-brand">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                      <span>{tr("Finding shop's WhatsApp contact...", "दुकान का WhatsApp संपर्क खोज रहे हैं...")}</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-blue-800">
                      {tr(
                        "TinyFish is searching official pages and verified public business listings for this shop. This avoids fake numbers and ensures you connect to the exact store.",
                        "TinyFish इस दुकान के लिए आधिकारिक सार्वजनिक लिस्टिंग खोज रहा है ताकि आपको सटीक स्टोर का संपर्क मिले।"
                      )}
                    </p>
                  </div>
                )}

                {discoveryState.status === "verified" && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900">
                    <div className="flex items-center gap-2 font-bold text-emerald-700">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>{tr("Verified WhatsApp Contact:", "सत्यापित WhatsApp संपर्क:")} <span className="font-mono">{discoveryState.whatsappNumber}</span></span>
                    </div>
                    {discoveryState.sourceUrl && (
                      <p className="mt-1 text-[11px] text-emerald-700">
                        {tr("Source:", "स्रोत:")} <span className="font-mono break-all">{discoveryState.sourceUrl}</span>
                      </p>
                    )}
                    <p className="mt-1 leading-relaxed text-emerald-800">
                      {tr(
                        "WhatsApp opened in a new tab. Please review the prefilled message and press Send in WhatsApp manually.",
                        "WhatsApp नए टैब में खुल गया है। कृपया संदेश की समीक्षा करें और स्वयं Send दबाएं।"
                      )}
                    </p>
                  </div>
                )}

                {discoveryState.status === "phone_only" && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span>{tr("WhatsApp number could not be verified for this shop.", "इस दुकान के लिए WhatsApp नंबर सत्यापित नहीं हो सका।")}</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-amber-800">
                      {tr(
                        `A public phone number was found (${discoveryState.phoneNumber}), but WhatsApp could not be verified. A phone number alone does not prove WhatsApp is available.`,
                        `एक सार्वजनिक फ़ोन नंबर मिला (${discoveryState.phoneNumber}), लेकिन WhatsApp सत्यापित नहीं हो सका। फ़ोन नंबर होना WhatsApp होने का प्रमाण नहीं है।`
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a
                        href={`tel:${discoveryState.phoneNumber}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
                      >
                        <Phone className="h-3.5 w-3.5 text-amber-700" />
                        <span>{tr("Call Store", "स्टोर पर कॉल करें")} ({discoveryState.phoneNumber})</span>
                      </a>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPharmacy.name} ${selectedPharmacy.address}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-navy transition hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                        <span>{tr("View on Google Maps", "Google Maps पर देखें")}</span>
                      </a>
                    </div>
                  </div>
                )}

                {discoveryState.status === "not_found" && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <AlertCircle className="h-4 w-4 text-slate-500" />
                      <span>{tr("WhatsApp number could not be verified for this shop.", "इस दुकान के लिए WhatsApp नंबर सत्यापित नहीं हो सका।")}</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-slate-600">
                      {tr(
                        "No verified public contact could be discovered for this exact store. You can search this shop on Google Maps or copy the enquiry text to share manually.",
                        "इस स्टोर के लिए कोई सत्यापित सार्वजनिक संपर्क नहीं मिला। आप Google Maps पर खोज सकते हैं या संदेश कॉपी कर सकते हैं।"
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPharmacy.name} ${selectedPharmacy.address}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-navy transition hover:bg-slate-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                        <span>{tr("Search on Google Maps", "Google Maps पर खोजें")}</span>
                      </a>
                    </div>
                  </div>
                )}

                {discoveryState.status === "ambiguous" && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
                    <div className="flex items-center gap-2 font-bold text-amber-800">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span>{tr("Multiple matching pharmacy locations found.", "फार्मेसी के कई स्थान मिले।")}</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-amber-800">
                      {tr(
                        "Multiple branches or conflicting public contacts were found for this pharmacy. To ensure you reach the correct shopkeeper, please refine the shop address or view the listing on Google Maps.",
                        "इस फार्मेसी के लिए कई शाखाएं या परस्पर विरोधी संपर्क मिले। सही दुकानदार तक पहुंचने के लिए, कृपया पता स्पष्ट करें या Google Maps पर देखें।"
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleCloseModal();
                          setShowCustomShopForm(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
                      >
                        <Store className="h-3.5 w-3.5 text-amber-700" />
                        <span>{tr("Refine Shop Details", "दुकान का विवरण सुधारें")}</span>
                      </button>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPharmacy.name} ${selectedPharmacy.address}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-navy transition hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                        <span>{tr("View on Google Maps", "Google Maps पर देखें")}</span>
                      </a>
                    </div>
                  </div>
                )}

                {discoveryState.status === "error" && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-900">
                    <div className="flex items-center gap-2 font-bold text-red-700">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span>{tr("Contact discovery timed out or encountered an error.", "संपर्क खोज में त्रुटि हुई या समय समाप्त हो गया।")}</span>
                    </div>
                    <p className="mt-1 leading-relaxed text-red-800">{discoveryState.error}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenWhatsApp}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700"
                      >
                        <span>{tr("Retry Discovery", "पुनः प्रयास करें")}</span>
                      </button>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPharmacy.name} ${selectedPharmacy.address}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-navy transition hover:bg-slate-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                        <span>{tr("Search on Google Maps", "Google Maps पर खोजें")}</span>
                      </a>
                    </div>
                  </div>
                )}

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
                        <span className="text-emerald-700">{tr("Message copied!", "संदेश कॉपी हो गया!")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>{tr("Copy message text", "संदेश कॉपी करें")}</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseModal();
                        setShowResponseModal(true);
                      }}
                      className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-navy"
                    >
                      Simulate shopkeeper response
                    </button>

                    {discoveryState.status === "verified" ? (
                      <button
                        type="button"
                        onClick={handleOpenWhatsApp}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#20bd5a]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>{tr("Open in WhatsApp →", "WhatsApp में खोलें →")}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenWhatsApp}
                        disabled={discoveryState.status === "loading" || savingEnquiry}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#20bd5a] disabled:opacity-60"
                      >
                        {discoveryState.status === "loading" ? (
                          <>
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>{tr("Finding contact...", "संपर्क खोज रहे हैं...")}</span>
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4" />
                            <span>{tr("Open in WhatsApp →", "WhatsApp में खोलें →")}</span>
                          </>
                        )}
                      </button>
                    )}
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
                  <span>{tr("Screen 9 · Demo Pharmacy Response Form", "स्क्रीन 9 · फार्मेसी उत्तर फॉर्म")}</span>
                </div>

                <h2 className="mt-3 text-xl font-bold text-navy">{tr("Record / Simulate Pharmacy Response", "फार्मेसी का उत्तर दर्ज करें / सिम्युलेट करें")}</h2>
                <p className="mt-1 text-xs text-muted">
                  Captures the shopkeeper&apos;s quote and packaging details (batch number, expiry, manufacturer).
                </p>

                <div className="mt-5 space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-navy">{tr("Availability Status", "उपलब्धता स्थिति")}</label>
                    <select className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-medium text-navy">
                      <option value="available">{tr("In Stock (Available)", "स्टॉक में उपलब्ध")}</option>
                      <option value="partial">{tr("Partially Available", "आंशिक रूप से उपलब्ध")}</option>
                      <option value="unavailable">{tr("Out of Stock", "स्टॉक में नहीं")}</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-navy">{tr("Quoted Price (₹)", "बताई गई कीमत (₹)")}</label>
                      <input
                        type="text"
                        value={simulatedPrice}
                        onChange={(e) => setSimulatedPrice(e.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-medium text-navy"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-navy">{tr("Manufacturer on Pack", "पैक पर निर्माता")}</label>
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
                      <label className="block font-semibold text-navy">{tr("Batch Number on Pack", "पैक पर बैच नंबर")}</label>
                      <input
                        type="text"
                        value={simulatedBatch}
                        onChange={(e) => setSimulatedBatch(e.target.value)}
                        className="mt-1 h-9 w-full rounded-xl border border-slate-200 px-3 font-mono font-bold text-navy"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-navy">{tr("Expiry Date", "समाप्ति तिथि")}</label>
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
                    <span>{tr("Verify Batch", "बैच जांचें")} #{simulatedBatch} {tr("in Batch Safety →", "बैच सुरक्षा में →")}</span>
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
