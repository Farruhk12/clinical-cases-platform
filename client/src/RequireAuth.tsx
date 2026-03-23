import { Navigate, useLocation } from "react-router-dom";
import { NavBar } from "@/components/nav";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/auth-context";
import type { ReactNode } from "react";

export function RequireAuth({
  children,
  immersive = false,
}: {
  children: ReactNode;
  immersive?: boolean;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        <PageLoader />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (immersive) {
    return (
      <div className="flex flex-1 flex-col">
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <NavBar role={user.role} login={user.login} />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 motion-safe:animate-fade-in">
        {children}
      </div>
    </div>
  );
}
