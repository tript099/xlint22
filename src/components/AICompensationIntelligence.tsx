import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, AlertTriangle, Users, Target, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CompensationIntelligenceProps {
  onAnalysisComplete?: (result: any) => void;
}

export function AICompensationIntelligence({ onAnalysisComplete }: CompensationIntelligenceProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('pay_equity');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const { toast } = useToast();

  // Format variance to handle extremely large values
  const formatVariance = (variance: number): string => {
    if (variance == null || isNaN(variance)) return '0';
    
    // If variance is extremely large (> 1000%), cap it to reasonable range
    if (variance > 1000) {
      return Math.min(variance, 100).toFixed(1);
    }
    
    // For normal values, show with one decimal place
    return variance.toFixed(1);
  };

  const analysisTypes = [
    { value: 'pay_equity', label: 'Pay Equity Analysis', icon: Users },
    { value: 'market_benchmarking', label: 'Market Benchmarking', icon: TrendingUp },
    { value: 'promotion_readiness', label: 'Promotion Readiness', icon: Target },
    { value: 'compensation_optimization', label: 'Compensation Optimization', icon: DollarSign }
  ];

  const handleAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-compensation-intelligence', {
        body: {
          analysisType: selectedAnalysis,
          departmentFilter: departmentFilter || undefined,
          roleFilter: roleFilter || undefined
        }
      });

      if (error) throw error;

      setAnalysisResult(data);
      onAnalysisComplete?.(data);
      
      toast({
        title: "Analysis Complete",
        description: "AI compensation intelligence analysis has been completed successfully.",
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to complete compensation intelligence analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const renderPayEquityResults = () => {
    if (!analysisResult?.payEquityMetrics) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.payEquityMetrics.overallEquityScore}%</p>
                  <p className="text-sm text-muted-foreground">Equity Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-secondary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.payEquityMetrics.totalEmployeesAnalyzed}</p>
                  <p className="text-sm text-muted-foreground">Employees Analyzed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.payEquityMetrics.potentialIssuesFound}</p>
                  <p className="text-sm text-muted-foreground">Potential Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-2xl font-bold">{formatVariance(analysisResult.payEquityMetrics.avgSalaryVariance)}%</p>
                  <p className="text-sm text-muted-foreground">Avg Variance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gender Pay Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {(!analysisResult.genderPayAnalysis || analysisResult.genderPayAnalysis.length === 0 || 
              analysisResult.genderPayAnalysis.every((a: any) => a.sampleSize?.male === 0 && a.sampleSize?.female === 0)) ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-2">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Gender data not available for employees</p>
                  <p className="text-xs">Add gender field to employee records to enable pay equity analysis</p>
                </div>
              </div>
            ) : (
            <div className="space-y-4">
              {analysisResult.genderPayAnalysis?.map((analysis: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{analysis.role} - {analysis.department}</h4>
                    <Badge variant={
                      analysis.riskLevel === 'High' ? 'destructive' :
                      analysis.riskLevel === 'Medium' ? 'secondary' : 'outline'
                    }>
                      {analysis.riskLevel} Risk
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium">Pay Gap: {analysis.genderPayGap}%</p>
                      <Progress value={Math.abs(analysis.genderPayGap)} className="h-2 mt-1" />
                    </div>
                    <div>
                      <p className="text-sm">Sample Size:</p>
                      <p className="text-sm text-muted-foreground">
                        Male: {analysis.sampleSize?.male || 0}, Female: {analysis.sampleSize?.female || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Actions:</p>
                      <p className="text-sm text-muted-foreground">
                        {analysis.recommendedActions?.slice(0, 2).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

        {analysisResult.actionPlan && (
          <Card>
            <CardHeader>
              <CardTitle>Action Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Immediate Actions</h4>
                  <ul className="space-y-1">
                    {analysisResult.actionPlan.immediateActions?.map((action: string, index: number) => (
                      <li key={index} className="text-sm text-muted-foreground">• {action}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Medium-term Actions</h4>
                  <ul className="space-y-1">
                    {analysisResult.actionPlan.mediumTermActions?.map((action: string, index: number) => (
                      <li key={index} className="text-sm text-muted-foreground">• {action}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm"><strong>Budget Impact:</strong> {formatCurrency(analysisResult.actionPlan.budgetImpact || 0)}</p>
                <p className="text-sm"><strong>Timeline:</strong> {analysisResult.actionPlan.timeline}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderMarketBenchmarkingResults = () => {
    if (!analysisResult?.marketPositioning) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-lg font-bold">{analysisResult.marketPositioning.overallMarketPosition}</p>
                  <p className="text-sm text-muted-foreground">Market Position</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-secondary" />
                <div>
                  <p className="text-2xl font-bold">{analysisResult.marketPositioning.competitivenessScore}%</p>
                  <p className="text-sm text-muted-foreground">Competitiveness</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-lg font-bold">{analysisResult.marketPositioning.retentionRisk}</p>
                  <p className="text-sm text-muted-foreground">Retention Risk</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-lg font-bold">{analysisResult.marketPositioning.attractionCapability}</p>
                  <p className="text-sm text-muted-foreground">Attraction Capability</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Role Benchmarking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.roleBenchmarking?.map((role: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{role.role}</h4>
                    <Badge variant={
                      role.priority === 'High' ? 'destructive' :
                      role.priority === 'Medium' ? 'secondary' : 'outline'
                    }>
                      {role.priority} Priority
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Current Avg</p>
                      <p className="text-muted-foreground">{formatCurrency(role.currentAvgSalary)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Market P50</p>
                      <p className="text-muted-foreground">{formatCurrency(role.marketP50)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Market P75</p>
                      <p className="text-muted-foreground">{formatCurrency(role.marketP75)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Gap</p>
                      <p className={`font-medium ${role.gap < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {role.gap > 0 ? '+' : ''}{formatCurrency(role.gap)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>Recommended Action:</strong> {role.recommendedAction}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPromotionReadinessResults = () => {
    if (!analysisResult?.promotionReadiness) return null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Promotion Ready Candidates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisResult.promotionReadiness?.slice(0, 8).map((candidate: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{candidate.currentRole}</h4>
                    <Badge variant={candidate.readinessScore > 80 ? 'default' : 'secondary'}>
                      {candidate.readinessScore}% Ready
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm"><strong>Current:</strong> {formatCurrency(candidate.currentSalary)}</p>
                      <p className="text-sm"><strong>Target Role:</strong> {candidate.targetRole}</p>
                    </div>
                    <div>
                      <p className="text-sm"><strong>Target Salary:</strong> {formatCurrency(candidate.targetSalary)}</p>
                      <p className="text-sm"><strong>Increase:</strong> {formatCurrency(candidate.salaryIncrease)}</p>
                    </div>
                    <div>
                      <p className="text-sm"><strong>Time to Promotion:</strong> {candidate.timeToPromotion}</p>
                      <Progress value={candidate.readinessScore} className="h-2 mt-1" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium">Development Needs:</p>
                    <p className="text-sm text-muted-foreground">{candidate.developmentNeeds?.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {analysisResult.organizationalImpact && (
          <Card>
            <CardHeader>
              <CardTitle>Organizational Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Promotion Budget:</span>
                    <span className="font-medium">{formatCurrency(analysisResult.organizationalImpact.totalPromotionBudget)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Adjustment Budget:</span>
                    <span className="font-medium">{formatCurrency(analysisResult.organizationalImpact.totalAdjustmentBudget)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Retention Improvement:</span>
                    <span className="font-medium">{analysisResult.organizationalImpact.talentRetentionImprovement}%</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Expected ROI</h4>
                  <p className="text-sm text-muted-foreground">{analysisResult.organizationalImpact.expectedROI}</p>
                  <p className="text-sm mt-2"><strong>Timeline:</strong> {analysisResult.organizationalImpact.implementationTimeline}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderCompensationOptimizationResults = () => {
    const data = analysisResult;
    
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Current State Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(data.currentState?.totalCompensationBudget || 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Budget</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {data.currentState?.compressionIssues || 0}
                </p>
                <p className="text-sm text-muted-foreground">Compression Issues</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {((data.currentState?.budgetUtilization || 0) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground">Budget Utilization</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {Object.keys(data.currentState?.avgSalaryByLevel || {}).length}
                </p>
                <p className="text-sm text-muted-foreground">Salary Levels</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {data.currentState?.avgSalaryByLevel && (
          <Card>
            <CardHeader>
              <CardTitle>Average Salary by Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(data.currentState.avgSalaryByLevel).map(([level, salary]) => (
                  <div key={level} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="font-medium capitalize">{level}</span>
                    <span className="text-primary font-bold">{formatCurrency(salary as number)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.optimizationOpportunities && data.optimizationOpportunities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Optimization Opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.optimizationOpportunities.map((opportunity: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold">{opportunity.area}</h4>
                      <div className="text-right">
                        <p className="text-green-600 font-bold">
                          Savings: {formatCurrency(opportunity.savings || 0)}
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground mb-3">{opportunity.implementation}</p>
                    {opportunity.riskFactors && opportunity.riskFactors.length > 0 && (
                      <div>
                        <p className="font-medium text-sm mb-1">Risk Factors:</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside">
                          {opportunity.riskFactors.map((risk: string, riskIndex: number) => (
                            <li key={riskIndex}>{risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.salaryBandRecommendations && data.salaryBandRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Salary Band Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.salaryBandRecommendations.map((rec: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold">{rec.role}</h4>
                        <p className="text-sm text-muted-foreground">{rec.level}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Affected: {rec.affectedEmployees} employees</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm font-medium">Current Range</p>
                        <p className="text-sm">{formatCurrency(rec.currentRange?.min || 0)} - {formatCurrency(rec.currentRange?.max || 0)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Recommended Range</p>
                        <p className="text-sm text-primary">{formatCurrency(rec.recommendedRange?.min || 0)} - {formatCurrency(rec.recommendedRange?.max || 0)}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.strategicRecommendations && (
          <Card>
            <CardHeader>
              <CardTitle>Strategic Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 text-green-600">Short Term</h4>
                  <ul className="space-y-2">
                    {data.strategicRecommendations.shortTerm?.map((rec: string, index: number) => (
                      <li key={index} className="text-sm flex items-start">
                        <span className="w-2 h-2 bg-green-600 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 text-orange-600">Medium Term</h4>
                  <ul className="space-y-2">
                    {data.strategicRecommendations.mediumTerm?.map((rec: string, index: number) => (
                      <li key={index} className="text-sm flex items-start">
                        <span className="w-2 h-2 bg-orange-600 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-3 text-blue-600">Long Term</h4>
                  <ul className="space-y-2">
                    {data.strategicRecommendations.longTerm?.map((rec: string, index: number) => (
                      <li key={index} className="text-sm flex items-start">
                        <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {data.strategicRecommendations.totalInvestment && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Total Investment Required:</span>
                    <span className="text-lg font-bold text-primary">
                      {formatCurrency(data.strategicRecommendations.totalInvestment)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <span>AI Compensation Intelligence</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Analysis Type</label>
              <Select value={selectedAnalysis} onValueChange={setSelectedAnalysis}>
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
              <label className="text-sm font-medium mb-2 block">Role Filter</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Senior">Senior</SelectItem>
                  <SelectItem value="Lead">Lead</SelectItem>
                  <SelectItem value="Specialist">Specialist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={() => {
                  console.log('🚀 Run Analysis clicked!');
                  handleAnalysis();
                }} 
                disabled={isAnalyzing}
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold"
                size="lg"
              >
                {isAnalyzing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {analysisResult && (
        <div className="space-y-6">
          {selectedAnalysis === 'pay_equity' && renderPayEquityResults()}
          {selectedAnalysis === 'market_benchmarking' && renderMarketBenchmarkingResults()}
          {selectedAnalysis === 'promotion_readiness' && renderPromotionReadinessResults()}
          {selectedAnalysis === 'compensation_optimization' && renderCompensationOptimizationResults()}
        </div>
      )}
    </div>
  );
}