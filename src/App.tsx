import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Candidates from "./pages/Candidates";
import CandidateProfile from "./pages/CandidateProfile";
import Pipeline from "./pages/Pipeline";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminCompanies from "./pages/admin/AdminCompanies";
import CareersPage from "./pages/careers/CareersPage";
import JobDetailsPage from "./pages/careers/JobDetailsPage";
import ScreeningJobs from "./pages/screening/ScreeningJobs";
import ScreeningSubmissions from "./pages/screening/ScreeningSubmissions";
import PublicScreening from "./pages/screening/PublicScreening";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const TEST_ADMIN_EMAIL = "testadmin@email.com";

function ProtectedRoutes() {
  const { user, loading, profile, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || (!profile && !loading)) return <Navigate to="/auth" replace />;

  return <AppLayout />;
}

function ATSGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  if (profile?.email !== TEST_ADMIN_EMAIL) {
    return <Navigate to="/screening" replace />;
  }
  return <>{children}</>;
}

function DefaultRedirect() {
  const { profile } = useAuth();
  if (profile?.email === TEST_ADMIN_EMAIL) {
    return <Dashboard />;
  }
  return <Navigate to="/screening" replace />;
}

function AuthRoute() {
  const { user, loading, profile, role } = useAuth();
  if (loading) return null;
  if (user && (profile || role === "super_admin")) {
    const redirectTo = profile?.email === TEST_ADMIN_EMAIL ? "/" : "/screening";
    return <Navigate to={redirectTo} replace />;
  }
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/careers/:companySlug" element={<CareersPage />} />
            <Route path="/careers/:companySlug/:jobId" element={<JobDetailsPage />} />
            <Route path="/screen/:linkId" element={<PublicScreening />} />
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/candidates" element={<Candidates />} />
              <Route path="/candidates/:id" element={<CandidateProfile />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/screening" element={<ScreeningJobs />} />
              <Route path="/screening/:jobId/submissions" element={<ScreeningSubmissions />} />
              <Route path="/admin" element={<AdminDashboard />}>
                <Route index element={<AdminOverview />} />
                <Route path="companies" element={<AdminCompanies />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
