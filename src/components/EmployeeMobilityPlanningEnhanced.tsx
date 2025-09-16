import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Users, TrendingUp, MapPin, Clock, Building, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkMobilityProgress {
  total: number;
  processed: number;
  completed: number;
  errors: number;
}

export const EmployeeMobilityPlanningEnhanced = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("individual");
  
  // Individual form data
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
  
  // Bulk selection data
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  
  // State management
  const [mobilityPlan, setMobilityPlan] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkMobilityProgress>({ total: 0, processed: 0, completed: 0, errors: 0 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Dropdown data
  const [companies, setCompanies] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    // Fetch companies
    const { data: companyData } = await supabase
      .from('xlsmart_employees')
      .select('source_company')
      .eq('is_active', true);
    if (companyData) {
      const uniqueCompanies = [...new Set(companyData.map(item => item.source_company))];
      setCompanies(uniqueCompanies);
    }

    // Fetch departments
    const { data: deptData } = await supabase
      .from('xlsmart_employees')
      .select('current_department')
      .eq('is_active', true);
    if (deptData) {
      const uniqueDepartments = [...new Set(deptData.map(item => item.current_department).filter(Boolean))];
      setDepartments(uniqueDepartments);
    }

    // Fetch roles
    const { data: roleData } = await supabase
      .from('xlsmart_employees')
      .select('current_position')
      .eq('is_active', true);
    if (roleData) {
      const uniqueRoles = [...new Set(roleData.map(item => item.current_position))];
      setRoles(uniqueRoles);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateIndividualPlan = async () => {
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
            targetRole: formData.targetRole,
            careerAspirations: formData.careerAspirations,
            performanceRating: formData.performanceRating
          }
        }
      });

      if (error) throw error;

      setMobilityPlan(data.mobilityPlan);
      toast({
        title: "Success!",
        description: "Mobility plan generated successfully"
      });
    } catch (error: any) {
      console.error('Error generating mobility plan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate mobility plan",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runBulkMobilityPlanning = async (type: 'company' | 'department' | 'role', identifier: string) => {
    if (!identifier) {
      toast({
        title: "Missing Selection",
        description: `Please select a ${type}`,
        variant: "destructive"
      });
      return;
    }

    setIsBulkProcessing(true);
    setBulkProgress({ total: 0, processed: 0, completed: 0, errors: 0 });

    try {
      const { data, error } = await supabase.functions.invoke('employee-mobility-planning-bulk', {
        body: {
          planningType: type,
          identifier
        }
      });

      if (error) throw error;

      setSessionId(data.sessionId);
      
      // Poll for progress
      const pollProgress = setInterval(async () => {
        const { data: progressData } = await supabase.functions.invoke('employee-mobility-planning-progress', {
          body: { sessionId: data.sessionId }
        });

        if (progressData) {
          setBulkProgress(progressData.progress);
          
          if (progressData.status === 'completed') {
            clearInterval(pollProgress);
            setIsBulkProcessing(false);
            toast({
              title: "Bulk Planning Complete!",
              description: `Generated mobility plans for ${progressData.progress.completed} employees`
            });
          } else if (progressData.status === 'error') {
            clearInterval(pollProgress);
            setIsBulkProcessing(false);
            toast({
              title: "Planning Failed",
              description: progressData.error || "An error occurred during bulk planning",
              variant: "destructive"
            });
          }
        }
      }, 3000);

    } catch (error: any) {
      console.error('Bulk planning error:', error);
      setIsBulkProcessing(false);
      toast({
        title: "Planning Failed",
        description: error.message || "Failed to start bulk planning",
        variant: "destructive"
      });
    }
  };

  const getBulkProgressPercentage = () => {
    if (bulkProgress.total === 0) return 0;
    return Math.round((bulkProgress.processed / bulkProgress.total) * 100);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Employee Mobility Planning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="company">By Company</TabsTrigger>
            <TabsTrigger value="department">By Department</TabsTrigger>
            <TabsTrigger value="role">By Role</TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeeName">Employee Name</Label>
                <Input
                  id="employeeName"
                  value={formData.employeeName}
                  onChange={(e) => handleInputChange("employeeName", e.target.value)}
                  placeholder="Enter employee name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentRole">Current Role</Label>
                <Input
                  id="currentRole"
                  value={formData.currentRole}
                  onChange={(e) => handleInputChange("currentRole", e.target.value)}
                  placeholder="Enter current role"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => handleInputChange("department", e.target.value)}
                  placeholder="Enter department"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Years of Experience</Label>
                <Input
                  id="experience"
                  value={formData.experience}
                  onChange={(e) => handleInputChange("experience", e.target.value)}
                  placeholder="Enter years of experience"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skills">Current Skills</Label>
              <Textarea
                id="skills"
                value={formData.skills}
                onChange={(e) => handleInputChange("skills", e.target.value)}
                placeholder="Enter current skills (comma-separated)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetRole">Target Role</Label>
                <Input
                  id="targetRole"
                  value={formData.targetRole}
                  onChange={(e) => handleInputChange("targetRole", e.target.value)}
                  placeholder="Enter target role"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="performanceRating">Performance Rating</Label>
                <Select value={formData.performanceRating} onValueChange={(value) => handleInputChange("performanceRating", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exceptional">Exceptional</SelectItem>
                    <SelectItem value="exceeds">Exceeds Expectations</SelectItem>
                    <SelectItem value="meets">Meets Expectations</SelectItem>
                    <SelectItem value="below">Below Expectations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="careerAspirations">Career Aspirations</Label>
              <Textarea
                id="careerAspirations"
                value={formData.careerAspirations}
                onChange={(e) => handleInputChange("careerAspirations", e.target.value)}
                placeholder="Describe career aspirations and goals"
              />
            </div>

            <Button 
              onClick={generateIndividualPlan} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Generate Mobility Plan
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="company" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-select">Select Company</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => runBulkMobilityPlanning('company', selectedCompany)} 
              disabled={!selectedCompany || isBulkProcessing}
              className="w-full"
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Planning for Company...
                </>
              ) : (
                <>
                  <Building className="mr-2 h-4 w-4" />
                  Generate Plans for All Company Employees
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="department" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="department-select">Select Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => runBulkMobilityPlanning('department', selectedDepartment)} 
              disabled={!selectedDepartment || isBulkProcessing}
              className="w-full"
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Planning for Department...
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Generate Plans for All Department Employees
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="role" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-select">Select Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => runBulkMobilityPlanning('role', selectedRole)} 
              disabled={!selectedRole || isBulkProcessing}
              className="w-full"
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Planning for Role...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Generate Plans for All Role Employees
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {isBulkProcessing && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Bulk Mobility Planning Progress</span>
                <span>{getBulkProgressPercentage()}%</span>
              </div>
              <Progress value={getBulkProgressPercentage()} className="w-full" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{bulkProgress.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{bulkProgress.processed}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{bulkProgress.completed}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{bulkProgress.errors}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
            </div>
          </div>
        )}

        {mobilityPlan && activeTab === "individual" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Generated Mobility Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{mobilityPlan}</div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};