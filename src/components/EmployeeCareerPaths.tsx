import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, MapPin, Star, Clock, Building, Users, UserCheck, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkCareerPathProgress {
  total: number;
  processed: number;
  completed: number;
  errors: number;
}

interface CareerPath {
  currentRole: string;
  nextRoles: string[];
  timeframe: string;
  requiredSkills: string[];
  certifications: string[];
  recommendations: string;
}

export const EmployeeCareerPaths = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("individual");
  
  // Individual form data
  const [formData, setFormData] = useState({
    employeeName: "",
    currentPosition: "",
    department: "",
    experienceYears: "",
    currentSkills: "",
    careerInterests: "",
    preferredDirection: "",
    geographicFlexibility: "",
    leadershipAspiration: ""
  });
  
  // Bulk selection data
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  
  // State management
  const [careerPath, setCareerPath] = useState<CareerPath | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkCareerPathProgress>({ total: 0, processed: 0, completed: 0, errors: 0 });
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

  const generateIndividualCareerPath = async () => {
    if (!formData.employeeName || !formData.currentPosition || !formData.careerInterests) {
      toast({
        title: "Missing Information",
        description: "Please fill in employee name, current position, and career interests.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('employee-career-paths', {
        body: {
          employeeData: {
            name: formData.employeeName,
            currentPosition: formData.currentPosition,
            department: formData.department,
            experienceYears: parseInt(formData.experienceYears) || 0,
            currentSkills: formData.currentSkills.split(',').map(s => s.trim()),
            careerInterests: formData.careerInterests,
            preferredDirection: formData.preferredDirection,
            geographicFlexibility: formData.geographicFlexibility,
            leadershipAspiration: formData.leadershipAspiration
          }
        }
      });

      if (error) throw error;

      setCareerPath(data.careerPath);
      toast({
        title: "Success!",
        description: "Career path generated successfully"
      });
    } catch (error: any) {
      console.error('Error generating career path:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate career path",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runBulkCareerPaths = async (type: 'company' | 'department' | 'role', identifier: string) => {
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
      const { data, error } = await supabase.functions.invoke('employee-career-paths-bulk', {
        body: {
          careerPathType: type,
          identifier
        }
      });

      if (error) throw error;

      setSessionId(data.sessionId);
      
      // Poll for progress
      const pollProgress = setInterval(async () => {
        const { data: progressData } = await supabase.functions.invoke('employee-career-paths-progress', {
          body: { sessionId: data.sessionId }
        });

        if (progressData) {
          setBulkProgress(progressData.progress);
          
          if (progressData.status === 'completed') {
            clearInterval(pollProgress);
            setIsBulkProcessing(false);
            toast({
              title: "Bulk Career Paths Complete!",
              description: `Generated career paths for ${progressData.progress.completed} employees`
            });
          } else if (progressData.status === 'error') {
            clearInterval(pollProgress);
            setIsBulkProcessing(false);
            toast({
              title: "Career Path Generation Failed",
              description: progressData.error || "An error occurred during bulk processing",
              variant: "destructive"
            });
          }
        }
      }, 3000);

    } catch (error: any) {
      console.error('Bulk career paths error:', error);
      setIsBulkProcessing(false);
      toast({
        title: "Career Path Generation Failed",
        description: error.message || "Failed to start bulk career path generation",
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
          <TrendingUp className="h-5 w-5" />
          Employee Career Paths
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
                <Label htmlFor="currentPosition">Current Position</Label>
                <Input
                  id="currentPosition"
                  value={formData.currentPosition}
                  onChange={(e) => handleInputChange("currentPosition", e.target.value)}
                  placeholder="Enter current position"
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
                <Label htmlFor="experienceYears">Years of Experience</Label>
                <Input
                  id="experienceYears"
                  type="number"
                  value={formData.experienceYears}
                  onChange={(e) => handleInputChange("experienceYears", e.target.value)}
                  placeholder="Enter years of experience"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentSkills">Current Skills</Label>
              <Textarea
                id="currentSkills"
                value={formData.currentSkills}
                onChange={(e) => handleInputChange("currentSkills", e.target.value)}
                placeholder="Enter current skills (comma-separated)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="careerInterests">Career Interests & Goals</Label>
              <Textarea
                id="careerInterests"
                value={formData.careerInterests}
                onChange={(e) => handleInputChange("careerInterests", e.target.value)}
                placeholder="Describe career interests, goals, and aspirations"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preferredDirection">Preferred Career Direction</Label>
                <Select value={formData.preferredDirection} onValueChange={(value) => handleInputChange("preferredDirection", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical/Specialist</SelectItem>
                    <SelectItem value="management">Management/Leadership</SelectItem>
                    <SelectItem value="mixed">Mixed Technical-Management</SelectItem>
                    <SelectItem value="entrepreneurial">Entrepreneurial</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="open">Open to All Paths</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadershipAspiration">Leadership Aspiration</Label>
                <Select value={formData.leadershipAspiration} onValueChange={(value) => handleInputChange("leadershipAspiration", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select aspiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual-contributor">Individual Contributor</SelectItem>
                    <SelectItem value="team-lead">Team Lead</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="senior-manager">Senior Manager</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="geographicFlexibility">Geographic Flexibility</Label>
              <Select value={formData.geographicFlexibility} onValueChange={(value) => handleInputChange("geographicFlexibility", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select flexibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-location">Current Location Only</SelectItem>
                  <SelectItem value="domestic">Domestic Relocation</SelectItem>
                  <SelectItem value="international">International Relocation</SelectItem>
                  <SelectItem value="remote">Remote Work Preferred</SelectItem>
                  <SelectItem value="flexible">Fully Flexible</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={generateIndividualCareerPath} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Career Path...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Generate Career Path
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
              onClick={() => runBulkCareerPaths('company', selectedCompany)} 
              disabled={!selectedCompany || isBulkProcessing}
              className="w-full"
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating for Company...
                </>
              ) : (
                <>
                  <Building className="mr-2 h-4 w-4" />
                  Generate Career Paths for All Company Employees
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
              onClick={() => runBulkCareerPaths('department', selectedDepartment)} 
              disabled={!selectedDepartment || isBulkProcessing}
              className="w-full"
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating for Department...
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Generate Career Paths for All Department Employees
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
              onClick={() => runBulkCareerPaths('role', selectedRole)} 
              disabled={!selectedRole || isBulkProcessing}
              className="w-full"
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating for Role...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Generate Career Paths for All Role Employees
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {isBulkProcessing && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Bulk Career Path Generation Progress</span>
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

        {careerPath && activeTab === "individual" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Generated Career Path
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Current Role</h4>
                    <Badge variant="outline">{careerPath.currentRole}</Badge>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm mb-2">Timeframe</h4>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {careerPath.timeframe}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-3">Next Possible Roles</h4>
                  <div className="flex flex-wrap gap-2">
                    {careerPath.nextRoles.map((role, index) => (
                      <div key={index} className="flex items-center gap-1">
                        <Badge>{role}</Badge>
                        {index < careerPath.nextRoles.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Required Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {careerPath.requiredSkills.map((skill, index) => (
                      <Badge key={index} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Recommended Certifications</h4>
                  <div className="flex flex-wrap gap-2">
                    {careerPath.certifications.map((cert, index) => (
                      <Badge key={index} variant="outline">{cert}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Career Path Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm">{careerPath.recommendations}</div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};