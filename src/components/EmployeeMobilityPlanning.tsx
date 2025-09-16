import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const EmployeeMobilityPlanning = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    employeeName: "",
    currentRole: "",
    department: "",
    experience: "",
    skills: "",
    targetRole: "",
    careerAspirations: "",
    performanceRating: ""
  });
  const [mobilityPlan, setMobilityPlan] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateMobilityPlan = async () => {
    if (!formData.employeeName || !formData.currentRole || !formData.targetRole) {
      toast({
        title: "Missing Information",
        description: "Please fill in employee name, current role, and target role.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('employee-mobility-planning', {
        body: {
          employeeData: {
            name: formData.employeeName,
            currentRole: formData.currentRole,
            department: formData.department,
            experience: formData.experience,
            skills: formData.skills.split(',').map(s => s.trim()),
            careerAspirations: formData.careerAspirations
          },
          targetRole: formData.targetRole,
          currentPerformance: formData.performanceRating
        }
      });

      if (error) throw error;

      setMobilityPlan(data.mobilityPlan);
      toast({
        title: "Mobility Plan Generated",
        description: "Career mobility plan has been successfully created.",
      });
    } catch (error) {
      console.error('Error generating mobility plan:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate mobility plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Users className="h-5 w-5 text-primary" />
            Employee Mobility & Planning
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
              <Label htmlFor="currentRole">Current Role</Label>
              <Input
                id="currentRole"
                placeholder="e.g., Software Developer"
                value={formData.currentRole}
                onChange={(e) => handleInputChange("currentRole", e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                placeholder="e.g., Engineering"
                value={formData.department}
                onChange={(e) => handleInputChange("department", e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Years of Experience</Label>
              <Input
                id="experience"
                placeholder="e.g., 5 years"
                value={formData.experience}
                onChange={(e) => handleInputChange("experience", e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetRole">Target Role</Label>
              <Input
                id="targetRole"
                placeholder="e.g., Senior Software Engineer"
                value={formData.targetRole}
                onChange={(e) => handleInputChange("targetRole", e.target.value)}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="performanceRating">Performance Rating</Label>
              <Select onValueChange={(value) => handleInputChange("performanceRating", value)}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exceeds">Exceeds Expectations</SelectItem>
                  <SelectItem value="meets">Meets Expectations</SelectItem>
                  <SelectItem value="below">Below Expectations</SelectItem>
                  <SelectItem value="needs-improvement">Needs Improvement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skills">Current Skills (comma-separated)</Label>
            <Textarea
              id="skills"
              placeholder="e.g., JavaScript, React, Node.js, Project Management"
              value={formData.skills}
              onChange={(e) => handleInputChange("skills", e.target.value)}
              className="bg-background border-border min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="careerAspirations">Career Aspirations</Label>
            <Textarea
              id="careerAspirations"
              placeholder="Describe long-term career goals and interests..."
              value={formData.careerAspirations}
              onChange={(e) => handleInputChange("careerAspirations", e.target.value)}
              className="bg-background border-border min-h-[100px]"
            />
          </div>

          <Button 
            onClick={generateMobilityPlan}
            disabled={isLoading}
            className="w-full xl-button-primary"
          >
            {isLoading ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Generating Mobility Plan...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                Generate Mobility Plan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {mobilityPlan && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <MapPin className="h-5 w-5 text-primary" />
              Career Mobility Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-card-foreground bg-muted/30 p-4 rounded-lg border border-border">
                {mobilityPlan}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};