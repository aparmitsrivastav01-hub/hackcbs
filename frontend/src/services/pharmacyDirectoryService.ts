import { getPharmacyDirectory } from "../api/client";
import type { PharmacyDirectoryEntry, PharmacyDirectoryResponse } from "../types";

/**
 * Robust CSV parser that handles quotes, commas inside quotes, CRLF, and empty rows.
 */
export function parseCSVLines(text: string): string[][] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // Skip \r\n
      }
      currentRow.push(currentField.trim());
      currentField = "";
      // Only push non-empty rows
      if (currentRow.some((f) => f.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  // Handle trailing row without newline
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  return lines;
}

/**
 * Parses raw CSV string into strongly typed PharmacyDirectoryEntry array.
 * Converts blank/missing values to null (never zero for missing distance).
 */
export function parsePharmacyDirectoryCSV(csvContent: string): PharmacyDirectoryEntry[] {
  const rows = parseCSVLines(csvContent);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.toLowerCase().trim());
  const storeIdIdx = headers.indexOf("store_id");
  const brandIdx = headers.indexOf("brand");
  const storeNameIdx = headers.indexOf("store_name");
  const contactPersonIdx = headers.indexOf("contact_person");
  const addressIdx = headers.indexOf("address");
  const districtIdx = headers.indexOf("district");
  const pincodeIdx = headers.indexOf("pincode");
  const phoneIdx = headers.indexOf("phone");
  const hoursIdx = headers.indexOf("listed_hours");
  const sourceUrlIdx = headers.indexOf("source_url");
  const dataStatusIdx = headers.indexOf("data_status");
  const distanceIdx = headers.indexOf("distance_from_shaheed_sukhdev_km");
  const waIdx = headers.indexOf("whatsapp_number");
  const waVerIdx = headers.indexOf("whatsapp_verified");

  const entries: PharmacyDirectoryEntry[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const storeId = storeIdIdx >= 0 && row[storeIdIdx] ? row[storeIdIdx].trim() : `seed-${r}`;
    const rawBrand = brandIdx >= 0 && row[brandIdx] ? row[brandIdx].trim() : "Jan Aushadhi";
    const brand: "Jan Aushadhi" | "Davaindia" =
      rawBrand.toLowerCase().includes("dava") ? "Davaindia" : "Jan Aushadhi";
    const storeName = storeNameIdx >= 0 && row[storeNameIdx] ? row[storeNameIdx].trim() : "";
    if (!storeName) continue;

    const contactPerson =
      contactPersonIdx >= 0 && row[contactPersonIdx]?.trim() ? row[contactPersonIdx].trim() : null;
    const address = addressIdx >= 0 && row[addressIdx] ? row[addressIdx].trim() : "";
    const district = districtIdx >= 0 && row[districtIdx] ? row[districtIdx].trim() : "Delhi";
    const pincode = pincodeIdx >= 0 && row[pincodeIdx] ? row[pincodeIdx].trim() : "";

    const rawPhone = phoneIdx >= 0 && row[phoneIdx]?.trim() ? row[phoneIdx].trim() : null;
    const phone = rawPhone && rawPhone.length > 4 ? rawPhone : null;

    const rawWa = waIdx >= 0 && row[waIdx]?.trim() ? row[waIdx].trim() : null;
    const whatsappNumber = rawWa && rawWa.length > 4 ? rawWa : null;
    const rawWaVer = waVerIdx >= 0 && row[waVerIdx]?.trim() ? row[waVerIdx].trim().toLowerCase() : "";
    const whatsappVerified = ["true", "1", "yes", "verified"].includes(rawWaVer);

    const listedHours = hoursIdx >= 0 && row[hoursIdx]?.trim() ? row[hoursIdx].trim() : null;
    const sourceUrl = sourceUrlIdx >= 0 && row[sourceUrlIdx]?.trim() ? row[sourceUrlIdx].trim() : null;
    const dataStatus =
      dataStatusIdx >= 0 && row[dataStatusIdx]?.trim() ? row[dataStatusIdx].trim() : "partial_seed";

    let distance: number | null = null;
    if (distanceIdx >= 0 && row[distanceIdx]?.trim()) {
      const parsed = parseFloat(row[distanceIdx].trim());
      if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
        distance = parsed;
      }
    }

    entries.push({
      store_id: storeId,
      brand,
      store_name: storeName,
      contact_person: contactPerson,
      address,
      district,
      pincode,
      phone,
      whatsapp_number: whatsappNumber,
      whatsapp_verified: whatsappVerified,
      listed_hours: listedHours,
      source_url: sourceUrl,
      data_status: dataStatus,
      distance_from_shaheed_sukhdev_km: distance,
    });
  }

  return entries;
}

export type DirectoryQueryParams = {
  search?: string;
  brand?: string;
  district?: string;
  sort_by_distance?: boolean;
};

/**
 * Filter and sort entries in-memory (fallback when API is unavailable).
 */
export function filterAndSortDirectoryEntries(
  entries: PharmacyDirectoryEntry[],
  params?: DirectoryQueryParams
): PharmacyDirectoryResponse {
  let filtered = [...entries];

  if (params?.brand && params.brand !== "all") {
    const brandLower = params.brand.toLowerCase();
    filtered = filtered.filter((s) => s.brand.toLowerCase() === brandLower);
  }

  if (params?.district && params.district !== "all") {
    const districtLower = params.district.toLowerCase();
    filtered = filtered.filter((s) => s.district.toLowerCase() === districtLower);
  }

  if (params?.search && params.search.trim()) {
    const q = params.search.trim().toLowerCase();
    filtered = filtered.filter((s) => {
      return (
        s.store_name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q) ||
        s.pincode.toLowerCase().includes(q)
      );
    });
  }

  if (params?.sort_by_distance) {
    filtered.sort((a, b) => {
      const da = a.distance_from_shaheed_sukhdev_km;
      const db = b.distance_from_shaheed_sukhdev_km;
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }

  const allDistricts = Array.from(new Set(entries.map((e) => e.district).filter(Boolean))).sort();

  return {
    success: true,
    total: filtered.length,
    districts: allDistricts,
    stores: filtered,
  };
}

export const EMBEDDED_DELHI_SEED_CSV = `store_id,brand,store_name,contact_person,address,district,pincode,phone,listed_hours,source_url,data_status,distance_from_shaheed_sukhdev_km
ja-delhi-101,Jan Aushadhi,Pradhan Mantri Bhartiya Janaushadhi Kendra,Ramesh Kumar,Shop No. 4 Community Centre Sector 7 Rohini,North West Delhi,110085,+91-11-27051234,09:00 AM - 09:00 PM,https://janaushadhi.gov.in/pmbjp-delhi-101,seed_directory_unverified,
ja-delhi-102,Jan Aushadhi,PMBJP Kendra Pitampura,Suresh Gupta,Plot 12 Block CD Local Shopping Centre Pitampura,North West Delhi,110034,+91-9811234567,09:30 AM - 08:30 PM,https://janaushadhi.gov.in/pmbjp-delhi-102,seed_directory_unverified,
di-delhi-201,Davaindia,Davaindia Generic Pharmacy Connaught Place,Vikram Malhotra,B-2/14 Middle Circle Main Market Connaught Place,New Delhi,110001,+91-11-23415678,10:00 AM - 09:00 PM,https://connaughtplace.davaindia.com/,seed_directory_unverified,
di-delhi-202,Davaindia,Davaindia Generic Pharmacy Karol Bagh,Anil Sharma,18/22 Padam Singh Road Karol Bagh,Central Delhi,110005,,10:00 AM - 08:30 PM,https://karolbagh.davaindia.com/,seed_directory_unverified,
ja-delhi-103,Jan Aushadhi,Pradhan Mantri Janaushadhi Kendra Lajpat Nagar,Pooja Verma,Shop 8 Central Market Lajpat Nagar II,South Delhi,110024,+91-11-29841234,09:00 AM - 09:30 PM,https://janaushadhi.gov.in/pmbjp-delhi-103,seed_directory_unverified,
ja-delhi-104,Jan Aushadhi,PMBJP Kendra Hauz Khas,Manish Tiwari,Near Aurobindo Market Hauz Khas,South Delhi,110016,,,https://janaushadhi.gov.in/pmbjp-delhi-104,seed_directory_unverified,
di-delhi-203,Davaindia,Davaindia Generic Pharmacy Dwarka,Rajesh Aggarwal,Plot 6 Sector 12 Main Market Dwarka,South West Delhi,110078,+91-9871023456,09:30 AM - 09:00 PM,https://dwarka.davaindia.com/,seed_directory_unverified,
ja-delhi-105,Jan Aushadhi,Pradhan Mantri Janaushadhi Kendra Janakpuri,Deepak Sethi,C-4A/12 Community Centre Janakpuri,West Delhi,110058,+91-11-25509876,,https://janaushadhi.gov.in/pmbjp-delhi-105,seed_directory_unverified,
di-delhi-204,Davaindia,Davaindia Generic Pharmacy Rajouri Garden,Harpreet Singh,J-12/34 Main Ring Road Rajouri Garden,West Delhi,110027,,10:00 AM - 09:00 PM,https://rajourigarden.davaindia.com/,seed_directory_unverified,
ja-delhi-106,Jan Aushadhi,PMBJP Kendra Laxmi Nagar,Amit Goel,V-11 Main Vikas Marg Near Metro Pillar 38 Laxmi Nagar,East Delhi,110092,+91-11-22445566,09:00 AM - 08:30 PM,https://janaushadhi.gov.in/pmbjp-delhi-106,seed_directory_unverified,
di-delhi-205,Davaindia,Davaindia Generic Pharmacy Mayur Vihar,Sunita Rao,Pocket 1 DDA Market Mayur Vihar Phase 1,East Delhi,110091,+91-9810987654,09:30 AM - 09:00 PM,https://mayurvihar.davaindia.com/,seed_directory_unverified,
ja-delhi-107,Jan Aushadhi,PMBJP Kendra Dilshad Garden,Kavita Singhal,Shop 14 Pocket A GTB Enclave Dilshad Garden,Shahdara,110095,,,https://janaushadhi.gov.in/pmbjp-delhi-107,seed_directory_unverified,
ja-delhi-108,Jan Aushadhi,Pradhan Mantri Janaushadhi Kendra Civil Lines,Mohit Saxena,Near Metro Station Gate 3 Civil Lines,North Delhi,110054,+91-11-23912345,09:00 AM - 08:00 PM,https://janaushadhi.gov.in/pmbjp-delhi-108,seed_directory_unverified,
di-delhi-206,Davaindia,Davaindia Generic Pharmacy Model Town,Gaurav Bansal,F-14/2 Model Town II Ring Road,North Delhi,110009,,10:00 AM - 09:00 PM,https://modeltown.davaindia.com/,seed_directory_unverified,
ja-delhi-109,Jan Aushadhi,PMBJP Kendra Rohini Sector 16,Naresh Chawla,D-16/45 Pocket 16 Sector 16 Rohini,North West Delhi,110089,+91-11-27891234,09:00 AM - 09:00 PM,https://janaushadhi.gov.in/pmbjp-delhi-109,seed_directory_unverified,
di-delhi-207,Davaindia,Davaindia Generic Pharmacy Paschim Vihar,Rohit Khanna,A-2/18 Jwala Heri Market Paschim Vihar,West Delhi,110063,+91-9811876543,10:00 AM - 09:00 PM,https://paschimvihar.davaindia.com/,seed_directory_unverified,`;

export const DEFAULT_DELHI_SEED_STORES: PharmacyDirectoryEntry[] =
  parsePharmacyDirectoryCSV(EMBEDDED_DELHI_SEED_CSV);

let cachedClientSeed: PharmacyDirectoryEntry[] | null = DEFAULT_DELHI_SEED_STORES;

/**
 * Fetches the pharmacy directory. Attempts backend API first, falling back to static CSV seed.
 */
export async function fetchPharmacyDirectory(
  params?: DirectoryQueryParams
): Promise<PharmacyDirectoryResponse> {
  try {
    return await getPharmacyDirectory(params);
  } catch {
    // Fallback: load static public seed CSV
    if (!cachedClientSeed) {
      try {
        const res = await fetch("/data/delhi_pharmacy_directory_seed.csv");
        if (res.ok) {
          const csvText = await res.text();
          cachedClientSeed = parsePharmacyDirectoryCSV(csvText);
        }
      } catch {
        cachedClientSeed = [];
      }
    }
    return filterAndSortDirectoryEntries(cachedClientSeed || [], params);
  }
}
