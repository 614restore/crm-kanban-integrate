import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { useServiceWorker } from "@/lib/serviceWorker";
import { useEffect } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Photos from "./pages/Photos";
import NotFound from "./pages/NotFound";
import UpdatePassword from "./pages/UpdatePassword";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import EULA from "./pages/EULA";
import SignDocument from "./pages/SignDocument";
import SignEstimate from "./pages/SignEstimate";
import SignQuote from "./pages/SignQuote";
import SignChangeOrder from "./pages/SignChangeOrder";
import SignDocTemplate from "./pages/SignDocTemplate";
import AcceptInvite from "./pages/AcceptInvite";
import WorkOrders from "./pages/WorkOrders";
import QuickBooksCallback from "./pages/QuickBooksCallback";
import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});


// Get base path from environment (set by Vite)
const basename = import.meta.env.BASE_URL || "/";

// PWA Update notification component
const PWAUpdateNotification = () => {
  const { updateAvailable, activateUpdate, isOffline } = useServiceWorker();

  useEffect(() => {
    // updateAvailable is handled by the banner below
  }, [updateAvailable]);

  if (updateAvailable) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white p-3 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            App update available!
          </span>
          <span className="text-xs opacity-90">
            New features and improvements ready
          </span>
        </div>
        <button
          onClick={activateUpdate}
          className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
        >
          Update Now
        </button>
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-orange-600 text-white p-2 z-50 text-center">
        <span className="text-sm">
          📱 Offline mode - Changes will sync when reconnected
        </span>
      </div>
    );
  }

  return null;
};
const App = () => {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Only sign out on a genuine auth error. AppLayout handles data refresh
        // after long idle periods (>5 min) — we must not invalidate here or every
        // tab switch triggers a full refetch and blanks the UI.
        const { error } = await supabase.auth.getSession();
        if (error) {
          await supabase.auth.signOut();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (

  <ErrorBoundary>
    <ThemeProvider defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <PWAUpdateNotification />
          <Toaster />
          <Sonner />
          <BrowserRouter basename={basename}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/photos" element={<Photos />} />
              <Route path="/reset-password" element={<UpdatePassword />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/eula" element={<EULA />} />
              <Route path="/sign" element={<SignDocument />} />
              <Route path="/sign-estimate/:token" element={<SignEstimate />} />
              <Route path="/sign-estimate" element={<SignEstimate />} />
              <Route path="/quote/:token" element={<SignQuote />} />
              <Route path="/sign-change-order" element={<SignChangeOrder />} />
              <Route path="/sign-doc" element={<SignDocTemplate />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/work-orders" element={<WorkOrders />} />
              <Route path="/integrations/quickbooks/callback" element={<QuickBooksCallback />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
  );
};


export default App;
