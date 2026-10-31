import type { Locale } from "./LanguageContext";

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatInr(value: number | null | undefined, locale: Locale = "en"): string {
  if (value == null || !Number.isFinite(value)) {
    return locale === "hi" ? "उपलब्ध नहीं" : "Not available";
  }
  return INR_FORMATTER.format(value);
}

export function formatSavingsText(
  amount: number | null | undefined,
  percentage: number | null | undefined,
  locale: Locale = "en",
): string {
  if (amount == null || !Number.isFinite(amount)) {
    return locale === "hi" ? "बचत की जानकारी उपलब्ध नहीं" : "No savings data";
  }
  if (amount < 0) {
    return locale === "hi"
      ? `${formatInr(Math.abs(amount), locale)} अधिक खर्च`
      : `Costs ${formatInr(Math.abs(amount), locale)} more`;
  }
  if (percentage != null && Number.isFinite(percentage)) {
    return locale === "hi"
      ? `${formatInr(amount, locale)} बचत (${percentage.toFixed(1)}%)`
      : `Save ${formatInr(amount, locale)} (${percentage.toFixed(1)}%)`;
  }
  return locale === "hi" ? `${formatInr(amount, locale)} बचत` : `Save ${formatInr(amount, locale)}`;
}
