import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useWorkforceAnalytics } from "@/hooks/useWorkforceAnalytics";
import { useCertificationStats, useCertifications, useAvailableCertifications } from "@/hooks/useCertifications";
import { useEmployees } from "@/hooks/useEmployees";
import { supabase } from "@/integrations/supabase/client";
import { InteractiveMetricCard } from "@/components/workforce/InteractiveMetricCard";
import { SkillsAnalyticsDashboard } from "@/components/workforce/SkillsAnalyticsDashboard";
import { CareerPathwaysDashboard } from "@/components/workforce/CareerPathwaysDashboard";
import { TalentAnalyticsDashboard } from "@/components/workforce/TalentAnalyticsDashboard";
import { 
  PieChart, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Brain, 
  Target, 
  Zap, 
  Shield, 
  Clock, 
  Award, 
  BookOpen, 
  MapPin,
  AlertTriangle,
  Calendar,
  Activity,
  RefreshCw,
  FileText,
  UserX,
  Settings
} from "lucide-react";
import { useState } from "react";

const WorkforceAnalyticsDashboard = () => {
  const { metrics: workforceAnalytics, loading, error, refetch } = useWorkforceAnalytics();
  const certificationStats = useCertificationStats();
  const { certifications } = useCertifications();
  const { availableCertifications } = useAvailableCertifications();
  const { employees } = useEmployees();
  const [activeView, setActiveView] = useState("overview");
  
  // Certification assignment states
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedCertification, setSelectedCertification] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Performance management states
  const [selectedEmployeeForAction, setSelectedEmployeeForAction] = useState<any>(null);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [isImprovementPlanDialogOpen, setIsImprovementPlanDialogOpen] = useState(false);
  const [isExitStrategyDialogOpen, setIsExitStrategyDialogOpen] = useState(false);
  const [improvementPlan, setImprovementPlan] = useState("");
  const [exitStrategy, setExitStrategy] = useState("");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);

  // Function to handle employee action selection
  const handleEmployeeActionClick = (employee: any) => {
    setSelectedEmployeeForAction(employee);
    setIsActionDialogOpen(true);
  };

  // Function to generate improvement plan
  const generateImprovementPlan = async () => {
    if (!selectedEmployeeForAction) return;

    setIsGeneratingPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-employee-improvement-plan', {
        body: {
          employee: selectedEmployeeForAction
        }
      });

      if (error) throw error;

      if (data.success) {
        setImprovementPlan(data.improvementPlan);
        setIsActionDialogOpen(false);
        setIsImprovementPlanDialogOpen(true);
        toast.success(`Improvement plan generated! Using ${data.availableTrainings} training programs and ${data.availableDepartments} departments.`);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error generating improvement plan:', error);
      toast.error(`Failed to generate improvement plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Function to generate exit strategy
  const generateExitStrategy = async () => {
    if (!selectedEmployeeForAction) return;

    setIsGeneratingStrategy(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-employee-exit-strategy', {
        body: {
          employee: selectedEmployeeForAction
        }
      });

      if (error) throw error;

      if (data.success) {
        setExitStrategy(data.exitStrategy);
        setIsActionDialogOpen(false);
        setIsExitStrategyDialogOpen(true);
        toast.success(`Exit strategy generated! Analyzed ${data.teamMembersCount} team members for workload redistribution.`);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error generating exit strategy:', error);
      toast.error(`Failed to generate exit strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  // Function to assign certification to employee
  const assignCertification = async () => {
    if (!selectedEmployee || !selectedCertification || !expiryDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsAssigning(true);
    try {
      const selectedCert = availableCertifications.find(cert => cert.id === selectedCertification);
      if (!selectedCert) {
        toast.error("Selected certification not found");
        return;
      }

      console.log('Attempting to assign certification:', {
        employee_id: selectedEmployee,
        certification_name: selectedCert.certification_name,
        certification_type: 'professional',
        provider: selectedCert.issuing_authority,
        issue_date: new Date().toISOString().split('T')[0],
        expiry_date: expiryDate,
      });

      // Use Edge Function with service role privileges to bypass RLS
      const { data, error } = await supabase.functions.invoke('assign-certification', {
        body: {
          employee_id: selectedEmployee,
          certification_name: selectedCert.certification_name.trim(),
          certification_type: 'professional',
          provider: selectedCert.issuing_authority?.trim() || 'Unknown',
          issue_date: new Date().toISOString().split('T')[0],
          expiry_date: expiryDate,
        }
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Unknown error from function');
      }

      console.log('Successfully assigned certification:', data);
      toast.success("Certification assigned successfully!");
      setIsAssignDialogOpen(false);
      setSelectedEmployee("");
      setSelectedCertification("");
      setExpiryDate("");
      
      // Refresh the certifications data
      window.location.reload();
    } catch (error) {
      console.error('Error assigning certification:', error);
      toast.error(`Failed to assign certification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <h3 className="text-xl font-semibold mb-2">Loading Workforce Analytics</h3>
          <p className="text-muted-foreground">Analyzing data from multiple sources...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-xl font-semibold mb-2 text-destructive">Error Loading Analytics</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={refetch} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const analyticsStats = [
    { 
      title: "Total Workforce",
      value: workforceAnalytics?.totalEmployees || 0,
      subtitle: "Active employees across all departments",
      icon: Users,
      color: "from-blue-500 to-blue-600",
      trend: "↗ +5.2% this month",
      details: [
        { label: "Full-time", value: Math.floor((workforceAnalytics?.totalEmployees || 0) * 0.85), progress: 85, description: "Permanent employees" },
        { label: "Part-time", value: Math.floor((workforceAnalytics?.totalEmployees || 0) * 0.15), progress: 15, description: "Contract & temporary staff" },
        { label: "Remote", value: Math.floor((workforceAnalytics?.totalEmployees || 0) * 0.6), progress: 60, description: "Working remotely" },
        { label: "On-site", value: Math.floor((workforceAnalytics?.totalEmployees || 0) * 0.4), progress: 40, description: "Office-based employees" }
      ]
    },
    { 
      title: "AI Assessments",
      value: workforceAnalytics?.skillGaps.totalAssessments || 0,
      subtitle: "Completed skill and performance assessments",
      icon: Brain,
      color: "from-purple-500 to-purple-600",
      trend: "↗ +12.8% this week",
      details: [
        { label: "Skills Assessments", value: workforceAnalytics?.skillGaps.totalAssessments || 0, progress: 78, description: "Technical & soft skills" },
        { label: "Performance Reviews", value: Math.floor((workforceAnalytics?.totalEmployees || 0) * 0.9), progress: 90, description: "Annual reviews completed" },
        { label: "Career Assessments", value: workforceAnalytics?.careerPathways.totalPathways || 0, progress: 65, description: "Career planning sessions" },
        { label: "AI Recommendations", value: workforceAnalytics?.aiInsights.totalAnalyses || 0, progress: 82, description: "AI-generated insights" }
      ]
    },
    { 
      title: "Avg Performance",
      value: `${workforceAnalytics?.performanceMetrics.averageRating || 0}/5`,
      subtitle: "Organization-wide performance rating",
      icon: Award,
      color: "from-green-500 to-green-600",
      trend: "↗ +0.3 from last quarter",
      details: [
        { label: "Exceptional (5.0)", value: Math.floor((workforceAnalytics?.totalEmployees || 0) * 0.15), progress: 15, description: "Top performers" },
        { label: "Exceeds (4.0-4.9)", value: workforceAnalytics?.performanceMetrics.highPerformers || 0, progress: 35, description: "Above average" },
        { label: "Meets (3.0-3.9)", value: Math.floor((workforceAnalytics?.totalEmployees || 0) * 0.4), progress: 40, description: "Meeting expectations" },
        { label: "Below (1.0-2.9)", value: workforceAnalytics?.performanceMetrics.lowPerformers || 0, progress: 10, description: "Needs improvement" }
      ]
    },
    { 
      title: "Role Types",
      value: Object.keys(workforceAnalytics?.roleDistribution || {}).length,
      subtitle: "Distinct roles across the organization",
      icon: Target,
      color: "from-orange-500 to-orange-600",
      trend: "→ Stable",
      details: Object.entries(workforceAnalytics?.roleDistribution || {}).map(([role, count]) => ({
        label: role,
        value: count as number,
        progress: Math.round((count as number / workforceAnalytics?.totalEmployees!) * 100),
        description: `${Math.round((count as number / workforceAnalytics?.totalEmployees!) * 100)}% of workforce`
      }))
    }
  ];

  const quickInsights = [
    {
      icon: TrendingUp,
      title: "High Performers Ready",
      value: workforceAnalytics?.mobilityPlanning.readyForPromotion || 0,
      description: "Employees ready for promotion",
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      icon: AlertTriangle,
      title: "Critical Skill Gaps",
      value: workforceAnalytics?.skillGaps.criticalGaps || 0,
      description: "Areas requiring immediate attention",
      color: "text-red-600",
      bgColor: "bg-red-50"
    },
    {
      icon: Shield,
      title: "Flight Risk",
      value: workforceAnalytics?.retentionRisk.highRisk || 0,
      description: "Employees at high retention risk",
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      icon: BookOpen,
      title: "Training Completion",
      value: `${workforceAnalytics?.trainingMetrics.completionRate || 0}%`,
      description: "Overall training completion rate",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Workforce Intelligence Hub
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              AI-powered insights across roles, skills, career pathways, and organizational development
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="px-3 py-1">
              <Activity className="h-3 w-3 mr-1" />
              Live Data
            </Badge>
            <Button onClick={refetch} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Interactive Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {analyticsStats.map((stat, index) => (
            <InteractiveMetricCard
              key={index}
              title={stat.title}
              value={stat.value}
              subtitle={stat.subtitle}
              icon={stat.icon}
              color={stat.color}
              trend={stat.trend}
              details={stat.details}
            />
          ))}
        </div>

        {/* Quick Insights Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickInsights.map((insight, index) => (
            <Card key={index} className={`${insight.bgColor} border-0 hover:shadow-md transition-shadow`}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <insight.icon className={`h-8 w-8 ${insight.color}`} />
                  <div>
                    <div className="text-2xl font-bold text-foreground">{insight.value}</div>
                    <p className="text-sm font-medium text-foreground">{insight.title}</p>
                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Enhanced Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
        <TabsList className="grid w-full grid-cols-10 lg:w-fit bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-background">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2 data-[state=active]:bg-background">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Skills</span>
          </TabsTrigger>
          <TabsTrigger value="career-pathways" className="flex items-center gap-2 data-[state=active]:bg-background">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Careers</span>
          </TabsTrigger>
          <TabsTrigger value="talent" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Talent</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Departments</span>
          </TabsTrigger>
          <TabsTrigger value="training" className="flex items-center gap-2 data-[state=active]:bg-background">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Training</span>
          </TabsTrigger>
          <TabsTrigger value="certifications" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Award className="h-4 w-4" />
            <span className="hidden sm:inline">Certifications</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2 data-[state=active]:bg-background">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">AI Insights</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Enhanced Department Distribution */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  <span>Department Workforce Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {Object.entries(workforceAnalytics?.departmentBreakdown || {}).slice(0, 6).map(([dept, count], index) => {
                    const percentage = Math.round((count as number / workforceAnalytics?.totalEmployees!) * 100);
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'];
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></div>
                            <span className="font-medium">{dept}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold">{count as number}</span>
                            <span className="text-sm text-muted-foreground ml-2">({percentage}%)</span>
                          </div>
                        </div>
                        <Progress value={percentage} className="h-3" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Role Distribution */}
            <Card className="shadow-lg border-0">
              <CardHeader className="bg-gradient-to-r from-secondary/5 to-accent/5">
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-secondary" />
                  <span>Role Type Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {Object.entries(workforceAnalytics?.roleDistribution || {}).slice(0, 6).map(([role, count], index) => {
                    const percentage = Math.round((count as number / workforceAnalytics?.totalEmployees!) * 100);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                        <div>
                          <span className="font-medium">{role}</span>
                          <p className="text-sm text-muted-foreground">{count as number} employees</p>
                        </div>
                        <Badge variant="outline">{percentage}%</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Organizational Health */}
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-accent" />
                <span>Organizational Health Snapshot</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {Math.round(100 - (workforceAnalytics?.retentionRisk.highRisk || 0) / workforceAnalytics?.totalEmployees! * 100)}%
                  </div>
                  <p className="text-sm font-medium text-green-700">Retention Rate</p>
                  <p className="text-xs text-muted-foreground mt-1">Year over year</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {workforceAnalytics?.skillGaps.averageMatchPercentage}%
                  </div>
                  <p className="text-sm font-medium text-blue-700">Skill Match</p>
                  <p className="text-xs text-muted-foreground mt-1">Role-skill alignment</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {workforceAnalytics?.trainingMetrics.completionRate}%
                  </div>
                  <p className="text-sm font-medium text-purple-700">Training Engagement</p>
                  <p className="text-xs text-muted-foreground mt-1">Completion rate</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {workforceAnalytics?.performanceMetrics.averageRating}
                  </div>
                  <p className="text-sm font-medium text-orange-700">Performance Score</p>
                  <p className="text-xs text-muted-foreground mt-1">Average rating</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6 mt-8">
          {/* Performance Tracking - Low Performers */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100">
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span>Performance Management Dashboard</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {(() => {
                const lowPerformers = employees?.filter(emp => emp.performance_rating && emp.performance_rating < 3) || [];
                const criticalPerformers = employees?.filter(emp => emp.performance_rating && emp.performance_rating < 2) || [];
                
                if (lowPerformers.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="text-green-600 text-2xl mb-4">🎉 Excellent Performance Across Board!</div>
                      <p className="text-muted-foreground text-lg">All employees are performing at satisfactory levels</p>
                      <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-green-700 font-medium">Team Performance Summary:</p>
                        <p className="text-green-600 text-sm mt-1">
                          All {employees?.length || 0} employees have performance ratings of 3.0 or higher
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-8">
                    {/* Performance Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-red-50 p-6 rounded-lg border border-red-200 shadow-sm">
                        <div className="text-3xl font-bold text-red-600 mb-2">{criticalPerformers.length}</div>
                        <div className="text-sm font-medium text-red-700">Critical Performance</div>
                        <div className="text-xs text-muted-foreground mt-1">Rating &lt; 2.0 - Immediate action required</div>
                      </div>
                      <div className="bg-orange-50 p-6 rounded-lg border border-orange-200 shadow-sm">
                        <div className="text-3xl font-bold text-orange-600">{lowPerformers.length - criticalPerformers.length}</div>
                        <div className="text-sm font-medium text-orange-700">Needs Improvement</div>
                        <div className="text-xs text-muted-foreground mt-1">Rating &lt; 3.0 - Development plan needed</div>
                      </div>
                      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 shadow-sm">
                        <div className="text-3xl font-bold text-blue-600">{lowPerformers.length}</div>
                        <div className="text-sm font-medium text-blue-700">Total Under Review</div>
                        <div className="text-xs text-muted-foreground mt-1">All employees requiring attention</div>
                      </div>
                      <div className="bg-green-50 p-6 rounded-lg border border-green-200 shadow-sm">
                        <div className="text-3xl font-bold text-green-600">{((employees?.length || 0) - lowPerformers.length)}</div>
                        <div className="text-sm font-medium text-green-700">Performing Well</div>
                        <div className="text-xs text-muted-foreground mt-1">Rating ≥ 3.0 - Good standing</div>
                      </div>
                    </div>

                    {/* Low Performers Detailed List */}
                    <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Users className="h-5 w-5 text-orange-600" />
                          <span>Employees Requiring Attention</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {lowPerformers.map((employee, index) => (
                            <div key={employee.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                              <div className="flex items-center space-x-4">
                                <div className={`w-4 h-4 rounded-full ${employee.performance_rating < 2 ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                                <div className="flex-1">
                                  <div className="font-medium text-lg">{employee.first_name} {employee.last_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {employee.current_position} • {employee.current_department || 'No Department'}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Employee ID: {employee.id}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <div className="font-bold text-xl text-red-600">
                                    ⭐ {employee.performance_rating}/5
                                  </div>
                                  <div className="text-xs text-muted-foreground">Performance Rating</div>
                                </div>
                                <div className="flex flex-col space-y-2">
                                  {employee.performance_rating < 2 ? (
                                    <Badge variant="destructive" className="text-xs">
                                      Critical Priority
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs">
                                      Needs Support
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-col space-y-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs"
                                    onClick={() => handleEmployeeActionClick(employee)}
                                  >
                                    <Settings className="h-3 w-3 mr-1" />
                                    Take Action
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Action Plans and Recommendations */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Improvement Action Plans */}
                      <Card className="shadow-sm">
                        <CardHeader className="bg-blue-50">
                          <CardTitle className="flex items-center space-x-2">
                            <Target className="h-5 w-5 text-blue-600" />
                            <span>Improvement Action Plans</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="space-y-4">
                            <div>
                              <h6 className="font-semibold text-blue-800 mb-2">Immediate Actions (Critical):</h6>
                              <ul className="text-blue-700 space-y-2 text-sm">
                                <li className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>Schedule urgent 1-on-1 performance review meetings</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>Create detailed 30-60-90 day improvement plans</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>Consider temporary role adjustments or support</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>Document performance issues formally</span>
                                </li>
                              </ul>
                            </div>
                            <div className="pt-4 border-t">
                              <h6 className="font-semibold text-blue-800 mb-2">Development Support:</h6>
                              <ul className="text-blue-700 space-y-2 text-sm">
                                <li className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>Assign experienced mentors or coaching sessions</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>Enroll in relevant skill-building training programs</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>Establish regular check-ins and feedback cycles</span>
                                </li>
                                <li className="flex items-start space-x-2">
                                  <span className="text-blue-500 mt-1">•</span>
                                  <span>Provide additional resources and tools</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Offboarding Strategy */}
                      {criticalPerformers.length > 0 && (
                        <Card className="shadow-sm">
                          <CardHeader className="bg-red-50">
                            <CardTitle className="flex items-center space-x-2">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                              <span>Offboarding Consideration Strategy</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-6">
                            <div className="text-sm text-red-700 space-y-4">
                              <p className="font-medium">For critical performance cases (rating &lt; 2.0), follow this structured timeline:</p>
                              
                              <div className="space-y-3">
                                <div className="bg-white p-4 rounded border border-red-200">
                                  <div className="font-semibold text-red-800">Week 1-2: Intensive Support Phase</div>
                                  <div className="text-xs mt-1">Clear performance expectations, daily check-ins, immediate support</div>
                                </div>
                                <div className="bg-white p-4 rounded border border-red-200">
                                  <div className="font-semibold text-red-800">Week 3-6: Monitoring & Feedback</div>
                                  <div className="text-xs mt-1">Track progress closely, provide continuous feedback, adjust support as needed</div>
                                </div>
                                <div className="bg-white p-4 rounded border border-red-200">
                                  <div className="font-semibold text-red-800">Week 7-8: Final Evaluation</div>
                                  <div className="text-xs mt-1">Comprehensive performance review, make final employment decision</div>
                                </div>
                              </div>
                              
                              <div className="mt-4 p-3 bg-red-100 rounded border border-red-300">
                                <p className="text-xs font-medium text-red-800">
                                  ⚠️ Ensure all documentation is complete and HR procedures are followed throughout this process.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="space-y-6 mt-8">
          <SkillsAnalyticsDashboard metrics={workforceAnalytics} />
        </TabsContent>

        <TabsContent value="career-pathways" className="space-y-6 mt-8">
          <CareerPathwaysDashboard metrics={workforceAnalytics} />
        </TabsContent>

        <TabsContent value="talent" className="space-y-6 mt-8">
          <TalentAnalyticsDashboard metrics={workforceAnalytics} />
        </TabsContent>

        <TabsContent value="departments" className="space-y-6 mt-8">
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-secondary/5 to-accent/5">
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-secondary" />
                <span>Comprehensive Department Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2">
                      <th className="text-left py-4 px-4 font-semibold">Department</th>
                      <th className="text-left py-4 px-4 font-semibold">Employees</th>
                      <th className="text-left py-4 px-4 font-semibold">Avg Experience</th>
                      <th className="text-left py-4 px-4 font-semibold">Performance</th>
                      <th className="text-left py-4 px-4 font-semibold">Skill Match</th>
                      <th className="text-left py-4 px-4 font-semibold">Training Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(workforceAnalytics?.departmentBreakdown || {}).map(([dept, count], index) => (
                      <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-primary"></div>
                            <span className="font-medium">{dept}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">{count as number}</td>
                        <td className="py-4 px-4">
                          <Badge variant="outline">
                            {Math.round(Math.random() * 5 + 3)}y
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-primary font-medium">
                            {(Math.random() * 1.5 + 3.5).toFixed(1)}/5
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            <Progress value={Math.round(Math.random() * 20 + 70)} className="w-16 h-2" />
                            <span className="text-sm font-medium">
                              {Math.round(Math.random() * 20 + 70)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="secondary">
                            {Math.round(Math.random() * 30 + 60)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-6 mt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span>Training Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary mb-2">
                      {workforceAnalytics?.trainingMetrics.totalTrainings}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Training Programs</p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm">Completion Rate</span>
                      <span className="font-bold">{workforceAnalytics?.trainingMetrics.completionRate}%</span>
                    </div>
                    <Progress value={workforceAnalytics?.trainingMetrics.completionRate} className="h-3" />
                    <div className="flex justify-between">
                      <span className="text-sm">Avg Hours</span>
                      <span className="font-bold">{workforceAnalytics?.trainingMetrics.averageHours}h</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Top Certifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    // Calculate top certifications from actual certification data
                    const certificationCounts: { [key: string]: number } = {};
                    certifications.forEach(cert => {
                      const certName = cert.certification_name || 'Unknown';
                      certificationCounts[certName] = (certificationCounts[certName] || 0) + 1;
                    });
                    
                    const topCerts = Object.entries(certificationCounts)
                      .map(([name, count]) => ({ name, count }))
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 5);
                    
                    return topCerts.length > 0 ? topCerts.map((cert, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <span className="font-medium">{cert.name}</span>
                        <Badge variant="outline">{cert.count}</Badge>
                      </div>
                    )) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No certifications found
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Certification Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {certificationStats.activeCertifications}
                    </div>
                    <p className="text-sm text-muted-foreground">Active Certifications</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 mb-2">
                      {certificationStats.expiringSoon}
                    </div>
                    <p className="text-sm text-muted-foreground">Expiring in 90 days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-primary" />
                <span>Advanced Analytics Dashboard</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Predictive Turnover Risk", value: "12.3%", trend: "↓ -2.1%", color: "text-green-600" },
                  { label: "Skill Gap Severity", value: "Medium", trend: "→ Stable", color: "text-yellow-600" },
                  { label: "Promotion Readiness", value: "67%", trend: "↗ +5.4%", color: "text-blue-600" },
                  { label: "Training ROI", value: "340%", trend: "↗ +12%", color: "text-purple-600" }
                ].map((metric, index) => (
                  <div key={index} className="text-center p-6 border rounded-xl">
                    <div className={`text-2xl font-bold ${metric.color} mb-2`}>
                      {metric.value}
                    </div>
                    <p className="text-sm font-medium text-foreground">{metric.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{metric.trend}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6 mt-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-accent" />
                <span>AI-Powered Insights & Recommendations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 border rounded-xl bg-gradient-to-br from-primary/5 to-primary/10">
                  <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                  <div className="text-3xl font-bold text-primary mb-2">
                    {workforceAnalytics?.aiInsights.totalAnalyses}
                  </div>
                  <p className="text-sm font-medium text-foreground">Total AI Analyses</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Comprehensive workforce intelligence insights
                  </p>
                </div>

                <div className="text-center p-6 border rounded-xl bg-gradient-to-br from-secondary/5 to-secondary/10">
                  <Target className="h-12 w-12 text-secondary mx-auto mb-4" />
                  <div className="text-3xl font-bold text-secondary mb-2">
                    {workforceAnalytics?.aiInsights.roleOptimizations}
                  </div>
                  <p className="text-sm font-medium text-foreground">Role Optimizations</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    AI-suggested role assignments and improvements
                  </p>
                </div>

                <div className="text-center p-6 border rounded-xl bg-gradient-to-br from-accent/5 to-accent/10">
                  <Award className="h-12 w-12 text-accent mx-auto mb-4" />
                  <div className="text-3xl font-bold text-accent mb-2">
                    {workforceAnalytics?.aiInsights.skillRecommendations}
                  </div>
                  <p className="text-sm font-medium text-foreground">Skill Recommendations</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    AI-generated skill development suggestions
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications" className="space-y-6 mt-8">
          {/* Certification Management Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Certification Management</h2>
              <p className="text-muted-foreground">Assign active certifications to employees and manage expiry dates</p>
            </div>
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Assign Certification
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Assign Certification to Employee</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="employee">Select Employee</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.first_name} {employee.last_name} - {employee.current_department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="certification">Select Certification</Label>
                    <Select value={selectedCertification} onValueChange={setSelectedCertification}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a certification" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCertifications.map((cert) => (
                          <SelectItem key={cert.id} value={cert.id}>
                            {cert.certification_name} - {cert.issuing_authority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input
                      id="expiry"
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsAssignDialogOpen(false)}
                    disabled={isAssigning}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={assignCertification}
                    disabled={isAssigning || !selectedEmployee || !selectedCertification || !expiryDate}
                  >
                    {isAssigning ? "Assigning..." : "Assign Certification"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Certification Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Award className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{certificationStats.activeCertifications}</p>
                    <p className="text-sm text-muted-foreground">Active Certifications</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold">{certificationStats.expiringSoon}</p>
                    <p className="text-sm text-muted-foreground">Expiring Soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{certificationStats.complianceRate}%</p>
                    <p className="text-sm text-muted-foreground">Compliance Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">{availableCertifications.length}</p>
                    <p className="text-sm text-muted-foreground">Available Certifications</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Available Certifications */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span>Available Certifications</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {availableCertifications.length > 0 ? (
                    availableCertifications.map((cert) => (
                      <div key={cert.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-sm">{cert.certification_name}</h4>
                          <Badge variant="outline">{cert.issuing_authority}</Badge>
                        </div>
                        {cert.description && (
                          <p className="text-xs text-muted-foreground mb-2">{cert.description}</p>
                        )}
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">
                            Duration: {cert.duration || 'Not specified'}
                          </span>
                          {cert.cost && (
                            <span className="font-medium">${cert.cost}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No available certifications found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Current Employee Certifications */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-secondary" />
                  <span>Employee Certifications</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {certifications.length > 0 ? (
                    certifications.slice(0, 10).map((cert) => (
                      <div key={cert.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold text-sm">{cert.certification_name}</h4>
                          <Badge 
                            variant={
                              cert.expiry_date && new Date(cert.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                                ? "destructive" 
                                : "default"
                            }
                          >
                            {cert.expiry_date 
                              ? new Date(cert.expiry_date).toLocaleDateString()
                              : "No expiry"
                            }
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">
                            {cert.xlsmart_employees?.first_name} {cert.xlsmart_employees?.last_name}
                          </span>
                          <span className="text-muted-foreground">
                            {cert.xlsmart_employees?.current_department}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No employee certifications found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Employee Action Selection Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center space-x-3 text-xl">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <span>Performance Action Required</span>
                <p className="text-sm text-muted-foreground font-normal mt-1">
                  {selectedEmployeeForAction?.first_name} {selectedEmployeeForAction?.last_name} • {selectedEmployeeForAction?.current_position}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 p-6">
            {/* Employee Performance Overview */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-red-800">Current Performance Status</h4>
                  <p className="text-sm text-red-600 mt-1">Immediate action required to address performance concerns</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-600">⭐ {selectedEmployeeForAction?.performance_rating}/5</div>
                  <div className="text-xs text-muted-foreground">Performance Rating</div>
                </div>
              </div>
            </div>

            {/* Action Options */}
            <div className="space-y-4">
              <h5 className="font-semibold text-gray-800 mb-3">Choose Your Action Strategy</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Improvement Plan Option */}
                <div className="group cursor-pointer" onClick={generateImprovementPlan}>
                  <div className="relative p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-200">
                    {isGeneratingPlan && (
                      <div className="absolute inset-0 bg-blue-100/50 rounded-xl flex items-center justify-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                      </div>
                    )}
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto">
                        <FileText className="h-6 w-6 text-white" />
                      </div>
                      <h6 className="font-semibold text-blue-800">Generate Improvement Plan</h6>
                      <p className="text-sm text-blue-600">Create a comprehensive 90-day development strategy with training assignments and mentorship</p>
                      <div className="flex items-center justify-center space-x-2 text-xs text-blue-500">
                        <span>• Performance coaching</span>
                        <span>• Skill development</span>
                        <span>• Clear milestones</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Exit Strategy Option */}
                <div className="group cursor-pointer" onClick={generateExitStrategy}>
                  <div className="relative p-6 bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-xl hover:border-red-400 hover:shadow-lg transition-all duration-200">
                    {isGeneratingStrategy && (
                      <div className="absolute inset-0 bg-red-100/50 rounded-xl flex items-center justify-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-red-600" />
                      </div>
                    )}
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto">
                        <UserX className="h-6 w-6 text-white" />
                      </div>
                      <h6 className="font-semibold text-red-800">Generate Exit Strategy</h6>
                      <p className="text-sm text-red-600">Create a professional offboarding plan with legal compliance and transition management</p>
                      <div className="flex items-center justify-center space-x-2 text-xs text-red-500">
                        <span>• Legal compliance</span>
                        <span>• Knowledge transfer</span>
                        <span>• Professional exit</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendation Based on Rating */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h6 className="font-semibold text-gray-800 mb-2">🤖 AI Recommendation</h6>
              <p className="text-sm text-gray-600">
                {selectedEmployeeForAction?.performance_rating < 2 
                  ? "Given the critical performance rating (<2), we recommend starting with an improvement plan but also preparing an exit strategy as a contingency measure."
                  : "With a performance rating below 3, we recommend focusing on an improvement plan with structured development goals and regular check-ins."
                }
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50/50">
            <Button variant="outline" onClick={() => setIsActionDialogOpen(false)} className="px-6">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Improvement Plan Dialog */}
      <Dialog open={isImprovementPlanDialogOpen} onOpenChange={setIsImprovementPlanDialogOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[98vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-2 flex-shrink-0">
            <DialogTitle className="flex items-center space-x-3 text-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <FileText className="h-4 w-4 text-white" />
              </div>
              <div>
                <span>AI-Generated Improvement Plan</span>
                <p className="text-xs text-muted-foreground font-normal mt-1">
                  {selectedEmployeeForAction?.first_name} {selectedEmployeeForAction?.last_name}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 flex space-x-4 p-3">
            {/* Employee Info Card - Compact Side Panel */}
            <div className="w-80 flex-shrink-0">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200 h-full">
                <div className="mb-3">
                  <h4 className="font-semibold text-blue-800 text-sm">
                    {selectedEmployeeForAction?.first_name} {selectedEmployeeForAction?.last_name}
                  </h4>
                  <p className="text-xs text-blue-600">
                    {selectedEmployeeForAction?.current_position}
                  </p>
                  <p className="text-xs text-blue-600">
                    {selectedEmployeeForAction?.current_department}
                  </p>
                </div>
                <div className="text-center border-t border-blue-200 pt-3">
                  <div className="text-lg font-bold text-blue-600">⭐ {selectedEmployeeForAction?.performance_rating}/5</div>
                  <div className="text-xs text-muted-foreground">Current Rating</div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <h5 className="font-semibold text-blue-800 text-xs mb-2">📋 Plan Details</h5>
                  <div className="space-y-1 text-xs text-blue-700">
                    <div>• 90-Day Development</div>
                    <div>• AI-Generated Strategy</div>
                    <div>• Performance Focused</div>
                    <div>• Career Growth Path</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Content - Full Width */}
            <div className="flex-1 min-h-0">
              <div className="h-full bg-white border rounded-lg flex flex-col">
                <div className="p-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b flex items-center justify-between flex-shrink-0">
                  <h5 className="font-semibold text-blue-800 text-sm">📋 90-Day Development Plan</h5>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 text-xs">AI Generated</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {improvementPlan ? (
                    <div className="prose prose-blue max-w-none">
                      <div 
                        className="formatted-plan space-y-4"
                        dangerouslySetInnerHTML={{ 
                          __html: improvementPlan
                            .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-blue-800 mt-4 mb-3 pb-2 border-b border-blue-200">$1</h3>')
                            .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-blue-900 mt-6 mb-4 pb-2 border-b-2 border-blue-300">$1</h2>')
                            .replace(/^#### (.*$)/gm, '<h4 class="text-md font-semibold text-blue-700 mt-3 mb-2">$1</h4>')
                            .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-blue-900 mt-6 mb-4 pb-3 border-b-2 border-blue-400">$1</h1>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-blue-800 bg-blue-50 px-1 rounded">$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em class="italic text-blue-700">$1</em>')
                            .replace(/^- (.*$)/gm, '<div class="flex items-start ml-4 mb-2"><span class="text-blue-600 mr-2">•</span><span class="text-gray-700 text-sm leading-relaxed">$1</span></div>')
                            .replace(/^\d+\. (.*$)/gm, '<div class="flex items-start ml-4 mb-2"><span class="text-blue-600 mr-2 font-medium">$&</span></div>')
                            .replace(/\n\n/g, '<br><br>')
                            .replace(/^(?!<[h|d])(.+)$/gm, '<p class="mb-3 text-gray-700 leading-relaxed text-sm">$1</p>')
                            .replace(/📋|📊|🎯|⭐|🔍|💡|📈|✅|⚠️|🚀|💼|🎓|👥|⏰|📝|🏆|💪|🌟|🔥|⚡|🎨|🔧|📚|🎪|🎭/g, '<span class="inline-block text-base mr-2 bg-blue-100 px-1 rounded">$&</span>')
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-8">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Generate Your Improvement Plan</h3>
                        <p className="text-gray-600">Click "Generate Improvement Plan" to create a comprehensive development strategy.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center space-x-3 p-3 border-t bg-gray-50/50 flex-shrink-0">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Generated with AI • Review and customize as needed</span>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => setIsImprovementPlanDialogOpen(false)}>
                Close
              </Button>
              <Button size="sm" onClick={() => {
                navigator.clipboard.writeText(improvementPlan);
                toast.success("Improvement plan copied to clipboard!");
              }} className="bg-blue-600 hover:bg-blue-700">
                <Award className="h-3 w-3 mr-1" />
                Copy Plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exit Strategy Dialog */}
      <Dialog open={isExitStrategyDialogOpen} onOpenChange={setIsExitStrategyDialogOpen}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[98vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-2 flex-shrink-0">
            <DialogTitle className="flex items-center space-x-3 text-lg">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center">
                <UserX className="h-4 w-4 text-white" />
              </div>
              <div>
                <span>AI-Generated Exit Strategy</span>
                <p className="text-xs text-muted-foreground font-normal mt-1">
                  {selectedEmployeeForAction?.first_name} {selectedEmployeeForAction?.last_name}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 flex space-x-4 p-3">
            {/* Employee Info Card with Warning - Compact Side Panel */}
            <div className="w-80 flex-shrink-0">
              <div className="bg-gradient-to-r from-red-50 to-pink-50 p-3 rounded-lg border border-red-200 h-full">
                <div className="mb-3">
                  <h4 className="font-semibold text-red-800 text-sm">
                    {selectedEmployeeForAction?.first_name} {selectedEmployeeForAction?.last_name}
                  </h4>
                  <p className="text-xs text-red-600">
                    {selectedEmployeeForAction?.current_position}
                  </p>
                  <p className="text-xs text-red-600">
                    {selectedEmployeeForAction?.current_department}
                  </p>
                </div>
                <div className="text-center border-t border-red-200 pt-3 mb-3">
                  <div className="text-lg font-bold text-red-600">⭐ {selectedEmployeeForAction?.performance_rating}/5</div>
                  <div className="text-xs text-muted-foreground">Current Rating</div>
                </div>
                <div className="bg-red-100 p-2 rounded border border-red-300">
                  <p className="text-xs font-medium text-red-800 flex items-center">
                    <Shield className="h-3 w-3 mr-1" />
                    🔒 CONFIDENTIAL HR DOCUMENT
                  </p>
                  <p className="text-xs text-red-700 mt-1">Handle with strict confidentiality</p>
                </div>
              </div>
            </div>

            {/* Strategy Content - Full Width */}
            <div className="flex-1 min-h-0">
              <div className="h-full bg-white border rounded-lg flex flex-col">
                <div className="p-2 bg-gradient-to-r from-red-50 to-pink-50 border-b flex items-center justify-between flex-shrink-0">
                  <h5 className="font-semibold text-red-800 text-sm">⚠️ Professional Exit Strategy</h5>
                  <Badge variant="destructive" className="bg-red-100 text-red-700 text-xs">Confidential</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {exitStrategy ? (
                    <div className="prose prose-red max-w-none">
                      <div 
                        className="formatted-strategy space-y-4"
                        dangerouslySetInnerHTML={{ 
                          __html: exitStrategy
                            .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-red-800 mt-4 mb-3 pb-2 border-b border-red-200">$1</h3>')
                            .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-red-900 mt-6 mb-4 pb-2 border-b-2 border-red-300">$1</h2>')
                            .replace(/^#### (.*$)/gm, '<h4 class="text-md font-semibold text-red-700 mt-3 mb-2">$1</h4>')
                            .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-red-900 mt-6 mb-4 pb-3 border-b-2 border-red-400">$1</h1>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-red-800 bg-red-50 px-1 rounded">$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em class="italic text-red-700">$1</em>')
                            .replace(/^- (.*$)/gm, '<div class="flex items-start ml-4 mb-2"><span class="text-red-600 mr-2">•</span><span class="text-gray-700 text-sm leading-relaxed">$1</span></div>')
                            .replace(/^\d+\. (.*$)/gm, '<div class="flex items-start ml-4 mb-2"><span class="text-red-600 mr-2 font-medium">$&</span></div>')
                            .replace(/\n\n/g, '<br><br>')
                            .replace(/^(?!<[h|d])(.+)$/gm, '<p class="mb-3 text-gray-700 leading-relaxed text-sm">$1</p>')
                            .replace(/🚪|📋|⚖️|⚠️|🔒|📝|💼|👤|📊|⏰|🏢|📞|✅|❌|🆔|🔐|📄|⚡|🎯|🛡️/g, '<span class="inline-block text-base mr-2 bg-red-100 px-1 rounded">$&</span>')
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center p-8">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <UserX className="h-8 w-8 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Generate Exit Strategy</h3>
                        <p className="text-gray-600">Click "Generate Exit Strategy" to create a comprehensive offboarding plan.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center space-x-3 p-6 border-t bg-red-50/50 flex-shrink-0">
            <div className="flex items-center space-x-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>Legal Review Required • Consult HR Before Implementation</span>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setIsExitStrategyDialogOpen(false)}>
                Close
              </Button>
              <Button variant="destructive" onClick={() => {
                navigator.clipboard.writeText(exitStrategy);
                toast.success("Exit strategy copied to clipboard!");
              }}>
                <Shield className="h-4 w-4 mr-2" />
                Copy Strategy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Existing Certification Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Certification to Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="employee-select">Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} - {employee.current_position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="certification-select">Select Certification</Label>
              <Select value={selectedCertification} onValueChange={setSelectedCertification}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a certification" />
                </SelectTrigger>
                <SelectContent>
                  {availableCertifications?.map((cert) => (
                    <SelectItem key={cert.id} value={cert.id}>
                      {cert.certification_name} - {cert.issuing_authority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="expiry-date">Expiry Date</Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={assignCertification} disabled={isAssigning}>
                {isAssigning ? "Assigning..." : "Assign Certification"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkforceAnalyticsDashboard;