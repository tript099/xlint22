import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, TrendingUp, AlertTriangle, Users, Target, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EmployeeEngagementProps {
  onAnalysisComplete?: (result: any) => void;
}

export const AIEmployeeEngagement: React.FC<EmployeeEngagementProps> = ({ onAnalysisComplete }) => {
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('sentiment_analysis');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [timeFrame, setTimeFrame] = useState<string>('3_months');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const analysisTypes = [
    { value: 'sentiment_analysis', label: 'Sentiment Analysis', icon: Heart },
    { value: 'engagement_prediction', label: 'Engagement Prediction', icon: TrendingUp },
    { value: 'retention_modeling', label: 'Retention Modeling', icon: Users },
    { value: 'early_warning', label: 'Early Warning System', icon: AlertTriangle }
  ];

  const handleAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-employee-engagement', {
        body: {
          analysisType: selectedAnalysis,
          departmentFilter: departmentFilter || undefined,
          timeFrame: timeFrame
        }
      });

      if (error) throw error;
      
      setResults(data);
      onAnalysisComplete?.(data);
      toast({
        title: "Analysis Complete",
        description: "Employee engagement analysis completed successfully!"
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: "Failed to complete engagement analysis",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderSentimentResults = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{data.overallSentiment?.score || 0}%</div>
            <div className="text-sm text-muted-foreground">Overall Sentiment</div>
            <Badge variant={data.overallSentiment?.trend === 'positive' ? 'default' : 
                           data.overallSentiment?.trend === 'negative' ? 'destructive' : 'secondary'}>
              {data.overallSentiment?.trend || 'stable'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-secondary">{data.departmentSentiment?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Departments Analyzed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{data.riskSegments?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Risk Segments</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Department Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.departmentSentiment?.map((dept: any, index: number) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{dept.department}</h4>
                    <div className="flex items-center gap-2">
                      <Progress value={dept.sentimentScore} className="w-20" />
                      <span className="text-sm font-medium">{dept.sentimentScore}%</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {dept.employeeCount} employees
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <span className="font-medium text-green-600">Positives:</span>
                      <ul className="text-muted-foreground">
                        {dept.positiveIndicators?.slice(0, 2).map((indicator: string, i: number) => (
                          <li key={i}>• {indicator}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium text-red-600">Concerns:</span>
                      <ul className="text-muted-foreground">
                        {dept.topConcerns?.slice(0, 2).map((concern: string, i: number) => (
                          <li key={i}>• {concern}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sentiment Factors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.sentimentFactors?.map((factor: any, index: number) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{factor.factor}</h4>
                    <Badge variant={factor.impact === 'high' ? 'destructive' : factor.impact === 'medium' ? 'default' : 'secondary'}>
                      {factor.impact}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Affects {factor.affectedEmployees} employees
                  </div>
                  <div className="text-sm text-primary">{factor.recommendation}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderEngagementPredictionResults = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{data.engagementForecasting?.currentEngagementRate || 0}%</div>
            <div className="text-sm text-muted-foreground">Current Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-secondary">{data.engagementForecasting?.predictedEngagementRate || 0}%</div>
            <div className="text-sm text-muted-foreground">Predicted Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{data.engagementForecasting?.forecastConfidence || 0}%</div>
            <div className="text-sm text-muted-foreground">Confidence</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{data.interventionStrategies?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Interventions</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Intervention Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.interventionStrategies?.map((strategy: any, index: number) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{strategy.strategy}</h4>
                  <Badge variant={strategy.implementationPriority === 'high' ? 'destructive' : 
                                 strategy.implementationPriority === 'medium' ? 'default' : 'secondary'}>
                    {strategy.implementationPriority} priority
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  Target: {strategy.targetSegment}
                </div>
                <div className="text-sm text-primary">
                  Expected improvement: {strategy.expectedImprovement}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderRetentionResults = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{data.retentionMetrics?.overallRetentionRate || 0}%</div>
            <div className="text-sm text-muted-foreground">Retention Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-secondary">{data.retentionMetrics?.predictedRetentionRate || 0}%</div>
            <div className="text-sm text-muted-foreground">Predicted Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{data.retentionMetrics?.averageTenure || 0}</div>
            <div className="text-sm text-muted-foreground">Avg Tenure (years)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{data.retentionMetrics?.criticalRetentionRisk || 0}</div>
            <div className="text-sm text-muted-foreground">Critical Risk</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>High-Risk Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.riskAnalysis?.slice(0, 5).map((risk: any, index: number) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{risk.employee}</h4>
                  <div className="flex items-center gap-2">
                    <Progress value={risk.retentionProbability} className="w-20" />
                    <span className="text-sm font-medium">{risk.retentionProbability}%</span>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-2">
                  Risk timeline: {risk.timeToRisk}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-medium text-red-600">Risk Factors:</span>
                    <ul className="text-muted-foreground">
                      {risk.riskFactors?.slice(0, 2).map((factor: string, i: number) => (
                        <li key={i}>• {factor}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-green-600">Actions:</span>
                    <ul className="text-muted-foreground">
                      {risk.retentionActions?.slice(0, 2).map((action: string, i: number) => (
                        <li key={i}>• {action}</li>
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

  const renderEarlyWarningResults = (data: any) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{data.warningSystem?.totalEmployeesMonitored || 0}</div>
            <div className="text-sm text-muted-foreground">Monitored</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{data.warningSystem?.highRiskEmployees || 0}</div>
            <div className="text-sm text-muted-foreground">High Risk</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{data.warningSystem?.mediumRiskEmployees || 0}</div>
            <div className="text-sm text-muted-foreground">Medium Risk</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{data.warningSystem?.earlyWarningAccuracy || 0}%</div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.alertedEmployees?.map((alert: any, index: number) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{alert.employee}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.urgency === 'immediate' ? 'destructive' : 
                                   alert.urgency === 'soon' ? 'default' : 'secondary'}>
                      {alert.urgency}
                    </Badge>
                    <span className="text-sm font-medium">Risk: {alert.riskScore}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-orange-600">Warnings:</span>
                    <ul className="text-muted-foreground ml-2">
                      {alert.primaryWarnings?.slice(0, 2).map((warning: string, i: number) => (
                        <li key={i}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium text-green-600">Actions:</span>
                    <ul className="text-muted-foreground ml-2">
                      {alert.recommendedActions?.slice(0, 2).map((action: string, i: number) => (
                        <li key={i}>• {action}</li>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={selectedAnalysis} onValueChange={setSelectedAnalysis}>
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

        <Select value={timeFrame} onValueChange={setTimeFrame}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Time frame" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1_month">1 Month</SelectItem>
            <SelectItem value="3_months">3 Months</SelectItem>
            <SelectItem value="6_months">6 Months</SelectItem>
            <SelectItem value="1_year">1 Year</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          onClick={handleAnalysis} 
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? 'Analyzing...' : 'Run Analysis'}
          <Heart className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {results && (
        <Tabs value={selectedAnalysis} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sentiment_analysis">Sentiment</TabsTrigger>
            <TabsTrigger value="engagement_prediction">Engagement</TabsTrigger>
            <TabsTrigger value="retention_modeling">Retention</TabsTrigger>
            <TabsTrigger value="early_warning">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="sentiment_analysis" className="mt-6">
            {renderSentimentResults(results)}
          </TabsContent>

          <TabsContent value="engagement_prediction" className="mt-6">
            {renderEngagementPredictionResults(results)}
          </TabsContent>

          <TabsContent value="retention_modeling" className="mt-6">
            {renderRetentionResults(results)}
          </TabsContent>

          <TabsContent value="early_warning" className="mt-6">
            {renderEarlyWarningResults(results)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};