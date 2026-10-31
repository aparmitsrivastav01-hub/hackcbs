import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";

export function HelpPage() {
  const { tr } = useLanguage();

  return (
    <>
      <Helmet>
        <title>{tr("Help & Frequently Asked Questions — MedEasy", "सहायता और अक्सर पूछे जाने वाले प्रश्न — MedEasy")}</title>
        <meta
          name="description"
          content={tr(
            "Get help using MedEasy: prescription OCR scanning, price comparison accuracy, catalogue data provenance, and pharmacy enquiries.",
            "MedEasy के उपयोग में सहायता: पर्चा OCR स्कैनिंग, मूल्य तुलना सटीकता, कैटलॉग डेटा और मेडिकल स्टोर पूछताछ।"
          )}
        />
      </Helmet>
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        <h1 className="text-3xl font-extrabold text-navy">
          {tr("Help & Support", "सहायता एवं समर्थन")}
        </h1>
        <div className="mt-6 space-y-5 text-sm leading-6 text-muted">
          <p>
            <strong className="text-navy">
              {tr("Does scan search the catalogue immediately?", "क्या स्कैन करने पर सीधे कैटलॉग में खोज शुरू हो जाती है?")}
            </strong>
            <br />
            {tr(
              "No. Extraction returns text for review. Search runs only after you confirm items.",
              "नहीं। OCR केवल आपके पढ़ने के लिए नाम निकालता है। खोज केवल तब होती है जब आप स्वयं नामों की पुष्टि करते हैं।"
            )}
          </p>
          <p>
            <strong className="text-navy">
              {tr("Are cheaper options always equivalent?", "क्या सस्ती दवाइयां हमेशा समान होती हैं?")}
            </strong>
            <br />
            {tr(
              "No. Confirm ingredient, strength, dosage form and pack size with a pharmacist or clinician.",
              "आवश्यक नहीं। साल्ट सामग्री, मात्रा, खुराक और पैक के आकार की पुष्टि हमेशा फार्मासिस्ट या डॉक्टर से करें।"
            )}
          </p>
          <p>
            <strong className="text-navy">
              {tr("Where do prices come from?", "दवाइयों के दाम कहाँ से लिए गए हैं?")}
            </strong>
            <br />
            {tr(
              "The catalogue CSV loaded by the API. See ",
              "API द्वारा लोड किए गए आधिकारिक कैटलॉग से। लाइव आंकड़ों के लिए देखें "
            )}
            <Link className="font-semibold text-brand" to="/data-sources">
              {tr("Data Sources", "डेटा स्रोत")}
            </Link>
            {tr(" for live counts.", "।")}
          </p>
          <p>
            <strong className="text-navy">
              {tr("Need the scanner?", "पर्चा स्कैन करना चाहते हैं?")}
            </strong>
            <br />
            <Link className="font-semibold text-brand" to="/scan">
              {tr("Scan a prescription", "पर्चा स्कैन करें")}
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
