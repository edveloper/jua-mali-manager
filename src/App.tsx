import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import PublicInvoice from "./pages/PublicInvoice";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PasswordSetupGate } from "@/components/PasswordSetupGate";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

/*
 * Split, because the two are read by different people at different moments.
 *
 * Somebody arriving from a forwarded link is on mobile data and has never seen
 * this before; making them download the whole shop app to read a page about it
 * is the most expensive first impression available. Somebody signing in has the
 * app cached from last time either way.
 */
const Index = lazy(() => import("./pages/Index"));
const Landing = lazy(() => import("./pages/Landing"));

const Splash = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
  </div>
);

/**
 * What lives at the root depends on who is asking.
 *
 * Signed out used to mean an immediate bounce to the sign-in form, which asks
 * somebody who has never heard of this to produce a password for it. Now they
 * get told what it is first. Waiting for `loading` matters: rendering the
 * landing page for a moment before the session resolves would flash marketing
 * at somebody who has been using the app for months.
 */
const Home = () => {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <Index /> : <Landing />;
};

const queryClient = new QueryClient();

// Sits above the router so there is no route an employee can navigate to in
// order to skip it.
const AppRoutes = () => {
  const { mustChangePassword, isRecovering, loading } = useAuth();

  if (!loading && isRecovering) return <PasswordSetupGate recovery />;
  if (!loading && mustChangePassword) return <PasswordSetupGate />;

  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        {/* No session required: a customer reads this from a WhatsApp link. */}
        <Route path="/i/:token" element={<PublicInvoice />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
