import re
from dataclasses import dataclass, field
from typing import Optional


# Emergency Red-Flag Trigger Keywords (English & Hindi)
EMERGENCY_KEYWORDS = (
    # Cardiovascular & Respiratory
    "chest pain", "severe chest pain", "heart attack", "heart stroke", "difficulty breathing",
    "trouble breathing", "can't breathe", "cannot breathe", "shortness of breath", "gasping for air",
    "suffocating", "throat closing", "choking",
    # Neurological & Stroke
    "face drooping", "arm weakness", "slurred speech", "sudden numbness", "loss of balance",
    "stroke", "paralysis", "seizure", "convulsions", "fits",
    # Consciousness & Trauma
    "unconscious", "passed out", "loss of consciousness", "unresponsive", "fainted", "severe bleeding",
    "bleeding heavily", "uncontrollable bleeding", "vomiting blood", "coughing blood",
    # High-Risk Crisis
    "suicide", "suicidal", "kill myself", "end my life", "self harm", "overdose", "poison", "poisoning",
    # Hindi Red Flags
    "सीने में दर्द", "सीने में तेज दर्द", "सांस नहीं आ रही", "सांस लेने में तकलीफ", "सांस फूलना",
    "बेहोश", "बेहोशी", "लकवा", "चेहरा टेढ़ा", "दौरा", "मिर्गी", "खून बहना", "खून की उल्टी",
    "आत्महत्या", "जान देना", "जहर", "ओवरडोज",
)

# Direct Prescription / Doctor Decision Triggers
PRESCRIPTION_KEYWORDS = (
    "prescribe me", "give me a prescription", "which antibiotic should i take",
    "prescribe medicine", "prescribe an antibiotic", "write me a prescription",
    "tell me what medicine to take to cure", "diagnose me", "diagnose what illness",
    "what disease do i have", "can you diagnose", "am i having cancer",
    "should i stop my prescription", "can i stop my bp medicine",
    # Hindi
    "दवा लिख दो", "पर्चा बना दो", "कौन सी एंटीबायोटिक लूं", "रोग बताओ", "बीमारी का निदान",
    "मुझे कौन सी बीमारी है", "मेरी दवा बंद कर दूं",
)


@dataclass
class GuardrailResult:
    triggered: bool
    category: Optional[str] = None  # "emergency", "prescription_refusal", "diagnostic_refusal"
    message_en: str = ""
    message_hi: str = ""
    home_remedies_en: list[str] = field(default_factory=list)
    home_remedies_hi: list[str] = field(default_factory=list)
    disclaimer_en: str = ""
    disclaimer_hi: str = ""

    def response_text(self, language: str = "en") -> str:
        if language == "hi":
            parts = [self.message_hi]
            if self.home_remedies_hi:
                parts.append("\n\nघरेलू देखभाल और बचाव के सुरक्षित उपाय (यह दवा नहीं है):")
                for item in self.home_remedies_hi:
                    parts.append(f"• {item}")
            if self.disclaimer_hi:
                parts.append(f"\n\nमहत्वपूर्ण सूचना: {self.disclaimer_hi}")
            return "\n".join(parts)
        else:
            parts = [self.message_en]
            if self.home_remedies_en:
                parts.append("\n\nSafe Home Comfort & Preventive Care (Non-medicinal):")
                for item in self.home_remedies_en:
                    parts.append(f"• {item}")
            if self.disclaimer_en:
                parts.append(f"\n\nImportant Notice: {self.disclaimer_en}")
            return "\n".join(parts)


class AISafetyGuardrail:
    """
    Deterministic Safety Guardrail for MedSaathi AI.
    Enforces that MedSaathi operates strictly as an AI Information Agent and never as a doctor.
    - Blocks medical emergency delays and provides instant escalation (108/112).
    - Refuses to prescribe prescription drugs or make authoritative clinical diagnoses.
    - Limits minor symptom consultations to safe home remedies and prevention.
    - Incorporates known allergy awareness without ever prescribing pharmaceuticals.
    """

    @classmethod
    def check_emergency(cls, message: str) -> Optional[GuardrailResult]:
        normalized = re.sub(r"\s+", " ", message.casefold())
        if any(term in normalized for term in EMERGENCY_KEYWORDS):
            return GuardrailResult(
                triggered=True,
                category="emergency",
                message_en=(
                    "🚨 **IMMEDIATE MEDICAL ATTENTION REQUIRED**\n\n"
                    "Your symptoms indicate a possible medical emergency. As an AI health information agent, "
                    "I cannot treat emergency conditions or make life-saving clinical decisions.\n\n"
                    "**Action Steps Now:**\n"
                    "1. Call local emergency services immediately: **108** (Ambulance in India) or **112** (National Emergency).\n"
                    "2. If experiencing mental health distress, call the National Tele-MANAS helpline: **14416** or **1800-891-4416**.\n"
                    "3. Go directly to the nearest hospital casualty or emergency room.\n"
                    "4. If conscious, sit upright in a comfortable position and loosen tight clothing. Do not attempt to drive yourself."
                ),
                message_hi=(
                    "🚨 **तत्काल चिकित्सकीय सहायता की आवश्यकता है**\n\n"
                    "आपके द्वारा बताए गए लक्षण किसी गंभीर चिकित्सीय आपातकाल का संकेत हो सकते हैं। एक AI स्वास्थ्य सूचना सहायक के रूप में, "
                    "मैं आपातकालीन स्थितियों का उपचार नहीं कर सकता।\n\n"
                    "**तुरंत ये कदम उठाएं:**\n"
                    "1. आपातकालीन सेवाओं को तुरंत कॉल करें: **108** (एंबुलेंस) या **112** (राष्ट्रीय आपातकाल)।\n"
                    "2. मानसिक स्वास्थ्य संकट की स्थिति में Tele-MANAS हेल्पलाइन: **14416** या **1800-891-4416** पर कॉल करें।\n"
                    "3. तुरंत नज़दीकी अस्पताल के आपातकालीन कक्ष (Emergency Room) में जाएं।\n"
                    "4. यदि होश में हैं, तो आरामदायक स्थिति में सीधे बैठें और तंग कपड़े ढीले करें। स्वयं वाहन न चलाएं।"
                ),
                disclaimer_en="MedSaathi is an AI information tool. Never delay professional medical emergency care for AI advice.",
                disclaimer_hi="मेडसाथी केवल एक AI सूचना उपकरण है। आपातकालीन स्थिति में पेशेवर डॉक्टर की सलाह में देरी न करें।",
            )
        return None

    @classmethod
    def check_prescription_or_diagnosis_demand(
        cls, message: str, memory_context: str = ""
    ) -> Optional[GuardrailResult]:
        normalized = re.sub(r"\s+", " ", message.casefold())
        demands_prescription = any(term in normalized for term in PRESCRIPTION_KEYWORDS)

        if not demands_prescription:
            return None

        # Check if memory has allergy notes
        allergy_note = ""
        allergy_note_hi = ""
        if "allergy" in memory_context.lower() or "allergic" in memory_context.lower():
            allergy_note = "I also see you have a reported allergy in your saved health context — please ensure your doctor is aware of this."
            allergy_note_hi = "आपकी प्रोफ़ाइल में एलर्जी दर्ज है — कृपया अपने डॉक्टर को इसके बारे में अवश्य बताएं।"

        # Home remedies based on keywords
        remedies_en = []
        remedies_hi = []
        if any(w in normalized for w in ("throat", "cough", "cold", "गले", "खांसी", "जुकाम")):
            remedies_en = [
                "Warm salt-water gargle (1/2 teaspoon salt in warm water) 3–4 times daily.",
                "Steam inhalation with plain water to soothe airway irritation.",
                "Warm herbal fluids (warm water, ginger water, or herbal tea with honey for adults).",
                "Adequate rest and staying well-hydrated.",
            ]
            remedies_hi = [
                "गुनगुने पानी में आधा चम्मच नमक मिलाकर दिन में 3-4 बार गरारे करें।",
                "भाप (स्टीम) लें ताकि गले और सांस की नली को आराम मिले।",
                "गुनगुने तरल पदार्थ (अदरक का पानी, तुलसी का काढ़ा या शहद के साथ गर्म पानी) लें।",
                "पर्याप्त आराम करें और शरीर में पानी की कमी न होने दें।",
            ]
        elif any(w in normalized for w in ("headache", "pain", "सिरदर्द", "दर्द")):
            remedies_en = [
                "Rest in a quiet, dark, well-ventilated room.",
                "Stay well-hydrated with water or electrolytes.",
                "Gentle cool or warm compress over forehead and neck.",
                "Avoid screen time and excessive bright light.",
            ]
            remedies_hi = [
                "शांत और हल्के अंधेरे कमरे में आराम करें।",
                "पर्याप्त मात्रा में पानी पिएं।",
                "माथे और गर्दन पर ठंडी या हल्की गर्म सिकाई करें।",
                "मोबाइल और कंप्यूटर स्क्रीन से दूरी बनाएं।",
            ]
        else:
            remedies_en = [
                "Adequate rest and staying well-hydrated.",
                "Non-spicy, easily digestible home-cooked meals.",
                "Monitor your temperature and symptoms carefully.",
            ]
            remedies_hi = [
                "पर्याप्त आराम करें और पानी पीते रहें।",
                "हल्का, सुपाच्य और सादा घर का भोजन लें।",
                "अपने तापमान और लक्षणों पर नज़र रखें।",
            ]

        msg_en = (
            "I cannot prescribe medicines, antibiotics, or diagnose specific illnesses. "
            "As an AI Agent, prescribing drugs requires an in-person clinical examination and medical evaluation by a licensed doctor.\n\n"
            "I can help you compare medicine prices from our Jan Aushadhi catalogue, check batch numbers against CDSCO safety alerts, "
            "or suggest safe non-medicinal home remedies and prevention."
        )
        if allergy_note:
            msg_en += f"\n\n⚠️ {allergy_note}"

        msg_hi = (
            "मैं दवाएं (जैसे एंटीबायोटिक) नहीं लिख सकता और न ही रोगों का निदान कर सकता हूँ। "
            "एक AI एजेंट के रूप में, दवा लिखना और बीमारी की पुष्टि करना केवल प्रमाणित डॉक्टर का कार्य है।\n\n"
            "मैं जन औषधि कैटलॉग से दवाओं के दामों की तुलना करने, सीडीएससीओ बैच अलर्ट जांचने या सुरक्षित घरेलू उपचार और बचाव के तरीके बताने में आपकी मदद कर सकता हूँ।"
        )
        if allergy_note_hi:
            msg_hi += f"\n\n⚠️ {allergy_note_hi}"

        return GuardrailResult(
            triggered=True,
            category="prescription_refusal",
            message_en=msg_en,
            message_hi=msg_hi,
            home_remedies_en=remedies_en,
            home_remedies_hi=remedies_hi,
            disclaimer_en="MedSaathi is an AI assistant. For prescriptions or if symptoms persist beyond 48 hours, consult a licensed physician or pharmacist.",
            disclaimer_hi="मेडसाथी केवल एक AI सहायक है। दवा पर्चे के लिए या लक्षण 48 घंटे से अधिक रहने पर प्रमाणित डॉक्टर से संपर्क करें।",
        )

    @classmethod
    def sanitize_llm_response(cls, response_text: str, language: str = "en") -> str:
        """
        Validates that the LLM response adheres strictly to non-doctor boundaries.
        Strips any hallucinated prescribing or diagnostic claims.
        """
        if not response_text:
            return response_text

        sanitized = response_text

        # Patterns where LLM mistakenly acts like a doctor
        prescriptive_patterns = [
            r"i\s+(?:hereby\s+)?prescribe\s+(?:you\s+)?",
            r"you\s+must\s+take\s+\d+\s*(?:mg|ml|tablets?)\s+",
            r"take\s+this\s+medicine\s+\d+\s+times\s+a\s+day",
            r"i\s+diagnose\s+you\s+with\s+",
            r"you\s+definitely\s+have\s+(?:acute|chronic|severe)?\s+",
            r"मैं\s+(?:आपको\s+)?दवा\s+लिखता\s+हूँ",
            r"आपको\s+यह\s+दवा\s+लेनी\s+होगी",
        ]

        needs_disclaimer = False
        for pat in prescriptive_patterns:
            if re.search(pat, sanitized, re.IGNORECASE):
                needs_disclaimer = True
                sanitized = re.sub(
                    pat,
                    "General medical guidance indicates that you should consult a doctor regarding ",
                    sanitized,
                    flags=re.IGNORECASE,
                )

        # Append non-doctor disclaimer if prescriptive language was cleaned
        if needs_disclaimer:
            if language == "hi":
                sanitized += (
                    "\n\n[सुरक्षा सूचना: मेडसाथी केवल एक AI सहायक है, डॉक्टर नहीं। यह कोई दवा नहीं लिखता। "
                    "कृपया किसी भी दवा को शुरू करने से पहले डॉक्टर या फार्मासिस्ट से परामर्श लें।]"
                )
            else:
                sanitized += (
                    "\n\n[Safety Notice: MedSaathi is an AI health information assistant, not a doctor. "
                    "I do not prescribe medicines. Always consult a licensed physician or pharmacist before taking any medication.]"
                )

        return sanitized

