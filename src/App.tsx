import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Index from "./pages/Index";
import HRDashboard from "./pages/HRDashboard";
import AnalyticsDashboard from "./pages/dashboard/AnalyticsDashboard";
import EmployeeDashboard from "./pages/dashboard/EmployeeDashboard";
import RolesDashboard from "./pages/dashboard/RolesDashboard";
import JobDescriptionsDashboard from "./pages/dashboard/JobDescriptionsDashboard";
import JobDescriptionReview from "./pages/dashboard/JobDescriptionReview";
import SkillsDashboard from "./pages/dashboard/SkillsDashboard";
import CareerPathsDashboard from "./pages/dashboard/CareerPathsDashboard";
import MobilityDashboard from "./pages/dashboard/MobilityDashboard";
import DevelopmentDashboard from "./pages/dashboard/DevelopmentDashboard";
import CertificationsDashboard from "./pages/dashboard/CertificationsDashboard";
import WorkforceAnalyticsDashboard from "./pages/dashboard/WorkforceAnalyticsDashboard";
import SkillInventoryDashboard from "./pages/dashboard/SkillInventoryDashboard";
import TrainingDashboard from "./pages/dashboard/TrainingDashboard";
import BulkRoleAssignmentDashboard from "./pages/dashboard/BulkRoleAssignmentDashboard";
import AIInterviewDashboard from "./pages/dashboard/AIInterviewDashboard";
import TdDiagnostics from "./pages/admin/TdDiagnostics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/legacy-dashboard" element={<Index />} />
          <Route path="/dashboard" element={<HRDashboard />}>
            <Route index element={<RolesDashboard />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="employees" element={<EmployeeDashboard />} />
            <Route path="bulk-role-assignment" element={<BulkRoleAssignmentDashboard />} />
            <Route path="roles" element={<RolesDashboard />} />
            <Route path="job-descriptions" element={<JobDescriptionsDashboard />} />
            <Route path="job-descriptions/review" element={<JobDescriptionReview />} />
            <Route path="skills" element={<SkillsDashboard />} />
            <Route path="career-paths" element={<CareerPathsDashboard />} />
            <Route path="mobility" element={<MobilityDashboard />} />
            <Route path="development" element={<DevelopmentDashboard />} />
            <Route path="training" element={<TrainingDashboard />} />
            <Route path="certifications" element={<CertificationsDashboard />} />
            <Route path="workforce-analytics" element={<WorkforceAnalyticsDashboard />} />
            <Route path="skill-inventory" element={<SkillInventoryDashboard />} />
            <Route path="ai-interviews" element={<AIInterviewDashboard />} />
          </Route>
          {/* Admin Routes */}
          <Route path="/admin">
            <Route path="td-diagnostics" element={<TdDiagnostics />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
