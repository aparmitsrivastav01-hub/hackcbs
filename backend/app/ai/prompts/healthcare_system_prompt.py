from app.core.healthcare_prompt import HEALTHCARE_SYSTEM_PROMPT


def healthcare_system_prompt(language: str) -> str:
    language_instruction = "Hindi" if language == "hi" else "English"
    return f"{HEALTHCARE_SYSTEM_PROMPT}\n\nAnswer in {language_instruction}."
