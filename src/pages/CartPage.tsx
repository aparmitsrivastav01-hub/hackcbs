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
import { Link, useNavigate } from "react-router-dom";
import { formatInr } from "../api/client";
import { useCart } from "../context/CartContext";

export function CartPage() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart, subtotal, itemCount } = useCart();

  return (
    <div className="min-h-screen bg-[#f7faff] pb-24 pt-8">
      <div className="mx-auto max-w-[1080px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eef5ff] px-3.5 py-1 text-xs font-bold text-brand">
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Pharmacy Enquiry List</span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-navy sm:text-4xl">
              Your Medicine Enquiry List
            </h1>
            <p className="mt-1 text-sm text-muted">
              Review requested medicines before sending availability and price queries to nearby pharmacies.
            </p>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-semibold text-slate-400 hover:text-red-600"
            >
              Clear entire list
            </button>
          )}
        </div>

        {items.length === 0 ? (
          /* Empty State */
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef5ff] text-brand">
              <ShoppingCart className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-navy">Your enquiry list is empty</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Add medicines from the catalogue search or upload a prescription to extract and confirm items.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/medicines"
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-brand-dark"
              >
                <Search className="h-4 w-4" />
                <span>Explore catalogue</span>
              </Link>
              <Link
                to="/scan"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-navy hover:border-brand"
              >
                <Pill className="h-4 w-4 text-brand" />
                <span>Scan prescription</span>
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
                    ? "Jan Aushadhi (Govt Generic)"
                    : item.selected_provider === "dava_india"
                      ? "Dava India Generic"
                      : "Private Brand (Benchmark)";

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
                            Unit: {formatInr(item.selected_price)}
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
                        title="Remove from list"
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
                  + Add more medicines from catalogue
                </Link>
                <span>{itemCount} total units in enquiry</span>
              </div>
            </div>

            {/* Right: Summary & Next Step */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_12px_36px_rgba(15,40,90,0.06)]">
                <h2 className="text-lg font-bold text-navy">Enquiry Summary</h2>

                <div className="mt-4 space-y-2 border-b border-slate-100 pb-4 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Medicines in list</span>
                    <span className="font-semibold text-navy">{items.length} item(s)</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total units / packs</span>
                    <span className="font-semibold text-navy">{itemCount} units</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Catalogue reference subtotal</span>
                    <span className="font-bold text-navy">{formatInr(subtotal)}</span>
                  </div>
                </div>

                <div className="pt-4">
                  <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Indicative Catalogue Subtotal
                  </span>
                  <p className="mt-1 text-3xl font-black text-navy">{formatInr(subtotal)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Estimated based on loaded benchmark prices.
                  </p>
                </div>

                {/* Important Notice */}
                <div className="mt-5 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Not a checkout or online payment</p>
                      <p className="mt-0.5 leading-relaxed text-amber-800">
                        Final prices and stock must be confirmed directly with your chosen local pharmacy.
                        MedEasy does not sell medicines or collect payments.
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
                    <span>Find nearby pharmacies to enquire</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
