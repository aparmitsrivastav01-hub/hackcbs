export type Medicine = {
  id: number;
  brand_name: string;
  active_salt: string;
  dosage_form: string;
  private_brand_price: number | null;
  jan_aushadhi_price: number | null;
  dava_india_price: number | null;
  category: string;
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

export type ExtractedItem = {
  raw_text: string;
  medicine_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  instructions: string | null;
  confidence: string;
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
  }>;
  customer_message: string | null;
  status: string;
  shopkeeper_response: unknown;
};

export type DatasetStatus = {
  source_name: string;
  dataset_file: string;
  records_loaded: number;
  last_modified: string | null;
  note: string;
};
