import { Helmet } from "react-helmet-async";
import { useLanguage } from "../i18n/LanguageContext";

export function AboutPage() {
  const { tr } = useLanguage();

  return (
    <>
      <Helmet>
        <title>{tr("About MedEasy — Accessible Medicine Price Transparency", "MedEasy के बारे में — सुलभ दवा मूल्य पारदर्शिता")}</title>
        <meta
          name="description"
          content={tr(
            "Learn about MedEasy's mission to make healthcare affordable in India by comparing generic and branded medicine prices transparently.",
            "जेनेरिक और ब्रांडेड दवाओं की पारदर्शी तुलना द्वारा भारत में स्वास्थ्य सेवा को वहनीय बनाने के MedEasy के मिशन के बारे में जानें।"
          )}
        />
      </Helmet>
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        <h1 className="text-3xl font-extrabold text-navy">
          {tr("About MedEasy", "MedEasy के बारे में")}
        </h1>
        <p className="mt-4 leading-7 text-muted">
          {tr(
            "MedEasy helps you read a prescription more clearly, compare listed catalogue prices, and look up nearby pharmacies on Google Maps. It does not diagnose, prescribe, or confirm that two medicines are clinically interchangeable.",
            "MedEasy आपको पर्चे को अधिक स्पष्टता से पढ़ने, कैटलॉग में सूचीबद्ध कीमतों की तुलना करने और गूगल मैप्स पर आस-पास के मेडिकल स्टोर खोजने में मदद करता है। यह कोई चिकित्सीय निदान, उपचार या दो दवाओं के चिकित्सीय रूप से समान होने की पुष्टि नहीं करता।"
          )}
        </p>
        <p className="mt-4 leading-7 text-muted">
          {tr(
            "Prices come from the MedEasy catalogue API. Nearby store discovery uses Google Maps in your browser. Pharmacy stock is never assumed from a map listing.",
            "कीमतें MedEasy कैटलॉग API से आती हैं। नज़दीकी स्टोर खोज आपके ब्राउज़र में गूगल मैप्स का उपयोग करती है। मैप लिस्टिंग से सीधे दवा के स्टॉक की पुष्टि नहीं मानी जाती।"
          )}
        </p>
      </div>
    </>
  );
}
