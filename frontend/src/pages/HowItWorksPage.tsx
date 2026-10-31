import { Link } from "react-router-dom";

const steps = [
  {
    title: "Scan a prescription",
    body: "Upload an image or PDF. Gemini extracts visible medicine lines for review. Search does not run automatically.",
    to: "/scan",
    cta: "Open scanner",
  },
  {
    title: "Confirm, then search",
    body: "Correct names, strength and form. Only confirmed items are matched against the catalogue.",
    to: "/scan",
    cta: "Review flow",
  },
  {
    title: "Compare listed prices",
    body: "Private Brand, Jan Aushadhi and Dava India prices come from the loaded CSV. Missing prices are shown as unavailable.",
    to: "/medicines",
    cta: "Browse catalogue",
  },
  {
    title: "Find nearby pharmacies",
    body: "Open Google Maps around your location. Save an enquiry if you want to ask a shop about stock — WhatsApp is never sent by the server.",
    to: "/stores",
    cta: "Nearby stores",
  },
];

export function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-12 md:px-8">
      <h1 className="text-3xl font-extrabold text-navy">How it works</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <article key={step.title} className="rounded-2xl border border-slate-100 p-6 shadow-sm">
            <p className="text-sm font-semibold text-brand">Step {index + 1}</p>
            <h2 className="mt-2 text-xl font-bold text-navy">{step.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
            <Link to={step.to} className="mt-4 inline-block text-sm font-semibold text-brand">
              {step.cta} →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
