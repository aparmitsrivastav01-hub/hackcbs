import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ConsentModal } from "./components/auth/ConsentModal";
import { PrivateRoute } from "./components/auth/PrivateRoute";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import { AboutPage } from "./pages/AboutPage";
import { AccountPage } from "./pages/AccountPage";
import { BatchSafetyPage } from "./pages/BatchSafetyPage";
import { CartPage } from "./pages/CartPage";
import { HelpPage } from "./pages/HelpPage";
import { HomePage } from "./pages/HomePage";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { LoginPage } from "./pages/LoginPage";
import { MedicineDetailPage } from "./pages/MedicineDetailPage";
import { MedicinesPage } from "./pages/MedicinesPage";
import { MedSaathiPage } from "./pages/MedSaathiPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { ScanPage } from "./pages/ScanPage";
import { SignupPage } from "./pages/SignupPage";
import { StoresPage } from "./pages/StoresPage";
import { TermsPage } from "./pages/TermsPage";

export default function App() {
  return (
    <HelmetProvider>
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <BrowserRouter>
              <ConsentModal />
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="/medicines" element={<MedicinesPage />} />
                  <Route path="/medicines/:id" element={<MedicineDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/stores" element={<StoresPage />} />
                  <Route path="/batch-safety" element={<BatchSafetyPage />} />
                  <Route path="/med-saathi" element={<MedSaathiPage />} />
                  <Route path="/data-sources" element={<Navigate to="/med-saathi" replace />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route
                    path="/account"
                    element={
                      <PrivateRoute>
                        <AccountPage />
                      </PrivateRoute>
                    }
                  />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/how-it-works" element={<HowItWorksPage />} />
                  <Route path="/help" element={<HelpPage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </HelmetProvider>
  );
}
