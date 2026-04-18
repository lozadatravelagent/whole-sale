import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequireConsumer from "@/components/RequireConsumer";
import { isEmiliaHost } from "@/lib/host";
import { lazy, Suspense, useEffect } from 'react';

// Landing pages loaded immediately (first view)
import Index from "./pages/Index";
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
const ConsumerLogin = lazy(() => import("./pages/ConsumerLogin"));
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

const EmiliaHostRoutes = () => (
  <Routes>
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      }
    />
    <Route
      path="/chat"
      element={
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      }
    />
    <Route path="/login" element={<Login />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const MainHostRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<Login />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/documentacion" element={<Documentation />} />
    <Route path="/soporte" element={<Support />} />
    <Route path="/terminos" element={<Terms />} />
    <Route path="/privacidad" element={<Privacy />} />
    <Route path="/contacto" element={<Contact />} />
    <Route path="/emilia" element={<EmiliaLanding />} />
    <Route path="/emilia/signup" element={<ConsumerSignup />} />
    <Route path="/emilia/login" element={<ConsumerLogin />} />
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
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/chat"
      element={
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      }
    />
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
      path="/settings"
      element={
        <ProtectedRoute>
          <Settings />
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
    <Route
      path="/users"
      element={
        <ProtectedRoute>
          <Users />
        </ProtectedRoute>
      }
    />
    <Route
      path="/agencies"
      element={
        <ProtectedRoute>
          <Agencies />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tenants"
      element={
        <ProtectedRoute>
          <Tenants />
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

const AppRoutes = () => (isEmiliaHost() ? <EmiliaHostRoutes /> : <MainHostRoutes />);

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
