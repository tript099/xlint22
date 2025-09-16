import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, Target, Clock, ArrowRight, Star, BookOpen, Loader2 } from "lucide-react";

interface CareerPathwaysProps {
  metrics: any;
}

export const CareerPathwaysDashboard = ({ metrics }: CareerPathwaysProps) => {
  const [showCreatePlanDialog, setShowCreatePlanDialog] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPathway, setSelectedPathway] = useState<any>(null);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    employeeId: "",
    employeeName: "",
    currentPosition: "",
    targetRole: "",
    careerGoals: "",
    currentSkills: "",
    timeframe: "12"
  });

  // Fetch employees for the dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from('xlsmart_employees')
        .select('id, first_name, last_name, current_position, current_department')
        .eq('is_active', true)
        .order('first_name');
      
      if (!error && data) {
        setEmployees(data);
      }
    };
    
    fetchEmployees();
  }, []);

  if (!metrics) return null;

  // Function to create development plan
  const createDevelopmentPlan = async () => {
    if (!formData.employeeId || !formData.careerGoals || !formData.targetRole) {
      toast({
        title: "Missing Information",
        description: "Please fill in employee, target role, and career goals.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Find selected employee details
      const selectedEmployee = employees.find(emp => emp.id === formData.employeeId);
      
      // Generate development plan using the existing Supabase function
      const { data, error } = await supabase.functions.invoke('development-pathways', {
        body: {
          employeeProfile: {
            name: formData.employeeName,
            currentPosition: formData.currentPosition,
            experienceLevel: 'Intermediate',
            department: selectedEmployee?.current_department || '',
          },
          careerGoals: formData.careerGoals,
          currentSkills: formData.currentSkills.split(',').map(s => s.trim()).filter(s => s),
          industryTrends: `Current trends in telecommunications and technology`
        }
      });

      if (error) throw error;

      // Save the structured development plan to xlsmart_development_plans table
      const developmentPlanData = {
        employee_id: formData.employeeId,
        target_role: formData.targetRole,
        current_skill_level: 0.0,
        target_skill_level: 5.0,
        development_areas: formData.currentSkills.split(',').map(s => s.trim()).filter(s => s),
        recommended_courses: [],
        recommended_certifications: [],
        recommended_projects: [],
        timeline_months: parseInt(formData.timeframe),
        progress_percentage: 0.0,
        plan_status: 'active',
        created_by: (await supabase.auth.getUser()).data.user?.id || '',
        assigned_to: formData.employeeId,
        next_review_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      };

      const { error: saveError } = await supabase
        .from('xlsmart_development_plans')
        .insert(developmentPlanData);

      if (saveError) throw saveError;

      toast({
        title: "Development Plan Created",
        description: `Successfully created development plan for ${formData.employeeName}`,
      });

      // Reset form and close dialog
      setFormData({
        employeeId: "",
        employeeName: "",
        currentPosition: "",
        targetRole: "",
        careerGoals: "",
        currentSkills: "",
        timeframe: "12"
      });
      setShowCreatePlanDialog(false);
      
    } catch (error) {
      console.error('Error creating development plan:', error);
      toast({
        title: "Error",
        description: "Failed to create development plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle employee selection
  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find(emp => emp.id === employeeId);
    if (employee) {
      setFormData({
        ...formData,
        employeeId,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        currentPosition: employee.current_position || ''
      });
    }
  };

  // Handle opening the dialog with pathway context
  const openCreatePlanDialog = (pathway: any) => {
    setSelectedPathway(pathway);
    setFormData({
      ...formData,
      targetRole: pathway.nextRoles[0] || '',
      currentSkills: pathway.requiredSkills.join(', ')
    });
    setShowCreatePlanDialog(true);
  };

  // Simulated career pathway data based on available metrics
  const careerPathways = [
    {
      currentRole: "Software Engineer",
      employees: Math.floor((metrics.totalEmployees || 0) * 0.25),
      nextRoles: ["Senior Software Engineer", "Tech Lead", "Engineering Manager"],
      readinessScore: 78,
      timeframe: "6-12 months",
      requiredSkills: ["Leadership", "System Design", "Mentoring"]
    },
    {
      currentRole: "Business Analyst",
      employees: Math.floor((metrics.totalEmployees || 0) * 0.15),
      nextRoles: ["Senior Business Analyst", "Product Manager", "Solutions Architect"],
      readinessScore: 65,
      timeframe: "8-15 months",
      requiredSkills: ["Product Management", "Stakeholder Management", "Strategic Thinking"]
    },
    {
      currentRole: "Marketing Specialist",
      employees: Math.floor((metrics.totalEmployees || 0) * 0.12),
      nextRoles: ["Marketing Manager", "Brand Manager", "Digital Marketing Lead"],
      readinessScore: 72,
      timeframe: "6-10 months",
      requiredSkills: ["Team Leadership", "Budget Management", "Campaign Strategy"]
    },
    {
      currentRole: "Data Analyst",
      employees: Math.floor((metrics.totalEmployees || 0) * 0.18),
      nextRoles: ["Senior Data Analyst", "Data Scientist", "Analytics Manager"],
      readinessScore: 84,
      timeframe: "4-8 months",
      requiredSkills: ["Machine Learning", "Data Engineering", "Statistical Modeling"]
    }
  ];

  const getReadinessColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getReadinessBadge = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  return (
    <div className="space-y-6">
      {/* Career Pathways Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{metrics.careerPathways?.totalPathways || 0}</p>
                <p className="text-sm text-muted-foreground">Active Pathways</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{metrics.mobilityPlanning?.readyForPromotion || 0}</p>
                <p className="text-sm text-muted-foreground">Ready for Promotion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{metrics.mobilityPlanning?.internalMoves || 0}</p>
                <p className="text-sm text-muted-foreground">Internal Moves</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{metrics.careerPathways?.avgReadinessScore || 0}%</p>
                <p className="text-sm text-muted-foreground">Avg Readiness</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Career Pathways */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Career Progression Analytics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {careerPathways.map((pathway, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-lg">{pathway.currentRole}</h4>
                    <p className="text-sm text-muted-foreground">
                      {pathway.employees} employees in this role
                    </p>
                  </div>
                  <Badge variant={getReadinessBadge(pathway.readinessScore)}>
                    {pathway.readinessScore}% Ready
                  </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Career Progression */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Next Career Steps</h5>
                    <div className="space-y-2">
                      {pathway.nextRoles.map((role, roleIndex) => (
                        <div key={roleIndex} className="flex items-center space-x-2 p-2 bg-muted/30 rounded">
                          <ArrowRight className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{role}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Readiness Progress */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Readiness Score</h5>
                    <div className="space-y-2">
                      <Progress value={pathway.readinessScore} className="h-3" />
                      <div className="flex justify-between text-sm">
                        <span className={getReadinessColor(pathway.readinessScore)}>
                          {pathway.readinessScore}% Ready
                        </span>
                        <span className="text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {pathway.timeframe}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Required Skills */}
                  <div className="space-y-3">
                    <h5 className="font-medium text-sm">Development Focus</h5>
                    <div className="flex flex-wrap gap-1">
                      {pathway.requiredSkills.map((skill, skillIndex) => (
                        <Badge key={skillIndex} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => openCreatePlanDialog(pathway)}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Create Development Plan
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Succession Planning */}
      <Card>
        <CardHeader>
          <CardTitle>Succession Planning Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                role: "Engineering Manager",
                criticality: "High",
                successors: 3,
                readiness: "2 ready now, 1 in 6 months",
                risk: "Low"
              },
              {
                role: "Product Manager",
                criticality: "High",
                successors: 2,
                readiness: "1 ready now, 1 in 12 months",
                risk: "Medium"
              },
              {
                role: "Sales Director",
                criticality: "Critical",
                successors: 1,
                readiness: "1 ready in 8 months",
                risk: "High"
              }
            ].map((succession, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{succession.role}</h4>
                  <Badge variant={
                    succession.criticality === "Critical" ? "destructive" :
                    succession.criticality === "High" ? "secondary" : "outline"
                  }>
                    {succession.criticality}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Successors:</span>
                    <span className="font-medium">{succession.successors}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Readiness:</span>
                    <p className="text-xs mt-1">{succession.readiness}</p>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk:</span>
                    <Badge variant={
                      succession.risk === "High" ? "destructive" :
                      succession.risk === "Medium" ? "secondary" : "outline"
                    }>
                      {succession.risk}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Development Plan Dialog */}
      <Dialog open={showCreatePlanDialog} onOpenChange={setShowCreatePlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Create Development Plan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Employee Selection */}
            <div className="space-y-2">
              <Label htmlFor="employee">Select Employee</Label>
              <Select value={formData.employeeId} onValueChange={handleEmployeeSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} - {employee.current_position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Role */}
            <div className="space-y-2">
              <Label htmlFor="targetRole">Target Role</Label>
              <Input
                id="targetRole"
                value={formData.targetRole}
                onChange={(e) => setFormData({...formData, targetRole: e.target.value})}
                placeholder="e.g., Senior Software Engineer"
              />
            </div>

            {/* Career Goals */}
            <div className="space-y-2">
              <Label htmlFor="careerGoals">Career Goals</Label>
              <Textarea
                id="careerGoals"
                value={formData.careerGoals}
                onChange={(e) => setFormData({...formData, careerGoals: e.target.value})}
                placeholder="Describe the employee's career aspirations and objectives..."
                rows={3}
              />
            </div>

            {/* Current Skills */}
            <div className="space-y-2">
              <Label htmlFor="currentSkills">Current Skills (comma-separated)</Label>
              <Input
                id="currentSkills"
                value={formData.currentSkills}
                onChange={(e) => setFormData({...formData, currentSkills: e.target.value})}
                placeholder="e.g., JavaScript, React, Node.js"
              />
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              <Label htmlFor="timeframe">Development Timeline (months)</Label>
              <Select value={formData.timeframe} onValueChange={(value) => setFormData({...formData, timeframe: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="18">18 months</SelectItem>
                  <SelectItem value="24">24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowCreatePlanDialog(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                onClick={createDevelopmentPlan}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Plan...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Create Plan
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};