export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <h1 className="text-3xl font-extrabold text-navy">About MedEasy</h1>
      <p className="mt-4 leading-7 text-muted">
        MedEasy helps you read a prescription more clearly, compare listed catalogue prices, and look up nearby pharmacies on Google Maps. It does not diagnose, prescribe, or confirm that two medicines are clinically interchangeable.
      </p>
      <p className="mt-4 leading-7 text-muted">
        Prices come from the MedEasy catalogue API. Nearby store discovery uses Google Maps in your browser. Pharmacy stock is never assumed from a map listing.
      </p>
    </div>
  );
}
