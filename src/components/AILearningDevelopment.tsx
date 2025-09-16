import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, TrendingUp, Award, Users, Target, Clock, CheckCircle, Brain, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LearningDevelopmentProps {
  onAnalysisComplete?: (result: any) => void;
}

export function AILearningDevelopment({ onAnalysisComplete }: LearningDevelopmentProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('personalized_learning');
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
        .eq('function_name', 'ai-learning-development')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPastResults(data || []);
    } catch (error) {
      console.error('Error fetching past learning results:', error);
    }
  };

  const analysisTypes = [
    { value: 'personalized_learning', label: 'Personalized Learning', icon: BookOpen },
    { value: 'skills_development', label: 'Skills Development', icon: TrendingUp },
    { value: 'training_effectiveness', label: 'Training Effectiveness', icon: Award },
    { value: 'learning_strategy', label: 'Learning Strategy', icon: Brain }
  ];

  const handleAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-learning-development', {
        body: {
          analysisType: selectedAnalysis,
          departmentFilter: departmentFilter || undefined,
          employeeId: employeeId || undefined
        }
      });

      if (error) {
        console.error('Development analysis error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from analysis');
      }

      setAnalysisResult(data);
      setSelectedResultId(''); // Clear selected result ID for new analysis
      onAnalysisComplete?.(data);
      
      toast({
        title: "Analysis Complete",
        description: "AI learning & development analysis has been completed successfully.",
      });

      // Refresh past results to include the new one
      await fetchPastResults();
    } catch (error) {
      console.error('Development analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: `Failed to complete learning & development analysis: ${error.message}`,
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
        description: "Loaded previous learning analysis result from database.",
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
        description: "Loaded previous learning analysis result.",
      });
    }
  };

  const renderPersonalizedLearningResults = () => {
    console.log('renderPersonalizedLearningResults called');
    console.log('analysisResult:', analysisResult);
    
    // Handle the actual AI response structure
    if (analysisResult?.employees) {
      return renderEmployeeCareerDevelopment();
    }
    
    // Handle the expected structure
    if (!analysisResult?.personalizedPlans) {
      console.log('No personalized plans found');
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No personalized learning plans available</p>
          <pre className="text-xs text-left mt-4 bg-muted p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(analysisResult, null, 2)}
          </pre>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personalized Learning Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.personalizedPlans?.slice(0, 6).map((plan: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Employee: {plan.currentProfile?.role}</h4>
                    <Badge variant="outline">{plan.currentProfile?.skillLevel}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h5 className="font-medium text-sm mb-2">Learning Objectives</h5>
                      <ul className="text-sm space-y-1">
                        {plan.learningObjectives?.slice(0, 3).map((obj: string, idx: number) => (
                          <li key={idx} className="text-muted-foreground">• {obj}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-sm mb-2">Learning Preferences</h5>
                      <div className="text-sm space-y-1">
                        <p><strong>Modality:</strong> {plan.learningPreferences?.modality}</p>
                        <p><strong>Pace:</strong> {plan.learningPreferences?.pace}</p>
                        <p><strong>Time:</strong> {plan.learningPreferences?.timeCommitment}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium text-sm mb-2">Top Skill Development Areas</h5>
                    <div className="space-y-2">
                      {plan.skillDevelopmentPlan?.slice(0, 3).map((skill: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-sm">{skill.skillName}</span>
                          <div className="flex items-center space-x-2">
                            <Progress value={(skill.currentLevel / skill.targetLevel) * 100} className="w-20 h-2" />
                            <Badge variant={skill.priority === 'High' ? 'destructive' : 'secondary'} className="text-xs">
                              {skill.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {analysisResult.learningRecommendations && (
          <Card>
            <CardHeader>
              <CardTitle>Learning Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Immediate Actions</h4>
                  <ul className="space-y-1">
                    {analysisResult.learningRecommendations.immediateActions?.map((action: string, index: number) => (
                      <li key={index} className="text-sm text-muted-foreground">• {action}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Quarterly Goals</h4>
                  <ul className="space-y-1">
                    {analysisResult.learningRecommendations.quarterlyGoals?.map((goal: string, index: number) => (
                      <li key={index} className="text-sm text-muted-foreground">• {goal}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Annual Targets</h4>
                  <ul className="space-y-1">
                    {analysisResult.learningRecommendations.annualTargets?.map((target: string, index: number) => (
                      <li key={index} className="text-sm text-muted-foreground">• {target}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Estimated Budget:</strong> IDR {analysisResult.learningRecommendations.budgetEstimate?.toLocaleString() || 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderSkillsDevelopmentResults = () => {
    if (!analysisResult?.organizationalSkillsGaps) return null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organizational Skills Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.organizationalSkillsGaps?.map((gap: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{gap.skillCategory}</h4>
                    <Badge variant={
                      gap.gapSeverity === 'Critical' ? 'destructive' :
                      gap.gapSeverity === 'High' ? 'secondary' : 'outline'
                    }>
                      {gap.gapSeverity}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm"><strong>Current:</strong> {gap.currentCapability}</p>
                      <p className="text-sm"><strong>Target:</strong> {gap.targetCapability}</p>
                    </div>
                    <div>
                      <p className="text-sm"><strong>Affected Roles:</strong> {gap.affectedRoles?.join(', ')}</p>
                      <p className="text-sm"><strong>Priority:</strong> {gap.developmentPriority}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium">Recommended Programs:</p>
                    <p className="text-sm text-muted-foreground">{gap.recommendedPrograms?.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {analysisResult.skillsDevelopmentPrograms && (
          <Card>
            <CardHeader>
              <CardTitle>Recommended Development Programs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysisResult.skillsDevelopmentPrograms?.map((program: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{program.programName}</h4>
                      <Badge variant="outline">{program.delivery}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm"><strong>Target Skills:</strong></p>
                        <p className="text-sm text-muted-foreground">{program.targetSkills?.join(', ')}</p>
                      </div>
                      <div>
                        <p className="text-sm"><strong>Duration:</strong> {program.duration}</p>
                        <p className="text-sm"><strong>Investment:</strong> IDR {program.investmentRequired?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm"><strong>ROI:</strong> {program.roi}</p>
                        <p className="text-sm"><strong>Audience:</strong> {program.targetAudience}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderEmployeeCareerDevelopment = () => {
    const employees = analysisResult?.employees || [];
    const analysisDate = analysisResult?.analysis_date;
    
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Employee Career Development Plans
              {analysisDate && (
                <Badge variant="outline" className="ml-2">
                  {new Date(analysisDate).toLocaleDateString()}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {employees.map((employee: any, index: number) => (
                <div key={employee.employee_id || index} className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-lg">
                        {employee.employee_name || employee.employee_id || `Employee ${index + 1}`}
                      </h4>
                      <div className="text-sm text-muted-foreground mb-2">
                        ID: {employee.employee_id}
                      </div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline">{employee.current_role}</Badge>
                        <Badge variant="secondary">{employee.target_role}</Badge>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{employee.readiness_score}%</div>
                      <div className="text-sm text-muted-foreground">Readiness Score</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Gap Analysis */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-base">Gap Analysis</h5>
                      
                      {employee.gap_analysis?.technical_skills && (
                        <div>
                          <h6 className="font-medium text-sm text-blue-600 mb-2">Technical Skills</h6>
                          <ul className="space-y-1">
                            {employee.gap_analysis.technical_skills.map((skill: string, idx: number) => (
                              <li key={idx} className="text-sm flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                {skill}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {employee.gap_analysis?.leadership_skills && (
                        <div>
                          <h6 className="font-medium text-sm text-green-600 mb-2">Leadership Skills</h6>
                          <ul className="space-y-1">
                            {employee.gap_analysis.leadership_skills.map((skill: string, idx: number) => (
                              <li key={idx} className="text-sm flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                {skill}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {employee.gap_analysis?.certifications && (
                        <div>
                          <h6 className="font-medium text-sm text-purple-600 mb-2">Required Certifications</h6>
                          <div className="flex flex-wrap gap-2">
                            {employee.gap_analysis.certifications.map((cert: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Development Recommendations */}
                    <div>
                      <h5 className="font-medium text-base mb-3">Development Recommendations</h5>
                      <ul className="space-y-2">
                        {employee.development_recommendations?.map((rec: string, idx: number) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Career Readiness</span>
                      <span className="text-sm text-muted-foreground">{employee.readiness_score}%</span>
                    </div>
                    <Progress value={employee.readiness_score} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTrainingEffectivenessResults = () => {
    if (!analysisResult?.trainingEffectivenessMetrics) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.trainingEffectivenessMetrics.totalTrainingsCompleted}</p>
                  <p className="text-sm text-muted-foreground">Trainings Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-secondary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.trainingEffectivenessMetrics.avgCompletionRate}%</p>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.trainingEffectivenessMetrics.skillImprovementRate}%</p>
                  <p className="text-sm text-muted-foreground">Skill Improvement</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Award className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.trainingEffectivenessMetrics.trainingROI}%</p>
                  <p className="text-sm text-muted-foreground">Training ROI</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Program Performance Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.programPerformance?.map((program: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{program.programName}</h4>
                    <Badge variant={
                      program.continuationDecision === 'Continue' ? 'default' :
                      program.continuationDecision === 'Modify' ? 'secondary' : 'destructive'
                    }>
                      {program.continuationDecision}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-sm font-medium">Completion Rate</p>
                      <Progress value={program.completionRate} className="h-2 mt-1" />
                      <p className="text-xs text-muted-foreground mt-1">{program.completionRate}%</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Average Rating</p>
                      <p className="text-lg font-bold text-primary">{program.averageRating}/5</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Skill Improvement</p>
                      <p className="text-lg font-bold text-secondary">{program.skillImprovementMeasured}%</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Business Impact</p>
                      <Badge variant="outline">{program.businessImpact}</Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Recommendations:</p>
                    <p className="text-sm text-muted-foreground">{program.recommendations?.join(', ')}</p>
                  </div>
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
            <BookOpen className="h-6 w-6 text-primary" />
            <span>AI Learning & Development Intelligence</span>
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
              <label className="text-sm font-medium mb-2 block">Department Filter</label>
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

            <div>
              <label className="text-sm font-medium mb-2 block">Employee ID (Optional)</label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
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
          {selectedAnalysis === 'personalized_learning' && renderPersonalizedLearningResults()}
          {selectedAnalysis === 'skills_development' && renderSkillsDevelopmentResults()}
          {selectedAnalysis === 'training_effectiveness' && renderTrainingEffectivenessResults()}
          {selectedAnalysis === 'learning_strategy' && (
            <Card>
              <CardHeader>
                <CardTitle>Learning Strategy Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Learning strategy results will be displayed here</p>
                  <pre className="text-xs text-left mt-4 bg-muted p-4 rounded overflow-auto max-h-96">
                    {JSON.stringify(analysisResult, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Debug: Show raw analysis result if no specific renderer matches */}
          {!['personalized_learning', 'skills_development', 'training_effectiveness', 'learning_strategy'].includes(selectedAnalysis) && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results (Debug)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96">
                  {JSON.stringify(analysisResult, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {!analysisResult && !isAnalyzing && (
        <Card>
          <CardContent className="text-center py-8">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No Analysis Results</h3>
            <p className="text-muted-foreground">
              Click "Run Analysis" to generate AI learning & development insights
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}