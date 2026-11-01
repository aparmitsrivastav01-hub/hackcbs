import { describe, expect, it } from "vitest";
import {
  filterAndSortDirectoryEntries,
  parseCSVLines,
  parsePharmacyDirectoryCSV,
} from "./pharmacyDirectoryService";

const SAMPLE_CSV = `store_id,brand,store_name,contact_person,address,district,pincode,phone,listed_hours,source_url,data_status,distance_from_shaheed_sukhdev_km
ja_del_01,Jan Aushadhi,"Pradhan Mantri Bhartiya Janaushadhi Kendra, Rohini Sector 16",Ramesh Kumar,"Shop No. 5, Pocket D-11, Sector 16, Rohini",North West Delhi,110089,011-27891234,09:00 AM - 09:00 PM,https://janaushadhi.gov.in,verified_listing,1.8
di_del_02,Davaindia,Davaindia Generic Pharmacy Pitampura,Sunita Sharma,"Plot 42, Kapil Vihar, Pitampura",North West Delhi,110034,9811234567,10:00 AM - 08:30 PM,https://davaindia.com,verified_listing,4.2
ja_del_03,Jan Aushadhi,PMBJP Kendra Connaught Place,,Shop 12 Palika Bazar,New Delhi,110001,,,https://janaushadhi.gov.in,partial_seed,
`;

describe("pharmacyDirectoryService", () => {
  it("correctly parses CSV with quoted fields and commas", () => {
    const lines = parseCSVLines(SAMPLE_CSV);
    expect(lines.length).toBe(4); // 1 header + 3 rows
    expect(lines[1][2]).toBe("Pradhan Mantri Bhartiya Janaushadhi Kendra, Rohini Sector 16");
    expect(lines[1][4]).toBe("Shop No. 5, Pocket D-11, Sector 16, Rohini");
  });

  it("parses directory entries and preserves missing fields as null (never zero distance)", () => {
    const entries = parsePharmacyDirectoryCSV(SAMPLE_CSV);
    expect(entries.length).toBe(3);

    // Row 1: Valid phone, hours, distance
    expect(entries[0].store_id).toBe("ja_del_01");
    expect(entries[0].brand).toBe("Jan Aushadhi");
    expect(entries[0].phone).toBe("011-27891234");
    expect(entries[0].distance_from_shaheed_sukhdev_km).toBe(1.8);

    // Row 3: Missing contact person, phone, hours, and distance
    expect(entries[2].contact_person).toBeNull();
    expect(entries[2].phone).toBeNull();
    expect(entries[2].listed_hours).toBeNull();
    expect(entries[2].distance_from_shaheed_sukhdev_km).toBeNull();
    expect(entries[2].distance_from_shaheed_sukhdev_km).not.toBe(0);
  });

  it("filters by brand", () => {
    const entries = parsePharmacyDirectoryCSV(SAMPLE_CSV);
    const jaOnly = filterAndSortDirectoryEntries(entries, { brand: "Jan Aushadhi" });
    expect(jaOnly.stores.length).toBe(2);
    expect(jaOnly.stores.every((s) => s.brand === "Jan Aushadhi")).toBe(true);

    const diOnly = filterAndSortDirectoryEntries(entries, { brand: "Davaindia" });
    expect(diOnly.stores.length).toBe(1);
    expect(diOnly.stores[0].brand).toBe("Davaindia");
  });

  it("filters by district", () => {
    const entries = parsePharmacyDirectoryCSV(SAMPLE_CSV);
    const nwOnly = filterAndSortDirectoryEntries(entries, { district: "North West Delhi" });
    expect(nwOnly.stores.length).toBe(2);
    expect(nwOnly.districts).toContain("New Delhi");
    expect(nwOnly.districts).toContain("North West Delhi");
  });

  it("sorts by distance putting null values at the end", () => {
    const entries = parsePharmacyDirectoryCSV(SAMPLE_CSV);
    const sorted = filterAndSortDirectoryEntries(entries, { sort_by_distance: true });
    expect(sorted.stores[0].distance_from_shaheed_sukhdev_km).toBe(1.8);
    expect(sorted.stores[1].distance_from_shaheed_sukhdev_km).toBe(4.2);
    expect(sorted.stores[2].distance_from_shaheed_sukhdev_km).toBeNull();
  });

  it("parses whatsapp_number and whatsapp_verified when present in CSV", () => {
    const csvWithWa = `store_id,brand,store_name,contact_person,address,district,pincode,phone,whatsapp_number,whatsapp_verified,listed_hours,source_url,data_status,distance_from_shaheed_sukhdev_km
wa_01,Jan Aushadhi,PMBJP Verified Store,,Address,New Delhi,110001,+91-11-22334455,+919811234567,true,9-9,https://test,verified,1.2
wa_02,Davaindia,Davaindia Unverified Store,,Address,New Delhi,110001,+91-11-99887766,,,9-9,https://test,verified,2.0
`;
    const entries = parsePharmacyDirectoryCSV(csvWithWa);
    expect(entries[0].whatsapp_number).toBe("+919811234567");
    expect(entries[0].whatsapp_verified).toBe(true);
    expect(entries[1].whatsapp_number).toBeNull();
    expect(entries[1].whatsapp_verified).toBe(false);
  });
});
