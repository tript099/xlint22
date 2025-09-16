import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { HRSidebar } from "@/components/HRSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";


const HRDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect unauthenticated users to login
  useEffect(() => {
    console.log('🔐 HRDashboard auth check - user:', !!user, 'loading:', authLoading, 'pathname:', location.pathname);
    if (!authLoading && !user) {
      console.log('🚫 No user found, redirecting to login');
      navigate('/');
    } else if (!authLoading && user) {
      console.log('✅ User authenticated, staying on current page:', location.pathname);
    }
  }, [user, authLoading, navigate, location.pathname]);

  // Show loading while auth is being checked
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Global Header */}
        <header className="fixed top-0 left-0 right-0 h-20 z-50 xlsmart-gradient-bg border-b flex items-center justify-between px-4">
          <SidebarTrigger className="text-white hover:bg-white/20" />
          
          <div className="flex flex-col items-center space-y-1">
            <img 
              src="/xlsmart-logo.svg" 
              alt="XLSMART Logo" 
              className="h-10 w-auto"
            />
            <p className="text-white/90 text-sm font-medium">AI-Powered HR Platform by SimplifyAI</p>
          </div>
          
          <div className="flex items-center gap-3">
          </div>
        </header>

        <HRSidebar />

        {/* Main Content Area */}
        <main className="flex-1 pt-20">
          <div className="p-6 h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default HRDashboard;