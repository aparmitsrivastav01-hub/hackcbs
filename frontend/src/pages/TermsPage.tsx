import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { FileText, AlertTriangle } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-navy">{title}</h2>
      <div className="space-y-3 text-[15px] leading-7 text-slate-600">{children}</div>
    </section>
  );
}

export function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of Use — MedEasy</title>
        <meta
          name="description"
          content="MedEasy terms of use: informational service only, not medical advice. Price comparisons are catalogue benchmarks. Read before using the service."
        />
      </Helmet>

      <main className="mx-auto max-w-[800px] px-5 py-14 md:px-8">
        {/* Header */}
        <div className="mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-[#eef5ff] px-3.5 py-1.5 text-[11px] font-bold tracking-[0.08em] text-brand">
            <FileText className="h-3.5 w-3.5" />
            TERMS OF USE
          </div>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-navy">
            Terms of Use
          </h1>
          <p className="text-[16px] leading-7 text-muted">
            By using MedEasy you agree to these terms. Please read them carefully — they clarify
            what this service is, what it is not, and how you should use it responsibly.
          </p>
          <p className="mt-3 text-sm text-slate-400">Last updated: October 2026</p>
        </div>

        {/* Important banner */}
        <div className="mb-10 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
          <p className="text-[14px] leading-6 text-amber-800">
            <strong>MedEasy is an informational tool only.</strong> It is not a licensed pharmacy,
            a medical practitioner, or a regulated healthcare service. Nothing on this platform
            constitutes medical advice, a diagnosis, or a treatment recommendation.
          </p>
        </div>

        <Section title="1. Service description">
          <p>
            MedEasy is a medicine price comparison platform that aggregates publicly available
            catalogue data from Jan Aushadhi, Dava India, and other government-linked sources. It
            helps users understand the approximate cost difference between generic and branded
            medicines listed in Indian government catalogues.
          </p>
        </Section>

        <Section title="2. Not medical advice">
          <p>
            Information provided by MedEasy — including search results, price comparisons, batch
            alert lookups, and prescription transcriptions — is for <strong>informational
            purposes only</strong>. You must not:
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>Use MedEasy as a substitute for professional medical advice</li>
            <li>
              Change, substitute, or stop any prescribed medication without consulting a licensed
              medical practitioner
            </li>
            <li>Rely on MedEasy for emergency health decisions</li>
          </ul>
        </Section>

        <Section title="3. Prescription AI transcription">
          <p>
            The prescription scan feature uses AI-assisted OCR to attempt to extract medicine
            names from uploaded images. This transcription is <strong>not guaranteed to be
            accurate</strong>. You are required to review and confirm all extracted items before
            proceeding. MedEasy is not liable for errors in AI-generated transcriptions.
          </p>
        </Section>

        <Section title="4. Prices are catalogue benchmarks">
          <p>
            Prices displayed are based on government catalogue data and are approximate benchmarks
            only. Actual prices at your pharmacy may differ due to stock availability, location,
            scheme eligibility, and other factors. MedEasy does not guarantee the accuracy,
            completeness, or current validity of any price shown.
          </p>
        </Section>

        <Section title="5. Batch safety checker">
          <p>
            The Batch Drug Alert checker searches public CDSCO-sourced data for known batch
            recalls or alerts. A result of "no alert found" is <strong>not a safety
            certificate</strong> and does not confirm that a particular batch is safe. Always
            consult your pharmacist or the CDSCO directly for authoritative safety information.
          </p>
        </Section>

        <Section title="6. WhatsApp pharmacy handoff">
          <p>
            The "Send to Pharmacy" feature generates a pre-filled WhatsApp message using your cart
            items. This message is <strong>not sent automatically</strong> — you must review and
            press Send yourself. MedEasy is not responsible for any transaction between you and a
            pharmacy, including availability, pricing, or delivery.
          </p>
        </Section>

        <Section title="7. No substitution recommendations">
          <p>
            Showing a lower-cost generic equivalent is <em>not a recommendation to switch</em>.
            Any substitution of a prescribed medicine must be discussed with and approved by your
            prescribing doctor or a licensed pharmacist.
          </p>
        </Section>

        <Section title="8. Intellectual property">
          <p>
            The MedEasy name, logo, and original code are property of the MedEasy team. Medicine
            data is sourced from public government datasets and remains under their respective
            licenses.
          </p>
        </Section>

        <Section title="9. Limitation of liability">
          <p>
            To the fullest extent permitted by applicable law, MedEasy and its contributors shall
            not be liable for any direct, indirect, incidental, or consequential damages arising
            from the use or inability to use this service.
          </p>
        </Section>

        <Section title="10. Changes to these terms">
          <p>
            We may revise these terms as the platform evolves. Continued use of MedEasy after
            changes constitutes acceptance of the updated terms.
          </p>
        </Section>

        {/* Footer nav */}
        <div className="mt-12 flex gap-5 border-t border-slate-100 pt-8 text-sm font-medium text-slate-400">
          <Link to="/" className="hover:text-navy">Home</Link>
          <Link to="/privacy" className="hover:text-navy">Privacy Policy</Link>
          <Link to="/data-sources" className="hover:text-navy">Data Sources</Link>
          <Link to="/help" className="hover:text-navy">Help</Link>
        </div>
      </main>
    </>
  );
}
