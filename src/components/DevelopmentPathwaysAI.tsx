import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { BookOpen, ArrowRight, Target, Clock, Star, Users, RefreshCw, Brain, TrendingUp, Award } from "lucide-react";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDevelopmentAnalytics } from "@/hooks/useDevelopmentAnalytics";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  current_position: string;
  current_department: string;
  current_level: string;
  years_of_experience: number;
  skills: any;
  certifications: any;
  performance_rating: number;
  standard_role_id: string | null;
  source_company: string;
}

interface StandardRole {
  id: string;
  role_title: string;
  job_family: string;
  role_level: string;
  department: string;
  required_skills?: any;
}

interface DevelopmentPlan {
  id: string;
  employee_id: string;
  employee_name: string;
  current_position: string;
  department: string;
  experience: number;
  ai_development_plan: string;
  created_at: string;
  formattedPlan?: string;
}

export const DevelopmentPathwaysAI = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [standardRoles, setStandardRoles] = useState<StandardRole[]>([]);
  const [developmentPlans, setDevelopmentPlans] = useState<DevelopmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const { toast } = useToast();
  const { refresh: refreshAnalytics } = useDevelopmentAnalytics();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load employees and roles in parallel for faster loading
      const [employeesResult, rolesResult, developmentPlansResult] = await Promise.all([
        supabase
          .from('xlsmart_employees')
          .select('*')
          .eq('is_active', true)
          .order('first_name'),
        supabase
          .from('xlsmart_standard_roles')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('ai_analysis_results')
          .select('*')
          .eq('analysis_type', 'development_pathways')
          .order('created_at', { ascending: false })
      ]);

      if (employeesResult.error) throw employeesResult.error;
      if (rolesResult.error) throw rolesResult.error;
      if (developmentPlansResult.error) throw developmentPlansResult.error;

      setEmployees(employeesResult.data || []);
      setStandardRoles(rolesResult.data || []);
      
      // Transform AI analysis results into development plans
      const plans = (developmentPlansResult.data || []).map(result => ({
        id: result.id,
        employee_id: result.input_parameters?.employee_id || '',
        employee_name: result.input_parameters?.employee_name || '',
        current_position: result.input_parameters?.current_position || '',
        department: result.input_parameters?.department || '',
        experience: result.input_parameters?.experience || 0,
        ai_development_plan: result.analysis_result?.developmentPlan || 'No development plan available',
        created_at: result.created_at
      }));
      
      setDevelopmentPlans(plans);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load development pathways data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runAIDevelopmentAnalysis = async () => {
    if (employees.length === 0) {
      toast({
        title: "No employees",
        description: "No employees found for development analysis",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setProgress({ processed: 0, total: employees.length });

    try {
      console.log('Starting AI development analysis for', employees.length, 'employees');

      // First, get all unique companies to ensure we use a valid identifier
      const { data: companiesData } = await supabase
        .from('xlsmart_employees')
        .select('source_company')
        .eq('is_active', true);
      
      const uniqueCompanies = [...new Set(companiesData?.map(emp => emp.source_company) || [])];
      const targetCompany = uniqueCompanies.length > 0 ? uniqueCompanies[0] : 'xl';
      
      console.log('Available companies:', uniqueCompanies, 'Using:', targetCompany);

      const { data, error } = await supabase.functions.invoke('development-pathways-bulk', {
        body: {
          pathwayType: 'company',
          identifier: targetCompany  // Use the first available company
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Development Analysis Complete",
          description: `Generated development plans for ${data.total_processed} employees`,
        });
        
        // Automatically convert AI analysis results to structured development plans
        console.log('Converting AI analysis results to structured development plans...');
        try {
          const { data: convertData, error: convertError } = await supabase.functions.invoke('convert-ai-to-development-plans', {
            body: {}
          });

          if (convertError) {
            console.error('Error converting to structured plans:', convertError);
            toast({
              title: "⚠️ Analysis Complete",
              description: `Generated development pathways, but failed to create structured plans. ${convertError.message}`,
              variant: "destructive"
            });
          } else {
            console.log(`Successfully converted ${convertData.converted} AI analysis results to structured development plans`);
            toast({
              title: "🎉 Complete Success!",
              description: `Generated development pathways and created ${convertData.converted} structured development plans. Analytics updated!`,
            });
            
            // Refresh the main analytics dashboard
            refreshAnalytics();
          }
        } catch (convertError) {
          console.error('Error in conversion process:', convertError);
          toast({
            title: "⚠️ Analysis Complete",
            description: "Generated development pathways, but failed to create structured plans.",
            variant: "destructive"
          });
        }
        
        // Reload data to show new development plans
        await loadData();
      }

    } catch (error: any) {
      console.error('Development analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to run development analysis",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  };

  const getSkillGaps = (employee: Employee) => {
    // Find the target role and identify skill gaps
    const targetRole = standardRoles.find(role => role.id === employee.standard_role_id);
    if (!targetRole || !targetRole.required_skills) return [];

    const currentSkills = Array.isArray(employee.skills) ? employee.skills : [];
    const requiredSkills = Array.isArray(targetRole.required_skills) ? targetRole.required_skills : [];
    
    return requiredSkills.filter(skill => 
      !currentSkills.some(currentSkill => 
        currentSkill.toLowerCase().includes(skill.toLowerCase())
      )
    ).slice(0, 3);
  };

  const getDevelopmentPriority = (employee: Employee) => {
    const experience = employee.years_of_experience || 0;
    const performance = employee.performance_rating || 0;
    const skillGaps = getSkillGaps(employee).length;
    
    if (performance >= 4 && skillGaps <= 2) return "Advanced";
    if (performance >= 3 && experience >= 3) return "Intermediate";
    return "Foundation";
  };

  const getLearningRecommendations = (employee: Employee) => {
    const skillGaps = getSkillGaps(employee);
    const priority = getDevelopmentPriority(employee);
    
    const recommendations = [];
    
    if (skillGaps.length > 0) {
      recommendations.push(`Skill development: ${skillGaps.join(', ')}`);
    }
    
    if (priority === "Advanced") {
      recommendations.push("Leadership training", "Mentoring opportunities");
    } else if (priority === "Intermediate") {
      recommendations.push("Cross-functional projects", "Certification programs");
    } else {
      recommendations.push("Foundation courses", "On-the-job training");
    }
    
    return recommendations.slice(0, 3);
  };

  const calculateProgressPercentage = () => {
    if (!progress) return 0;
    return (progress.processed / progress.total) * 100;
  };


  // Simple formatting for development plans
  const formatDevelopmentPlan = useCallback((text: string) => {
    if (!text) return '';
    
    return text
      // Basic headers
      .replace(/###\s+(.*?)(?=\n|$)/g, '<h4 class="font-semibold text-blue-600 mt-3 mb-2">$1</h4>')
      .replace(/##\s+(.*?)(?=\n|$)/g, '<h3 class="font-bold text-gray-800 mt-4 mb-2">$1</h3>')
      
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      
      // Simple bullet points
      .replace(/^[-•]\s+(.*)$/gm, '<div class="mb-1">• $1</div>')
      
      // Basic line breaks
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading development pathways data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Development Pathways</h2>
          <p className="text-muted-foreground">
            AI-powered learning and development planning for employee growth
          </p>
        </div>
        <Button
          onClick={runAIDevelopmentAnalysis}
          disabled={analyzing || employees.length === 0}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {analyzing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Run AI Development Analysis & Create Plans
            </>
          )}
        </Button>
      </div>

      {analyzing && progress && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Analyzing development pathways...</span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <Progress value={calculateProgressPercentage()} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employees">Development Analysis</TabsTrigger>
          <TabsTrigger value="pathways">Learning Pathways</TabsTrigger>
          <TabsTrigger value="ai-results">AI Results</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employees.length}</div>
                <p className="text-xs text-muted-foreground">
                  Active employees for development
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Learning Paths</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">
                  Foundation, Intermediate, Advanced
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">High Performers</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {employees.filter(emp => emp.performance_rating >= 4).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ready for advanced development
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Skill Gaps</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {employees.reduce((total, emp) => total + getSkillGaps(emp).length, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total identified skill gaps
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Employee Development Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Priority Level</TableHead>
                    <TableHead>Skill Gaps</TableHead>
                    <TableHead>Learning Recommendations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => {
                    const priority = getDevelopmentPriority(employee);
                    const skillGaps = getSkillGaps(employee);
                    const recommendations = getLearningRecommendations(employee);
                    
                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {employee.employee_number}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{employee.current_position}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {employee.years_of_experience || 0} years
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            {employee.performance_rating || 0}/5
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              priority === 'Advanced' ? 'default' : 
                              priority === 'Intermediate' ? 'secondary' : 'outline'
                            }
                          >
                            {priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {skillGaps.length > 0 ? skillGaps.map((gap, index) => (
                              <Badge key={index} variant="destructive" className="text-xs">
                                {gap}
                              </Badge>
                            )) : (
                              <span className="text-sm text-green-600">No major gaps</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {recommendations.map((rec, index) => (
                              <div key={index} className="flex items-center gap-1 text-sm">
                                <ArrowRight className="h-3 w-3 text-purple-500" />
                                {rec}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pathways" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  Foundation Path
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    For employees new to their roles or the organization
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium">Key Components:</div>
                    <ul className="text-sm space-y-1">
                      <li>• Basic skill training</li>
                      <li>• Company orientation</li>
                      <li>• Mentorship programs</li>
                      <li>• Foundational certifications</li>
                    </ul>
                  </div>
                  <div className="text-lg font-bold">
                    {employees.filter(emp => getDevelopmentPriority(emp) === 'Foundation').length} employees
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Intermediate Path
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    For experienced employees ready to advance
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium">Key Components:</div>
                    <ul className="text-sm space-y-1">
                      <li>• Advanced skill development</li>
                      <li>• Cross-functional projects</li>
                      <li>• Professional certifications</li>
                      <li>• Leadership training</li>
                    </ul>
                  </div>
                  <div className="text-lg font-bold">
                    {employees.filter(emp => getDevelopmentPriority(emp) === 'Intermediate').length} employees
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-500" />
                  Advanced Path
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    For high performers ready for leadership roles
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium">Key Components:</div>
                    <ul className="text-sm space-y-1">
                      <li>• Executive training</li>
                      <li>• Strategic projects</li>
                      <li>• Mentoring others</li>
                      <li>• Innovation initiatives</li>
                    </ul>
                  </div>
                  <div className="text-lg font-bold">
                    {employees.filter(emp => getDevelopmentPriority(emp) === 'Advanced').length} employees
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Generated Development Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              {developmentPlans.length > 0 ? (
                <div className="space-y-6">
                  {developmentPlans.slice(0, 10).map((plan) => {
                    const employee = employees.find(emp => emp.id === plan.employee_id);
                    return (
                      <div key={plan.id} className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-lg text-gray-900">
                              {plan.employee_name || `${employee?.first_name} ${employee?.last_name}` || 'Unknown Employee'}
                            </h4>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline">{plan.current_position}</Badge>
                              <Badge variant="secondary">{plan.department}</Badge>
                              <Badge variant="outline">{plan.experience} years exp</Badge>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(plan.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        
                        <div className="bg-white border border-gray-200 p-6 rounded-lg">
                          <h5 className="font-semibold text-base mb-4 text-gray-800 border-b border-gray-200 pb-2">
                            AI Development Recommendations
                          </h5>
                          <div className="max-w-none">
                            <div 
                              className="text-sm leading-relaxed text-gray-700"
                              dangerouslySetInnerHTML={{ __html: formatDevelopmentPlan(plan.ai_development_plan) }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {developmentPlans.length > 10 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">
                        Showing first 10 of {developmentPlans.length} development plans
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">No AI Results Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Run the AI Development Analysis to generate personalized development plans
                  </p>
                  <Button
                    onClick={runAIDevelopmentAnalysis}
                    disabled={analyzing || employees.length === 0}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {analyzing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        Run AI Development Analysis
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};