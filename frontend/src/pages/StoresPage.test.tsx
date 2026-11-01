import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "../api/client";
import { CartProvider } from "../context/CartContext";
import { LanguageProvider } from "../i18n/LanguageContext";
import * as directoryService from "../services/pharmacyDirectoryService";
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

describe("StoresPage — Google Maps Embed & WhatsApp Enquiry Behaviour", () => {
  let mockGetShopWhatsAppContact: ReturnType<typeof vi.spyOn>;
  let mockWindowOpen: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    mockGetShopWhatsAppContact = vi.spyOn(apiClient, "getShopWhatsAppContact");
    mockWindowOpen = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    sessionStorage.clear();
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders Google Maps Embed with official search URL and responsive iframe", () => {
    renderStoresPage();

    const iframe = screen.getByTitle("Google Maps Pharmacy Search") as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toContain("https://www.google.com/maps?q=");
    expect(iframe.src).toContain("output=embed");
    expect(iframe.src).not.toContain("key="); // Must not use Google API key

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
    expect(mockGetShopWhatsAppContact).not.toHaveBeenCalled();
  });

  it("Case 2: CSV has phone but no verified WhatsApp — no automatic TinyFish call when opening modal, editing message, or previewing", async () => {
    renderStoresPage();

    // Click "Prepare enquiry" for first store (Pradhan Mantri Bhartiya Janaushadhi Kendra)
    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[0]);

    // Modal opens with store contact info from CSV
    expect(screen.getByText(/Enquire with Pradhan Mantri Bhartiya Janaushadhi Kendra/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\+91-11-27051234/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/WhatsApp not verified/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Prefilled WhatsApp Message Preview/i)).toBeInTheDocument();

    // Edit notes and area
    const areaInput = screen.getByPlaceholderText(/Sector 15, Near City Hospital/i);
    fireEvent.change(areaInput, { target: { value: "Sector 7 Rohini" } });

    // Open WhatsApp is UNAVAILABLE because WhatsApp is unverified
    expect(screen.queryByRole("button", { name: /Open in WhatsApp →/i })).not.toBeInTheDocument();

    // Find WhatsApp button is offered
    const findButtons = screen.getAllByRole("button", { name: /Find WhatsApp/i });
    expect(findButtons.length).toBeGreaterThan(0);

    // TinyFish is STILL NOT called
    expect(mockGetShopWhatsAppContact).not.toHaveBeenCalled();
  });

  it("Case 3: User explicitly clicks Find WhatsApp — TinyFish runs once and enables Open WhatsApp", async () => {
    renderStoresPage();

    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[0]);

    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "Pradhan Mantri Bhartiya Janaushadhi Kendra",
      phone_number: "+911123456789",
      whatsapp_number: "+919811234567",
      source_url: "https://janaushadhi.gov.in/pmbjp-delhi-01",
      verification_status: "verified_whatsapp",
      confidence: "high",
      message: "Verified WhatsApp number found.",
      cached: false,
    });

    // User explicitly clicks "Find WhatsApp"
    const findWhatsAppButtons = screen.getAllByRole("button", { name: /Find WhatsApp/i });
    fireEvent.click(findWhatsAppButtons[0]);

    // Shows loading state immediately
    expect(screen.getByText(/Finding shop's WhatsApp contact.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetShopWhatsAppContact).toHaveBeenCalledTimes(1);
    });

    // Check exact shop context passed
    const callArg = mockGetShopWhatsAppContact.mock.calls[0][0];
    expect(callArg.shop_name).toContain("Pradhan Mantri Bhartiya Janaushadhi Kendra");
    expect(callArg.shop_address).toContain("Rohini");

    // Success state shown with verified number and "WhatsApp available"
    await waitFor(() => {
      expect(screen.getAllByText(/\+919811234567/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/WhatsApp available/i)).toBeInTheDocument();
    });

    // Now "Open in WhatsApp →" button is available
    const openWhatsAppButton = screen.getByRole("button", { name: /Open in WhatsApp →/i });
    expect(openWhatsAppButton).toBeInTheDocument();

    // Click "Open in WhatsApp →" to open wa.me
    fireEvent.click(openWhatsAppButton);

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    const openedUrl = mockWindowOpen.mock.calls[0][0] as string;
    expect(openedUrl).toContain("https://wa.me/919811234567?text=");
    expect(openedUrl).toContain(encodeURIComponent("Hello Pradhan Mantri Bhartiya Janaushadhi Kendra"));

    // TinyFish was NOT called a second time
    expect(mockGetShopWhatsAppContact).toHaveBeenCalledTimes(1);
  });

  it("Case 4: Lookup result is reused on subsequent modal openings (session caching)", async () => {
    renderStoresPage();

    // 1. Open modal and run discovery once
    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[0]);

    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "Pradhan Mantri Bhartiya Janaushadhi Kendra",
      phone_number: "+911123456789",
      whatsapp_number: "+919811234567",
      source_url: "https://janaushadhi.gov.in/pmbjp-delhi-01",
      verification_status: "verified_whatsapp",
      confidence: "high",
      message: "Verified WhatsApp number found.",
      cached: false,
    });

    const findButtons = screen.getAllByRole("button", { name: /Find WhatsApp/i });
    fireEvent.click(findButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/WhatsApp available/i)).toBeInTheDocument();
    });
    expect(mockGetShopWhatsAppContact).toHaveBeenCalledTimes(1);

    // 2. Close modal
    const closeButton = screen.getByLabelText(/Close modal/i);
    fireEvent.click(closeButton);

    // 3. Re-open modal for the exact same store
    const prepareButtonsAgain = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtonsAgain[0]);

    // Modal immediately displays cached verified result
    expect(screen.getByText(/WhatsApp available/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\+919811234567/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Open in WhatsApp →/i })).toBeInTheDocument();

    // TinyFish was NOT called again on reopen
    expect(mockGetShopWhatsAppContact).toHaveBeenCalledTimes(1);
  });

  it("Case 1: CSV has verified WhatsApp number — Open in WhatsApp opens wa.me without any TinyFish call", async () => {
    // Mock fetchPharmacyDirectory to return a store with verified WhatsApp in CSV
    vi.spyOn(directoryService, "fetchPharmacyDirectory").mockResolvedValueOnce({
      success: true,
      total: 1,
      districts: ["New Delhi"],
      stores: [
        {
          store_id: "ja-verified-01",
          brand: "Jan Aushadhi",
          store_name: "Verified PMBJP Kendra Connaught Place",
          contact_person: "Mr. Sharma",
          address: "Block A Connaught Place",
          district: "New Delhi",
          pincode: "110001",
          phone: "+91-11-23344556",
          whatsapp_number: "+919899112233",
          whatsapp_verified: true,
          listed_hours: "09:00 AM - 09:00 PM",
          source_url: "https://janaushadhi.gov.in",
          data_status: "verified_listing",
          distance_from_shaheed_sukhdev_km: 2.5,
        },
      ],
    });

    renderStoresPage();

    await waitFor(() => {
      expect(screen.getByText(/Verified PMBJP Kendra Connaught Place/i)).toBeInTheDocument();
    });

    // Click "Prepare enquiry"
    const prepareBtn = screen.getByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareBtn);

    // Modal opens showing "WhatsApp available" directly from CSV
    expect(screen.getByText(/WhatsApp available/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\+919899112233/i).length).toBeGreaterThan(0);

    // "Open in WhatsApp →" button is immediately available
    const openWaBtn = screen.getByRole("button", { name: /Open in WhatsApp →/i });
    expect(openWaBtn).toBeInTheDocument();

    // User clicks Open WhatsApp
    fireEvent.click(openWaBtn);

    // wa.me URL opened directly
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    const openedUrl = mockWindowOpen.mock.calls[0][0] as string;
    expect(openedUrl).toContain("https://wa.me/919899112233?text=");

    // ZERO TinyFish calls made!
    expect(mockGetShopWhatsAppContact).not.toHaveBeenCalled();
  });

  it("Case 5: No verified WhatsApp result — Open WhatsApp remains unavailable", async () => {
    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "Pradhan Mantri Bhartiya Janaushadhi Kendra",
      phone_number: "+911145678900",
      whatsapp_number: null,
      source_url: "https://example.com/listing",
      verification_status: "phone_only",
      confidence: "medium",
      message: "Phone number found, but WhatsApp could not be verified for this shop.",
      cached: false,
    });

    renderStoresPage();

    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[0]);

    // Click Find WhatsApp
    const findButtons = screen.getAllByRole("button", { name: /Find WhatsApp/i });
    fireEvent.click(findButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/WhatsApp number could not be verified for this shop/i)).toBeInTheDocument();
    });

    // "Open in WhatsApp →" remains unavailable
    expect(screen.queryByRole("button", { name: /Open in WhatsApp →/i })).not.toBeInTheDocument();
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it("Case 6: Message preview and Copy message continue working", async () => {
    const mockClipboard = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockClipboard,
      },
    });

    renderStoresPage();

    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[0]);

    // Message preview contains store name and enquiry template
    expect(screen.getByText(/Prefilled WhatsApp Message Preview/i)).toBeInTheDocument();

    // Click "Copy message text"
    const copyButton = screen.getByRole("button", { name: /Copy message text/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/Message copied!/i)).toBeInTheDocument();
  });

  it("handles contact not found gracefully", async () => {
    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "PMBJP Kendra Pitampura",
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
    fireEvent.click(prepareButtons[1]);

    const findButtons = screen.getAllByRole("button", { name: /Find WhatsApp/i });
    fireEvent.click(findButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/WhatsApp number could not be verified for this shop/i)).toBeInTheDocument();
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

    const findButtons = screen.getAllByRole("button", { name: /Find WhatsApp/i });
    fireEvent.click(findButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Contact discovery timed out or encountered an error/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/TinyFish contact discovery timed out/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry Find WhatsApp/i })).toBeInTheDocument();
  });

  it("handles ambiguous contact status and offers refinement option", async () => {
    mockGetShopWhatsAppContact.mockResolvedValueOnce({
      shop_name: "Davaindia Generic Pharmacy Connaught Place",
      phone_number: "+911145678900",
      whatsapp_number: null,
      source_url: "https://davaindia.com/branches",
      verification_status: "ambiguous",
      confidence: "low",
      message: "Multiple branches or conflicting contacts found. Unable to verify exact store.",
      cached: false,
    });

    renderStoresPage();

    const prepareButtons = screen.getAllByRole("button", { name: /Prepare enquiry/i });
    fireEvent.click(prepareButtons[2]);

    const findButtons = screen.getAllByRole("button", { name: /Find WhatsApp/i });
    fireEvent.click(findButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Multiple matching pharmacy locations found/i)).toBeInTheDocument();
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

    // Custom shop has no verified WhatsApp yet -> Find WhatsApp is shown
    const findButtons = screen.getAllByRole("button", { name: /Find WhatsApp/i });
    fireEvent.click(findButtons[0]);

    await waitFor(() => {
      expect(mockGetShopWhatsAppContact).toHaveBeenCalledTimes(1);
    });

    const callArg = mockGetShopWhatsAppContact.mock.calls[0][0];
    expect(callArg.shop_name).toBe("Dava India Generic Pharmacy");
    expect(callArg.shop_address).toBe("Picnic Spot Rd, Indira Nagar, Lucknow");
    expect(callArg.locality).toBe("Lucknow");

    // Open in WhatsApp becomes available after verification
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Open in WhatsApp →/i })).toBeInTheDocument();
    });

    const openWhatsAppButton = screen.getByRole("button", { name: /Open in WhatsApp →/i });
    fireEvent.click(openWhatsAppButton);

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    const openedUrl = mockWindowOpen.mock.calls[0][0] as string;
    expect(openedUrl).toContain("https://wa.me/919044366999?text=");
  });

  it("filters directory stores by brand (Jan Aushadhi vs Davaindia)", async () => {
    renderStoresPage();

    expect(screen.getByText(/Available Pharmacies/i)).toBeInTheDocument();

    const jaButton = screen.getByRole("button", { name: /Jan Aushadhi/i });
    fireEvent.click(jaButton);

    const jaBadges = screen.getAllByText("Jan Aushadhi");
    expect(jaBadges.length).toBeGreaterThan(0);

    const diButton = screen.getByRole("button", { name: /Davaindia/i });
    fireEvent.click(diButton);

    const diBadges = screen.getAllByText("Davaindia");
    expect(diBadges.length).toBeGreaterThan(0);
  });

  it("filters directory stores by district dropdown", async () => {
    renderStoresPage();

    const districtSelect = screen.getByLabelText(/Filter by district/i);
    fireEvent.change(districtSelect, { target: { value: "New Delhi" } });

    expect(screen.getByText(/Davaindia Generic Pharmacy Connaught Place/i)).toBeInTheDocument();
  });

  it("displays Distance unavailable when distance is unverified and provides Google Maps directions", () => {
    renderStoresPage();

    const unavailableBadges = screen.getAllByText(/Distance unavailable/i);
    expect(unavailableBadges.length).toBeGreaterThan(0);

    const directionLinks = screen.getAllByRole("link", { name: /Directions/i });
    expect(directionLinks.length).toBeGreaterThan(0);
    const firstDirectionHref = directionLinks[0].getAttribute("href");
    expect(firstDirectionHref).toContain("https://www.google.com/maps/dir/?api=1&destination=");
  });

  it("displays functional Call button when phone exists and No Phone when phone is missing", () => {
    renderStoresPage();

    const callLinks = screen.getAllByRole("link", { name: /Call /i });
    expect(callLinks.length).toBeGreaterThan(0);
    expect(callLinks[0].getAttribute("href")).toContain("tel:");

    const noPhoneBadges = screen.getAllByText(/No Phone/i);
    expect(noPhoneBadges.length).toBeGreaterThan(0);
  });
});
