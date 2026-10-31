import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Locale = "en" | "hi";

const copy = {
  en: {
    brand: "MedEasy",
    navHome: "Home",
    navScan: "Scan Rx",
    navMedicines: "Explore Medicines",
    navStores: "Nearby Stores",
    navBatchSafety: "Batch Safety",
    navData: "Data Sources",
    navAbout: "About",
    navHow: "How It Works",
    navHelp: "Help",
    navCart: "Enquiry Cart",
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
    feat1Body: "Turn prescription details into clear, readable medicine lists with human confirmation.",
    feat2Title: "Compare Listed Prices",
    feat2Body: "Compare Jan Aushadhi (PMBJP), Dava India, and private brand catalogue benchmarks.",
    feat3Title: "Nearby Pharmacies",
    feat3Body: "Discover licensed pharmacies and send structured WhatsApp availability enquiries.",
    feat4Title: "Check Batch Alerts",
    feat4Body: "Cross-reference pack batch numbers against CDSCO Not of Standard Quality (NSQ) alerts.",
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
    navScan: "पर्चा स्कैन",
    navMedicines: "दवाइयां खोजें",
    navStores: "नज़दीकी मेडिकल स्टोर",
    navBatchSafety: "बैच सुरक्षा",
    navData: "डेटा स्रोत",
    navAbout: "परिचय",
    navHow: "कैसे काम करता है",
    navHelp: "सहायता",
    navCart: "पूछताछ सूची",
    language: "हिन्दी",
    eyebrow: "आपकी सेहत • स्पष्ट विकल्प • आपके करीब",
    headline1: "दवाइयों को बनाना",
    headlineMore: "और ",
    headline2: "सुलभ.",
    subhead:
      "पर्चे को समझें, जेनेरिक व ब्रांडेड दामों की तुलना करें, और पास के मेडिकल स्टोर से जानकारी प्राप्त करें।",
    scanCta: "पर्चा स्कैन करें",
    exploreCta: "दवाइयां देखें",
    trustLine: "आपका पर्चा। आपकी पसंद। स्पष्ट और प्रमाणित जानकारी।",
    feat1Title: "पर्चे को समझें",
    feat1Body: "हस्तलिखित पर्चे को आसानी से पढ़ने योग्य सूची में बदलें और स्वयं पुष्टि करें।",
    feat2Title: "कीमतों की तुलना करें",
    feat2Body: "जन औषधि, दवा इंडिया और ब्रांडेड कीमतों की पारदर्शी तुलना देखें।",
    feat3Title: "नज़दीकी मेडिकल स्टोर",
    feat3Body: "नज़दीकी स्टोर खोजें और उपलब्धता के लिए सीधा संदेश तैयार करें।",
    feat4Title: "बैच अलर्ट जांचें",
    feat4Body: "सीडीएससीओ (CDSCO) सरकारी गुणवत्ता अलर्ट में बैच नंबर की जांच करें।",
    phoneScanTitle: "प्रिस्क्रिप्शन स्कैन",
    phoneScanBody: "दवा सूची प्राप्त करने के लिए अपने पर्चे का फोटो अपलोड करें",
    medicineFound: "दवाई मिली",
    viewAll: "सभी देखें",
    seeAll: "पूरा देखें",
    comparePrices: "दाम तुलना",
    phoneFooter: "आपकी पसंद, स्पष्ट जानकारी के साथ।",
    branded: "ब्रांडेड",
    generic: "जेनेरिक",
    saveUpTo: "आप बचा सकते हैं तक",
    matched: "मैच हुआ",
    check: "जांचें",
    uploadLink: "पर्चे की फोटो / PDF अपलोड करें",
    dragDropAnywhere: "स्कैन करने के लिए फ़ाइल यहां छोड़ें",
    dropToScan: "स्कैन के लिए पर्चा ड्रॉप करें",
  },
};

type LanguageContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (typeof copy)["en"];
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: copy[locale],
    }),
    [locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
