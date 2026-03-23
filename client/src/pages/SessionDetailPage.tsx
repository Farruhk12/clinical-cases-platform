import { Navigate, useParams } from "react-router-dom";
import { SessionRunner } from "@/SessionRunner";
import { useAuth } from "@/auth-context";

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();

  if (!user) return null;
  if (!sessionId) {
    return <Navigate to="/sessions" replace />;
  }

  return (
    <SessionRunner
      sessionId={sessionId}
      userId={user.id}
      role={user.role}
    />
  );
}

/** Flag used by RequireAuth to render immersive (full-width) layout */
SessionDetailPage.immersive = true as const;
