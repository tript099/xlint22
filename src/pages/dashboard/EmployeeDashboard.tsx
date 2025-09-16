import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeListDetails } from "@/components/EmployeeListDetails";
import { EmployeeUploadTwoStep } from "@/components/EmployeeUploadTwoStep";
import { AICompensationIntelligence } from "@/components/AICompensationIntelligence";
import { AIEmployeeEngagement } from "@/components/AIEmployeeEngagement";
import { AISuccessionPlanning } from "@/components/AISuccessionPlanning";
import { AIDiversityInclusion } from "@/components/AIDiversityInclusion";
import { Users, Upload, BarChart3, TrendingUp, DollarSign, Brain, Loader2 } from "lucide-react";
import { useAIStats } from "@/components/AIStatsProvider";
import { useEmployeeAnalytics } from "@/hooks/useEmployeeAnalytics";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const EmployeeDashboard = () => {
  const aiStats = useAIStats();
  const employeeAnalytics = useEmployeeAnalytics();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const employeeStats = [
    { 
      value: employeeAnalytics.loading ? "..." : employeeAnalytics.totalEmployees.toLocaleString(), 
      label: "Total Employees", 
      icon: Users, 
      color: "text-blue-600",
      description: "Active employee records"
    },
    { 
      value: employeeAnalytics.loading ? "..." : `${employeeAnalytics.roleAssignmentRate}%`, 
      label: "Role Assignment Rate", 
      icon: TrendingUp, 
      color: "text-green-600",
      description: "Successfully assigned roles"
    },
    { 
      value: employeeAnalytics.loading ? "..." : `${employeeAnalytics.dataCompleteness}%`, 
      label: "Data Completeness", 
      icon: BarChart3, 
      color: "text-purple-600",
      description: "Complete employee profiles"
    },
    { 
      value: employeeAnalytics.loading ? "..." : `${employeeAnalytics.skillsAssessmentRate}%`, 
      label: "Skills Assessment", 
      icon: Users, 
      color: "text-orange-600",
      description: "Completed assessments"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Employee Management</h1>
        <p className="text-muted-foreground text-lg">
          Manage employee data, assignments, compensation analytics, and AI insights
        </p>
      </div>

      {/* Employee Stats */}
      <section className="bg-muted/50 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Employee Statistics</h2>
          <p className="text-muted-foreground">
            Overview of employee data and management metrics
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {employeeStats.map((stat, index) => (
            <Card 
              key={index} 
              className="hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => {
                if (index === 0) {
                  setActiveDialog('employee-details');
                } else if (index === 1) {
                  // Role Assignment Rate - navigate to role management
                  window.location.href = '/dashboard/roles';
                } else if (index === 2) {
                  // Data Completeness - show employee directory for data review
                  setActiveDialog('employee-details');
                } else if (index === 3) {
                  // Skills Assessment - navigate to skills dashboard
                  window.location.href = '/dashboard/skills';
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${
                    index % 4 === 0 ? 'from-blue-500 to-blue-600' :
                    index % 4 === 1 ? 'from-green-500 to-green-600' :
                    index % 4 === 2 ? 'from-purple-500 to-purple-600' :
                    'from-orange-500 to-orange-600'
                  }`}>
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-2xl font-bold ${stat.color} flex items-center gap-2`}>
                      {employeeAnalytics.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {stat.value}
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {stat.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Main Content Tabs */}
      <Tabs defaultValue="management" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-fit">
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Management</span>
          </TabsTrigger>
          <TabsTrigger value="compensation" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Compensation</span>
          </TabsTrigger>
          <TabsTrigger value="engagement" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Engagement</span>
          </TabsTrigger>
          <TabsTrigger value="succession" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Succession</span>
          </TabsTrigger>
          <TabsTrigger value="directory" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Directory</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="space-y-6 mt-6">
          {/* Employee Upload Section */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">Employee Upload & Management</h2>
              <p className="text-muted-foreground">
                Upload employee data and manage AI-powered role assignments
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <span>Employee Data Upload</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EmployeeUploadTwoStep />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-primary" />
                <span>Employee Engagement Intelligence</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AIEmployeeEngagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="succession" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Succession Planning Intelligence</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AISuccessionPlanning />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <span>Diversity & Inclusion Intelligence</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AIDiversityInclusion />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compensation" className="space-y-6 mt-6">
          <AICompensationIntelligence />
        </TabsContent>

        <TabsContent value="directory" className="space-y-6 mt-6">
          {/* Employee List and Analytics */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">Employee Directory & Analytics</h2>
              <p className="text-muted-foreground">
                Detailed view of all employees with analysis and recommendations
              </p>
            </div>

            <Card>
              <CardContent className="p-0">
                <EmployeeListDetails />
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      {/* Detail Dialogs */}
      <Dialog open={activeDialog === 'employee-details'} onOpenChange={(open) => setActiveDialog(open ? 'employee-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Employee Details</DialogTitle>
          <EmployeeListDetails />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeDashboard;