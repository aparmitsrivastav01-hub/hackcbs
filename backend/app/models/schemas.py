from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    catalogue_records: int


class Prices(BaseModel):
    private_brand: float | None
    jan_aushadhi: float | None
    dava_india: float | None


class ProviderSavings(BaseModel):
    savings_amount: float | None
    savings_percentage: float | None


class MaximumSavings(BaseModel):
    provider: str | list[str]
    amount: float
    percentage: float | None
    private_brand_price: float
    alternative_price: float


class SavingsComparison(BaseModel):
    jan_aushadhi: ProviderSavings
    dava_india: ProviderSavings
    maximum_savings: MaximumSavings | None


class SavingsOpportunity(BaseModel):
    medicine_id: int
    medicine_name: str
    private_brand_price: float
    alternative_provider: str
    alternative_price: float
    savings_amount: float
    savings_percentage: float


class MaximumSavingsResponse(BaseModel):
    success: bool
    provider: str | None
    highest_savings_amount: SavingsOpportunity | None
    highest_savings_percentage: SavingsOpportunity | None
    top_savings: list[SavingsOpportunity]


class MedicineResponse(BaseModel):
    id: int
    brand_name: str
    active_salt: str
    dosage_form: str
    category: str
    prices: Prices
    cheapest_provider: str | None
    cheapest_price: float | None
    savings: float | None
    savings_percentage: float | None
    savings_comparison: SavingsComparison


class SearchResponse(BaseModel):
    success: bool = True
    query: str
    total_results: int
    results: list[MedicineResponse]


class CategoriesResponse(BaseModel):
    categories: list[str]
    total_categories: int


class ErrorResponse(BaseModel):
    detail: str
