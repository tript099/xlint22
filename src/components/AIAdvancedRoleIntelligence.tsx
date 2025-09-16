import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Repeat, Zap, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const AIAdvancedRoleIntelligence = () => {
  const [selectedAnalysis, setSelectedAnalysis] = useState('role_evolution');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const analysisTypes = [
    { value: 'role_evolution', label: 'Role Evolution', icon: TrendingUp },
    { value: 'redundancy_analysis', label: 'Redundancy Analysis', icon: Repeat },
    { value: 'future_prediction', label: 'Future Prediction', icon: Zap },
    { value: 'competitiveness_scoring', label: 'Competitiveness', icon: Target }
  ];

  const handleAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-advanced-role-intelligence', {
        body: { analysisType: selectedAnalysis, departmentFilter: departmentFilter || undefined }
      });
      if (error) throw error;
      setResults(data);
      toast({ title: "Analysis Complete", description: "Role intelligence analysis completed!" });
    } catch (error) {
      toast({ title: "Analysis Failed", description: "Failed to complete role analysis", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Select value={selectedAnalysis} onValueChange={setSelectedAnalysis}>
          <SelectTrigger className="w-64">
            <SelectValue />
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
        <Button onClick={handleAnalysis} disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>

      {results && (
        <div className="space-y-6">
          {/* Role Evolution Results */}
          {selectedAnalysis === 'role_evolution' && results.evolutionOverview && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.evolutionOverview.rolesAnalyzed}</div>
                    <div className="text-sm text-muted-foreground">Roles Analyzed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.evolutionOverview.evolutionRate}%</div>
                    <div className="text-sm text-muted-foreground">Evolution Rate</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold capitalize">{results.evolutionOverview.disruptionRisk}</div>
                    <div className="text-sm text-muted-foreground">Disruption Risk</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.evolutionOverview.adaptationReadiness}%</div>
                    <div className="text-sm text-muted-foreground">Adaptation Readiness</div>
                  </CardContent>
                </Card>
              </div>

              {results.emergingRoles && results.emergingRoles.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Emerging Roles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {results.emergingRoles.map((role: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold">{role.roleTitle}</h3>
                            <Badge variant="outline">{role.department}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            <strong>Timeline:</strong> {role.timeToMarketNeed}
                          </p>
                          <p className="text-sm mb-2">
                            <strong>Drivers:</strong> {role.emergenceDrivers?.join(', ')}
                          </p>
                          <p className="text-sm">
                            <strong>Key Skills:</strong> {role.requiredSkills?.join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Future Prediction Results */}
          {selectedAnalysis === 'future_prediction' && results.futurePrediction && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{Math.round(results.futurePrediction.predictionConfidence * 100)}%</div>
                    <div className="text-sm text-muted-foreground">Prediction Confidence</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold capitalize">{results.futurePrediction.disruptionLevel}</div>
                    <div className="text-sm text-muted-foreground">Disruption Level</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.futurePrediction.newRolesExpected}</div>
                    <div className="text-sm text-muted-foreground">New Roles Expected</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.futurePrediction.obsoleteRolesExpected}</div>
                    <div className="text-sm text-muted-foreground">Roles at Risk</div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="future-roles">
                <TabsList>
                  <TabsTrigger value="future-roles">Future Roles</TabsTrigger>
                  <TabsTrigger value="transformations">Role Transformations</TabsTrigger>
                  <TabsTrigger value="obsolescence">Obsolescence Risk</TabsTrigger>
                </TabsList>
                
                <TabsContent value="future-roles">
                  <Card>
                    <CardHeader>
                      <CardTitle>Predicted Future Roles</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {results.futureRoles?.map((role: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold">{role.predictedRole}</h3>
                              <Badge variant="outline">{role.department}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              <strong>Timeline:</strong> {role.emergenceTimeframe}
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Drivers:</strong> {role.drivingFactors?.join(', ')}
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Skills:</strong> {role.requiredSkills?.join(', ')}
                            </p>
                            <p className="text-sm">
                              <strong>Preparation:</strong> {role.preparationStrategy}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="transformations">
                  <Card>
                    <CardHeader>
                      <CardTitle>Role Transformations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {results.roleTransformations?.map((transformation: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">{transformation.currentRole}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-semibold text-primary">{transformation.transformedRole}</span>
                            </div>
                            <p className="text-sm mb-2">
                              <strong>Drivers:</strong> {transformation.transformationDrivers?.join(', ')}
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Skill Gaps:</strong> {transformation.skillGaps?.join(', ')}
                            </p>
                            <p className="text-sm">
                              <strong>Transition Plan:</strong> {transformation.transitionPlan}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="obsolescence">
                  <Card>
                    <CardHeader>
                      <CardTitle>Obsolescence Risk Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {results.obsolescenceRisk?.map((risk: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-semibold">{risk.role}</h3>
                              <Badge variant={risk.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                                {risk.riskLevel} risk
                              </Badge>
                            </div>
                            <p className="text-sm mb-2">
                              <strong>Risk Factors:</strong> {risk.obsolescenceFactors?.join(', ')}
                            </p>
                            <p className="text-sm mb-2">
                              <strong>Mitigation:</strong> {risk.mitigationStrategies?.join(', ')}
                            </p>
                            <p className="text-sm">
                              <strong>Transition Options:</strong> {risk.transitionOptions?.join(', ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Redundancy Analysis Results */}
          {selectedAnalysis === 'redundancy_analysis' && results.redundancyOverview && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.redundancyOverview.totalRolesAnalyzed}</div>
                    <div className="text-sm text-muted-foreground">Total Roles</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.redundancyOverview.redundantRolesIdentified}</div>
                    <div className="text-sm text-muted-foreground">Redundant Roles</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.redundancyOverview.overlapScore}%</div>
                    <div className="text-sm text-muted-foreground">Overlap Score</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.redundancyOverview.optimizationPotential}%</div>
                    <div className="text-sm text-muted-foreground">Optimization Potential</div>
                  </CardContent>
                </Card>
              </div>

              {results.optimizationPlan && results.optimizationPlan.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Optimization Plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {results.optimizationPlan.map((plan: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <h3 className="font-semibold mb-2">{plan.phase}</h3>
                          <p className="text-sm mb-2">
                            <strong>Timeline:</strong> {plan.timeline}
                          </p>
                          <p className="text-sm mb-2">
                            <strong>Actions:</strong> {plan.actions?.join(', ')}
                          </p>
                          <p className="text-sm">
                            <strong>Expected Outcomes:</strong> {plan.expectedOutcomes?.join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Competitiveness Analysis Results */}
          {selectedAnalysis === 'competitiveness_scoring' && results.competitivenessOverview && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.competitivenessOverview.averageCompetitivenessScore}%</div>
                    <div className="text-sm text-muted-foreground">Avg Competitiveness</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold capitalize">{results.competitivenessOverview.marketPositioning}</div>
                    <div className="text-sm text-muted-foreground">Market Position</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold capitalize">{results.competitivenessOverview.talentAttractionRisk}</div>
                    <div className="text-sm text-muted-foreground">Talent Risk</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold">{results.competitivenessOverview.retentionAdvantage}%</div>
                    <div className="text-sm text-muted-foreground">Retention Advantage</div>
                  </CardContent>
                </Card>
              </div>

              {results.talentStrategy && results.talentStrategy.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Talent Strategy Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {results.talentStrategy.map((strategy: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold">{strategy.strategy}</h3>
                            <Badge variant={strategy.expectedImpact === 'high' ? 'default' : 'secondary'}>
                              {strategy.expectedImpact} impact
                            </Badge>
                          </div>
                          <p className="text-sm mb-2">{strategy.implementation}</p>
                          <p className="text-sm">
                            <strong>Investment Required:</strong> {strategy.investmentRequired}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};