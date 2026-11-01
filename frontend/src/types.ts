// Medicine catalogue and pricing types matching FRONTEND_INTEGRATION.md
export type Prices = {
  private_brand: number | null;
  jan_aushadhi: number | null;
  dava_india: number | null;
};

export type ProviderSavings = {
  savings_amount: number | null;
  savings_percentage: number | null;
};

export type MaximumSavings = {
  provider: string | string[];
  amount: number;
  percentage: number | null;
  private_brand_price: number;
  alternative_price: number;
};

export type SavingsComparison = {
  jan_aushadhi: ProviderSavings;
  dava_india: ProviderSavings;
  maximum_savings: MaximumSavings | null;
};

export type SavingsOpportunity = {
  medicine_id: number;
  medicine_name: string;
  private_brand_price: number;
  alternative_provider: string;
  alternative_price: number;
  savings_amount: number;
  savings_percentage: number;
};

export type MaximumSavingsResponse = {
  success: boolean;
  provider: string | null;
  highest_savings_amount: SavingsOpportunity | null;
  highest_savings_percentage: SavingsOpportunity | null;
  top_savings: SavingsOpportunity[];
};

export type MedicineResponse = {
  id: number;
  brand_name: string;
  active_salt: string;
  dosage_form: string;
  category: string;
  prices: Prices;
  cheapest_provider: string | null;
  cheapest_price: number | null;
  savings: number | null;
  savings_percentage: number | null;
  savings_comparison: SavingsComparison;
  private_brand_price?: number | null;
  jan_aushadhi_price?: number | null;
  dava_india_price?: number | null;
};

export type SearchResponse = {
  success: boolean;
  query: string;
  total_results: number;
  results: MedicineResponse[];
};

export type CategoriesResponse = {
  categories: string[];
  total_categories: number;
};

export type HealthResponse = {
  status: string;
  catalogue_records: number;
};

// Base medicine item type supporting both legacy views and full catalogue responses
export type Medicine = {
  id: number;
  brand_name: string;
  active_salt: string;
  dosage_form: string;
  category: string;
  prices?: Prices;
  private_brand_price?: number | null;
  jan_aushadhi_price?: number | null;
  dava_india_price?: number | null;
  cheapest_provider?: string | null;
  cheapest_price?: number | null;
  savings?: number | null;
  savings_percentage?: number | null;
  savings_comparison?: SavingsComparison;
};

export type PriceOption = {
  provider: string;
  price: number | null;
  available: boolean;
  is_cheapest: boolean;
  savings_vs_private: number | null;
  savings_percent: number | null;
};

export type Comparison = {
  medicine: Medicine;
  price_options: PriceOption[];
  recommended_option: {
    provider: string;
    price: number | null;
    savings: number | null;
    savings_percent: number | null;
  } | null;
  comparison_note: string;
};

export type CatalogueStats = {
  total_medicines: number;
  categories: number;
  category_counts: Record<string, number>;
  price_coverage: {
    private_brand: number;
    jan_aushadhi: number;
    dava_india: number;
  };
};

// OCR extraction types
export type ExtractedItem = {
  raw_text: string;
  medicine_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  instructions: string | null;
  confidence: "High" | "Medium" | "Low" | string;
  uncertain_parts: string[];
  needs_user_confirmation: boolean;
};

export type ExtractionResponse = {
  status: string;
  message: string;
  search_performed: boolean;
  model: string;
  file_name: string;
  extraction: {
    document_language: string;
    items: ExtractedItem[];
    other_text: string[];
    warnings: string[];
  };
};

export type ConfirmedSearchResult = {
  status: string;
  note: string;
  results: Array<{
    confirmed_input: {
      medicine_name: string;
      strength: string | null;
      dosage_form: string | null;
    };
    matches: Comparison[];
    match_count: number;
    review_note: string;
  }>;
};

// Cart / Enquiry Item
export type CartItem = {
  id: string; // unique item id in cart
  medicine_id?: number | null;
  brand_name: string;
  active_salt?: string;
  dosage_form?: string;
  selected_provider: "jan_aushadhi" | "dava_india" | "private_brand" | "unspecified";
  selected_price: number | null;
  private_brand_price: number | null;
  quantity: number;
  pack_info?: string;
};

// Pharmacy & Enquiries
export type Pharmacy = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  distance?: string;
  open_now?: boolean;
  rating?: number;
  review_count?: number;
  is_generic_store?: boolean;
  generic_network?: "Jan Aushadhi" | "Dava India" | "Independent";
  source: "places" | "demo";
};

export type PharmacyEnquiry = {
  id: string;
  created_at: string;
  updated_at: string;
  pharmacy: {
    name: string;
    phone: string | null;
    place_id: string | null;
    address: string | null;
  };
  customer_area: string | null;
  items: Array<{
    medicine_name: string;
    strength?: string | null;
    dosage_form?: string | null;
    quantity: string;
    catalogue_medicine_id?: number | null;
    quoted_price?: number | null;
  }>;
  customer_message: string | null;
  status: "draft" | "enquiry_prepared" | "awaiting_pharmacy" | "responded" | "closed";
  shopkeeper_response?: {
    availability: "available" | "partial" | "unavailable";
    quoted_price?: number | null;
    manufacturer?: string;
    batch_number?: string;
    expiry_date?: string;
    home_delivery?: boolean;
    delivery_fee?: number | null;
    estimated_delivery?: string;
    notes?: string;
    is_simulated?: boolean;
  } | null;
};

// Batch Alert Safety types
export type BatchAlertRecord = {
  product_name: string;
  manufacturer: string;
  batch_number: string;
  alert_type: string;
  notice_date: string;
  source_name: string;
  source_url?: string;
  notes: string;
};

export type BatchCheckResult = {
  status: "alert_match" | "no_match" | "manual_review" | "unavailable";
  product_name: string;
  manufacturer?: string;
  batch_number: string;
  matches: BatchAlertRecord[];
  dataset_records: number;
  last_updated?: string;
  message: string;
  safety_note: string;
};

export type DatasetStatus = {
  source_name: string;
  dataset_file: string;
  records_loaded: number;
  last_modified: string | null;
  note: string;
};

// -------------------------------------------------------------
// Phase 2: User Account, Patient Profile, & Privacy Consent Types
// -------------------------------------------------------------

export type UserPublic = {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

export type PatientProfile = {
  id: string;
  user_id: string;
  display_label: string | null;
  preferred_language: string;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = {
  success: boolean;
  access_token: string;
  token_type: string;
  user: UserPublic;
  profile: PatientProfile;
};

export type PrivacyConsent = {
  purpose: string;
  policy_version: string;
  granted: boolean;
  granted_at: string | null;
  withdrawn_at: string | null;
};

export type MekoContextItem = {
  memory_id: string;
  text: string;
  source?: string;
  recorded_at?: string;
  review_status?: string;
};

export type MekoContextResponse = {
  meko_enabled: boolean;
  operation: "recall" | "propose" | "save" | "forget" | "status";
  status: "success" | "empty" | "disabled" | "error";
  context_items: MekoContextItem[];
  message?: string;
};

// On-Demand TinyFish WhatsApp Contact Discovery
export type ShopWhatsAppContactRequest = {
  shop_name: string;
  shop_address?: string;
  city?: string;
  locality?: string;
  maps_url?: string;
  query?: string;
};

export type ShopWhatsAppContactResponse = {
  shop_name: string;
  address?: string | null;
  mobile_number?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  source_url?: string | null;
  run_url?: string | null;
  embed_url?: string | null;
  verification_status: "verified" | "verified_whatsapp" | "phone_only" | "not_found" | "ambiguous";
  confidence?: "high" | "medium" | "low" | "none" | null;
  message: string;
  cached?: boolean;
};

// Pharmacy Directory (Delhi Seed Dataset)
export type PharmacyDirectoryEntry = {
  store_id: string;
  brand: "Jan Aushadhi" | "Davaindia";
  store_name: string;
  contact_person: string | null;
  address: string;
  district: string;
  pincode: string;
  phone: string | null;
  whatsapp_number?: string | null;
  whatsapp_verified?: boolean;
  listed_hours: string | null;
  source_url: string | null;
  data_status: string;
  distance_from_shaheed_sukhdev_km: number | null;
};

export type PharmacyDirectoryResponse = {
  success: boolean;
  total: number;
  districts: string[];
  stores: PharmacyDirectoryEntry[];
};
