import { Menu, Plus, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";

const links = [
  { to: "/", key: "navHome" as const },
  { to: "/about", key: "navAbout" as const },
  { to: "/how-it-works", key: "navHow" as const },
  { to: "/stores", key: "navStores" as const },
  { to: "/data-sources", key: "navData" as const },
];

export function Navbar() {
  const { t, locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1280px] items-center justify-between px-5 md:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand shadow-[0_4px_14px_rgba(8,123,255,0.28)]">
            <Plus className="h-5 w-5 text-white" strokeWidth={3.5} />
          </span>
          <span className="text-[22px] font-extrabold tracking-tight">
            <span className="text-navy">Med</span>
            <span className="text-brand">Easy</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `relative py-1 text-[15px] font-medium transition ${
                  isActive ? "text-brand font-semibold" : "text-slate-600 hover:text-navy"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {t[link.key]}
                  {isActive ? (
                    <span className="absolute -bottom-[24px] left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-brand" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Segmented English / हिंदी pill toggle matching reference screenshot */}
          <div className="flex items-center rounded-full bg-[#f1f5f9] p-1 border border-slate-200/90 shadow-2xs">
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
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
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                locale === "hi"
                  ? "bg-brand text-white shadow-xs"
                  : "text-slate-600 hover:text-navy"
              }`}
            >
              हिंदी
            </button>
          </div>

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

      {open ? (
        <div className="border-t border-slate-100 bg-white px-5 py-3 lg:hidden">
          {links.map((link) => (
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
        </div>
      ) : null}
    </header>
  );
}
