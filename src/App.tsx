import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { LanguageProvider } from "./i18n/LanguageContext";
import { AboutPage } from "./pages/AboutPage";
import { DataSourcesPage } from "./pages/DataSourcesPage";
import { HelpPage } from "./pages/HelpPage";
import { HomePage } from "./pages/HomePage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { MedicineDetailPage } from "./pages/MedicineDetailPage";
import { MedicinesPage } from "./pages/MedicinesPage";
import { ScanPage } from "./pages/ScanPage";
import { StoresPage } from "./pages/StoresPage";

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/medicines" element={<MedicinesPage />} />
            <Route path="/medicines/:id" element={<MedicineDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/stores" element={<StoresPage />} />
            <Route path="/data-sources" element={<DataSourcesPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
