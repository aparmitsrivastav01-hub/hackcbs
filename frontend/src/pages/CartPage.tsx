import {
  AlertTriangle,
  ArrowRight,
  MapPin,
  Minus,
  Pill,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { formatInr } from "../api/client";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../i18n/LanguageContext";

export function CartPage() {
  const navigate = useNavigate();
  const { tr } = useLanguage();
  const { items, updateQuantity, removeItem, clearCart, subtotal, itemCount } = useCart();

  return (
    <>
      <Helmet>
        <title>{tr("Pharmacy Enquiry Cart — MedEasy", "फार्मेसी पूछताछ कार्ट — MedEasy")}</title>
        <meta
          name="description"
          content={tr(
            "Review your medicine enquiry list, adjust quantities, and send a prefilled WhatsApp message to your nearest pharmacy.",
            "अपनी दवा सूची की समीक्षा करें, मात्रा समायोजित करें और नज़दीकी स्टोर को व्हाट्सएप पूछताछ भेजें।"
          )}
        />
      </Helmet>
    <div className="min-h-screen bg-[#f7faff] pb-24 pt-8">
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>{tr("Pharmacy Enquiry List", "फार्मेसी पूछताछ सूची")}</span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
              {tr("Your Medicine Enquiry List", "आपकी दवा पूछताछ सूची")}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {tr(
                "Review requested medicines before sending availability and price queries to nearby pharmacies.",
                "पास के मेडिकल स्टोर को उपलब्धता और कीमत पूछने से पहले चुनी गई दवाइयों की समीक्षा करें।"
              )}
            </p>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-semibold text-slate-400 hover:text-red-600"
            >
              {tr("Clear entire list", "पूरी सूची साफ़ करें")}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          /* Empty State */
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef5ff] text-brand">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-navy">
              {tr("Your enquiry list is empty", "आपकी पूछताछ सूची खाली है")}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {tr(
                "Add medicines from the catalogue search or upload a prescription to extract and confirm items.",
                "कैटलॉग से दवाइयां जोड़ें या पर्चा अपलोड करके सूची तैयार करें।"
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/medicines"
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-brand-dark"
              >
                <Search className="h-4 w-4" />
                <span>{tr("Explore catalogue", "कैटलॉग देखें")}</span>
              </Link>
              <Link
                to="/scan"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-navy hover:border-brand"
              >
                <Pill className="h-4 w-4 text-brand" />
                <span>{tr("Scan prescription", "पर्चा स्कैन करें")}</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
            {/* Left: Item List */}
            <div className="space-y-3">
              {items.map((item) => {
                const itemTotal = (item.selected_price ?? 0) * item.quantity;
                const providerLabel =
                  item.selected_provider === "jan_aushadhi"
                    ? tr("Jan Aushadhi (Govt Generic)", "जन औषधि (सरकारी जेनेरिक)")
                    : item.selected_provider === "dava_india"
                      ? tr("Dava India Generic", "दवा इंडिया जेनेरिक")
                      : tr("Private Brand (Benchmark)", "प्राइवेट ब्रांड (मानक)");

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef5ff] text-brand">
                        <Pill className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        {item.medicine_id ? (
                          <Link
                            to={`/medicines/${item.medicine_id}`}
                            className="font-bold text-navy hover:text-brand"
                          >
                            {item.brand_name}
                          </Link>
                        ) : (
                          <span className="font-bold text-navy">{item.brand_name}</span>
                        )}
                        {item.active_salt && (
                          <p className="text-xs text-slate-500 truncate">{item.active_salt}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {providerLabel}
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">
                            {tr("Unit:", "इकाई:")} {formatInr(item.selected_price)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quantity & Price Controls */}
                    <div className="flex items-center justify-between gap-6 sm:justify-end">
                      {/* Quantity Selector */}
                      <div className="flex items-center rounded-xl border border-slate-200 bg-[#f8fbff] p-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-navy"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-navy">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-navy"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Total for item */}
                      <div className="text-right min-w-[70px]">
                        <span className="block text-sm font-extrabold text-navy">
                          {formatInr(itemTotal)}
                        </span>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                        title={tr("Remove from list", "सूची से हटाएं")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <Link
                  to="/medicines"
                  className="font-semibold text-brand hover:underline"
                >
                  {tr("+ Add more medicines from catalogue", "+ कैटलॉग से और दवाइयां जोड़ें")}
                </Link>
                <span>
                  {itemCount} {tr("total units in enquiry", "दवाइयां सूची में")}
                </span>
              </div>
            </div>

            {/* Right: Summary & Next Step */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_36px_rgba(15,40,90,0.06)]">
                <h2 className="text-lg font-bold text-navy">
                  {tr("Enquiry Summary", "पूछताछ सारांश")}
                </h2>

                <div className="mt-4 space-y-2 border-b border-slate-100 pb-4 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>{tr("Medicines in list", "सूची में दवाइयां")}</span>
                    <span className="font-semibold text-navy">{items.length} {tr("item(s)", "आइटम")}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{tr("Total units / packs", "कुल इकाइयां / पैक")}</span>
                    <span className="font-semibold text-navy">{itemCount} {tr("units", "इकाइयां")}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{tr("Catalogue reference subtotal", "कैटलॉग संदर्भ उपकुल")}</span>
                    <span className="font-bold text-navy">{formatInr(subtotal)}</span>
                  </div>
                </div>

                <div className="pt-4">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    {tr("Indicative Catalogue Subtotal", "अनुमानित कैटलॉग उपकुल")}
                  </span>
                  <p className="mt-1 text-3xl font-black text-navy">{formatInr(subtotal)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tr("Estimated based on loaded benchmark prices.", "उपलब्ध बेंचमार्क कीमतों के आधार पर अनुमानित।")}
                  </p>
                </div>

                {/* Important Notice */}
                <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {tr("Not a checkout or online payment", "यह ऑनलाइन भुगतान या बिक्री नहीं है")}
                      </p>
                      <p className="mt-0.5 leading-relaxed text-amber-800">
                        {tr(
                          "Final prices and stock must be confirmed directly with your chosen local pharmacy. MedEasy does not sell medicines or collect payments.",
                          "अंतिम कीमतों और स्टॉक की पुष्टि स्थानीय मेडिकल स्टोर से की जानी चाहिए। MedEasy दवाइयां नहीं बेचता और न ही भुगतान स्वीकार करता है।"
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary CTA */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => navigate("/stores")}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand font-bold text-white shadow-[0_10px_24px_rgba(8,102,255,0.25)] transition hover:bg-brand-dark"
                  >
                    <MapPin className="h-4 w-4" />
                    <span>{tr("Find nearby pharmacies to enquire", "पूछताछ के लिए नज़दीकी स्टोर खोजें")}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
