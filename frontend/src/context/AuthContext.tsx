import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentUser,
  getPrivacyConsentStatus,
  loginUser,
  logoutUser,
  refreshAuthToken,
  signupUser,
  updatePatientProfile,
  updatePrivacyConsent,
} from "../api/client";
import type { PatientProfile, PrivacyConsent, UserPublic } from "../types";

type AuthContextType = {
  user: UserPublic | null;
  profile: PatientProfile | null;
  consent: PrivacyConsent | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  showConsentPrompt: boolean;
  dismissConsentPrompt: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: {
    email: string;
    password: string;
    confirm_password?: string;
    display_label?: string;
    preferred_language?: string;
    role?: "patient" | "pharmacist" | "admin";
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (payload: { display_label?: string; preferred_language?: string }) => Promise<void>;
  setMekoConsent: (granted: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [consent, setConsent] = useState<PrivacyConsent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConsentPrompt, setShowConsentPrompt] = useState(false);

  // Attempt session restoration via HttpOnly refresh cookie on initial app load
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const token = await refreshAuthToken();
        if (token && mounted) {
          const meData = await getCurrentUser();
          if (mounted) {
            setUser(meData.user);
            setProfile(meData.profile);
            const consentData = await getPrivacyConsentStatus();
            setConsent(consentData);
          }
        }
      } catch {
        // Unauthenticated visitor is normal
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void initSession();

    return () => {
      mounted = false;
    };
  }, []);

  async function login(email: string, password: string) {
    const res = await loginUser({ email, password });
    setUser(res.user);
    setProfile(res.profile);
    try {
      const consentData = await getPrivacyConsentStatus();
      setConsent(consentData);
      // Prompt for consent on first login if not yet granted or explicitly answered
      if (!consentData.granted && !consentData.withdrawn_at) {
        setShowConsentPrompt(true);
      }
    } catch {
      /* ignore */
    }
  }

  async function signup(payload: {
    email: string;
    password: string;
    confirm_password?: string;
    display_label?: string;
    preferred_language?: string;
    role?: "patient" | "pharmacist" | "admin";
  }) {
    const res = await signupUser(payload);
    setUser(res.user);
    setProfile(res.profile);
    try {
      const consentData = await getPrivacyConsentStatus();
      setConsent(consentData);
      // Explicitly prompt new users with first-login privacy choices
      setShowConsentPrompt(true);
    } catch {
      /* ignore */
    }
  }

  async function logout() {
    await logoutUser();
    setUser(null);
    setProfile(null);
    setConsent(null);
    setShowConsentPrompt(false);
  }

  async function updateProfile(payload: { display_label?: string; preferred_language?: string }) {
    const updated = await updatePatientProfile(payload);
    setProfile(updated);
  }

  async function setMekoConsent(granted: boolean) {
    const updated = await updatePrivacyConsent({ granted });
    setConsent(updated);
    setShowConsentPrompt(false);
  }

  function dismissConsentPrompt() {
    setShowConsentPrompt(false);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        consent,
        isAuthenticated: !!user,
        isLoading,
        showConsentPrompt,
        dismissConsentPrompt,
        login,
        signup,
        logout,
        updateProfile,
        setMekoConsent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      token: null,
      isLoading: false,
      login: async () => {},
      signup: async () => {},
      logout: () => {},
      updateConsent: async () => {},
      refreshProfile: async () => {},
    };
  }
  return ctx;
}
