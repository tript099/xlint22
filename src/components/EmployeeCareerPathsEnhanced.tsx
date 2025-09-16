import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, ArrowRight, MapPin, Star, Clock, Building, Users, RefreshCw, Brain, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

interface CareerPath {
  id: string;
  employee_id: string;
  lateralRoles: string[];
  nextRoles: string[];
  requiredSkills: string[];
  certifications: string[];
  actionsPlan: {
    lateral: string[];
    vertical: string[];
  };
  recommendations: string;
  created_at: string;
}

export const EmployeeCareerPathsEnhanced = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [standardRoles, setStandardRoles] = useState<StandardRole[]>([]);
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all employees
      const { data: employeesData, error: employeesError } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('is_active', true)
        .order('first_name');

      if (employeesError) throw employeesError;

      // Load standard roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('xlsmart_standard_roles')
        .select('*')
        .eq('is_active', true);

      if (rolesError) throw rolesError;

      // Load AI-generated career paths
      const { data: careerPathsData, error: careerPathsError } = await supabase
        .from('ai_analysis_results')
        .select('*')
        .eq('analysis_type', 'career_path')
        .order('created_at', { ascending: false });

      if (careerPathsError) throw careerPathsError;

      // Transform career paths data
      const transformedCareerPaths = careerPathsData?.map(path => {
        const inputParams = path.input_parameters as any;
        const analysisResult = path.analysis_result as any;
        
        return {
          id: path.id,
          employee_id: inputParams?.employee_id || '',
          lateralRoles: analysisResult?.lateralRoles || [],
          nextRoles: analysisResult?.nextRoles || [],
          requiredSkills: analysisResult?.requiredSkills || [],
          certifications: analysisResult?.certifications || [],
          actionsPlan: analysisResult?.actionsPlan || { lateral: [], vertical: [] },
          recommendations: analysisResult?.recommendations || '',
          created_at: path.created_at
        };
      }) || [];

      setEmployees(employeesData || []);
      setStandardRoles(rolesData || []);
      setCareerPaths(transformedCareerPaths);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load career path data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runAICareerPathAnalysis = async () => {
    if (employees.length === 0) {
      toast({
        title: "No employees",
        description: "No employees found for career path analysis",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setProgress({ processed: 0, total: employees.length });

    try {
      console.log('Starting AI career path analysis for', employees.length, 'employees');

      const { data, error } = await supabase.functions.invoke('employee-career-paths-bulk', {
        body: {
          employees: employees.map(emp => ({
            id: emp.id,
            first_name: emp.first_name,
            last_name: emp.last_name,
            current_position: emp.current_position,
            current_department: emp.current_department,
            current_level: emp.current_level,
            years_of_experience: emp.years_of_experience,
            skills: emp.skills,
            performance_rating: emp.performance_rating,
            source_company: emp.source_company
          })),
          standard_roles: standardRoles
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Career Path Analysis Complete",
          description: `Generated career paths for ${data.total_processed} employees`,
        });
        
        // Reload data to show new career paths
        await loadData();
      }

    } catch (error: any) {
      console.error('Career path analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to run career path analysis",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  };

  const getCareerDirection = (employee: Employee) => {
    // Simple logic to suggest career direction based on current role and experience
    const experience = employee.years_of_experience || 0;
    const currentLevel = employee.current_level || '';
    
    if (experience < 3) return "Growth Track";
    if (experience < 7) return "Specialist Track";
    if (currentLevel.includes('M') || experience > 10) return "Leadership Track";
    return "Expert Track";
  };

  const getEmployeeCareerPath = (employee: Employee) => {
    return careerPaths.find(path => path.employee_id === employee.id);
  };

  const getLateralRoles = (employee: Employee) => {
    const careerPath = getEmployeeCareerPath(employee);
    return careerPath?.lateralRoles || [];
  };

  const getNextRoles = (employee: Employee) => {
    const careerPath = getEmployeeCareerPath(employee);
    return careerPath?.nextRoles || [];
  };

  const getRecommendedActions = (employee: Employee) => {
    const careerPath = getEmployeeCareerPath(employee);
    return careerPath?.actionsPlan || { lateral: [], vertical: [] };
  };

  const calculateProgressPercentage = () => {
    if (!progress) return 0;
    return (progress.processed / progress.total) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading employee career path data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Employee Career Paths</h2>
          <p className="text-muted-foreground">
            AI-powered career path planning and progression mapping for all employees
          </p>
        </div>
        <Button
          onClick={runAICareerPathAnalysis}
          disabled={analyzing || employees.length === 0}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          {analyzing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Run AI Career Path Analysis
            </>
          )}
        </Button>
      </div>

      {analyzing && progress && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Analyzing employee career paths...</span>
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
          <TabsTrigger value="employees">Employee Analysis</TabsTrigger>
          <TabsTrigger value="insights">Career Insights</TabsTrigger>
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
                  Active employees in system
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Career Tracks</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4</div>
                <p className="text-xs text-muted-foreground">
                  Growth, Specialist, Leadership, Expert
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">High Potential</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {employees.filter(emp => emp.performance_rating >= 4).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Employees rated 4+ performance
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Departments</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(employees.map(emp => emp.current_department).filter(Boolean)).size}
                </div>
                <p className="text-xs text-muted-foreground">
                  Unique departments
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
                Employee Career Path Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Current Position</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead className="text-green-600">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        Lateral Opportunities
                      </div>
                    </TableHead>
                    <TableHead className="text-blue-600">
                      <div className="flex items-center gap-1">
                        <ArrowRight className="h-4 w-4" />
                        Career Progression
                      </div>
                    </TableHead>
                    <TableHead>Development Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => {
                    const lateralRoles = getLateralRoles(employee);
                    const nextRoles = getNextRoles(employee);
                    const actions = getRecommendedActions(employee);
                    
                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {employee.employee_number}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {employee.current_department || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {employee.current_position}
                          </Badge>
                        </TableCell>
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
                          <div className="space-y-1 max-w-[240px]">
                            {lateralRoles.length > 0 ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Lateral Moves
                                </div>
                                {lateralRoles.slice(0, 3).map((role, index) => (
                                  <Badge key={index} variant="outline" className="text-xs block w-fit mb-1 bg-green-50 border-green-200">
                                    {role}
                                  </Badge>
                                ))}
                                {lateralRoles.length > 3 && (
                                  <span className="text-xs text-muted-foreground">+{lateralRoles.length - 3} more</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">Run AI analysis for recommendations</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 max-w-[240px]">
                            {nextRoles.length > 0 ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-blue-600 mb-1 flex items-center gap-1">
                                  <ArrowRight className="h-3 w-3" />
                                  Career Progression
                                </div>
                                {nextRoles.slice(0, 3).map((role, index) => (
                                  <Badge key={index} variant="outline" className="text-xs block w-fit mb-1 bg-blue-50 border-blue-200">
                                    {role}
                                  </Badge>
                                ))}
                                {nextRoles.length > 3 && (
                                  <span className="text-xs text-muted-foreground">+{nextRoles.length - 3} more</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">Run AI analysis for recommendations</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[280px] space-y-3">
                            {actions.lateral.length > 0 && (
                              <div className="bg-green-50 p-2 rounded-md border border-green-200">
                                <div className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Lateral Development
                                </div>
                                <div className="space-y-1">
                                  {actions.lateral.slice(0, 2).map((action, index) => (
                                    <div key={index} className="text-xs text-green-600 flex items-start gap-1">
                                      <span className="text-green-400 mt-0.5">•</span>
                                      <span>{action}</span>
                                    </div>
                                  ))}
                                </div>
                                {actions.lateral.length > 2 && (
                                  <div className="text-xs text-green-500 mt-1">+{actions.lateral.length - 2} more actions</div>
                                )}
                              </div>
                            )}
                            {actions.vertical.length > 0 && (
                              <div className="bg-blue-50 p-2 rounded-md border border-blue-200">
                                <div className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                                  <ArrowRight className="h-3 w-3" />
                                  Career Advancement
                                </div>
                                <div className="space-y-1">
                                  {actions.vertical.slice(0, 2).map((action, index) => (
                                    <div key={index} className="text-xs text-blue-600 flex items-start gap-1">
                                      <span className="text-blue-400 mt-0.5">•</span>
                                      <span>{action}</span>
                                    </div>
                                  ))}
                                </div>
                                {actions.vertical.length > 2 && (
                                  <div className="text-xs text-blue-500 mt-1">+{actions.vertical.length - 2} more actions</div>
                                )}
                              </div>
                            )}
                            {actions.lateral.length === 0 && actions.vertical.length === 0 && (
                              <div className="text-xs text-muted-foreground italic bg-gray-50 p-2 rounded-md border border-gray-200">
                                Run AI analysis for personalized recommendations
                              </div>
                            )}
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

        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Career Track Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['Growth Track', 'Specialist Track', 'Leadership Track', 'Expert Track'].map((track) => {
                    const count = employees.filter(emp => getCareerDirection(emp) === track).length;
                    const percentage = employees.length > 0 ? (count / employees.length) * 100 : 0;
                    
                    return (
                      <div key={track} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{track}</span>
                          <span>{count} employees ({percentage.toFixed(1)}%)</span>
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
                <CardTitle>High Potential Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {employees
                    .filter(emp => emp.performance_rating >= 4)
                    .slice(0, 5)
                    .map((employee) => (
                      <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.current_position}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">{employee.performance_rating}/5</span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};