import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StandardizedRolesDetails } from "@/components/StandardizedRolesDetails";
import { RoleStandardizationSystem } from "@/components/RoleStandardizationSystem";
import { AIAdvancedRoleIntelligence } from "@/components/AIAdvancedRoleIntelligence";
import BulkRoleAssignment from "@/components/BulkRoleAssignment";
import { MappingAccuracyDetails } from "@/components/MappingAccuracyDetails";
import { RoleCategoriesDetails } from "@/components/RoleCategoriesDetails";
import { StandardizationRateDetails } from "@/components/StandardizationRateDetails";
import { Briefcase, Upload, Target, BarChart3, Brain, Loader2 } from "lucide-react";
import { useAIStats } from "@/components/AIStatsProvider";
import { useRoleAnalytics } from "@/hooks/useRoleAnalytics";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const RolesDashboard = () => {
  const aiStats = useAIStats();
  const roleAnalytics = useRoleAnalytics();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const roleStats = [
    { 
      value: roleAnalytics.loading ? "..." : roleAnalytics.totalRoles.toString(), 
      label: "Standardized Roles", 
      icon: Briefcase, 
      color: "text-blue-600",
      description: "Total role definitions"
    },
    { 
      value: roleAnalytics.loading ? "..." : `${roleAnalytics.mappingAccuracy}%`, 
      label: "Mapping Accuracy", 
      icon: Target, 
      color: "text-green-600",
      description: "Role assignment precision"
    },
    { 
      value: roleAnalytics.loading ? "..." : `${roleAnalytics.standardizationRate}%`, 
      label: "Standardization Rate", 
      icon: BarChart3, 
      color: "text-purple-600",
      description: "Successfully standardized"
    },
    { 
      value: roleAnalytics.loading ? "..." : roleAnalytics.roleCategories.toString(), 
      label: "Role Categories", 
      icon: Briefcase, 
      color: "text-orange-600",
      description: "Distinct role families"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Role Management</h1>
        <p className="text-muted-foreground text-lg">
          Standardize roles, manage assignments, analyze role distribution, and AI-powered intelligence
        </p>
      </div>

      {/* Role Stats */}
      <section className="bg-muted/50 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Role Statistics</h2>
          <p className="text-muted-foreground">
            Overview of role standardization and management metrics
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {roleStats.map((stat, index) => (
            <Card 
              key={index} 
              className="hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => {
                if (index === 0) {
                  setActiveDialog('roles-details');
                } else if (index === 1) {
                  setActiveDialog('accuracy-details');
                } else if (index === 2) {
                  setActiveDialog('standardization-details');
                } else if (index === 3) {
                  setActiveDialog('categories-details');
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
                      {roleAnalytics.loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
      <Tabs defaultValue="standardization" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-fit">
          <TabsTrigger value="standardization" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Standardization</span>
          </TabsTrigger>
          <TabsTrigger value="assignment" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Assignment</span>
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">AI Intelligence</span>
          </TabsTrigger>
          <TabsTrigger value="directory" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Directory</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="standardization" className="space-y-6 mt-6">
          {/* Role Standardization System */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">Role Standardization</h2>
              <p className="text-muted-foreground">
                Upload and standardize role catalogs using AI-powered processing
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <span>Role Upload & Standardization</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RoleStandardizationSystem />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="assignment" className="space-y-6 mt-6">
          {/* Bulk Role Assignment */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">Bulk Role Assignment</h2>
              <p className="text-muted-foreground">
                Automatically assign standardized roles to employees using AI
              </p>
            </div>

            <BulkRoleAssignment />
          </section>
        </TabsContent>

        <TabsContent value="intelligence" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-primary" />
                <span>Advanced Role Intelligence</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AIAdvancedRoleIntelligence />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directory" className="space-y-6 mt-6">
          {/* Role Directory and Analytics */}
          <section>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-2">Role Directory & Analytics</h2>
              <p className="text-muted-foreground">
                Detailed view of all standardized roles with analysis and recommendations
              </p>
            </div>

            <Card>
              <CardContent className="p-0">
                <StandardizedRolesDetails />
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      {/* Detail Dialogs */}
      <Dialog open={activeDialog === 'roles-details'} onOpenChange={(open) => setActiveDialog(open ? 'roles-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Standardized Roles Details</DialogTitle>
          <StandardizedRolesDetails />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'accuracy-details'} onOpenChange={(open) => setActiveDialog(open ? 'accuracy-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Mapping Accuracy Details</DialogTitle>
          <MappingAccuracyDetails />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'standardization-details'} onOpenChange={(open) => setActiveDialog(open ? 'standardization-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Standardization Rate Details</DialogTitle>
          <StandardizationRateDetails />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'categories-details'} onOpenChange={(open) => setActiveDialog(open ? 'categories-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Role Categories Details</DialogTitle>
          <RoleCategoriesDetails />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RolesDashboard;