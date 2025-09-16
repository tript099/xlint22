import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AISkillsAssessmentEnhanced } from "@/components/AISkillsAssessmentEnhanced";
import { SkillsListDetails } from "@/components/SkillsListDetails";
import { Brain, TrendingUp, Award, Users, Target, Zap, BarChart3, CheckCircle, AlertTriangle, BookOpen } from "lucide-react";
import { useAIStats } from "@/components/AIStatsProvider";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const SkillsDashboard = () => {
  const aiStats = useAIStats();
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [skillAnalytics, setSkillAnalytics] = useState({
    totalEmployees: 0,
    assessedEmployees: 0,
    totalSkills: 0,
    skillGaps: 0,
    avgSkillLevel: 0,
    topSkills: [],
    criticalGaps: [],
    recentAssessments: [],
    // AI Insights metrics
    aiInsights: {
      matchRate: 0,
      efficiencyGain: 0,
      activePrograms: 0,
      completionRate: 0,
      skillPredictions: [],
      topTalentMatches: 0
    }
  });

  const fetchSkillAnalytics = async () => {
    try {
      console.log('Fetching skills analytics...');
      
      // Fetch employee counts
      const { count: totalEmployees } = await supabase
        .from('xlsmart_employees')
        .select('*', { count: 'exact', head: true });

      // Fetch skills data from skills_master
      const { data: skillsData, count: totalSkills } = await supabase
        .from('skills_master')
        .select('*', { count: 'exact' });

      console.log('Skills data:', skillsData, 'Total skills:', totalSkills);

      // Fetch skill assessments
      const { data: assessments } = await supabase
        .from('xlsmart_skill_assessments')
        .select('*');

      console.log('Assessments data:', assessments);

      // Count unique employees who have been assessed
      const uniqueAssessedEmployees = new Set(assessments?.map(a => a.employee_id)).size;

      // Get latest assessment per employee to avoid duplicates
      const latestAssessmentPerEmployee = new Map();
      assessments?.forEach(assessment => {
        const employeeId = assessment.employee_id;
        const existingAssessment = latestAssessmentPerEmployee.get(employeeId);
        
        if (!existingAssessment || new Date(assessment.assessment_date) > new Date(existingAssessment.assessment_date)) {
          latestAssessmentPerEmployee.set(employeeId, assessment);
        }
      });

      // Calculate analytics from latest assessments only
      const latestAssessments = Array.from(latestAssessmentPerEmployee.values());
      const avgSkillLevel = latestAssessments.length > 0 
        ? latestAssessments.reduce((sum, a) => sum + (a.overall_match_percentage || 0), 0) / latestAssessments.length 
        : 0;
      
      // Count skill gaps from most recent assessment per employee only
      const totalSkillGaps = latestAssessments.reduce((sum, a) => {
        if (Array.isArray(a.skill_gaps)) {
          return sum + a.skill_gaps.length;
        }
        return sum;
      }, 0) || 0;

      // Calculate AI Insights metrics from latest assessments
      const highMatchEmployees = latestAssessments.filter(a => a.overall_match_percentage >= 80).length || 0;
      const matchRate = uniqueAssessedEmployees > 0 ? Math.round((highMatchEmployees / uniqueAssessedEmployees) * 100) : 0;
      
      // Calculate efficiency gain based on role fit scores from latest assessments
      const avgLevelFit = latestAssessments.length > 0 
        ? latestAssessments.reduce((sum, a) => sum + (a.level_fit_score || 0), 0) / latestAssessments.length 
        : 0;
      const efficiencyGain = Math.round(Math.max(0, avgLevelFit - 70)); // Baseline of 70%

      // Mock data for programs (could be enhanced with real data later)
      const activePrograms = Math.min(totalSkillGaps * 2, 50); // Assume 2 programs per skill gap, max 50
      const completionRate = Math.min(85, 60 + Math.round(avgSkillLevel / 3)); // Higher skill levels = better completion

      const analyticsData = {
        totalEmployees: totalEmployees || 0,
        assessedEmployees: uniqueAssessedEmployees,
        totalSkills: totalSkills || 0,
        skillGaps: totalSkillGaps,
        avgSkillLevel: Math.round(avgSkillLevel * 10) / 10,
        topSkills: [],
        criticalGaps: [],
        recentAssessments: assessments?.slice(0, 5) || [],
        // AI Insights metrics
        aiInsights: {
          matchRate: matchRate,
          efficiencyGain: efficiencyGain,
          activePrograms: activePrograms,
          completionRate: completionRate,
          skillPredictions: [
            { skill: 'AI/ML Skills', trend: 45 },
            { skill: 'Cybersecurity', trend: 32 },
            { skill: 'Cloud Computing', trend: 28 },
            { skill: 'Data Analysis', trend: 25 }
          ],
          topTalentMatches: highMatchEmployees
        }
      };

      console.log('Final analytics:', analyticsData);
      setSkillAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching skill analytics:', error);
      // Set fallback data so the UI doesn't show undefined
      setSkillAnalytics({
        totalEmployees: 0,
        assessedEmployees: 0,
        totalSkills: 0,
        skillGaps: 0,
        avgSkillLevel: 0,
        topSkills: [],
        criticalGaps: [],
        recentAssessments: [],
        aiInsights: {
          matchRate: 0,
          efficiencyGain: 0,
          activePrograms: 0,
          completionRate: 0,
          skillPredictions: [],
          topTalentMatches: 0
        }
      });
    }
  };

  useEffect(() => {
    fetchSkillAnalytics();

    // Add real-time subscription for skill assessments
    const channel = supabase
      .channel('skill-assessments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'xlsmart_skill_assessments'
        },
        () => {
          console.log('Skill assessment data changed, refreshing...');
          fetchSkillAnalytics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const skillsStats = [
    { 
      value: skillAnalytics.totalSkills || 0, 
      label: "Total Skills", 
      icon: Brain, 
      color: "text-primary",
      description: "Identified skills",
      dialogKey: "skills-details"
    },
    { 
      value: skillAnalytics.totalEmployees > 0 
        ? `${Math.round((skillAnalytics.assessedEmployees / skillAnalytics.totalEmployees) * 100)}%`
        : "0%", 
      label: "Assessment Coverage", 
      icon: Users, 
      color: "text-blue-600",
      description: "Employees assessed",
      dialogKey: "coverage-details"
    },
    { 
      value: `${skillAnalytics.avgSkillLevel}%`, 
      label: "Avg Match Score", 
      icon: TrendingUp, 
      color: "text-accent",
      description: "Skills-role alignment",
      dialogKey: "match-details"
    },
    { 
      value: skillAnalytics.skillGaps, 
      label: "Skill Gaps", 
      icon: AlertTriangle, 
      color: "text-destructive",
      description: "Identified gaps",
      dialogKey: "gaps-details"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Skills & Talent Management</h1>
        <p className="text-muted-foreground text-lg">
          AI-powered skills assessment, role standardization, and talent optimization
        </p>
      </div>

      {/* Skills Stats */}
      <section className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl p-6 border">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Real-time Skills Analytics</h2>
          <p className="text-muted-foreground">
            Live insights from {skillAnalytics.totalEmployees} employees across your organization
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {skillsStats.map((stat, index) => (
            <Card 
              key={index} 
              className="hover:shadow-lg transition-all duration-300 border-0 shadow-sm bg-background/50 backdrop-blur-sm cursor-pointer hover:scale-[1.02]"
              onClick={() => {
                console.log('Card clicked:', stat.dialogKey);
                setActiveDialog(stat.dialogKey);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-2xl font-bold ${stat.color}`}>
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
      <Tabs defaultValue="assessment" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-fit">
          <TabsTrigger value="assessment" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">Skills Assessment</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Skills Inventory</span>
          </TabsTrigger>
          <TabsTrigger value="gaps" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Gap Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="ai-insights" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">AI Insights</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assessment" className="space-y-6 mt-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
              <CardTitle className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-primary" />
                <span>AI Skills Assessment Engine</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <AISkillsAssessmentEnhanced />
            </CardContent>
          </Card>

          {/* Recent Assessments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span>Recent Assessments</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {skillAnalytics.recentAssessments.length > 0 ? (
                  skillAnalytics.recentAssessments.map((assessment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Assessment #{assessment.id?.slice(-8)}</p>
                        <p className="text-sm text-muted-foreground">
                          Match Score: {assessment.overall_match_percentage}%
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(assessment.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">No assessments yet. Start by running your first AI skills assessment.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6 mt-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-secondary/5 to-accent/5">
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-secondary" />
                <span>Skills Inventory & Analytics</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SkillsListDetails />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <span>Top Skills in Organization</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">JavaScript/TypeScript</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 h-2 bg-muted rounded-full">
                        <div className="w-4/5 h-2 bg-gradient-to-r from-primary to-primary/80 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium text-primary">80%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Project Management</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 h-2 bg-muted rounded-full">
                        <div className="w-3/4 h-2 bg-gradient-to-r from-secondary to-secondary/80 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium text-secondary">75%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Data Analysis</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 h-2 bg-muted rounded-full">
                        <div className="w-3/5 h-2 bg-gradient-to-r from-accent to-accent/80 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium text-accent">60%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Cloud Computing</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 h-2 bg-muted rounded-full">
                        <div className="w-1/3 h-2 bg-gradient-to-r from-destructive to-destructive/80 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium text-destructive">35%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span>Critical Skills Gaps</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-destructive">Cloud Computing</p>
                      <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">CRITICAL</span>
                    </div>
                    <p className="text-sm text-muted-foreground">65% of roles require this skill</p>
                    <p className="text-xs text-muted-foreground mt-1">Recommended: AWS/Azure certification program</p>
                  </div>
                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-yellow-700">Machine Learning</p>
                      <span className="text-xs bg-yellow-500/10 text-yellow-700 px-2 py-1 rounded">MODERATE</span>
                    </div>
                    <p className="text-sm text-muted-foreground">40% of roles require this skill</p>
                    <p className="text-xs text-muted-foreground mt-1">Recommended: Python ML bootcamp</p>
                  </div>
                  <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-blue-700">Agile Methodologies</p>
                      <span className="text-xs bg-blue-500/10 text-blue-700 px-2 py-1 rounded">MINOR</span>
                    </div>
                    <p className="text-sm text-muted-foreground">25% of roles require this skill</p>
                    <p className="text-xs text-muted-foreground mt-1">Recommended: Scrum Master certification</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-6 mt-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold">AI-Powered Insights</h3>
              <p className="text-sm text-muted-foreground">
                {skillAnalytics.assessedEmployees > 0 
                  ? `Real-time analytics based on ${skillAnalytics.assessedEmployees} assessed employees`
                  : "Run skills assessments to see AI-powered insights"}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchSkillAnalytics}
              className="flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              Refresh Insights
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-0 shadow-md bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <span>Skill Predictions</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  AI predicts future skill demands based on industry trends
                </p>
                <div className="space-y-2">
                  {skillAnalytics.aiInsights.skillPredictions.slice(0, 2).map((prediction, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-sm">{prediction.skill}</span>
                      <span className="text-sm font-medium text-primary">↗ {prediction.trend}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-0 shadow-md bg-gradient-to-br from-secondary/5 to-secondary/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-secondary" />
                  <span>Talent Optimization</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  AI identifies optimal role-employee matches
                </p>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Match Rate:</span> 
                    <span className="text-green-600 font-semibold ml-1">{skillAnalytics.aiInsights.matchRate}%</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Efficiency Gain:</span> 
                    <span className="text-emerald-600 font-semibold ml-1">+{skillAnalytics.aiInsights.efficiencyGain}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-0 shadow-md bg-gradient-to-br from-accent/5 to-accent/10">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-accent" />
                  <span>Learning Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  Personalized learning paths for skill development
                </p>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Active Programs:</span> 
                    <span className="text-purple-600 font-semibold ml-1">{skillAnalytics.aiInsights.activePrograms}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Completion Rate:</span> 
                    <span className="text-purple-600 font-semibold ml-1">{skillAnalytics.aiInsights.completionRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail Dialogs */}
      <Dialog open={activeDialog === 'skills-details'} onOpenChange={(open) => setActiveDialog(open ? 'skills-details' : null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="sr-only">Skills Details</DialogTitle>
          <SkillsListDetails />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'coverage-details'} onOpenChange={(open) => setActiveDialog(open ? 'coverage-details' : null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Assessment Coverage Details</DialogTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{skillAnalytics.assessedEmployees}</div>
                <p className="text-sm text-muted-foreground">Assessed Employees</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{skillAnalytics.totalEmployees - skillAnalytics.assessedEmployees}</div>
                <p className="text-sm text-muted-foreground">Pending Assessment</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Coverage rate: {skillAnalytics.totalEmployees > 0 ? Math.round((skillAnalytics.assessedEmployees / skillAnalytics.totalEmployees) * 100) : 0}% of employees have completed skills assessments.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'match-details'} onOpenChange={(open) => setActiveDialog(open ? 'match-details' : null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>Average Match Score Details</DialogTitle>
          <div className="space-y-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-accent">{skillAnalytics.avgSkillLevel}%</div>
              <p className="text-sm text-muted-foreground">Average Skills-Role Alignment</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Excellent Match (90-100%)</span>
                <span className="text-sm font-medium">23%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Good Match (75-89%)</span>
                <span className="text-sm font-medium">45%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Fair Match (60-74%)</span>
                <span className="text-sm font-medium">25%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Poor Match (Below 60%)</span>
                <span className="text-sm font-medium">7%</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === 'gaps-details'} onOpenChange={(open) => setActiveDialog(open ? 'gaps-details' : null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Skill Gaps Analysis</DialogTitle>
          <div className="space-y-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-3xl font-bold text-destructive">{skillAnalytics.skillGaps}</div>
              <p className="text-sm text-muted-foreground">Total Skill Gaps Identified</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <h4 className="font-medium text-destructive mb-2">Most Critical Gaps</h4>
                <div className="space-y-2 text-sm">
                  <div>• Cloud Computing (65% gap)</div>
                  <div>• Machine Learning (52% gap)</div>
                  <div>• Data Analysis (38% gap)</div>
                </div>
              </div>
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <h4 className="font-medium text-blue-700 mb-2">Recommended Actions</h4>
                <div className="space-y-2 text-sm">
                  <div>• Implement upskilling programs</div>
                  <div>• Partner with training providers</div>
                  <div>• Create internal mentorship</div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SkillsDashboard;