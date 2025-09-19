import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Upload, Target, BarChart3, Brain, Loader2 } from "lucide-react";
import { useAIStats } from "@/components/AIStatsProvider";
import { useOptimizedRoleAnalytics } from "@/hooks/useOptimizedRoleAnalytics";
import { useState, lazy, Suspense, memo, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw } from "lucide-react";

// OPTIMIZED: Lazy load heavy components to improve initial page load
const StandardizedRolesDetails = lazy(() => import("@/components/StandardizedRolesDetails").then(m => ({ default: m.StandardizedRolesDetails })));
const RoleStandardizationSystem = lazy(() => import("@/components/RoleStandardizationSystem").then(m => ({ default: m.RoleStandardizationSystem })));
const AIAdvancedRoleIntelligence = lazy(() => import("@/components/AIAdvancedRoleIntelligenceOptimized").then(m => ({ default: m.AIAdvancedRoleIntelligence })));
const BulkRoleAssignment = lazy(() => import("@/components/BulkRoleAssignment"));
const MappingAccuracyDetails = lazy(() => import("@/components/MappingAccuracyDetails").then(m => ({ default: m.MappingAccuracyDetails })));
const RoleCategoriesDetails = lazy(() => import("@/components/RoleCategoriesDetails").then(m => ({ default: m.RoleCategoriesDetails })));
const StandardizationRateDetails = lazy(() => import("@/components/StandardizationRateDetails").then(m => ({ default: m.StandardizationRateDetails })));

// OPTIMIZED: Create component skeleton for loading states
const ComponentSkeleton = memo(() => (
  <div className="space-y-4">
    <div className="flex items-center space-x-3 mb-4">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-6 w-48" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  </div>
));

// OPTIMIZED: Error boundary fallback component
const ErrorFallback = memo(({ error, resetError }: { error: Error; resetError: () => void }) => (
  <Alert className="border-destructive/20 bg-destructive/5">
    <AlertTriangle className="h-4 w-4 text-destructive" />
    <AlertDescription className="flex items-center justify-between">
      <div>
        <div className="font-medium text-destructive mb-1">Something went wrong</div>
        <div className="text-sm text-muted-foreground">{error.message}</div>
      </div>
      <button
        onClick={resetError}
        className="flex items-center gap-2 px-3 py-1 text-sm bg-background border rounded hover:bg-muted"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>
    </AlertDescription>
  </Alert>
));

// OPTIMIZED: Memoize stat card to prevent unnecessary re-renders
const StatCard = memo(({ stat, index, onClick, isLoading }: {
  stat: any;
  index: number;
  onClick: () => void;
  isLoading: boolean;
}) => (
  <Card 
    className="hover:shadow-md transition-all duration-200 cursor-pointer"
    onClick={onClick}
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
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
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
));

const RolesDashboard = () => {
  const aiStats = useAIStats();
  const roleAnalytics = useOptimizedRoleAnalytics();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  // OPTIMIZED: Performance monitoring for debugging
  const renderStartTime = useMemo(() => performance.now(), []);
  
  useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      const renderTime = performance.now() - renderStartTime;
      if (renderTime > 100) {
        console.warn(`🐌 RolesDashboard slow render: ${renderTime.toFixed(2)}ms`);
      }
    }
  }, [renderStartTime, roleAnalytics.loading]);

  // OPTIMIZED: Memoize role stats to prevent recalculation on every render
  const roleStats = useMemo(() => [
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
  ], [roleAnalytics]);

  // OPTIMIZED: Memoize dialog handlers to prevent unnecessary re-renders
  const handleStatCardClick = useCallback((index: number) => {
    const dialogMap = {
      0: 'roles-details',
      1: 'accuracy-details', 
      2: 'standardization-details',
      3: 'categories-details'
    };
    setActiveDialog(dialogMap[index as keyof typeof dialogMap] || null);
  }, []);

  const handleDialogClose = useCallback(() => {
    setActiveDialog(null);
  }, []);

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
            <StatCard 
              key={index}
              stat={stat}
              index={index}
              onClick={() => handleStatCardClick(index)}
              isLoading={roleAnalytics.loading}
            />
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
                <Suspense fallback={<ComponentSkeleton />}>
                  <RoleStandardizationSystem />
                </Suspense>
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

            <Suspense fallback={<ComponentSkeleton />}>
              <BulkRoleAssignment />
            </Suspense>
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
              <Suspense fallback={<ComponentSkeleton />}>
                <AIAdvancedRoleIntelligence />
              </Suspense>
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
                <Suspense fallback={<ComponentSkeleton />}>
                  <StandardizedRolesDetails />
                </Suspense>
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      {/* Detail Dialogs */}
      <Dialog open={activeDialog === 'roles-details'} onOpenChange={(open) => setActiveDialog(open ? 'roles-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Standardized Roles Details</DialogTitle>
          <Suspense fallback={<ComponentSkeleton />}>
            <StandardizedRolesDetails />
          </Suspense>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'accuracy-details'} onOpenChange={(open) => setActiveDialog(open ? 'accuracy-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Mapping Accuracy Details</DialogTitle>
          <Suspense fallback={<ComponentSkeleton />}>
            <MappingAccuracyDetails />
          </Suspense>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'standardization-details'} onOpenChange={(open) => setActiveDialog(open ? 'standardization-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Standardization Rate Details</DialogTitle>
          <Suspense fallback={<ComponentSkeleton />}>
            <StandardizationRateDetails />
          </Suspense>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'categories-details'} onOpenChange={(open) => setActiveDialog(open ? 'categories-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Role Categories Details</DialogTitle>
          <Suspense fallback={<ComponentSkeleton />}>
            <RoleCategoriesDetails />
          </Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RolesDashboard;