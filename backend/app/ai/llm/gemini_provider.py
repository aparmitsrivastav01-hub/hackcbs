import os
from typing import Any


class GeminiProviderConfigurationError(RuntimeError):
    pass


class GeminiProvider:
    """Lazily construct LangChain's supported Gemini chat model."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        chat_model: Any = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("GEMINI_API_KEY")
        self.model_name = model or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
        self._chat_model = chat_model

    @property
    def chat_model(self) -> Any:
        if self._chat_model is not None:
            return self._chat_model
        if not self.api_key:
            raise GeminiProviderConfigurationError(
                "Gemini is not configured; set GEMINI_API_KEY in the backend environment"
            )
        from langchain_google_genai import ChatGoogleGenerativeAI

        self._chat_model = ChatGoogleGenerativeAI(
            model=self.model_name,
            api_key=self.api_key,
            temperature=0.2,
            max_output_tokens=900,
        )
        return self._chat_model
