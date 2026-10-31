import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ShieldCheck, Mail, Lock, Database, Trash2 } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-navy">{title}</h2>
      <div className="space-y-3 text-[15px] leading-7 text-slate-600">{children}</div>
    </section>
  );
}

export function PrivacyPolicyPage() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — MedEasy</title>
        <meta
          name="description"
          content="MedEasy's privacy policy: how we handle prescription images, session data, and your personal information. No accounts, no persistent storage."
        />
      </Helmet>

      <main className="mx-auto max-w-[800px] px-5 py-14 md:px-8">
        {/* Header */}
        <div className="mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-[#eef5ff] px-3.5 py-1.5 text-[11px] font-bold tracking-[0.08em] text-brand">
            <ShieldCheck className="h-3.5 w-3.5" />
            PRIVACY POLICY
          </div>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-navy">
            Your privacy, protected
          </h1>
          <p className="text-[16px] leading-7 text-muted">
            MedEasy is a price comparison tool for medicines in India. We've designed it to work
            without storing your personal data. This policy explains exactly what we do and don't
            do with information that passes through the app.
          </p>
          <p className="mt-3 text-sm text-slate-400">Last updated: October 2026</p>
        </div>

        {/* Quick Summary Cards */}
        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Lock,
              label: "No accounts",
              desc: "We don't require registration or login.",
            },
            {
              icon: Database,
              label: "Session-only storage",
              desc: "Cart and data live in your browser tab only.",
            },
            {
              icon: Trash2,
              label: "No prescription storage",
              desc: "Uploaded images are processed and discarded.",
            },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef5ff]">
                <Icon className="h-5 w-5 text-brand" />
              </div>
              <p className="font-bold text-navy">{label}</p>
              <p className="mt-1 text-sm text-muted">{desc}</p>
            </div>
          ))}
        </div>

        {/* Sections */}
        <Section title="1. What we collect">
          <p>
            <strong className="text-navy">Prescription images (OCR only):</strong> When you upload
            a prescription photo or PDF, it is sent to our backend OCR service to extract medicine
            names. The image is processed in memory and is <em>not</em> written to disk, logged,
            or retained after the response is returned to your browser.
          </p>
          <p>
            <strong className="text-navy">Search queries:</strong> When you search for a medicine,
            your query is sent to our API server to retrieve results. We do not store search
            queries tied to any user identity.
          </p>
          <p>
            <strong className="text-navy">Cart / enquiry list:</strong> Items you add to your cart
            are stored in your browser's <code>sessionStorage</code>. This data is cleared
            automatically when you close the browser tab. We never see or receive your cart
            contents.
          </p>
        </Section>

        <Section title="2. What we do NOT collect">
          <ul className="list-inside list-disc space-y-1 pl-2">
            <li>Your name, email address, or phone number</li>
            <li>Location data (pharmacy map uses your browser's Geolocation API, which is local)</li>
            <li>Payment information of any kind</li>
            <li>Cookies for tracking or advertising</li>
            <li>Any persistent identifier linking sessions together</li>
          </ul>
        </Section>

        <Section title="3. Third-party services">
          <p>
            <strong className="text-navy">Google Fonts:</strong> Our frontend loads the{" "}
            <em>Plus Jakarta Sans</em> typeface from Google Fonts. Google may log font requests per
            their own privacy policy.
          </p>
          <p>
            <strong className="text-navy">WhatsApp:</strong> The "Send to Pharmacy" feature opens a
            pre-filled WhatsApp link using <code>wa.me</code>. No data is transmitted to WhatsApp
            until you press Send yourself.
          </p>
          <p>
            <strong className="text-navy">CDSCO / Jan Aushadhi / Dava India:</strong> Price and
            batch-alert data is sourced from Indian government and public datasets. See our{" "}
            <Link to="/data-sources" className="text-brand hover:underline">
              Data Sources
            </Link>{" "}
            page for details.
          </p>
        </Section>

        <Section title="4. Data security">
          <p>
            All API requests between your browser and MedEasy's backend are made over HTTPS in
            production. Prescription images are processed ephemerally; if the request fails, no
            partial data is persisted.
          </p>
        </Section>

        <Section title="5. Children's privacy">
          <p>
            MedEasy is not directed at children under 13. We do not knowingly collect information
            from children.
          </p>
        </Section>

        <Section title="6. Medical disclaimer">
          <p>
            MedEasy provides price comparison information only. It is <strong>not</strong> a
            licensed medical service and does not provide medical advice. Always consult a
            registered medical practitioner before changing or substituting any prescribed
            treatment. Prices shown are catalogue benchmarks and may differ at the point of
            purchase.
          </p>
        </Section>

        <Section title="7. Changes to this policy">
          <p>
            We may update this policy as the product evolves. Material changes will be noted with
            a revised "Last updated" date at the top of this page.
          </p>
        </Section>

        <Section title="8. Contact">
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-brand" />
            For privacy questions, reach us at{" "}
            <a
              href="mailto:privacy@medeasy.example"
              className="text-brand hover:underline"
            >
              privacy@medeasy.example
            </a>
          </p>
        </Section>

        {/* Footer nav */}
        <div className="mt-12 flex gap-5 border-t border-slate-100 pt-8 text-sm font-medium text-slate-400">
          <Link to="/" className="hover:text-navy">Home</Link>
          <Link to="/terms" className="hover:text-navy">Terms of Use</Link>
          <Link to="/data-sources" className="hover:text-navy">Data Sources</Link>
          <Link to="/help" className="hover:text-navy">Help</Link>
        </div>
      </main>
    </>
  );
}
