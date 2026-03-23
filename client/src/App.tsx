import { Route, Routes } from "react-router-dom";
import { SiteFooter } from "@/components/SiteFooter";
import { RequireAuth } from "@/RequireAuth";
import { HomePage } from "@/pages/HomePage";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CasesPage } from "@/pages/CasesPage";
import { CaseNewPage } from "@/pages/CaseNewPage";
import { CaseEditPage } from "@/pages/CaseEditPage";
import { SessionsPage } from "@/pages/SessionsPage";
import { SessionNewPage } from "@/pages/SessionNewPage";
import { SessionDetailPage } from "@/pages/SessionDetailPage";
import { AdminReferencesPage } from "@/pages/AdminReferencesPage";
import { AdminPage } from "@/pages/AdminPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-mesh">
      <div className="flex flex-1 flex-col">
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/cases"
        element={
          <RequireAuth>
            <CasesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/cases/new"
        element={
          <RequireAuth>
            <CaseNewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/cases/:caseId/edit"
        element={
          <RequireAuth>
            <CaseEditPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions"
        element={
          <RequireAuth>
            <SessionsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/new"
        element={
          <RequireAuth>
            <SessionNewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:sessionId"
        element={
          <RequireAuth immersive>
            <SessionDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <AdminUsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/references"
        element={
          <RequireAuth>
            <AdminReferencesPage />
          </RequireAuth>
        }
      />
    </Routes>
      </div>
      <SiteFooter />
    </div>
  );
}
