import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { WatchlistProvider } from "@/contexts/WatchlistContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Profiles from "./pages/Profiles";
import Browse from "./pages/Browse";
import VideoPlayer from "./pages/VideoPlayer";
import DemoDetail from "./pages/DemoDetail";
import MyList from "./pages/MyList";
import Support from "./pages/Support";
import Admin from "./pages/Admin";
import SubmitContent from "./pages/SubmitContent";
import FlixBuddy from "./pages/FlixBuddy";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";
import Checkout from "./pages/Checkout";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import NewsletterPreferences from "./pages/NewsletterPreferences";
import FloatingHedgehog from "./components/FloatingHedgehog";
import SyntheticMarker from "./components/SyntheticMarker";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const hideFooter = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/flixbuddy';

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profiles" element={
            <ProtectedRoute>
              <Profiles />
            </ProtectedRoute>
          } />
          <Route path="/browse" element={
            <ProtectedRoute>
              <Browse />
            </ProtectedRoute>
          } />
          <Route path="/my-list" element={
            <ProtectedRoute>
              <MyList />
            </ProtectedRoute>
          } />
          <Route path="/checkout" element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          } />
          <Route path="/checkout/success" element={
            <ProtectedRoute>
              <CheckoutSuccess />
            </ProtectedRoute>
          } />
          <Route path="/watch/:videoId" element={
            <ProtectedRoute>
              <VideoPlayer />
            </ProtectedRoute>
          } />
          <Route path="/demos/:id" element={
            <ProtectedRoute>
              <DemoDetail />
            </ProtectedRoute>
          } />
          <Route path="/support" element={<Support />} />
          <Route path="/submit-content" element={
            <ProtectedRoute>
              <SubmitContent />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/flixbuddy" element={
            <ProtectedRoute>
              <FlixBuddy />
            </ProtectedRoute>
          } />
          <Route path="/newsletter-preferences" element={
            <ProtectedRoute>
              <NewsletterPreferences />
            </ProtectedRoute>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      {!hideFooter && <Footer />}
      <FloatingHedgehog />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ProfileProvider>
          <WatchlistProvider>
            <SubscriptionProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <SyntheticMarker />
                <AppContent />
              </BrowserRouter>
            </SubscriptionProvider>
          </WatchlistProvider>
        </ProfileProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
