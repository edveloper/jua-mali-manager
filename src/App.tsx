import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicInvoice from "./pages/PublicInvoice";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PasswordSetupGate } from "@/components/PasswordSetupGate";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Sits above the router so there is no route an employee can navigate to in
// order to skip it.
const AppRoutes = () => {
  const { mustChangePassword, isRecovering, loading } = useAuth();

  if (!loading && isRecovering) return <PasswordSetupGate recovery />;
  if (!loading && mustChangePassword) return <PasswordSetupGate />;

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      {/* No session required: a customer reads this from a WhatsApp link. */}
      <Route path="/i/:token" element={<PublicInvoice />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
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
