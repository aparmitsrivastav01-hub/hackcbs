from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class MemoryContextItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str
    source: str = "meko"
    verified: bool = False
    classification: Literal[
        "patient_reported",
        "clinically_documented",
        "verified",
        "ai_inferred",
        "unknown",
    ] = "unknown"
    source_date: str | None = None
    reference: str | None = None

    def prompt_line(self) -> str:
        stamp = f"; source date: {self.source_date}" if self.source_date else ""
        ref = f"; reference: {self.reference}" if self.reference else ""
        return f"- [{self.classification}; unverified{stamp}{ref}] {self.text}"


class MemoryContext(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[MemoryContextItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    def as_unverified_prompt_context(self) -> str:
        if not self.items:
            return ""
        header = (
            "Retrieved Meko material is unverified conversational context, not a clinical record. "
            "Never treat it as confirmed; call out conflicts with the current user message and ask for clarification. "
            "Distinguish patient-reported symptoms from confirmed diagnoses (which remain unknown)."
        )
        lines: list[str] = [header]
        remaining = 6000
        for item in self.items:
            line = item.prompt_line()
            if len(line) > remaining:
                lines.append("... [truncated]")
                break
            lines.append(line)
            remaining -= len(line)
        return "\n".join(lines)
