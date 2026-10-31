import { Link } from "react-router-dom";

export function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8">
      <h1 className="text-3xl font-extrabold text-navy">Help</h1>
      <div className="mt-6 space-y-5 text-sm leading-6 text-muted">
        <p>
          <strong className="text-navy">Does scan search the catalogue immediately?</strong>
          <br />
          No. Extraction returns text for review. Search runs only after you confirm items.
        </p>
        <p>
          <strong className="text-navy">Are cheaper options always equivalent?</strong>
          <br />
          No. Confirm ingredient, strength, dosage form and pack size with a pharmacist or clinician.
        </p>
        <p>
          <strong className="text-navy">Where do prices come from?</strong>
          <br />
          The catalogue CSV loaded by the API. See <Link className="font-semibold text-brand" to="/data-sources">Data Sources</Link> for live counts.
        </p>
        <p>
          <strong className="text-navy">Need the scanner?</strong>
          <br />
          <Link className="font-semibold text-brand" to="/scan">Scan a prescription</Link>
        </p>
      </div>
    </div>
  );
}
