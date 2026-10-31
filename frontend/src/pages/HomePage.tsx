import { Helmet } from "react-helmet-async";
import { Hero } from "../components/home/Hero";
import { LandingGuide } from "../components/home/LandingGuide";

export function HomePage() {
  return (
    <>
      <Helmet>
        <title>MedEasy — Accessible Medicine Price Comparison & Prescription Assistant</title>
        <meta
          name="description"
          content="Compare Indian medicine prices across Jan Aushadhi (PMBJP), Dava India, and branded options. AI-assisted prescription scanning, CDSCO batch safety alerts, and nearby pharmacy finder."
        />
      </Helmet>
      <main>
        <Hero />
        <LandingGuide />
      </main>
    </>
  );
}
