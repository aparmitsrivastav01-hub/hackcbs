import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { CartProvider } from "./context/CartContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import { AboutPage } from "./pages/AboutPage";
import { BatchSafetyPage } from "./pages/BatchSafetyPage";
import { CartPage } from "./pages/CartPage";
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
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/medicines" element={<MedicinesPage />} />
              <Route path="/medicines/:id" element={<MedicineDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/stores" element={<StoresPage />} />
              <Route path="/batch-safety" element={<BatchSafetyPage />} />
              <Route path="/data-sources" element={<DataSourcesPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </LanguageProvider>
  );
}
