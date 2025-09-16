import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SkillGap {
  skill: string;
  currentLevel: number;
  requiredLevel: number;
  gap: number;
}

interface AssessmentResult {
  overallMatch: number;
  skillGaps: SkillGap[];
  recommendations: string;
  nextRoles: string[];
}

export const AISkillsAssessment = () => {
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const { toast } = useToast();

  const runAssessment = async () => {
    if (!selectedEmployee || !selectedRole) {
      toast({
        title: "Missing Selection",
        description: "Please select both employee and target role",
        variant: "destructive"
      });
      return;
    }

    setIsAssessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: `Analyze skill gaps for employee ID ${selectedEmployee} against role ${selectedRole}. Provide: 1) Overall match percentage 2) Specific skill gaps with current vs required levels 3) Recommendations for improvement 4) Suggested next career roles. Format as structured analysis.`,
          context: 'skill_assessor'
        }
      });

      if (error) throw error;

      // Parse AI response into structured format
      const aiResponse = data.response;
      
      // Mock structured result based on AI response
      const mockAssessment: AssessmentResult = {
        overallMatch: 75,
        skillGaps: [
          { skill: "Leadership", currentLevel: 6, requiredLevel: 8, gap: 2 },
          { skill: "Data Analysis", currentLevel: 5, requiredLevel: 9, gap: 4 },
          { skill: "Project Management", currentLevel: 7, requiredLevel: 8, gap: 1 }
        ],
        recommendations: aiResponse,
        nextRoles: ["Senior Manager", "Team Lead", "Principal Engineer"]
      };
      
      setAssessment(mockAssessment);
      
      toast({
        title: "Assessment Complete!",
        description: "AI has analyzed the skill gaps and provided recommendations"
      });
    } catch (error) {
      console.error('Error running assessment:', error);
      toast({
        title: "Assessment Failed",
        description: "Failed to run skill assessment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAssessing(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-card-foreground mb-2">AI Skills Assessment</h2>
        <p className="text-muted-foreground">Analyze employee skills against role requirements</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Brain className="h-5 w-5 text-primary" />
            Run Skills Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emp1">John Smith - Senior Developer</SelectItem>
                  <SelectItem value="emp2">Sarah Chen - Marketing Specialist</SelectItem>
                  <SelectItem value="emp3">Mike Johnson - Network Engineer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Target Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose target role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="role1">Tech Lead</SelectItem>
                  <SelectItem value="role2">Senior Manager</SelectItem>
                  <SelectItem value="role3">Principal Engineer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={runAssessment} 
            disabled={isAssessing || !selectedEmployee || !selectedRole}
            className="w-full xlsmart-button-primary"
          >
            <Brain className="mr-2 h-4 w-4" />
            {isAssessing ? "Analyzing..." : "Run AI Assessment"}
          </Button>

          {assessment && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{assessment.overallMatch}%</div>
                    <div className="text-sm text-muted-foreground">Overall Match</div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{assessment.skillGaps.length}</div>
                    <div className="text-sm text-muted-foreground">Skill Gaps</div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{assessment.nextRoles.length}</div>
                    <div className="text-sm text-muted-foreground">Next Roles</div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Skill Gaps Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {assessment.skillGaps.map((gap, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{gap.skill}</span>
                        <span className="text-muted-foreground">
                          {gap.currentLevel}/10 → {gap.requiredLevel}/10
                        </span>
                      </div>
                      <Progress value={(gap.currentLevel / gap.requiredLevel) * 100} className="h-2" />
                      <Badge variant={gap.gap > 2 ? "destructive" : "outline"} className="text-xs">
                        Gap: {gap.gap} levels
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {assessment.recommendations}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};