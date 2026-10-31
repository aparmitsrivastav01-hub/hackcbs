import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "hi";

const copy = {
  en: {
    brand: "MedEasy",
    navHome: "Home",
    navAbout: "About",
    navHow: "How It Works",
    navStores: "Nearby Stores",
    navData: "Data Sources",
    navHelp: "Help",
    language: "English",
    eyebrow: "YOUR HEALTH • CLEARER CHOICES • CLOSER TO YOU",
    headline1: "Making medicines",
    headlineMore: "more ",
    headline2: "accessible.",
    subhead:
      "Understand prescriptions, compare medicine prices, and find trusted nearby pharmacies — all in one place.",
    scanCta: "Scan Prescription",
    exploreCta: "Explore Medicines",
    trustLine: "Your prescription. Your choice. Clearer information.",
    feat1Title: "Understand Prescriptions",
    feat1Body: "Turn prescription details into clear, readable medicine lists.",
    feat2Title: "Compare Prices",
    feat2Body: "Find available price comparisons across listed public and online sources.",
    feat3Title: "Nearby Pharmacies",
    feat3Body: "Discover pharmacies in your area using real Google Maps exploration.",
    feat4Title: "Trusted Information",
    feat4Body: "Explore medicine details and source-cited pricing data without guesswork.",
    phoneScanTitle: "Prescription Scan",
    phoneScanBody: "Upload a photo of your prescription to get medicine list",
    medicineFound: "Medicine found",
    viewAll: "View all",
    seeAll: "See all",
    comparePrices: "Compare prices",
    phoneFooter: "Your choice, clearly informed.",
    branded: "Branded",
    generic: "Generic",
    saveUpTo: "You can save up to",
    matched: "Matched",
    check: "Check",
    uploadLink: "Upload Prescription Photo / PDF",
    dragDropAnywhere: "Drag & drop anywhere to scan",
    dropToScan: "Drop prescription to scan",
  },
  hi: {
    brand: "MedEasy",
    navHome: "होम",
    navAbout: "परिचय",
    navHow: "कैसे काम करता है",
    navStores: "नज़दीकी दुकानें",
    navData: "डेटा स्रोत",
    navHelp: "सहायता",
    language: "हिन्दी",
    eyebrow: "आपकी सेहत • स्पष्ट विकल्प • आपके करीब",
    headline1: "दवाइयों को बनाना",
    headlineMore: "और ",
    headline2: "सुलभ.",
    subhead:
      "प्रिस्क्रिप्शन समझें, दवा की कीमतें तुलना करें, और भरोसेमंद नज़दीकी फार्मेसी खोजें — एक ही जगह.",
    scanCta: "प्रिस्क्रिप्शन स्कैन करें",
    exploreCta: "दवाइयाँ देखें",
    trustLine: "आपकी पर्ची. आपकी पसंद. स्पष्ट जानकारी.",
    feat1Title: "प्रिस्क्रिप्शन समझें",
    feat1Body: "पर्ची की जानकारी को साफ़, पठनीय दवा सूची में बदलें.",
    feat2Title: "कीमत तुलना",
    feat2Body: "सूचीबद्ध सार्वजनिक और ऑनलाइन स्रोतों से उपलब्ध कीमत तुलना देखें.",
    feat3Title: "नज़दीकी फार्मेसी",
    feat3Body: "Google Maps से अपने इलाके की फार्मेसी खोजें.",
    feat4Title: "विश्वसनीय जानकारी",
    feat4Body: "अनुमान के बिना स्रोत-उल्लिखित कीमत और दवा विवरण देखें.",
    phoneScanTitle: "प्रिस्क्रिप्शन स्कैन",
    phoneScanBody: "दवा सूची पाने के लिए अपनी पर्ची की फोटो अपलोड करें",
    medicineFound: "दवा मिली",
    viewAll: "सभी देखें",
    seeAll: "सभी देखें",
    comparePrices: "कीमतें तुलना करें",
    phoneFooter: "आपकी पसंद, स्पष्ट जानकारी के साथ.",
    branded: "ब्रांडेड",
    generic: "जेनेरिक",
    saveUpTo: "आप बचा सकते हैं",
    matched: "मैच",
    check: "जाँचें",
    uploadLink: "पर्ची फ़ोटो / PDF अपलोड करें",
    dragDropAnywhere: "स्कैन के लिए कहीं भी ड्रैग और ड्रॉप करें",
    dropToScan: "स्कैन करने के लिए पर्ची यहाँ छोड़ें",
  },
} as const;

type Copy = (typeof copy)[Locale];

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Copy;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const value = useMemo(
    () => ({ locale, setLocale, t: copy[locale] }),
    [locale],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
