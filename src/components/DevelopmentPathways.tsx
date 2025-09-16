import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Target, Lightbulb, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDevelopmentPlanCreation } from "@/hooks/useDevelopmentPlanCreation";
import { useToast } from "@/hooks/use-toast";

export const DevelopmentPathways = () => {
  const { toast } = useToast();
  const { createStructuredDevelopmentPlan, isCreating } = useDevelopmentPlanCreation();
  const [formData, setFormData] = useState({
    employeeName: "",
    currentPosition: "",
    experienceLevel: "",
    currentSkills: "",
    careerGoals: "",
    preferredLearningStyle: "",
    timeCommitment: "",
    industryFocus: ""
  });
  const [developmentPlan, setDevelopmentPlan] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateDevelopmentPlan = async () => {
    if (!formData.employeeName || !formData.currentPosition || !formData.careerGoals) {
      toast({
        title: "Missing Information",
        description: "Please fill in employee name, current position, and career goals.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('development-pathways', {
        body: {
          employeeProfile: {
            name: formData.employeeName,
            currentPosition: formData.currentPosition,
            experienceLevel: formData.experienceLevel,
            preferredLearningStyle: formData.preferredLearningStyle,
            timeCommitment: formData.timeCommitment,
            industryFocus: formData.industryFocus
          },
          careerGoals: formData.careerGoals,
          currentSkills: formData.currentSkills.split(',').map(s => s.trim()),
          industryTrends: `Current trends in ${formData.industryFocus || 'technology'} industry`
        }
      });

      if (error) throw error;

      setDevelopmentPlan(data.developmentPlan);
      setSavedAnalysisId(data.analysisId);
      
      toast({
        title: "Development Plan Generated",
        description: "Personalized development pathway has been successfully created.",
      });
    } catch (error) {
      console.error('Error generating development plan:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate development plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createStructuredPlan = async () => {
    if (!savedAnalysisId) {
      toast({
        title: "No Analysis Found",
        description: "Please generate a development plan first.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get the saved analysis
      const { data: analysis, error: fetchError } = await supabase
        .from('ai_analysis_results')
        .select('*')
        .eq('id', savedAnalysisId)
        .single();

      if (fetchError) throw fetchError;

      // Find or create employee record
      const { data: employee, error: employeeError } = await supabase
        .from('xlsmart_employees')
        .select('id')
        .eq('first_name', formData.employeeName.split(' ')[0])
        .eq('last_name', formData.employeeName.split(' ')[1] || '')
        .single();

      if (employeeError && employeeError.code !== 'PGRST116') {
        throw employeeError;
      }

      // If employee doesn't exist, create a placeholder or use a default
      const employeeId = employee?.id || '00000000-0000-0000-0000-000000000000';

      // Create structured development plan
      await createStructuredDevelopmentPlan(analysis, employeeId, formData.careerGoals);

    } catch (error) {
      console.error('Error creating structured plan:', error);
      toast({
        title: "Error",
        description: "Failed to create structured development plan.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <BookOpen className="h-5 w-5 text-primary" />
            Development Pathways
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeName">Employee Name</Label>
              <Input
                id="employeeName"
                placeholder="Enter employee name"
                value={formData.employeeName}
                onChange={(e) => handleInputChange("employeeName", e.target.value)}
                className="bg-background border-border"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currentPosition">Current Position</Label>
              <Input
                id="currentPosition"
                placeholder="e.g., Marketing Coordinator"
                value={formData.currentPosition}
                onChange={(e) => handleInputChange("currentPosition", e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="experienceLevel">Experience Level</Label>
              <Select onValueChange={(value) => handleInputChange("experienceLevel", value)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select experience level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                  <SelectItem value="mid">Mid Level (3-5 years)</SelectItem>
                  <SelectItem value="senior">Senior Level (6-10 years)</SelectItem>
                  <SelectItem value="executive">Executive Level (10+ years)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredLearningStyle">Preferred Learning Style</Label>
              <Select onValueChange={(value) => handleInputChange("preferredLearningStyle", value)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select learning style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visual">Visual Learning</SelectItem>
                  <SelectItem value="auditory">Auditory Learning</SelectItem>
                  <SelectItem value="kinesthetic">Hands-on Learning</SelectItem>
                  <SelectItem value="reading">Reading/Writing</SelectItem>
                  <SelectItem value="mixed">Mixed Approach</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeCommitment">Weekly Time Commitment</Label>
              <Select onValueChange={(value) => handleInputChange("timeCommitment", value)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select time commitment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-2">1-2 hours/week</SelectItem>
                  <SelectItem value="3-5">3-5 hours/week</SelectItem>
                  <SelectItem value="6-10">6-10 hours/week</SelectItem>
                  <SelectItem value="10+">10+ hours/week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="industryFocus">Industry Focus</Label>
              <Input
                id="industryFocus"
                placeholder="e.g., Technology, Healthcare, Finance"
                value={formData.industryFocus}
                onChange={(e) => handleInputChange("industryFocus", e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentSkills">Current Skills (comma-separated)</Label>
            <Textarea
              id="currentSkills"
              placeholder="e.g., Data Analysis, Project Management, Python, Communication"
              value={formData.currentSkills}
              onChange={(e) => handleInputChange("currentSkills", e.target.value)}
              className="bg-background border-border min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="careerGoals">Career Goals & Aspirations</Label>
            <Textarea
              id="careerGoals"
              placeholder="Describe your career objectives, desired roles, and long-term aspirations..."
              value={formData.careerGoals}
              onChange={(e) => handleInputChange("careerGoals", e.target.value)}
              className="bg-background border-border min-h-[120px]"
            />
          </div>

          <Button 
            onClick={generateDevelopmentPlan}
            disabled={isLoading}
            className="w-full xl-button-primary"
          >
            {isLoading ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Creating Development Plan...
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                Generate Development Pathway
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {developmentPlan && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Lightbulb className="h-5 w-5 text-primary" />
              Personalized Development Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-card-foreground bg-muted/30 p-4 rounded-lg border border-border">
                {developmentPlan}
              </pre>
            </div>
            
            <div className="mt-4 flex gap-2">
              <Button 
                onClick={createStructuredPlan}
                disabled={isCreating}
                className="bg-green-600 hover:bg-green-700"
              >
                {isCreating ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Creating Structured Plan...
                  </>
                ) : (
                  <>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Save as Structured Development Plan
                  </>
                )}
              </Button>
              
              <div className="text-xs text-muted-foreground flex items-center">
                💡 This will create a structured plan that appears in your analytics dashboard
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};