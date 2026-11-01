import {
  AlertCircle,
  ArrowUpDown,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Filter,
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
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { createEnquiry, formatInr, getShopWhatsAppContact } from "../api/client";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";
import {
  DEFAULT_DELHI_SEED_STORES,
  fetchPharmacyDirectory,
  filterAndSortDirectoryEntries,
} from "../services/pharmacyDirectoryService";
import type { PharmacyDirectoryEntry, ShopWhatsAppContactRequest } from "../types";

export type SelectedPharmacyInfo = {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  whatsapp_number?: string | null;
  whatsapp_verified?: boolean;
  brand?: string | null;
  district?: string | null;
  pincode?: string | null;
  distance?: string | null;
  sourceUrl?: string | null;
  dataStatus?: string | null;
};

const SESSION_VERIFIED_WHATSAPP_CACHE_KEY = "medeasy_verified_whatsapp_cache";

export type CachedVerifiedContact = {
  whatsappNumber: string;
  phoneNumber?: string | null;
  shopName?: string | null;
  address?: string | null;
  sourceUrl?: string | null;
  embedUrl?: string | null;
  runUrl?: string | null;
};

export function getSessionVerifiedCache(): Record<string, CachedVerifiedContact> {
  try {
    const raw = sessionStorage.getItem(SESSION_VERIFIED_WHATSAPP_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSessionVerifiedContact(storeId: string, data: CachedVerifiedContact) {
  try {
    const current = getSessionVerifiedCache();
    current[storeId] = data;
    sessionStorage.setItem(SESSION_VERIFIED_WHATSAPP_CACHE_KEY, JSON.stringify(current));
  } catch {
    /* ignore storage errors */
  }
}

type DiscoveryState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "verified";
      whatsappNumber: string;
      phoneNumber?: string | null;
      shopName?: string;
      address?: string | null;
      sourceUrl?: string | null;
      embedUrl?: string | null;
      runUrl?: string | null;
      message: string;
    }
  | {
      status: "phone_only";
      phoneNumber: string;
      shopName?: string;
      address?: string | null;
      sourceUrl?: string | null;
      embedUrl?: string | null;
      runUrl?: string | null;
      message: string;
    }
  | {
      status: "not_found";
      shopName?: string;
      address?: string | null;
      sourceUrl?: string | null;
      embedUrl?: string | null;
      runUrl?: string | null;
      message: string;
    }
  | {
      status: "ambiguous";
      shopName?: string;
      address?: string | null;
      sourceUrl?: string | null;
      embedUrl?: string | null;
      runUrl?: string | null;
      message: string;
    }
  | { status: "error"; error: string; isTimeout?: boolean; isUnavailable?: boolean };

export function StoresPage() {
  const navigate = useNavigate();
  const { tr } = useLanguage();
  const { items, itemCount, subtotal } = useCart();

  // Pharmacy directory state (Delhi Seed Dataset)
  const [directoryStores, setDirectoryStores] = useState<PharmacyDirectoryEntry[]>(DEFAULT_DELHI_SEED_STORES);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([
    "Central Delhi",
    "East Delhi",
    "New Delhi",
    "North Delhi",
    "North West Delhi",
    "Shahdara",
    "South Delhi",
    "South West Delhi",
    "West Delhi",
  ]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);

  // Search and Filter states
  const [searchLocality, setSearchLocality] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [sortByDistance, setSortByDistance] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Selected Pharmacy for Screen 8 (Enquiry Preview & WhatsApp modal)
  const [selectedPharmacy, setSelectedPharmacy] = useState<SelectedPharmacyInfo | null>(null);
  const [customerArea, setCustomerArea] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingEnquiry, setSavingEnquiry] = useState(false);

  // Discovery state for on-demand TinyFish WhatsApp discovery
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>({ status: "idle" });
  const [sessionCache, setSessionCache] = useState<Record<string, CachedVerifiedContact>>(() =>
    getSessionVerifiedCache()
  );

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

  // Load directory entries on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingDirectory(true);
    fetchPharmacyDirectory()
      .then((res) => {
        if (isMounted && res.stores.length > 0) {
          setDirectoryStores(res.stores);
          if (res.districts && res.districts.length > 0) {
            setAvailableDistricts(res.districts);
          }
        }
      })
      .catch(() => {
        // Fallback already preloaded
      })
      .finally(() => {
        if (isMounted) setIsLoadingDirectory(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter and sort displayed stores
  const displayedStores = useMemo(() => {
    const res = filterAndSortDirectoryEntries(directoryStores, {
      search: searchLocality,
      brand: brandFilter !== "all" ? brandFilter : undefined,
      district: districtFilter !== "all" ? districtFilter : undefined,
      sort_by_distance: sortByDistance,
    });
    return res.stores;
  }, [directoryStores, searchLocality, brandFilter, districtFilter, sortByDistance]);

  // Dynamic Google Maps Search URL generation without requiring an API key
  function getMapSearchQuery(): string {
    let categoryTerms = "pharmacies, Jan Aushadhi stores and medical shops";
    if (brandFilter === "Jan Aushadhi") {
      categoryTerms = "Jan Aushadhi stores";
    } else if (brandFilter === "Davaindia") {
      categoryTerms = "Davaindia generic pharmacy";
    }

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

  // Generate WhatsApp prefilled enquiry text
  function generateEnquiryMessage(pharmacy: SelectedPharmacyInfo) {
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

  const hasVerifiedWhatsApp = Boolean(
    (discoveryState.status === "verified" && discoveryState.whatsappNumber) ||
    (selectedPharmacy?.whatsapp_verified && selectedPharmacy?.whatsapp_number)
  );

  const verifiedWhatsAppNumber =
    discoveryState.status === "verified" && discoveryState.whatsappNumber
      ? discoveryState.whatsappNumber
      : selectedPharmacy?.whatsapp_verified && selectedPharmacy?.whatsapp_number
      ? selectedPharmacy.whatsapp_number
      : null;

  function handleSelectDirectoryStore(store: PharmacyDirectoryEntry) {
    const cached = sessionCache[store.store_id];
    const isCsvVerified = Boolean(store.whatsapp_verified && store.whatsapp_number);
    const initialWa = cached?.whatsappNumber || (isCsvVerified ? store.whatsapp_number : null);

    setSelectedPharmacy({
      id: store.store_id,
      name: store.store_name,
      address: `${store.address}, ${store.district} - ${store.pincode}`,
      phone: store.phone,
      whatsapp_number: initialWa,
      whatsapp_verified: Boolean(initialWa),
      brand: store.brand,
      district: store.district,
      pincode: store.pincode,
      distance:
        store.distance_from_shaheed_sukhdev_km !== null
          ? `${store.distance_from_shaheed_sukhdev_km} km`
          : null,
      sourceUrl: cached?.sourceUrl || store.source_url,
      dataStatus: store.data_status,
    });

    if (cached) {
      setDiscoveryState({
        status: "verified",
        whatsappNumber: cached.whatsappNumber,
        phoneNumber: cached.phoneNumber || store.phone,
        shopName: cached.shopName || store.store_name,
        address: cached.address || `${store.address}, ${store.district} - ${store.pincode}`,
        sourceUrl: cached.sourceUrl || store.source_url,
        embedUrl: cached.embedUrl || null,
        runUrl: cached.runUrl || null,
        message: tr("Reused verified WhatsApp contact from current session.", "सत्र से सत्यापित WhatsApp संपर्क पुनः उपयोग किया गया।"),
      });
    } else if (isCsvVerified && store.whatsapp_number) {
      setDiscoveryState({
        status: "verified",
        whatsappNumber: store.whatsapp_number,
        phoneNumber: store.phone,
        shopName: store.store_name,
        address: `${store.address}, ${store.district} - ${store.pincode}`,
        sourceUrl: store.source_url,
        message: tr("Verified WhatsApp contact available from directory.", "डायरेक्टरी से सत्यापित WhatsApp संपर्क उपलब्ध।"),
      });
    } else {
      setDiscoveryState({ status: "idle" });
    }
  }

  function handleCloseModal() {
    setSelectedPharmacy(null);
    setDiscoveryState({ status: "idle" });
  }

  /**
   * Explicitly triggered ONLY when user clicks "Find WhatsApp".
   * Queries TinyFish to search official listings.
   */
  async function handleFindWhatsApp() {
    if (!selectedPharmacy) return;
    if (discoveryState.status === "loading") return;

    // Check if session cache already has verified number
    const cached = sessionCache[selectedPharmacy.id];
    if (cached && cached.whatsappNumber) {
      setDiscoveryState({
        status: "verified",
        whatsappNumber: cached.whatsappNumber,
        phoneNumber: cached.phoneNumber || selectedPharmacy.phone,
        shopName: cached.shopName || selectedPharmacy.name,
        address: cached.address || selectedPharmacy.address,
        sourceUrl: cached.sourceUrl || selectedPharmacy.sourceUrl,
        embedUrl: cached.embedUrl || null,
        runUrl: cached.runUrl || null,
        message: tr("Reused verified WhatsApp contact from current session.", "सत्र से सत्यापित WhatsApp संपर्क पुनः उपयोग किया गया।"),
      });
      return;
    }

    setDiscoveryState({ status: "loading" });

    try {
      const payload: ShopWhatsAppContactRequest = {
        shop_name: selectedPharmacy.name,
        shop_address: selectedPharmacy.address,
        city: customerArea || searchLocality || selectedPharmacy.district || undefined,
        locality: customerArea || searchLocality || selectedPharmacy.district || undefined,
        maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedPharmacy.name} ${selectedPharmacy.address}`)}`,
        query: `${selectedPharmacy.name} ${selectedPharmacy.address} pharmacy contact phone whatsapp`,
      };

      const contactRes = await getShopWhatsAppContact(payload);

      if (
        (contactRes.verification_status === "verified" || contactRes.verification_status === "verified_whatsapp") &&
        contactRes.whatsapp_number
      ) {
        saveSessionVerifiedContact(selectedPharmacy.id, {
          whatsappNumber: contactRes.whatsapp_number,
          phoneNumber: contactRes.phone_number || contactRes.mobile_number || null,
          shopName: contactRes.shop_name,
          address: contactRes.address || selectedPharmacy.address,
          sourceUrl: contactRes.source_url,
          embedUrl: contactRes.embed_url,
          runUrl: contactRes.run_url,
        });

        setSessionCache((prev) => ({
          ...prev,
          [selectedPharmacy.id]: {
            whatsappNumber: contactRes.whatsapp_number as string,
            phoneNumber: contactRes.phone_number || contactRes.mobile_number || null,
            shopName: contactRes.shop_name,
            address: contactRes.address || selectedPharmacy.address,
            sourceUrl: contactRes.source_url,
            embedUrl: contactRes.embed_url,
            runUrl: contactRes.run_url,
          },
        }));

        setSelectedPharmacy((prev) =>
          prev
            ? {
                ...prev,
                whatsapp_number: contactRes.whatsapp_number,
                whatsapp_verified: true,
              }
            : null
        );

        setDiscoveryState({
          status: "verified",
          whatsappNumber: contactRes.whatsapp_number,
          phoneNumber: contactRes.phone_number || contactRes.mobile_number || null,
          shopName: contactRes.shop_name,
          address: contactRes.address || selectedPharmacy.address,
          sourceUrl: contactRes.source_url,
          embedUrl: contactRes.embed_url,
          runUrl: contactRes.run_url,
          message: contactRes.message,
        });
      } else if (contactRes.verification_status === "phone_only" && (contactRes.phone_number || contactRes.mobile_number)) {
        setDiscoveryState({
          status: "phone_only",
          phoneNumber: (contactRes.phone_number || contactRes.mobile_number) as string,
          shopName: contactRes.shop_name,
          address: contactRes.address || selectedPharmacy.address,
          sourceUrl: contactRes.source_url,
          embedUrl: contactRes.embed_url,
          runUrl: contactRes.run_url,
          message: contactRes.message,
        });
      } else if (contactRes.verification_status === "ambiguous") {
        setDiscoveryState({
          status: "ambiguous",
          shopName: contactRes.shop_name,
          address: contactRes.address || selectedPharmacy.address,
          sourceUrl: contactRes.source_url,
          message: contactRes.message || "Multiple shops match this name. Please verify the exact shop address.",
        });
      } else {
        setDiscoveryState({
          status: "not_found",
          shopName: contactRes.shop_name,
          address: contactRes.address || selectedPharmacy.address,
          sourceUrl: contactRes.source_url,
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

  /**
   * Opens WhatsApp with prefilled message ONLY when verified number exists.
   * NEVER invokes TinyFish.
   * Calls window.open immediately within click handler to prevent popup blocking.
   */
  async function handleOpenWhatsApp() {
    if (!selectedPharmacy) return;
    if (!verifiedWhatsAppNumber) return;

    const cleanPhone = verifiedWhatsAppNumber.replace(/[^0-9]/g, "");
    const message = generateEnquiryMessage(selectedPharmacy);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    // Launch popup immediately within user click event context to avoid browser popup blockers
    window.open(waUrl, "_blank", "noopener,noreferrer");

    setSavingEnquiry(true);
    try {
      await createEnquiry({
        pharmacy_name: selectedPharmacy.name,
        pharmacy_phone: selectedPharmacy.phone || verifiedWhatsAppNumber || undefined,
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
    const customPharmacy: SelectedPharmacyInfo = {
      id: `custom-${Date.now()}`,
      name: cleanName,
      address: cleanAddress,
      phone: null,
      whatsapp_number: null,
      whatsapp_verified: false,
      distance: customShopCity.trim() || searchLocality || "Local Area",
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
    setSelectedPharmacy(customPharmacy);
    setDiscoveryState({ status: "idle" });
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
              <span>{tr("Delhi Pharmacy Directory & Enquiry Handoff", "दिल्ली फार्मेसी डायरेक्टरी व पूछताछ")}</span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
              {tr("Find Nearby Pharmacies & Send Enquiries", "नज़दीकी मेडिकल स्टोर खोजें व पूछताछ भेजें")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {tr(
                "Locate Jan Aushadhi Kendras and Dava India stores across Delhi districts. Prepare a structured inquiry with your requested medicines to check live stock, prices, and batch details.",
                "दिल्ली के विभिन्न जिलों में जन औषधि केंद्र व दवा इंडिया स्टोर खोजें। दवाओं की उपलब्धता, वर्तमान दाम और बैच विवरण पूछने के लिए व्हाट्सएप संदेश तैयार करें।"
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
                    "डायरेक्टरी लिस्टिंग से वास्तविक समय में स्टॉक की पुष्टि नहीं होती। जाने या ऑर्डर देने से पहले उपलब्धता, मूल्य और एक्सपायरी तिथि की पुष्टि स्टोर से सीधे करें।"
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
                    "Search by locality, area, or PIN (e.g. Rohini, Connaught Place, 110085)...",
                    "क्षेत्र, इलाका, पिनकोड या स्टोर खोजें (उदा. रोहिणी, कनाट प्लेस, 110085)..."
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
            </div>

            {/* Filter controls row */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              {/* Brand filter buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 mr-1">{tr("Brand:", "ब्रांड:")}</span>
                <button
                  type="button"
                  onClick={() => setBrandFilter("all")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    brandFilter === "all"
                      ? "bg-navy text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {tr("All Brands", "सभी ब्रांड")}
                </button>
                <button
                  type="button"
                  onClick={() => setBrandFilter("Jan Aushadhi")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    brandFilter === "Jan Aushadhi"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "border border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100/60"
                  }`}
                >
                  <Pill className="h-3 w-3" />
                  <span>Jan Aushadhi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBrandFilter("Davaindia")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    brandFilter === "Davaindia"
                      ? "bg-brand text-white shadow-xs"
                      : "border border-blue-200 bg-blue-50/60 text-brand hover:bg-blue-100/60"
                  }`}
                >
                  <Store className="h-3 w-3" />
                  <span>Davaindia</span>
                </button>
              </div>

              {/* District dropdown */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-500">{tr("District:", "ज़िला:")}</span>
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-navy focus:border-brand focus:outline-none"
                  aria-label="Filter by district"
                >
                  <option value="all">{tr("All Districts", "सभी ज़िले")}</option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Distance sorting toggle */}
              <button
                type="button"
                onClick={() => setSortByDistance((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  sortByDistance
                    ? "bg-brand text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
                aria-pressed={sortByDistance}
              >
                <ArrowUpDown className="h-3 w-3" />
                <span>{tr("Sort by distance (from CBS Rohini)", "दूरी अनुसार क्रमबद्ध (CBS रोहिणी से)")}</span>
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
                  "Google Maps Embed displays real-time search results directly from Google. MedEasy does not parse or claim structured pharmacy data from this map embed. To enquire with any pharmacy shown on the map, select a verified listing below or enter its shop name to discover WhatsApp contact via TinyFish.",
                  "गूगल मैप्स एम्बेड सीधे गूगल से लाइव परिणाम प्रदर्शित करता है। मेडईज़ी इस मैप से कोई संरचित स्टोर डेटा प्राप्त नहीं करता है। मैप में दिखने वाले किसी भी स्टोर से पूछताछ करने के लिए नीचे स्टोर चुनें या उसका नाम दर्ज करें।"
                )}
              </p>
            </div>
          </div>

          {/* Distance Reference Notice */}
          <div className="mt-4 rounded-xl border border-blue-100 bg-[#eef5ff] p-3 text-xs text-blue-900">
            <p>
              <span className="font-bold">{tr("Verified Distance Reference:", "सत्यापित दूरी संदर्भ बिंदु:")} </span>
              {tr(
                "Distance values in the seed directory are measured from Shaheed Sukhdev College of Business Studies (CBS, Rohini, Delhi 110089). Unverified listings display 'Distance unavailable' without fabricating straight-line numbers.",
                "डायरेक्टरी में दूरी शहीद सुखदेव कॉलेज ऑफ बिजनेस स्टडीज (CBS, रोहिणी, दिल्ली 110089) के सापेक्ष मापी गई है। असत्यापित रिकॉर्ड 'Distance unavailable' प्रदर्शित करते हैं।"
              )}
            </p>
          </div>

          {/* Enquiry Cart Alert Banner (if user has items) */}
          {items.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-[#eef5ff] p-4 text-xs">
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
                  {tr("Available Pharmacies", "उपलब्ध मेडिकल स्टोर")} ({displayedStores.length})
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

            {isLoadingDirectory && (
              <div className="py-8 text-center text-xs font-medium text-slate-500">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent mb-2" />
                <span>{tr("Loading pharmacy directory...", "फार्मेसी डायरेक्टरी लोड हो रही है...")}</span>
              </div>
            )}

            {!isLoadingDirectory && displayedStores.length === 0 && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 text-center md:text-left">
                <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
                  <div className="rounded-2xl bg-white p-3 shadow-xs">
                    <MapPin className="h-6 w-6 text-brand" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-navy">
                      {searchLocality.trim()
                        ? tr(`No direct seed matches for "${searchLocality}"`, `"${searchLocality}" के लिए कोई डायरेक्टरी परिणाम नहीं`)
                        : tr("No pharmacies match the selected filters", "चयनित फिल्टर के लिए कोई फार्मेसी नहीं मिली")}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-2xl">
                      {tr(
                        "Google Maps above is currently displaying live pharmacies and medical shops in this area. You can reset filters, or enquire with any pharmacy shown on the map by clicking the button below.",
                        "ऊपर Google Maps इस क्षेत्र के सभी सक्रिय स्टोर दिखा रहा है। आप फिल्टर रीसेट कर सकते हैं या मैप से दुकान का नाम दर्ज कर पूछताछ कर सकते हैं।"
                      )}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchLocality("");
                          setBrandFilter("all");
                          setDistrictFilter("all");
                          setSortByDistance(false);
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-navy shadow-xs transition hover:bg-slate-50"
                      >
                        {tr("Reset Filters", "फिल्टर रीसेट करें")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomShopCity(searchLocality.trim());
                          setShowCustomShopForm(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark"
                      >
                        <Store className="h-4 w-4" />
                        <span>{tr("Enquire with shop from map", "मैप से दुकान चुनें व पूछताछ करें")}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Store Cards Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {displayedStores.map((store) => {
                const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${store.store_name}, ${store.address}`)}`;
                return (
                  <div
                    key={store.store_id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-brand/40 hover:shadow-md"
                  >
                    <div>
                      {/* Badges row: Brand badge, Verified Distance or Distance Unavailable, Data status */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {store.brand === "Jan Aushadhi" ? (
                            <span className="rounded-full bg-emerald-100 border border-emerald-200/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                              Jan Aushadhi
                            </span>
                          ) : (
                            <span className="rounded-full bg-blue-100 border border-blue-200/80 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
                              Davaindia
                            </span>
                          )}

                          {store.distance_from_shaheed_sukhdev_km !== null ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {store.distance_from_shaheed_sukhdev_km} km {tr("from CBS", "CBS से")}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                              {tr("Distance unavailable", "दूरी उपलब्ध नहीं")}
                            </span>
                          )}
                        </div>

                        <span className="rounded bg-slate-50 border border-slate-200/60 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                          {store.data_status}
                        </span>
                      </div>

                      {/* Store Name */}
                      <h3 className="mt-2 text-base sm:text-lg font-bold text-navy">{store.store_name}</h3>

                      {/* Address, District, PIN code */}
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                        <MapPin className="mr-1 inline h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span>{store.address}, {store.district} {store.pincode ? `- ${store.pincode}` : ""}</span>
                      </p>

                      {/* Contact Person */}
                      {store.contact_person && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-600">{tr("Contact:", "संपर्क:")}</span> {store.contact_person}
                        </p>
                      )}

                      {/* Phone and Hours info row */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                        {store.phone ? (
                          <div className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <a href={`tel:${store.phone}`} className="hover:text-brand font-medium">
                              {store.phone}
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-400 italic">
                            <Phone className="h-3 w-3 text-slate-300" />
                            <span>{tr("Phone unavailable", "फोन उपलब्ध नहीं")}</span>
                          </div>
                        )}

                        {store.listed_hours ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>{store.listed_hours}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-slate-400 italic">
                            <Clock className="h-3 w-3 text-slate-300" />
                            <span>{tr("Hours unavailable", "समय उपलब्ध नहीं")}</span>
                          </div>
                        )}
                      </div>

                      <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        <span>{tr("WhatsApp verified on demand via TinyFish", "TinyFish द्वारा ऑन-डिमांड संपर्क सत्यापन")}</span>
                      </p>
                    </div>

                    {/* Action buttons row: Call, Directions, Prepare enquiry */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        {store.phone ? (
                          <a
                            href={`tel:${store.phone}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                            aria-label={`Call ${store.store_name} at ${store.phone}`}
                          >
                            <Phone className="h-3.5 w-3.5 text-brand" />
                            <span>{tr("Call", "कॉल")}</span>
                          </a>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed"
                            title={tr("Phone number unavailable", "फोन नंबर उपलब्ध नहीं")}
                          >
                            <Phone className="h-3.5 w-3.5 text-slate-300" />
                            <span>{tr("No Phone", "फोन नहीं")}</span>
                          </span>
                        )}

                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                          aria-label={`Directions to ${store.store_name}`}
                        >
                          <Navigation className="h-3.5 w-3.5 text-slate-500" />
                          <span>{tr("Directions", "दिशा-निर्देश")}</span>
                        </a>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectDirectoryStore(store)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>{tr("Prepare enquiry", "पूछताछ तैयार करें")}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
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
                    Clicking &ldquo;Open WhatsApp&rdquo; will launch WhatsApp with the message above prefilled.
                    You must review the text and <strong>manually press Send</strong> in WhatsApp.
                    MedEasy never sends messages on your behalf.
                  </p>
                </div>

                {/* STORE CONTACT INFORMATION & WHATSAPP VERIFICATION STATUS CARD */}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-[#f8fbff] p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-brand" />
                      <span className="font-bold text-navy">
                        {tr("Store Contact & WhatsApp Verification", "दुकान संपर्क व WhatsApp सत्यापन")}
                      </span>
                    </div>

                    {hasVerifiedWhatsApp ? (
                      <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        {tr("WhatsApp available", "WhatsApp उपलब्ध")}
                      </span>
                    ) : selectedPharmacy.phone ? (
                      <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                        {tr("WhatsApp not verified", "WhatsApp असत्यापित")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 border border-slate-300 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                        {tr("Contact unavailable", "संपर्क अनुपलब्ध")}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-slate-700">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">{tr("Shop Name", "दुकान का नाम")}</span>
                      <p className="font-semibold text-navy">{selectedPharmacy.name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">{tr("Address", "पता")}</span>
                      <p className="font-medium text-slate-600">{selectedPharmacy.address}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">{tr("Phone (Directory)", "फ़ोन (डायरेक्टरी)")}</span>
                      <p className="font-mono font-medium">
                        {selectedPharmacy.phone ? (
                          <a href={`tel:${selectedPharmacy.phone}`} className="hover:text-brand font-medium">
                            {selectedPharmacy.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">{tr("Not available", "उपलब्ध नहीं")}</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">{tr("WhatsApp Verification", "WhatsApp सत्यापन")}</span>
                      <p className="font-mono font-medium">
                        {hasVerifiedWhatsApp ? (
                          <span className="text-emerald-700 font-bold">{verifiedWhatsAppNumber}</span>
                        ) : (
                          <span className="text-amber-700 font-medium">{tr("WhatsApp not verified", "WhatsApp असत्यापित")}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Contextual guidance and Find WhatsApp button when unverified */}
                  {!hasVerifiedWhatsApp && (
                    <div className="mt-3.5 rounded-xl border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-600">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2 flex-1">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <p>
                            {selectedPharmacy.phone
                              ? tr(
                                  "A normal phone number is not automatically a verified WhatsApp number. Click \"Find WhatsApp\" to search official public business listings via TinyFish.",
                                  "सामान्य फ़ोन नंबर अपने आप WhatsApp नंबर नहीं होता। TinyFish द्वारा सत्यापित WhatsApp खोजने के लिए \"Find WhatsApp\" पर क्लिक करें।"
                                )
                              : tr(
                                  "No phone or WhatsApp number is listed in the directory for this store. You can search online listings via TinyFish to find a verified WhatsApp contact.",
                                  "इस स्टोर के लिए कोई फ़ोन नंबर दर्ज नहीं है। सत्यापित संपर्क खोजने के लिए \"Find WhatsApp\" पर क्लिक करें।"
                                )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleFindWhatsApp}
                          disabled={discoveryState.status === "loading"}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark disabled:opacity-60 shrink-0"
                        >
                          <Search className="h-3.5 w-3.5" />
                          <span>{tr("Find WhatsApp", "WhatsApp खोजें")}</span>
                        </button>
                      </div>
                    </div>
                  )}
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

                {/* Normalized Shop Information Discovery Card (TinyFish) */}
                {discoveryState.status !== "idle" && discoveryState.status !== "loading" && discoveryState.status !== "error" && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-[#f8fbff] p-4 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-brand" />
                        <span className="font-bold text-navy">
                          {tr("Discovered Public Shop Details (TinyFish)", "खोजा गया सार्वजनिक स्टोर विवरण (TinyFish)")}
                        </span>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          discoveryState.status === "verified"
                            ? "bg-emerald-100 text-emerald-800"
                            : discoveryState.status === "phone_only"
                            ? "bg-amber-100 text-amber-800"
                            : discoveryState.status === "ambiguous"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {discoveryState.status === "verified"
                          ? tr("Verified WhatsApp", "सत्यापित WhatsApp")
                          : discoveryState.status === "phone_only"
                          ? tr("Phone Only (WhatsApp Unverified)", "केवल फोन (WhatsApp असत्यापित)")
                          : discoveryState.status === "ambiguous"
                          ? tr("Ambiguous Matches", "अस्पष्ट मिलान")
                          : tr("Contact Not Found", "संपर्क नहीं मिला")}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-slate-700">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{tr("Shop Name", "दुकान का नाम")}</span>
                        <p className="font-semibold text-navy">{discoveryState.shopName || selectedPharmacy.name}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{tr("Address", "पता")}</span>
                        <p className="font-medium">{discoveryState.address || selectedPharmacy.address}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{tr("Phone / Mobile", "फ़ोन / मोबाइल")}</span>
                        <p className="font-mono font-medium">
                          {discoveryState.status === "phone_only"
                            ? discoveryState.phoneNumber
                            : discoveryState.status === "verified"
                            ? discoveryState.phoneNumber || discoveryState.whatsappNumber
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{tr("WhatsApp Contact", "WhatsApp संपर्क")}</span>
                        <p className="font-mono font-medium">
                          {discoveryState.status === "verified" ? discoveryState.whatsappNumber : tr("Not verified", "असत्यापित")}
                        </p>
                      </div>
                    </div>

                    {discoveryState.sourceUrl && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">{tr("Source page:", "स्रोत पृष्ठ:")}</span>
                        <a
                          href={discoveryState.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-brand hover:underline max-w-[280px] sm:max-w-[360px] truncate"
                        >
                          <span className="truncate">{discoveryState.sourceUrl}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    )}

                    {discoveryState.embedUrl && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                        <iframe
                          src={discoveryState.embedUrl}
                          className="h-56 w-full border-0"
                          title="TinyFish Verification Embed"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {discoveryState.runUrl && !discoveryState.embedUrl && (
                      <div className="mt-2 text-right">
                        <a
                          href={discoveryState.runUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-brand"
                        >
                          <span>{tr("View TinyFish run log", "TinyFish रन लॉग देखें")}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {discoveryState.status === "verified" && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900">
                    <div className="flex items-center gap-2 font-bold text-emerald-700">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>{tr("Verified WhatsApp Contact Ready:", "सत्यापित WhatsApp संपर्क तैयार:")} <span className="font-mono">{discoveryState.whatsappNumber}</span></span>
                    </div>
                    <p className="mt-1 leading-relaxed text-emerald-800">
                      {tr(
                        "Click \"Open in WhatsApp →\" below to start your conversation. Review the prefilled message and press Send manually.",
                        "बातचीत शुरू करने के लिए नीचे \"WhatsApp में खोलें →\" पर क्लिक करें। संदेश की समीक्षा करें और स्वयं Send दबाएं।"
                      )}
                    </p>
                  </div>
                )}

                {discoveryState.status === "phone_only" && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
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
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
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
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
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
                        onClick={handleFindWhatsApp}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700"
                      >
                        <span>{tr("Retry Find WhatsApp", "पुनः प्रयास करें")}</span>
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

                    {hasVerifiedWhatsApp ? (
                      <button
                        type="button"
                        onClick={handleOpenWhatsApp}
                        disabled={savingEnquiry}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#20bd5a] disabled:opacity-60"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>{tr("Open in WhatsApp →", "WhatsApp में खोलें →")}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleFindWhatsApp}
                        disabled={discoveryState.status === "loading"}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-brand-dark disabled:opacity-60"
                      >
                        {discoveryState.status === "loading" ? (
                          <>
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>{tr("Finding contact...", "संपर्क खोज रहे हैं...")}</span>
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4" />
                            <span>{tr("Find WhatsApp", "WhatsApp खोजें")}</span>
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
