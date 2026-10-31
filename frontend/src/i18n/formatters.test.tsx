import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { formatInr, formatSavingsText } from "./formatters";
import { LanguageProvider, useLanguage } from "./LanguageContext";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("currency formatting", () => {
  it("formats INR values with Indian grouping and no mojibake", () => {
    expect(formatInr(2450)).toBe("₹2,450");
    expect(formatInr(1631.21)).toBe("₹1,631.21");
    expect(formatInr(11818.79)).toBe("₹11,818.79");
    expect(formatInr(null)).toBe("Not available");
    expect(formatSavingsText(1631.21, 93.5)).toBe("Save ₹1,631.21 (93.5%)");
    expect(formatSavingsText(1631.21, 93.5, "hi")).toBe("₹1,631.21 बचत (93.5%)");
  });

  it("routes every price-bearing component through the shared INR formatter", () => {
    const components = [
      "pages/MedicinesPage.tsx",
      "pages/MedicineDetailPage.tsx",
      "pages/CartPage.tsx",
      "pages/ScanPage.tsx",
      "pages/StoresPage.tsx",
      "components/home/PhoneMockup.tsx",
      "components/home/FloatingCards.tsx",
    ];
    for (const component of components) {
      const source = readFileSync(join(process.cwd(), "src", component), "utf8");
      expect(source, component).toContain("formatInr(");
    }
  });

  it("contains no mojibake in user-facing frontend source", () => {
    const sourceRoot = join(process.cwd(), "src");
    const files: string[] = [];
    const visit = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) visit(path);
        else if (/\.(tsx?|html)$/.test(entry.name) && !entry.name.endsWith(".test.tsx")) files.push(path);
      }
    };
    visit(sourceRoot);
    const mojibake = /(?:â‚¹|Ã.|Â.|\uFFFD)/u;
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(mojibake);
    }
  });
});

function LanguageProbe() {
  const { locale, setLocale, tr } = useLanguage();
  return (
    <>
      <p>{tr("Explore Medicines", "दवाइयां खोजें")}</p>
      <p data-testid="dynamic-name">Crocin — Paracetamol 500 mg</p>
      <span data-testid="locale">{locale}</span>
      <button onClick={() => setLocale(locale === "en" ? "hi" : "en")}>toggle</button>
    </>
  );
}

describe("language context", () => {
  it("switches immediately, preserves dynamic medicine names, and persists across remounts", () => {
    const first = render(<LanguageProvider><LanguageProbe /></LanguageProvider>);
    expect(screen.getByText("Explore Medicines")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByText("दवाइयां खोजें")).toBeInTheDocument();
    expect(screen.getByTestId("dynamic-name")).toHaveTextContent("Crocin — Paracetamol 500 mg");
    expect(document.documentElement.lang).toBe("hi");
    expect(localStorage.getItem("medeasy_locale")).toBe("hi");
    first.unmount();

    render(<LanguageProvider><LanguageProbe /></LanguageProvider>);
    expect(screen.getByText("दवाइयां खोजें")).toBeInTheDocument();
    expect(screen.getByTestId("locale")).toHaveTextContent("hi");
  });
});
