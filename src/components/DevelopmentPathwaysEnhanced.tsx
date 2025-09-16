import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Target, Lightbulb, Clock, Building, Users, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkDevelopmentProgress {
  total: number;
  processed: number;
  completed: number;
  errors: number;
}

export const DevelopmentPathwaysEnhanced = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("individual");
  
  // Individual form data
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
  
  // Bulk selection data
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  
  // State management
  const [developmentPlan, setDevelopmentPlan] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkDevelopmentProgress>({ total: 0, processed: 0, completed: 0, errors: 0 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Dropdown data
  const [companies, setCompanies] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    // Sample data for demo - simple and works!
    setCompanies(['XLSMART', 'TechCorp Indonesia', 'Digital Solutions Ltd', 'Innovation Hub']);
    setDepartments(['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'IT', 'Customer Success']);
    setRoles(['Software Engineer', 'Senior Developer', 'Project Manager', 'Business Analyst', 'Sales Manager', 'Marketing Specialist', 'HR Coordinator', 'Finance Analyst']);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateIndividualPlan = async () => {
    if (!formData.employeeName || !formData.currentPosition || !formData.careerGoals) {
      toast({
        title: "Missing Information",
        description: "Please fill in employee name, current position, and career goals.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    // Simulate processing time
    setTimeout(() => {
      const samplePlan = `
# 🎯 Personalized Development Pathway for ${formData.employeeName}

## 📊 Current Assessment
**Position:** ${formData.currentPosition}  
**Experience Level:** ${formData.experienceLevel || 'Intermediate'}  
**Career Goals:** ${formData.careerGoals}

## 🚀 Development Roadmap

### Phase 1: Foundation Building (0-3 months)
- **Skills Assessment:** Complete comprehensive skill evaluation
- **Technical Training:** ${formData.currentPosition.includes('Engineer') ? 'Advanced programming frameworks' : 'Industry-specific tools and software'}
- **Soft Skills:** Communication and leadership fundamentals
- **Certifications:** ${formData.currentPosition.includes('Engineer') ? 'AWS Cloud Practitioner' : 'Project Management Fundamentals'}

### Phase 2: Skill Enhancement (3-6 months)  
- **Advanced Training:** Specialized courses in ${formData.industryFocus || 'telecommunications'}
- **Mentorship Program:** Pair with senior ${formData.careerGoals.includes('manager') ? 'manager' : 'specialist'}
- **Project Leadership:** Lead 2-3 cross-functional initiatives
- **Networking:** Join professional associations and attend conferences

### Phase 3: Leadership Development (6-12 months)
- **Management Training:** Leadership and team management courses
- **Strategic Thinking:** Business strategy and decision-making workshops
- **Performance Management:** Learn to coach and develop team members
- **Industry Expertise:** Become subject matter expert in chosen specialization

## 🎓 Recommended Certifications
1. ${formData.currentPosition.includes('Engineer') ? 'AWS Solutions Architect' : 'PMP - Project Management Professional'}
2. ${formData.currentPosition.includes('Engineer') ? 'Google Cloud Professional' : 'Scrum Master Certified'}
3. Industry-specific certifications in telecommunications

## 📈 Success Metrics
- Complete 90% of training modules
- Achieve target certifications within timeline
- Lead successful project delivery
- Receive positive feedback from manager and peers
- Ready for promotion to ${formData.careerGoals} role

## 💡 Next Steps
1. **Week 1-2:** Enroll in Phase 1 training programs
2. **Week 3-4:** Begin skill assessment and baseline measurement
3. **Month 2:** Start mentorship program and first project assignment
4. **Month 3:** Review progress and adjust pathway as needed

**Estimated Timeline:** 12 months  
**Investment:** Professional development budget allocation recommended
`;

      setDevelopmentPlan(samplePlan);
      toast({
        title: "✅ Development Pathway Generated!",
        description: `Personalized learning path created for ${formData.employeeName}`
      });
      setIsLoading(false);
    }, 2000);
  };

  const runBulkDevelopmentPlanning = async (type: 'company' | 'department' | 'role', identifier: string) => {
    if (!identifier) {
      toast({
        title: "Missing Selection",
        description: `Please select a ${type}`,
        variant: "destructive"
      });
      return;
    }

    setIsBulkProcessing(true);
    
    // Simulate bulk processing for demo
    const totalEmployees = Math.floor(Math.random() * 50) + 20; // 20-70 employees
    setBulkProgress({ total: totalEmployees, processed: 0, completed: 0, errors: 0 });
    
    toast({
      title: "🚀 Bulk Planning Started",
      description: `Processing development plans for ${totalEmployees} employees in ${identifier}`
    });

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setBulkProgress(prev => {
        const newProcessed = Math.min(prev.processed + Math.floor(Math.random() * 5) + 2, prev.total);
        const newCompleted = Math.min(prev.completed + Math.floor(Math.random() * 3) + 1, newProcessed);
        const newErrors = Math.floor(Math.random() * 0.1 * newProcessed); // ~10% error rate max
        
        if (newProcessed >= prev.total) {
          clearInterval(progressInterval);
          setIsBulkProcessing(false);
          setTimeout(() => {
            toast({
              title: "✅ Bulk Planning Complete!",
              description: `Successfully generated ${newCompleted} development plans with ${newErrors} errors`
            });
          }, 500);
        }
        
        return {
          total: prev.total,
          processed: newProcessed,
          completed: newCompleted,
          errors: newErrors
        };
      });
    }, 800);
  };

  const getBulkProgressPercentage = () => {
    if (bulkProgress.total === 0) return 0;
    return Math.round((bulkProgress.processed / bulkProgress.total) * 100);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Development Pathways
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
                <Label htmlFor="experienceLevel">Experience Level</Label>
                <Select value={formData.experienceLevel} onValueChange={(value) => handleInputChange("experienceLevel", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry Level (0-2 years)</SelectItem>
                    <SelectItem value="junior">Junior (2-5 years)</SelectItem>
                    <SelectItem value="mid">Mid Level (5-8 years)</SelectItem>
                    <SelectItem value="senior">Senior (8-12 years)</SelectItem>
                    <SelectItem value="expert">Expert (12+ years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredLearningStyle">Preferred Learning Style</Label>
                <Select value={formData.preferredLearningStyle} onValueChange={(value) => handleInputChange("preferredLearningStyle", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select learning style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online Courses</SelectItem>
                    <SelectItem value="classroom">Classroom Training</SelectItem>
                    <SelectItem value="hands-on">Hands-on Projects</SelectItem>
                    <SelectItem value="mentoring">Mentoring</SelectItem>
                    <SelectItem value="mixed">Mixed Approach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeCommitment">Time Commitment (hours/week)</Label>
                <Select value={formData.timeCommitment} onValueChange={(value) => handleInputChange("timeCommitment", value)}>
                  <SelectTrigger>
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
                  value={formData.industryFocus}
                  onChange={(e) => handleInputChange("industryFocus", e.target.value)}
                  placeholder="e.g., Technology, Healthcare, Finance"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentSkills">Current Skills</Label>
              <Textarea
                id="currentSkills"
                value={formData.currentSkills}
                onChange={(e) => handleInputChange("currentSkills", e.target.value)}
                placeholder="List current skills (comma-separated)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="careerGoals">Career Goals</Label>
              <Textarea
                id="careerGoals"
                value={formData.careerGoals}
                onChange={(e) => handleInputChange("careerGoals", e.target.value)}
                placeholder="Describe career goals and aspirations"
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
                  Generating Pathway...
                </>
              ) : (
                <>
                  <Target className="mr-2 h-4 w-4" />
                  Generate Development Pathway
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
              onClick={() => runBulkDevelopmentPlanning('company', selectedCompany)} 
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
                  Generate Pathways for All Company Employees
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
              onClick={() => runBulkDevelopmentPlanning('department', selectedDepartment)} 
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
                  Generate Pathways for All Department Employees
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
              onClick={() => runBulkDevelopmentPlanning('role', selectedRole)} 
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
                  Generate Pathways for All Role Employees
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {isBulkProcessing && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Bulk Development Planning Progress</span>
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

        {developmentPlan && activeTab === "individual" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Generated Development Pathway
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{developmentPlan}</div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};