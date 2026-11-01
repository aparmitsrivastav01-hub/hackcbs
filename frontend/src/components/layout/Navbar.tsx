import { LayoutDashboard, Menu, Plus, ShoppingCart, User, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useLanguage } from "../../i18n/LanguageContext";

export function Navbar() {
  const { t, locale, setLocale } = useLanguage();
  const { itemCount } = useCart();
  const { isAuthenticated, profile } = useAuth();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { to: "/", key: "navHome" as const },
    ...(isAuthenticated ? [{ to: "/dashboard", key: "navDashboard" as const }] : []),
    { to: "/scan", key: "navScan" as const },
    { to: "/medicines", key: "navMedicines" as const },
    { to: "/stores", key: "navStores" as const },
    { to: "/batch-safety", key: "navBatchSafety" as const },
    { to: "/med-saathi", key: "navMedSaathi" as const },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 md:px-8">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand shadow-[0_4px_14px_rgba(8,123,255,0.28)]">
            <Plus className="h-5 w-5 text-white" strokeWidth={3.5} />
          </span>
          <span className="text-[22px] font-extrabold tracking-tight">
            <span className="text-navy">Med</span>
            <span className="text-brand">Easy</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `relative py-1 text-[14.5px] font-medium transition ${
                  isActive ? "text-brand font-semibold" : "text-slate-600 hover:text-navy"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {t[link.key]}
                  {isActive ? (
                    <span className="absolute -bottom-[26px] left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-brand" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right Actions: Cart & Language */}
        <div className="flex items-center gap-3">
          {/* Cart Icon with Live Badge */}
          <Link
            to="/cart"
            title="View Enquiry Cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-[#f8fbff] text-slate-700 transition hover:border-brand hover:text-brand"
          >
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-black text-white shadow-xs">
                {itemCount}
              </span>
            )}
          </Link>

          {/* Segmented English / हिंदी pill toggle */}
          <div className="flex items-center rounded-full bg-[#f1f5f9] p-1 border border-slate-200/90 shadow-2xs">
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                locale === "en"
                  ? "bg-brand text-white shadow-xs"
                  : "text-slate-600 hover:text-navy"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLocale("hi")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                locale === "hi"
                  ? "bg-brand text-white shadow-xs"
                  : "text-slate-600 hover:text-navy"
              }`}
            >
              हिंदी
            </button>
          </div>

          {/* User Account / Sign In Pill */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                title="Patient Dashboard"
                className="hidden sm:flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/10 hover:border-brand"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-brand" />
                <span>{t.navDashboard}</span>
              </Link>
              <Link
                to="/account"
                title="Patient Account & Privacy"
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#f8fbff] px-3 py-1.5 text-xs font-bold text-navy transition hover:border-brand hover:text-brand"
              >
                <User className="h-3.5 w-3.5 text-brand" />
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {profile?.display_label || "Account"}
                </span>
              </Link>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-600 active:scale-98"
            >
              {locale === "hi" ? "साइन इन" : "Sign In"}
            </Link>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="rounded-lg p-2 text-navy lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {open ? (
        <div className="border-t border-slate-100 bg-white px-5 py-3 lg:hidden">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? "bg-sky text-brand" : "text-navy"}`
              }
            >
              {t[link.key]}
            </NavLink>
          ))}
          <NavLink
            to="/cart"
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-between rounded-lg bg-[#eef5ff] px-3 py-2.5 text-sm font-bold text-brand"
          >
            <span>{t.navCart}</span>
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">
              {itemCount} units
            </span>
          </NavLink>

          <NavLink
            to={isAuthenticated ? "/account" : "/login"}
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2.5 text-sm font-bold text-navy"
          >
            <span>{isAuthenticated ? (profile?.display_label || "Account") : "Sign In"}</span>
            <User className="h-4 w-4 text-brand" />
          </NavLink>
        </div>
      ) : null}
    </header>
  );
}
