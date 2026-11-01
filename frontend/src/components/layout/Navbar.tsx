import {
  ChevronDown,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ScanLine,
  Search,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useLanguage } from "../../i18n/LanguageContext";

export function Navbar() {
  const { t, locale, setLocale } = useLanguage();
  const { itemCount } = useCart();
  const { isAuthenticated, profile, user, logout } = useAuth();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const navLinks = [
    ...(isAuthenticated
      ? [{ to: "/dashboard", label: t.navDashboard, icon: LayoutDashboard }]
      : [{ to: "/", label: t.navHome, icon: Plus }]),
    { to: "/scan", label: t.navScan, icon: ScanLine },
    { to: "/medicines", label: t.navMedicines, icon: Search },
    { to: "/stores", label: t.navStores, icon: Store },
    { to: "/batch-safety", label: t.navBatchSafety, icon: ShieldCheck },
    { to: "/med-saathi", label: t.navMedSaathi, icon: Sparkles, isAI: true },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          to={isAuthenticated ? "/dashboard" : "/"}
          className="flex items-center gap-2.5 transition hover:opacity-95"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand shadow-[0_4px_12px_rgba(8,123,255,0.25)]">
            <Plus className="h-5 w-5 text-white" strokeWidth={3.5} />
          </span>
          <span className="text-[21px] font-black tracking-tight">
            <span className="text-navy">Med</span>
            <span className="text-brand">Easy</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-1.5 lg:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/" || link.to === "/dashboard"}
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] font-semibold transition ${
                  isActive
                    ? link.isAI
                      ? "bg-purple-100/80 text-purple-700 shadow-2xs font-bold"
                      : "bg-blue-50 text-brand shadow-2xs font-bold"
                    : link.isAI
                    ? "text-purple-700/90 hover:bg-purple-50 hover:text-purple-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-navy"
                }`
              }
            >
              {link.isAI && <Sparkles className="h-3.5 w-3.5 text-purple-600" />}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right Action Controls: Cart, Language Toggle, User Menu */}
        <div className="flex items-center gap-2.5">
          {/* Cart Icon with Live Badge */}
          <Link
            to="/cart"
            title="Enquiry Cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-[#f8fbff] text-slate-700 transition hover:border-brand hover:text-brand shadow-2xs"
          >
            <ShoppingCart className="h-4.5 w-4.5" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white shadow-xs">
                {itemCount}
              </span>
            )}
          </Link>

          {/* Compact Globe Language Toggle */}
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "hi" : "en")}
            title={locale === "en" ? "Switch to Hindi (हिन्दी)" : "Switch to English"}
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-brand hover:bg-white hover:text-brand shadow-2xs"
          >
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <span>{locale === "en" ? "हिन्दी" : "English"}</span>
          </button>

          {/* User Account Dropdown / Sign In Button */}
          {isAuthenticated ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-xs font-bold text-navy transition hover:border-brand shadow-2xs"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white font-black text-xs">
                  {(profile?.display_label || user?.email || "U")[0].toUpperCase()}
                </span>
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {profile?.display_label || user?.email?.split("@")[0] || "Account"}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Floating Profile Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="text-xs font-black text-navy truncate">
                        {profile?.display_label || (user?.role === "pharmacist" ? "Pharmacist" : "Patient")}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                        user?.role === "pharmacist"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : user?.role === "admin"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-blue-50 text-brand border border-blue-200"
                      }`}>
                        {user?.role || "patient"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</div>
                  </div>

                  <div className="mt-1 space-y-0.5">
                    <Link
                      to="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-brand transition"
                    >
                      <LayoutDashboard className="h-4 w-4 text-brand" />
                      <span>{t.navDashboard}</span>
                    </Link>

                    <Link
                      to="/cart"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-brand transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <ShoppingCart className="h-4 w-4 text-slate-500" />
                        <span>{t.navCart}</span>
                      </div>
                      {itemCount > 0 && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-brand">
                          {itemCount}
                        </span>
                      )}
                    </Link>

                    <Link
                      to="/account"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-brand transition"
                    >
                      <Shield className="h-4 w-4 text-slate-500" />
                      <span>{locale === "hi" ? "खाता व सेटिंग्स" : "Account & Privacy"}</span>
                    </Link>
                  </div>

                  <div className="mt-1 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={async () => {
                        setUserMenuOpen(false);
                        await logout();
                        navigate("/login");
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{locale === "hi" ? "साइन आउट" : "Sign Out"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-600 active:scale-98"
            >
              {locale === "hi" ? "साइन इन" : "Sign In"}
            </Link>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            className="rounded-xl p-2 text-navy hover:bg-slate-100 transition lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-100 bg-white px-5 py-4 lg:hidden space-y-2 animate-in slide-in-from-top-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/" || link.to === "/dashboard"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? link.isAI
                        ? "bg-purple-100/70 text-purple-700"
                        : "bg-blue-50 text-brand"
                      : "text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                <Icon className={`h-4 w-4 ${link.isAI ? "text-purple-600" : "text-brand"}`} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <NavLink
              to="/cart"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between rounded-xl bg-[#f0f6ff] px-3.5 py-2.5 text-sm font-bold text-brand"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="h-4 w-4" />
                <span>{t.navCart}</span>
              </div>
              <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-white">
                {itemCount} units
              </span>
            </NavLink>

            {isAuthenticated ? (
              <>
                <NavLink
                  to="/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-navy"
                >
                  <div className="flex items-center gap-2.5">
                    <User className="h-4 w-4 text-brand" />
                    <span>{profile?.display_label || "Account & Privacy"}</span>
                  </div>
                </NavLink>

                <button
                  type="button"
                  onClick={async () => {
                    setMobileOpen(false);
                    await logout();
                    navigate("/login");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{locale === "hi" ? "साइन आउट" : "Sign Out"}</span>
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center rounded-xl bg-brand px-3.5 py-2.5 text-sm font-bold text-white shadow-xs"
              >
                {locale === "hi" ? "साइन इन करें" : "Sign In"}
              </NavLink>
            )}
          </div>
        </div>
      )}
    </header>
  );
}