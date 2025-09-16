import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Users, TrendingUp, Target, AlertCircle, CheckCircle, Clock, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WorkforceIntelligenceProps {
  onAnalysisComplete?: (result: any) => void;
}

export function AIWorkforceIntelligence({ onAnalysisComplete }: WorkforceIntelligenceProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('role_optimization');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [pastResults, setPastResults] = useState<any[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>('');
  const { toast } = useToast();

  React.useEffect(() => {
    fetchPastResults();
  }, []);

  const fetchPastResults = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_analysis_results')
        .select('*')
        .eq('function_name', 'ai-workforce-intelligence')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPastResults(data || []);
    } catch (error) {
      console.error('Error fetching past workforce results:', error);
    }
  };

  const analysisTypes = [
    { value: 'role_optimization', label: 'Role Optimization', icon: Target },
    { value: 'skills_intelligence', label: 'Skills Intelligence', icon: Brain },
    { value: 'career_planning', label: 'Career Planning', icon: TrendingUp },
    { value: 'talent_analytics', label: 'Talent Analytics', icon: Users },
    { value: 'workforce_forecasting', label: 'Workforce Forecasting', icon: AlertCircle }
  ];

  const handleAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-workforce-intelligence', {
        body: {
          analysisType: selectedAnalysis,
          departmentFilter: departmentFilter || undefined,
          employeeId: employeeId || undefined
        }
      });

      if (error) throw error;

      setAnalysisResult(data);
      setSelectedResultId(''); // Clear selected result ID for new analysis
      onAnalysisComplete?.(data);
      
      toast({
        title: "Analysis Complete",
        description: "AI workforce intelligence analysis has been completed successfully.",
      });

      // Refresh past results to include the new one
      await fetchPastResults();
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to complete workforce intelligence analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalysisTypeChange = async (newAnalysisType: string) => {
    setSelectedAnalysis(newAnalysisType);
    
    // Check if we have cached results for this analysis type
    const cachedResult = pastResults.find(
      result => result.analysis_type === newAnalysisType
    );

    if (cachedResult) {
      setAnalysisResult(cachedResult.analysis_result);
      setSelectedResultId(cachedResult.id);
      toast({
        title: "Cached Result Loaded",
        description: "Loaded previous analysis result from database.",
      });
    } else {
      setAnalysisResult(null);
      setSelectedResultId('');
    }
  };

  const handleLoadPastResult = (resultId: string) => {
    const result = pastResults.find(r => r.id === resultId);
    if (result) {
      setAnalysisResult(result.analysis_result);
      setSelectedResultId(resultId);
      setSelectedAnalysis(result.analysis_type);
      toast({
        title: "Past Result Loaded",
        description: "Loaded previous analysis result.",
      });
    }
  };

  const renderRoleOptimizationResults = () => {
    if (!analysisResult?.roleRecommendations) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.organizationalInsights?.totalMisaligned || 0}</p>
                  <p className="text-sm text-muted-foreground">Misaligned Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-secondary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.organizationalInsights?.avgMatchScore || 0}%</p>
                  <p className="text-sm text-muted-foreground">Avg Match Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.roleRecommendations?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Recommendations</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Role Optimization Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.roleRecommendations?.slice(0, 10).map((rec: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Employee: {rec.currentRole}</h4>
                    <Badge variant={rec.matchScore > 80 ? 'default' : rec.matchScore > 60 ? 'secondary' : 'destructive'}>
                      {rec.matchScore}% Match
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Recommended: <strong>{rec.recommendedRoleTitle}</strong>
                  </p>
                  <p className="text-sm mb-3">{rec.reasoning}</p>
                  <div className="space-y-2">
                    {rec.skillsAlignment?.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-green-600">Aligned Skills: </span>
                        <span className="text-sm">{rec.skillsAlignment.join(', ')}</span>
                      </div>
                    )}
                    {rec.skillGaps?.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-red-600">Skill Gaps: </span>
                        <span className="text-sm">{rec.skillGaps.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSkillsIntelligenceResults = () => {
    if (!analysisResult?.skillsOverview) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.skillsOverview.totalUniqueSkills}</p>
                  <p className="text-sm text-muted-foreground">Total Skills</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-secondary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.skillsOverview.avgSkillsPerEmployee}</p>
                  <p className="text-sm text-muted-foreground">Avg Skills/Employee</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-xl font-bold">{analysisResult.skillsOverview.skillMaturityLevel}</p>
                  <p className="text-sm text-muted-foreground">Maturity Level</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.skillGapAnalysis?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Critical Gaps</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Skill Gap Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.skillGapAnalysis?.slice(0, 8).map((gap: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{gap.skillName}</h4>
                    <Badge variant={
                      gap.gapSeverity === 'Critical' ? 'destructive' :
                      gap.gapSeverity === 'High' ? 'secondary' : 'outline'
                    }>
                      {gap.gapSeverity}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 mb-2">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Current Supply: {gap.currentSupply}</span>
                        <span>Required Demand: {gap.requiredDemand}</span>
                      </div>
                      <Progress value={(gap.currentSupply / gap.requiredDemand) * 100} className="h-2" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Affected Roles: {gap.affectedRoles?.join(', ')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderCareerPlanningResults = () => {
    if (!analysisResult?.careerPathways) return null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Career Development Pathways</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.careerPathways?.slice(0, 6).map((pathway: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Current: {pathway.currentPosition}</h4>
                    <Badge variant={pathway.readinessScore > 80 ? 'default' : 'secondary'}>
                      {pathway.readinessScore}% Ready
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-sm mb-2">Short-term Path</h5>
                      <p className="text-sm"><strong>Next Role:</strong> {pathway.shortTermPath?.nextRole}</p>
                      <p className="text-sm"><strong>Timeframe:</strong> {pathway.shortTermPath?.timeframe}</p>
                      <p className="text-sm"><strong>Required Skills:</strong> {pathway.shortTermPath?.requiredSkills?.join(', ')}</p>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-sm mb-2">Long-term Vision</h5>
                      <p className="text-sm"><strong>Destination:</strong> {pathway.longTermPath?.destinationRoles?.join(', ')}</p>
                      <p className="text-sm"><strong>Timeframe:</strong> {pathway.longTermPath?.timeframe}</p>
                      <p className="text-sm"><strong>Strategic Skills:</strong> {pathway.longTermPath?.strategicSkills?.join(', ')}</p>
                    </div>
                  </div>

                  {pathway.riskFactors?.length > 0 && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded">
                      <p className="text-sm font-medium text-yellow-800">Risk Factors:</p>
                      <p className="text-sm text-yellow-700">{pathway.riskFactors.join(', ')}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-primary" />
            <span>AI Workforce Intelligence</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Analysis Type</label>
              <Select value={selectedAnalysis} onValueChange={handleAnalysisTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select analysis type" />
                </SelectTrigger>
                <SelectContent>
                  {analysisTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center space-x-2">
                        <type.icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Load Past Result</label>
              <Select value={selectedResultId} onValueChange={handleLoadPastResult}>
                <SelectTrigger>
                  <SelectValue placeholder="Select past analysis" />
                </SelectTrigger>
                <SelectContent>
                  {pastResults.map((result) => (
                    <SelectItem key={result.id} value={result.id}>
                      {result.analysis_type} - {new Date(result.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Department Filter (Optional)</label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="HR">Human Resources</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleAnalysis} 
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {selectedResultId && (
            <div className="bg-muted p-3 rounded-lg mb-4">
              <p className="text-sm text-muted-foreground">
                Showing cached result from {new Date(pastResults.find(r => r.id === selectedResultId)?.created_at || '').toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {analysisResult && (
        <div className="space-y-6">
          {selectedAnalysis === 'role_optimization' && renderRoleOptimizationResults()}
          {selectedAnalysis === 'skills_intelligence' && renderSkillsIntelligenceResults()}
          {selectedAnalysis === 'career_planning' && renderCareerPlanningResults()}
          {selectedAnalysis === 'talent_analytics' && (
            <Card>
              <CardHeader>
                <CardTitle>Talent Analytics Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Talent analytics results will be displayed here</p>
                  <pre className="text-xs text-left mt-4 bg-muted p-4 rounded overflow-auto max-h-96">
                    {JSON.stringify(analysisResult, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
          {selectedAnalysis === 'workforce_forecasting' && (
            <Card>
              <CardHeader>
                <CardTitle>Workforce Forecasting Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Workforce forecasting results will be displayed here</p>
                  <pre className="text-xs text-left mt-4 bg-muted p-4 rounded overflow-auto max-h-96">
                    {JSON.stringify(analysisResult, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}