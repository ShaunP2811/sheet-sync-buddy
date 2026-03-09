import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GoogleAuthProvider, useGoogleAuth } from "@/features/auth/GoogleAuthContext";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewSync from "./pages/NewSync";
import HistoryPage from "./pages/History";
import SyncDetail from "./pages/SyncDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoading } = useGoogleAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) return <LoginPage />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <GoogleAuthProvider>
        <BrowserRouter>
          <AuthGate>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sync/new" element={<NewSync />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:id" element={<SyncDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthGate>
        </BrowserRouter>
      </GoogleAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
