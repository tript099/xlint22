import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Crown, TrendingUp, Star, Target, Users, Award, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SuccessionPlanningProps {
  onAnalysisComplete?: (result: any) => void;
}

export const AISuccessionPlanning: React.FC<SuccessionPlanningProps> = ({ onAnalysisComplete }) => {
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('leadership_pipeline');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [positionLevel, setPositionLevel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [pastResults, setPastResults] = useState<any[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>('');

  React.useEffect(() => {
    fetchPastResults();
  }, []);

  const fetchPastResults = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_analysis_results')
        .select('*')
        .eq('function_name', 'ai-succession-planning')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPastResults(data || []);
    } catch (error) {
      console.error('Error fetching past succession results:', error);
    }
  };

  const analysisTypes = [
    { value: 'leadership_pipeline', label: 'Leadership Pipeline', icon: Crown },
    { value: 'succession_readiness', label: 'Succession Readiness', icon: TrendingUp },
    { value: 'high_potential_identification', label: 'High Potential ID', icon: Star },
    { value: 'leadership_gap_analysis', label: 'Leadership Gaps', icon: Target }
  ];

  const handleAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-succession-planning', {
        body: {
          analysisType: selectedAnalysis,
          departmentFilter: departmentFilter || undefined,
          positionLevel: positionLevel || undefined
        }
      });

      if (error) throw error;
      
      setResults(data);
      setSelectedResultId(''); // Clear selected result ID for new analysis
      onAnalysisComplete?.(data);
      toast({
        title: "Analysis Complete",
        description: "Succession planning analysis completed successfully!"
      });

      // Refresh past results to include the new one
      await fetchPastResults();
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed", 
        description: "Failed to complete succession planning analysis",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalysisTypeChange = async (newAnalysisType: string) => {
    setSelectedAnalysis(newAnalysisType);
    
    // Check if we have cached results for this analysis type
    const cachedResult = pastResults.find(
      result => result.analysis_type === newAnalysisType
    );

    if (cachedResult) {
      setResults(cachedResult.analysis_result);
      setSelectedResultId(cachedResult.id);
      toast({
        title: "Cached Result Loaded",
        description: "Loaded previous succession analysis result from database.",
      });
    } else {
      setResults(null);
      setSelectedResultId('');
    }
  };

  const handleLoadPastResult = (resultId: string) => {
    const result = pastResults.find(r => r.id === resultId);
    if (result) {
      setResults(result.analysis_result);
      setSelectedResultId(resultId);
      setSelectedAnalysis(result.analysis_type);
      toast({
        title: "Past Result Loaded",
        description: "Loaded previous succession analysis result.",
      });
    }
  };

  const renderPipelineResults = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{data.pipelineOverview?.totalLeadershipRoles || 0}</div>
            <div className="text-sm text-muted-foreground">Leadership Roles</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-secondary">{data.pipelineOverview?.totalPotentialSuccessors || 0}</div>
            <div className="text-sm text-muted-foreground">Potential Successors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{data.pipelineOverview?.averageSuccessionDepth || 0}</div>
            <div className="text-sm text-muted-foreground">Avg Succession Depth</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{data.pipelineOverview?.criticalGapsCount || 0}</div>
            <div className="text-sm text-muted-foreground">Critical Gaps</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Succession Chains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.successionChains?.map((chain: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{chain.role}</h4>
                    <Badge variant={chain.successionRisk === 'high' ? 'destructive' : 
                                   chain.successionRisk === 'medium' ? 'default' : 'secondary'}>
                      {chain.successionRisk} risk
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Current: {chain.currentLeader}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-green-600">Ready Successors:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {chain.readySuccessors?.map((successor: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{successor}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-orange-600">Developing:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {chain.developingSuccessors?.map((successor: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{successor}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Development Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.developmentRecommendations?.map((rec: any, index: number) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{rec.employee}</h4>
                    <div className="flex items-center gap-2">
                      <Progress value={rec.readinessLevel} className="w-16" />
                      <span className="text-xs">{rec.readinessLevel}%</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {rec.currentRole} → {rec.targetRole}
                  </div>
                  <div className="text-sm text-primary">
                    Ready in: {rec.timeToReadiness}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderReadinessResults = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{data.readinessMetrics?.immediatelyReady || 0}</div>
            <div className="text-sm text-muted-foreground">Ready Now</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{data.readinessMetrics?.readyWithDevelopment || 0}</div>
            <div className="text-sm text-muted-foreground">Ready w/ Development</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{data.readinessMetrics?.longerTermPotential || 0}</div>
            <div className="text-sm text-muted-foreground">Long-term Potential</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{data.readinessMetrics?.averageReadinessScore || 0}%</div>
            <div className="text-sm text-muted-foreground">Avg Readiness</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Readiness Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.readinessAssessment?.map((assessment: any, index: number) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{assessment.employee}</h4>
                  <div className="flex items-center gap-2">
                    <Progress value={assessment.readinessScore} className="w-20" />
                    <Badge variant={assessment.readinessCategory === 'ready_now' ? 'default' : 
                                   assessment.readinessCategory === 'ready_1_year' ? 'secondary' : 'outline'}>
                      {assessment.readinessCategory?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  Current: {assessment.currentRole}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-green-600">Strengths:</span>
                    <ul className="text-muted-foreground ml-2">
                      {assessment.strengthAreas?.slice(0, 2).map((strength: string, i: number) => (
                        <li key={i}>• {strength}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-orange-600">Development Needs:</span>
                    <ul className="text-muted-foreground ml-2">
                      {assessment.developmentNeeds?.slice(0, 2).map((need: string, i: number) => (
                        <li key={i}>• {need}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderHighPotentialResults = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{data.hipoIdentification?.totalHiposCandidates || 0}</div>
            <div className="text-sm text-muted-foreground">HiPo Candidates</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{data.hipoIdentification?.confirmedHipos || 0}</div>
            <div className="text-sm text-muted-foreground">Confirmed HiPos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{data.hipoIdentification?.emergingTalent || 0}</div>
            <div className="text-sm text-muted-foreground">Emerging Talent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{data.hipoIdentification?.hipoRetentionRate || 0}%</div>
            <div className="text-sm text-muted-foreground">HiPo Retention</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>High-Potential Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.hipoProfiles?.map((profile: any, index: number) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{profile.employee}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={profile.hipoCategory === 'confirmed' ? 'default' : 
                                   profile.hipoCategory === 'emerging' ? 'secondary' : 'outline'}>
                      {profile.hipoCategory}
                    </Badge>
                    <div className="text-sm font-medium">{profile.potentialScore}% potential</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-green-600">Strengths:</span>
                    <ul className="text-muted-foreground ml-2">
                      {profile.strengthIndicators?.slice(0, 2).map((strength: string, i: number) => (
                        <li key={i}>• {strength}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-blue-600">Career Velocity:</span>
                    <div className="text-muted-foreground ml-2">{profile.careerVelocity}</div>
                    <span className="font-medium text-blue-600">Leadership Readiness:</span>
                    <div className="text-muted-foreground ml-2">{profile.leadershipReadiness}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderGapAnalysisResults = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{data.gapAnalysis?.totalLeadershipGaps || 0}</div>
            <div className="text-sm text-muted-foreground">Total Gaps</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{data.gapAnalysis?.criticalGaps || 0}</div>
            <div className="text-sm text-muted-foreground">Critical Gaps</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{data.gapAnalysis?.averageTimeToFill || 'N/A'}</div>
            <div className="text-sm text-muted-foreground">Avg Time to Fill</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{data.gapAnalysis?.gapImpactRating || 0}</div>
            <div className="text-sm text-muted-foreground">Impact Rating</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Critical Leadership Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.leadershipGaps?.map((gap: any, index: number) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{gap.role}</h4>
                    <Badge variant={gap.gapSeverity === 'critical' ? 'destructive' : 
                                   gap.gapSeverity === 'high' ? 'default' : 'secondary'}>
                      {gap.gapSeverity}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {gap.department} • Need {gap.requiredCount}, Have {gap.currentCount}
                  </div>
                  <div className="text-sm text-primary mb-2">
                    {gap.impactOnBusiness}
                  </div>
                  <div className="text-xs text-orange-600">
                    Urgency: {gap.urgencyToFill?.replace(/_/g, ' ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Closure Strategies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.closureStrategies?.map((strategy: any, index: number) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{strategy.strategy}</h4>
                    <div className="flex items-center gap-2">
                      <Progress value={strategy.successProbability} className="w-16" />
                      <span className="text-xs">{strategy.successProbability}%</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Timeline: {strategy.timeframe}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <Badge variant={strategy.investment === 'high' ? 'destructive' : 
                                   strategy.investment === 'medium' ? 'default' : 'secondary'}>
                      {strategy.investment} investment
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={selectedAnalysis} onValueChange={handleAnalysisTypeChange}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select analysis type" />
          </SelectTrigger>
          <SelectContent>
            {analysisTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedResultId} onValueChange={handleLoadPastResult}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Load past analysis" />
          </SelectTrigger>
          <SelectContent>
            {pastResults.map((result) => (
              <SelectItem key={result.id} value={result.id}>
                {result.analysis_type} - {new Date(result.created_at).toLocaleDateString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="Engineering">Engineering</SelectItem>
            <SelectItem value="Marketing">Marketing</SelectItem>
            <SelectItem value="Sales">Sales</SelectItem>
            <SelectItem value="HR">HR</SelectItem>
            <SelectItem value="Finance">Finance</SelectItem>
          </SelectContent>
        </Select>

        <Select value={positionLevel} onValueChange={setPositionLevel}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Position level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="senior">Senior</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="director">Director</SelectItem>
            <SelectItem value="executive">Executive</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          onClick={handleAnalysis} 
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? 'Analyzing...' : 'Run Analysis'}
          <Crown className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {selectedResultId && (
        <div className="bg-muted p-3 rounded-lg mb-4">
          <p className="text-sm text-muted-foreground">
            Showing cached result from {new Date(pastResults.find(r => r.id === selectedResultId)?.created_at || '').toLocaleString()}
          </p>
        </div>
      )}

      {results && (
        <Tabs value={selectedAnalysis} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="leadership_pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="succession_readiness">Readiness</TabsTrigger>
            <TabsTrigger value="high_potential_identification">HiPo</TabsTrigger>
            <TabsTrigger value="leadership_gap_analysis">Gaps</TabsTrigger>
          </TabsList>

          <TabsContent value="leadership_pipeline" className="mt-6">
            {renderPipelineResults(results)}
          </TabsContent>

          <TabsContent value="succession_readiness" className="mt-6">
            {renderReadinessResults(results)}
          </TabsContent>

          <TabsContent value="high_potential_identification" className="mt-6">
            {renderHighPotentialResults(results)}
          </TabsContent>

          <TabsContent value="leadership_gap_analysis" className="mt-6">
            {renderGapAnalysisResults(results)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};