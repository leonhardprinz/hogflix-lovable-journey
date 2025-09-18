import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { WatchlistProvider } from "@/contexts/WatchlistContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Profiles from "./pages/Profiles";
import Browse from "./pages/Browse";
import VideoPlayer from "./pages/VideoPlayer";
import MyList from "./pages/MyList";
import Support from "./pages/Support";
import Admin from "./pages/Admin";
import SubmitContent from "./pages/SubmitContent";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const hideFooter = location.pathname === '/login' || location.pathname === '/signup';

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Index />} />
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
          <Route path="/watch/:videoId" element={
            <ProtectedRoute>
              <VideoPlayer />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      {!hideFooter && <Footer />}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ProfileProvider>
          <WatchlistProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </WatchlistProvider>
        </ProfileProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
