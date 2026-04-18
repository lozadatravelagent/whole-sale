import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequireConsumer from "@/components/RequireConsumer";
import RequireAgent from "@/components/RequireAgent";
import { lazy, Suspense, useEffect } from 'react';

// Landing pages loaded immediately (first view)
import Login from "./pages/Login";

// Lazy loaded pages (code-splitting)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat"));
const CRM = lazy(() => import("./pages/CRM"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Users = lazy(() => import("./pages/Users"));
const Agencies = lazy(() => import("./pages/Agencies"));
const Tenants = lazy(() => import("./pages/Tenants"));
const Documentation = lazy(() => import("./pages/Documentation"));
const Support = lazy(() => import("./pages/Support"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Contact = lazy(() => import("./pages/Contact"));
const EmiliaLanding = lazy(() => import("./pages/EmiliaLanding"));
const CompanionChatPage = lazy(() => import("./pages/CompanionChatPage"));
const ConsumerSignup = lazy(() => import("./pages/ConsumerSignup"));
const ConsumerProfile = lazy(() => import("./pages/ConsumerProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const HotelbedsTest = lazy(() => import("./pages/HotelbedsTest"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

// Legacy redirect: ?mode=companion was a Fase 0 entrypoint spec that never
// landed in code. This catches any hardcoded external link and routes it to
// the canonical /emilia/chat path, preserving other query params.
function LegacyCompanionRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') !== 'companion') return;

    params.delete('mode');
    const query = params.toString();
    navigate(`/emilia/chat${query ? `?${query}` : ''}`, { replace: true });
  }, [location.search, navigate]);

  return null;
}

// Root redirect: authenticated users land on the unified chat surface;
// anonymous users see the public Emilia landing. Replaces the per-host root
// behaviour from the dual-host era.
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return <Navigate to={user ? '/emilia/chat' : '/emilia'} replace />;
}

const AppRoutes = () => (
  <Routes>
    {/* Root: redirect condicional auth */}
    <Route path="/" element={<RootRedirect />} />

    {/* Auth surfaces (raíz) */}
    <Route path="/login" element={<Login />} />
    <Route path="/auth/callback" element={<AuthCallback />} />

    {/* Public/marketing pages */}
    <Route path="/documentacion" element={<Documentation />} />
    <Route path="/soporte" element={<Support />} />
    <Route path="/terminos" element={<Terms />} />
    <Route path="/privacidad" element={<Privacy />} />
    <Route path="/contacto" element={<Contact />} />

    {/* Emilia consumer surfaces */}
    <Route path="/emilia" element={<EmiliaLanding />} />
    <Route path="/emilia/signup" element={<ConsumerSignup />} />
    <Route
      path="/emilia/chat"
      element={
        <RequireConsumer>
          <CompanionChatPage />
        </RequireConsumer>
      }
    />
    <Route
      path="/emilia/chat/:conversationId"
      element={
        <RequireConsumer>
          <CompanionChatPage />
        </RequireConsumer>
      }
    />
    <Route
      path="/emilia/profile"
      element={
        <RequireConsumer>
          <ConsumerProfile />
        </RequireConsumer>
      }
    />

    {/* Emilia admin surfaces (agent-only). ProtectedRoute valida sesión;
        RequireAgent valida accountType y rebota consumers a /emilia/chat. */}
    <Route
      path="/emilia/dashboard"
      element={
        <ProtectedRoute>
          <RequireAgent>
            <Dashboard />
          </RequireAgent>
        </ProtectedRoute>
      }
    />
    <Route
      path="/emilia/users"
      element={
        <ProtectedRoute>
          <RequireAgent>
            <Users />
          </RequireAgent>
        </ProtectedRoute>
      }
    />
    <Route
      path="/emilia/agencies"
      element={
        <ProtectedRoute>
          <RequireAgent>
            <Agencies />
          </RequireAgent>
        </ProtectedRoute>
      }
    />
    <Route
      path="/emilia/tenants"
      element={
        <ProtectedRoute>
          <RequireAgent>
            <Tenants />
          </RequireAgent>
        </ProtectedRoute>
      }
    />
    <Route
      path="/emilia/settings"
      element={
        <ProtectedRoute>
          <RequireAgent>
            <Settings />
          </RequireAgent>
        </ProtectedRoute>
      }
    />

    {/* Legacy redirects: bookmarks viejos y links hardcodeados en componentes
        que sobreviven PR 2 (MainLayout, ConsumerSignup, Dashboard,
        UserProfileHeader, Marketplace) siguen funcionando hasta PR 4 los
        elimine junto con el resto del cleanup. */}
    <Route path="/chat" element={<Navigate to="/emilia/chat" replace />} />
    <Route path="/dashboard" element={<Navigate to="/emilia/dashboard" replace />} />
    <Route path="/users" element={<Navigate to="/emilia/users" replace />} />
    <Route path="/agencies" element={<Navigate to="/emilia/agencies" replace />} />
    <Route path="/tenants" element={<Navigate to="/emilia/tenants" replace />} />
    <Route path="/settings" element={<Navigate to="/emilia/settings" replace />} />

    {/* Legacy routes mantenidas tal cual; PR 4 las borra */}
    <Route
      path="/crm"
      element={
        <ProtectedRoute>
          <CRM />
        </ProtectedRoute>
      }
    />
    <Route
      path="/marketplace"
      element={
        <ProtectedRoute>
          <Marketplace />
        </ProtectedRoute>
      }
    />
    <Route
      path="/reports"
      element={
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      }
    />
    {/* Hotelbeds certification test page (auth-guarded) */}
    <Route
      path="/hotelbeds-test"
      element={
        <ProtectedRoute>
          <HotelbedsTest />
        </ProtectedRoute>
      }
    />

    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="vibook-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <LegacyCompanionRedirect />
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
