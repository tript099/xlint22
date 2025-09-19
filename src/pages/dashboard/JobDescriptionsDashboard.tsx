import React, { useCallback, useMemo, useState, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AIJobDescriptionGeneratorEnhanced } from "@/components/AIJobDescriptionGeneratorEnhanced";
import { AIJobDescriptionsIntelligence } from "@/components/AIJobDescriptionsIntelligence";
import JobDescriptionDialog from "@/components/JobDescriptionDialog";
import { useJobDescriptionStats } from "@/hooks/useJobDescriptionStats";
import { useRecentJobDescriptions } from "@/hooks/useRecentJobDescriptions";
import { useNavigate } from "react-router-dom";
import { FileText, Zap, CheckCircle, Clock, Brain, Loader2, XCircle } from "lucide-react";

// OPTIMIZATION: Memoized Stats Card Component
const StatsCard = memo(({ stat, index, onClick }: { 
  stat: any; 
  index: number; 
  onClick: (status: string, index: number) => void;
}) => (
  <Card
    className="hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
    onClick={() => onClick(stat.status, index)}
  >
    <CardContent className="p-4">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${
          index % 5 === 0 ? 'from-blue-500 to-blue-600' :
          index % 5 === 1 ? 'from-green-500 to-green-600' :
          index % 5 === 2 ? 'from-purple-500 to-purple-600' :
          index % 5 === 3 ? 'from-orange-500 to-orange-600' :
          'from-red-500 to-red-600'
        }`}>
          <stat.icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <div className={`text-2xl font-bold ${stat.color} flex items-center gap-2`}>
            {stat.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
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

StatsCard.displayName = 'StatsCard';

const JobDescriptionsDashboard = () => {
  console.log('🔄 JobDescriptionsDashboard rendered');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("generator");
  
  // Add useEffect to handle page refresh and ensure we stay on this page
  React.useEffect(() => {
    console.log('📍 JobDescriptionsDashboard mounted - ensuring we stay on this page');
    console.log('📍 Current pathname:', window.location.pathname);
    
    // Check if this is a page refresh (using modern Navigation API if available)
    const isRefresh = window.performance.getEntriesByType('navigation').length > 0 
      ? (window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type === 'reload'
      : true;
    console.log('📍 Is page refresh:', isRefresh);
    
    // Only navigate if we're not already on the correct page
    if (window.location.pathname !== '/dashboard/job-descriptions') {
      console.log('🔄 URL mismatch detected, correcting...');
      navigate('/dashboard/job-descriptions', { replace: true });
    } else {
      console.log('✅ Already on correct page, no navigation needed');
    }
    
    // Add a small delay to ensure the page is fully loaded
    const timer = setTimeout(() => {
      console.log('📍 Page fully loaded, ensuring correct URL');
      if (window.location.pathname !== '/dashboard/job-descriptions') {
        console.log('🔄 Final URL correction...');
        navigate('/dashboard/job-descriptions', { replace: true });
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [navigate]);
  
  console.log('🎯 Current activeTab:', activeTab);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const { totalJDs, activeJDs, draftJDs, approvedJDs, publishedJDs, declinedJDs, pendingJDs, loading, refetch: refetchStats } = useJobDescriptionStats();
  const { recentJDs, loading: recentLoading, refetch: refetchRecent } = useRecentJobDescriptions();
  console.log('📊 Dashboard stats:', { totalJDs, activeJDs, draftJDs, approvedJDs, publishedJDs, declinedJDs, pendingJDs, loading });

  // OPTIMIZATION: Memoized callbacks to prevent re-renders
  const handleCardClick = useCallback((cardType: string, index: number) => {
    console.log('🔍 Card clicked:', cardType, index);

    // Open dialog instead of navigation to prevent page reload
    const dialogMap = ['all-jds', 'approved-jds', 'pending-jds', 'active-jds', 'declined-jds'];
    setActiveDialog(dialogMap[index] || null);
  }, []);

  // OPTIMIZATION: Memoized JD generation callback
  const handleJDGenerated = useCallback(() => {
    console.log('🔄 JD generated, refreshing dashboard data...');
    refetchStats();
    refetchRecent();
  }, [refetchStats, refetchRecent]);

  // OPTIMIZATION: Memoized tab change handler
  const handleTabChange = useCallback((value: string) => {
    console.log('🔄 Tab changed from', activeTab, 'to', value);
    setActiveTab(value);
  }, [activeTab]);

  // OPTIMIZATION: Memoized dialog close handler
  const handleDialogClose = useCallback((dialogType: string) => {
    return (open: boolean) => setActiveDialog(open ? dialogType : null);
  }, []);  // OPTIMIZATION: Memoize the stats array with performance indicators
  const jdStats = useMemo(() => [
    {
      value: loading ? "Loading..." : totalJDs.toLocaleString(),
      label: "Generated JDs",
      icon: FileText,
      color: "text-blue-600",
      description: "Total job descriptions",
      status: "all",
      isLoading: loading
    },
    {
      value: loading ? "Loading..." : `${approvedJDs}`,
      label: "Approved JDs",
      icon: CheckCircle,
      color: "text-green-600",
      description: "Approved + Published JDs",
      status: "approved",
      isLoading: loading
    },
    {
      value: loading ? "Loading..." : `${pendingJDs}`,
      label: "Pending Review",
      icon: Clock,
      color: "text-purple-600",
      description: "Need approval or review",
      status: "draft,review",
      isLoading: loading
    },
    {
      value: loading ? "Loading..." : `${activeJDs}`,
      label: "Active JDs",
      icon: Zap,
      color: "text-orange-600",
      description: "Currently published",
      status: "published",
      isLoading: loading
    },
    {
      value: loading ? "Loading..." : `${declinedJDs}`,
      label: "Declined JDs",
      icon: XCircle,
      color: "text-red-600",
      description: "Declined job descriptions",
      status: "declined",
      isLoading: loading
    }
  ], [loading, totalJDs, approvedJDs, pendingJDs, activeJDs, declinedJDs]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Job Descriptions</h1>
        <p className="text-muted-foreground text-lg">
          Generate, manage, and analyze job descriptions with AI assistance
        </p>
      </div>

      {/* JD Stats */}
      <section className="bg-muted/50 rounded-xl p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Job Description Statistics</h2>
          <p className="text-muted-foreground">
            Overview of job description generation and management metrics
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {jdStats.map((stat, index) => (
            <StatsCard
              key={`${stat.label}-${stat.status}`}
              stat={stat}
              index={index}
              onClick={handleCardClick}
            />
          ))}
        </div>
      </section>

      {/* AI Job Description Tools */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">AI Job Description Tools</h2>
          <p className="text-muted-foreground">
            Generate, analyze, and optimize job descriptions with AI-powered intelligence
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generator" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Generator
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Intelligence
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generator" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>Generate Job Descriptions</span>
                </CardTitle>
              </CardHeader>
                             <CardContent>
                 <AIJobDescriptionGeneratorEnhanced onJDGenerated={handleJDGenerated} />
               </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="intelligence" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <span>Job Description Intelligence</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AIJobDescriptionsIntelligence />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* JD Management Features */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Generations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading recent job descriptions...</span>
                </div>
              ) : recentJDs.length > 0 ? (
                recentJDs.map((jd) => (
                  <div key={jd.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{jd.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Generated {new Date(jd.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`text-sm ${
                      jd.status === 'approved' ? 'text-green-600' :
                      jd.status === 'published' ? 'text-blue-600' :
                      jd.status === 'review' ? 'text-yellow-600' :
                      jd.status === 'declined' ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {jd.status === 'approved' && '✓ Approved'}
                      {jd.status === 'published' && '✓ Published'}
                      {jd.status === 'review' && '⏳ Review'}
                      {jd.status === 'draft' && '📝 Draft'}
                      {jd.status === 'declined' && '❌ Declined'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  No job descriptions found. Generate your first JD using the tools above.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quality Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">Completeness Score</span>
                <span className="font-semibold text-green-600">95%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Industry Alignment</span>
                <span className="font-semibold text-blue-600">92%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Skills Coverage</span>
                <span className="font-semibold text-purple-600">88%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Compliance Rate</span>
                <span className="font-semibold text-orange-600">97%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* OPTIMIZATION: Memoized Dialog Modals for JD Details */}
      <Dialog open={activeDialog === 'all-jds'} onOpenChange={handleDialogClose('all-jds')}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">All Job Descriptions</DialogTitle>
          <JobDescriptionDialog statusFilters={['all']} onActionPerformed={handleJDGenerated} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'approved-jds'} onOpenChange={handleDialogClose('approved-jds')}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Approved Job Descriptions</DialogTitle>
          <JobDescriptionDialog statusFilters={['approved', 'published']} onActionPerformed={handleJDGenerated} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'pending-jds'} onOpenChange={handleDialogClose('pending-jds')}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Pending Review Job Descriptions</DialogTitle>
          <JobDescriptionDialog statusFilters={['draft', 'review']} onActionPerformed={handleJDGenerated} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'active-jds'} onOpenChange={handleDialogClose('active-jds')}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Active Job Descriptions</DialogTitle>
          <JobDescriptionDialog statusFilters={['published']} onActionPerformed={handleJDGenerated} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'declined-jds'} onOpenChange={handleDialogClose('declined-jds')}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Declined Job Descriptions</DialogTitle>
          <JobDescriptionDialog statusFilters={['declined']} onActionPerformed={handleJDGenerated} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default memo(JobDescriptionsDashboard);