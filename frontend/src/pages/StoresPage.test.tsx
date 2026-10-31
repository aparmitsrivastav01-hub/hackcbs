import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "../api/client";
import { CartProvider } from "../context/CartContext";
import { LanguageProvider } from "../i18n/LanguageContext";
import { StoresPage } from "./StoresPage";

function renderStoresPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <LanguageProvider>
          <CartProvider>
            <StoresPage />
          </CartProvider>
        </LanguageProvider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("StoresPage — Google Maps Embed & On-Demand TinyFish WhatsApp Discovery", () => {
  let mockGetShopWhatsAppContact: ReturnType<typeof vi.spyOn>;
  let mockWindowOpen: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockGetShopWhatsAppContact = vi.spyOn(apiClient, "getShopWhatsAppContact");
    mockWindowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders Google Maps Embed with official search URL and responsive iframe", () => {
    renderStoresPage();

    const iframe = screen.getByTitle("Google Maps Pharmacy Search") as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    // Default search without API key: https://www.google.com/maps?q=...&output=embed
    expect(iframe.src).toContain("https://www.google.com/maps?q=");
    expect(iframe.src).toContain("output=embed");
    expect(iframe.src).not.toContain("key="); // Must not use Google API key

    // Separate "Open in Google Maps" link
    const openMapsLink = screen.getByRole("link", { name: /Open search in Google Maps in a new tab/i });
    expect(openMapsLink).toBeInTheDocument();
    expect(openMapsLink).toHaveAttribute("target", "_blank");
    expect(openMapsLink.getAttribute("href")).toContain("https://www.google.com/maps?q=");
  });

  it("updates Google Maps embed query when user enters manual area or PIN code", () => {
    renderStoresPage();

    const searchInput = screen.getByPlaceholderText(/Search by locality, area, or PIN/i);
    fireEvent.change(searchInput, { target: { value: "110001" } });

    const iframe = screen.getByTitle("Google Maps Pharmacy Search") as HTMLIFrameElement;
    expect(iframe.src).toContain(encodeURIComponent("near 110001"));

    const openMapsLink = screen.getByRole("link", { name: /Open search in Google Maps in a new tab/i });
    expect(openMapsLink.getAttribute("href")).toContain(encodeURIComponent("near 110001"));
  });

  it("updates Google Maps embed query when user uses geolocation", async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) => {
        success({
          coords: {
            latitude: 28.6139,
            longitude: 77.209,
          },
        });
      }),
    };
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: mockGeolocation,
    });

    renderStoresPage();

    const locationButton = screen.getByRole("button", { name: /Use my location/i });
    fireEvent.click(locationButton);

    await waitFor(() => {
      const iframe = screen.getByTitle("Google Maps Pharmacy Search") as HTMLIFrameElement;
      expect(iframe.src).toContain("28.61390");
      expect(iframe.src).toContain("77.20900");
    });
  });

  it("does NOT call TinyFish when the page loads", () => {
    renderStoresPage();
    // Verification requirement: TinyFish MUST NOT be called on page load
    expect(mockGetShopWhatsAppContact).not.toHaveBeenCalled();
  });

  it("does NOT call TinyFish when opening the enquiry modal; only when user clicks Open WhatsApp", async () => {
    renderStoresPage();

    // Click "Prepare enquiry" for first store
    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[0]);

    // Modal opens
    expect(screen.getByText(/Enquire with Pradhan Mantri Bhartiya Janaushadhi Kendra/i)).toBeInTheDocument();
    expect(screen.getByText(/Prefilled WhatsApp Message Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/MedEasy never sends messages on your behalf/i)).toBeInTheDocument();

    // TinyFish is STILL NOT called
    expect(mockGetShopWhatsAppContact).not.toHaveBeenCalled();

    // Mock successful TinyFish response
    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "Pradhan Mantri Bhartiya Janaushadhi Kendra (PMBJP)",
      phone_number: "+911123456789",
      whatsapp_number: "+919811234567",
      source_url: "https://janaushadhi.gov.in/pmbjp-delhi-01",
      verification_status: "verified_whatsapp",
      confidence: "high",
      message: "Verified WhatsApp number found.",
      cached: false,
    });

    // Now user clicks "Open in WhatsApp"
    const openWhatsAppButton = screen.getByRole("button", { name: /Open in WhatsApp →/i });
    fireEvent.click(openWhatsAppButton);

    // Shows loading state immediately
    expect(screen.getByText(/Finding shop's WhatsApp contact.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetShopWhatsAppContact).toHaveBeenCalledTimes(1);
    });

    // Check exact shop context passed
    const callArg = mockGetShopWhatsAppContact.mock.calls[0][0];
    expect(callArg.shop_name).toBe("Pradhan Mantri Bhartiya Janaushadhi Kendra (PMBJP)");
    expect(callArg.shop_address).toContain("Rohini");

    // Success state shown
    await waitFor(() => {
      expect(screen.getByText(/\+919811234567/i)).toBeInTheDocument();
    });

    // Valid wa.me URL opened with encoded message
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    const openedUrl = mockWindowOpen.mock.calls[0][0] as string;
    expect(openedUrl).toContain("https://wa.me/919811234567?text=");
    expect(openedUrl).toContain(encodeURIComponent("Hello Pradhan Mantri Bhartiya Janaushadhi Kendra"));
  });

  it("handles phone-only contact and NEVER generates a WhatsApp link if WhatsApp is unverified", async () => {
    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "Apollo Pharmacy 24/7",
      phone_number: "+911145678900",
      whatsapp_number: null,
      source_url: "https://apollo.test/listing",
      verification_status: "phone_only",
      confidence: "medium",
      message: "Phone number found, but WhatsApp could not be verified for this shop.",
      cached: false,
    });

    renderStoresPage();

    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    // Apollo Pharmacy is index 2
    fireEvent.click(prepareButtons[2]);

    const openWhatsAppButton = screen.getByRole("button", { name: /Open in WhatsApp →/i });
    fireEvent.click(openWhatsAppButton);

    await waitFor(() => {
      expect(
        screen.getByText(/WhatsApp number could not be verified for this shop/i)
      ).toBeInTheDocument();
    });

    // Verify phone call button is offered instead
    expect(screen.getByRole("link", { name: /Call Store/i })).toHaveAttribute(
      "href",
      "tel:+911145678900"
    );

    // Verify window.open was NOT called with wa.me
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it("handles contact not found gracefully", async () => {
    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "Jan Aushadhi Medical Store",
      phone_number: null,
      whatsapp_number: null,
      source_url: null,
      verification_status: "not_found",
      confidence: "none",
      message: "WhatsApp number could not be verified for this shop.",
      cached: false,
    });

    renderStoresPage();

    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[4]);

    const openWhatsAppButton = screen.getByRole("button", { name: /Open in WhatsApp →/i });
    fireEvent.click(openWhatsAppButton);

    await waitFor(() => {
      expect(
        screen.getByText(/WhatsApp number could not be verified for this shop/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /Search on Google Maps/i })).toBeInTheDocument();
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it("handles TinyFish service error or timeout with retry option", async () => {
    mockGetShopWhatsAppContact.mockRejectedValueOnce(
      new Error("TinyFish contact discovery timed out")
    );

    renderStoresPage();

    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[0]);

    const openWhatsAppButton = screen.getByRole("button", { name: /Open in WhatsApp →/i });
    fireEvent.click(openWhatsAppButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Contact discovery timed out or encountered an error/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/TinyFish contact discovery timed out/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry Discovery/i })).toBeInTheDocument();
  });

  it("handles ambiguous contact status and offers refinement option", async () => {
    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "Apollo Pharmacy",
      phone_number: "+911145678900",
      whatsapp_number: null,
      source_url: "https://apollopharmacy.in/branches",
      verification_status: "ambiguous",
      confidence: "low",
      message: "Multiple branches or conflicting contacts found. Unable to verify exact store.",
      cached: false,
    });

    renderStoresPage();

    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[0]);

    const openWhatsAppButton = screen.getByRole("button", { name: /Open in WhatsApp →/i });
    fireEvent.click(openWhatsAppButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Multiple matching pharmacy locations found/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Refine Shop Details/i })).toBeInTheDocument();
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it("supports enquiring with custom shop from map with validation", async () => {
    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "Dava India Generic Pharmacy",
      phone_number: "+919044366999",
      whatsapp_number: "+919044366999",
      source_url: "https://picnicspotroad-indiranagar.davaindia.com/",
      verification_status: "verified",
      confidence: "high",
      message: "Verified WhatsApp contact found.",
      cached: false,
    });

    renderStoresPage();

    // Click "Enquire with shop from map"
    const mapEnquiryButtons = screen.getAllByRole("button", { name: /Enquire with shop from map/i });
    fireEvent.click(mapEnquiryButtons[0]);

    // Form opens
    expect(screen.getByText(/Enquire with any Pharmacy seen on Google Maps/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\., Apollo Pharmacy/i);
    const addressInput = screen.getByPlaceholderText(/e\.g\., Main Market/i);
    const cityInput = screen.getByPlaceholderText(/e\.g\., Lucknow/i);

    // Fill form
    fireEvent.change(nameInput, { target: { value: "Dava India Generic Pharmacy" } });
    fireEvent.change(addressInput, { target: { value: "Picnic Spot Rd, Indira Nagar, Lucknow" } });
    fireEvent.change(cityInput, { target: { value: "Lucknow" } });

    // Submit custom shop
    const proceedButton = screen.getByRole("button", { name: /Prepare Enquiry →/i });
    fireEvent.click(proceedButton);

    // Enquiry modal opens with custom shop details
    await waitFor(() => {
      expect(screen.getByText(/Enquire with Dava India Generic Pharmacy/i)).toBeInTheDocument();
    });

    // Now trigger WhatsApp discovery
    const openWhatsAppButton = screen.getByRole("button", { name: /Open in WhatsApp →/i });
    fireEvent.click(openWhatsAppButton);

    await waitFor(() => {
      expect(mockGetShopWhatsAppContact).toHaveBeenCalledTimes(1);
    });

    const callArg = mockGetShopWhatsAppContact.mock.calls[0][0];
    expect(callArg.shop_name).toBe("Dava India Generic Pharmacy");
    expect(callArg.shop_address).toBe("Picnic Spot Rd, Indira Nagar, Lucknow");
    expect(callArg.locality).toBe("Lucknow");

    await waitFor(() => {
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    });
    const openedUrl = mockWindowOpen.mock.calls[0][0] as string;
    expect(openedUrl).toContain("https://wa.me/919044366999?text=");
  });
});
