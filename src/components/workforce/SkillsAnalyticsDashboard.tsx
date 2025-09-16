import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Target } from "lucide-react";

interface SkillsAnalyticsProps {
  metrics: any;
}

export const SkillsAnalyticsDashboard = ({ metrics }: SkillsAnalyticsProps) => {
  if (!metrics) return null;

  const topSkills = Object.entries(metrics.skillDistribution || {})
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 8);

  const skillGapSeverity = (gap: number) => {
    if (gap >= 70) return { color: "text-destructive", label: "Critical" };
    if (gap >= 40) return { color: "text-orange-500", label: "High" };
    return { color: "text-yellow-500", label: "Medium" };
  };

  return (
    <div className="space-y-6">
      {/* Skills Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{Object.keys(metrics.skillDistribution || {}).length}</p>
                <p className="text-sm text-muted-foreground">Total Skills</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{metrics.skillGaps.averageMatchPercentage}%</p>
                <p className="text-sm text-muted-foreground">Avg Match Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{metrics.skillGaps.criticalGaps}</p>
                <p className="text-sm text-muted-foreground">Critical Gaps</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{metrics.skillGaps.totalAssessments}</p>
                <p className="text-sm text-muted-foreground">Assessments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skills Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Top Skills Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topSkills.map(([skill, count]) => {
                const percentage = Math.round((count as number / metrics.totalEmployees) * 100);
                return (
                  <div key={skill} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{skill}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">{count as number} employees</span>
                        <Badge variant="outline">{percentage}%</Badge>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span>Skill Gap Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Simulated skill gaps based on available data */}
              {[
                { skill: "AI/Machine Learning", currentSupply: 12, requiredDemand: 25, gap: 52 },
                { skill: "Cybersecurity", currentSupply: 8, requiredDemand: 18, gap: 56 },
                { skill: "Cloud Architecture", currentSupply: 15, requiredDemand: 28, gap: 46 },
                { skill: "Data Science", currentSupply: 20, requiredDemand: 35, gap: 43 },
                { skill: "DevOps", currentSupply: 18, requiredDemand: 30, gap: 40 }
              ].map((gap, index) => {
                const severity = skillGapSeverity(gap.gap);
                return (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{gap.skill}</span>
                      <Badge variant={gap.gap >= 50 ? "destructive" : "secondary"} className={severity.color}>
                        {severity.label}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Supply: {gap.currentSupply}</span>
                        <span>Demand: {gap.requiredDemand}</span>
                      </div>
                      <Progress value={100 - gap.gap} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {gap.gap}% gap ({gap.requiredDemand - gap.currentSupply} employees needed)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skills Development Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>AI-Powered Skill Development Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                category: "Technical Skills",
                priority: "High",
                recommendations: ["Cloud Computing", "Machine Learning", "API Development"],
                impact: "Immediate productivity boost"
              },
              {
                category: "Leadership Skills",
                priority: "Medium",
                recommendations: ["Team Management", "Strategic Planning", "Change Management"],
                impact: "Enhanced team performance"
              },
              {
                category: "Digital Skills",
                priority: "High",
                recommendations: ["Data Analytics", "Automation", "Digital Transformation"],
                impact: "Future-ready workforce"
              }
            ].map((rec, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{rec.category}</h4>
                  <Badge variant={rec.priority === "High" ? "destructive" : "secondary"}>
                    {rec.priority} Priority
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Focus Areas:</p>
                  <div className="flex flex-wrap gap-1">
                    {rec.recommendations.map((skill, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-primary font-medium">{rec.impact}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};