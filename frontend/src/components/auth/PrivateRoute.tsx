import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types";

interface PrivateRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-2xl font-black text-navy">Access Restricted</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Your current account role (<strong>{user.role}</strong>) does not have permission to access this feature. This area is reserved for {allowedRoles.join(" or ")} accounts.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
