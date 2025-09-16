import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Zap, RefreshCw, BarChart3, Users, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  current_position: string;
  current_department: string;
  years_of_experience: number;
  skills: any; // Handle Json type from database
  certifications: any; // Handle Json type from database
  performance_rating: number;
  standard_role_id: string | null;
  ai_suggested_role_id: string | null;
  role_assignment_status: string;
  source_company: string;
}

interface StandardRole {
  id: string;
  role_title: string;
  job_family: string;
  role_level: string;
  department: string;
  required_skills?: any;
  preferred_skills?: any; // Make optional
}

interface SkillsAssessment {
  id: string;
  employee_id: string;
  job_description_id: string;
  overall_match_percentage: number;
  skill_gaps: any;
  level_fit_score: number;
  rotation_risk_score: number;
  churn_risk_score: number;
  ai_analysis: string;
  recommendations: string;
  assessment_date: string;
}

export const AISkillsAssessmentEnhanced = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [standardRoles, setStandardRoles] = useState<StandardRole[]>([]);
  const [assessments, setAssessments] = useState<SkillsAssessment[]>([]);
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
      
      // Load all employees with debugging
      console.log('Loading employees...');
      const { data: employeesData, error: employeesError } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('is_active', true)
        .order('first_name');

      console.log('Employees query result:', { employeesData, employeesError });
      if (employeesError) throw employeesError;

      // Load standard roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('xlsmart_standard_roles')
        .select('*')
        .eq('is_active', true);

      if (rolesError) throw rolesError;

      // Load existing assessments with more detailed debugging
      console.log('Loading skill assessments...');
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('xlsmart_skill_assessments')
        .select('*')
        .order('assessment_date', { ascending: false });

      console.log('Assessments query result:', { 
        assessmentsData, 
        assessmentsError, 
        count: assessmentsData?.length,
        sampleRecord: assessmentsData?.[0]
      });

      if (assessmentsError) {
        console.error('Assessment error:', assessmentsError);
        toast({
          title: "Assessment Loading Error",
          description: `Error loading assessments: ${assessmentsError.message}`,
          variant: "destructive",
        });
        setAssessments([]);
      } else {
        const validAssessments = assessmentsData || [];
        setAssessments(validAssessments);
        console.log('Set assessments:', validAssessments.length);
        
        if (validAssessments.length > 0) {
          toast({
            title: "Assessments Loaded",
            description: `Found ${validAssessments.length} skill assessments`,
          });
        }
      }

      setEmployees(employeesData || []);
      setStandardRoles(rolesData || []);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load skills assessment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const runAISkillsAssessment = async () => {
    if (employees.length === 0) {
      toast({
        title: "No employees",
        description: "No employees found for assessment",
        variant: "destructive",
      });
      return;
    }

    // Check for existing assessments
    const employeesWithAssessments = new Set(assessments.map(a => a.employee_id));
    const alreadyAssessed = employees.filter(emp => employeesWithAssessments.has(emp.id));
    
    if (alreadyAssessed.length > 0) {
      const confirmed = window.confirm(
        `${alreadyAssessed.length} employees already have recent assessments. ` +
        `Only employees without assessments from the last 30 days will be processed. Continue?`
      );
      if (!confirmed) return;
    }

    try {
      setAnalyzing(true);
      setProgress({ processed: 0, total: employees.length });

      toast({
        title: "AI Skills Assessment Started",
        description: `Analyzing up to ${employees.length} employees for skills, role fit, and risk factors...`,
      });

      // Call the bulk skills assessment function
      console.log('Starting bulk assessment with employees:', employees.length);
      const { data, error } = await supabase.functions.invoke('ai-skills-assessment-bulk', {
        body: {
          assessmentType: 'all',
          identifier: 'all',
          employees: employees
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }

      if (data?.sessionId) {
        // Poll for progress
        const pollInterval = setInterval(async () => {
          const { data: progressData } = await supabase.functions.invoke('ai-skills-assessment-progress', {
            body: { sessionId: data.sessionId }
          });

          if (progressData?.progress) {
            setProgress({
              processed: progressData.progress.processed,
              total: progressData.progress.total
            });

            if (progressData.status === 'completed') {
              clearInterval(pollInterval);
              setAnalyzing(false);
              setProgress(null);
              
              // Reload assessments
              await loadData();
              
              toast({
                title: "AI Assessment Completed",
                description: `Successfully analyzed ${employees.length} employees`,
              });
            } else if (progressData.status === 'error') {
              clearInterval(pollInterval);
              setAnalyzing(false);
              setProgress(null);
              throw new Error(progressData.error || 'Assessment failed');
            }
          }
        }, 2000);

        // Cleanup interval after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (analyzing) {
            setAnalyzing(false);
            setProgress(null);
          }
        }, 300000);
      }

    } catch (error: any) {
      console.error('Error in AI assessment:', error);
      setAnalyzing(false);
      setProgress(null);
      toast({
        title: "Assessment Failed",
        description: error.message || "Failed to run AI skills assessment",
        variant: "destructive",
      });
    }
  };

  const generateMockAssessments = () => {
    // Generate realistic mock assessments for demonstration
    const mockAssessments = employees.map(employee => ({
      id: `assessment-${employee.id}`,
      employee_id: employee.id,
      job_description_id: employee.standard_role_id || 'mock-jd',
      overall_match_percentage: Math.floor(Math.random() * 40) + 60, // 60-100%
      skill_gaps: {
        gaps: [
          { skill: 'Advanced Analytics', current: 2, required: 4, gap: 2 },
          { skill: 'Leadership', current: 3, required: 4, gap: 1 }
        ]
      },
      level_fit_score: Math.floor(Math.random() * 30) + 70, // 70-100
      rotation_risk_score: Math.floor(Math.random() * 60) + 20, // 20-80%
      churn_risk_score: Math.floor(Math.random() * 50) + 10, // 10-60%
      ai_analysis: `AI analysis for ${employee.first_name}: Strong technical skills with growth potential in leadership areas.`,
      recommendations: `Focus on developing leadership and advanced analytics skills for career progression.`,
      assessment_date: new Date().toISOString()
    }));
    
    setAssessments(mockAssessments);
    toast({
      title: "Mock Data Generated",
      description: `Generated ${mockAssessments.length} mock assessments for testing`,
    });
  };

  const debugAssessmentData = async () => {
    try {
      // Direct query to check data
      const { data: directAssessments, error: directError } = await supabase
        .from('xlsmart_skill_assessments')
        .select('employee_id, overall_match_percentage, assessment_date')
        .limit(5);

      console.log('Direct assessment query:', { directAssessments, directError });
      
      // Count query
      const { count, error: countError } = await supabase
        .from('xlsmart_skill_assessments')
        .select('*', { count: 'exact', head: true });

      console.log('Assessment count:', { count, countError });

      toast({
        title: "Debug Info",
        description: `Found ${count || 0} assessments in database. Check console for details.`,
      });
    } catch (error) {
      console.error('Debug query error:', error);
      toast({
        title: "Debug Error",
        description: "Error running debug queries",
        variant: "destructive",
      });
    }
  };

  const getEmployeeAssessment = (employeeId: string) => {
    return assessments.find(a => a.employee_id === employeeId);
  };

  const getAssignedRole = (employee: Employee) => {
    if (!employee.standard_role_id) return null;
    return standardRoles.find(role => role.id === employee.standard_role_id);
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'High', color: 'bg-red-500', textColor: 'text-red-700' };
    if (score >= 60) return { level: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    return { level: 'Low', color: 'bg-green-500', textColor: 'text-green-700' };
  };

  const getMatchLevel = (score: number) => {
    if (score >= 80) return { level: 'Excellent', color: 'bg-green-500', textColor: 'text-green-700' };
    if (score >= 60) return { level: 'Good', color: 'bg-blue-500', textColor: 'text-blue-700' };
    if (score >= 40) return { level: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    return { level: 'Poor', color: 'bg-red-500', textColor: 'text-red-700' };
  };

  const getOverallStats = () => {
    console.log('Calculating stats with:', { 
      employeesCount: employees.length, 
      assessmentsCount: assessments.length 
    });
    
    const assessedEmployees = employees.filter(emp => {
      const assessment = getEmployeeAssessment(emp.id);
      console.log(`Employee ${emp.id} assessment:`, assessment ? 'found' : 'not found');
      return assessment;
    });
    
    console.log('Assessed employees:', assessedEmployees.length);
    
    const avgMatch = assessedEmployees.length > 0 
      ? assessedEmployees.reduce((sum, emp) => {
          const assessment = getEmployeeAssessment(emp.id);
          const matchPercentage = assessment?.overall_match_percentage || 0;
          console.log(`Employee ${emp.id} match percentage:`, matchPercentage);
          return sum + matchPercentage;
        }, 0) / assessedEmployees.length
      : 0;

    const highRiskEmployees = assessedEmployees.filter(emp => {
      const assessment = getEmployeeAssessment(emp.id);
      return assessment && (assessment.rotation_risk_score > 70 || assessment.churn_risk_score > 70);
    });

    const stats = {
      totalEmployees: employees.length,
      assessedEmployees: assessedEmployees.length,
      avgMatchPercentage: Math.round(avgMatch),
      highRiskCount: highRiskEmployees.length,
      assignedRoles: employees.filter(emp => emp.standard_role_id).length
    };
    
    console.log('Calculated stats:', stats);
    return stats;
  };

  const stats = getOverallStats();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading skills assessment data...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI-Powered Skills Assessment
              <Badge variant="secondary">{employees.length} employees</Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={runAISkillsAssessment}
                disabled={analyzing || employees.length === 0}
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Run AI Assessment
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={loadData}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
              <Button
                variant="outline"
                onClick={debugAssessmentData}
                size="sm"
              >
                Debug
              </Button>
              <Button
                variant="outline"
                onClick={generateMockAssessments}
                size="sm"
              >
                Mock Data
              </Button>
            </div>
          </div>
          {progress && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BarChart3 className="h-4 w-4" />
                Progress: {progress.processed}/{progress.total} employees analyzed
              </div>
              <div className="w-full bg-secondary rounded-full h-2 mt-1">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.processed / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
          <TabsTrigger value="risks">Risk Analysis</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Total Employees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEmployees}</div>
                <p className="text-xs text-muted-foreground">Active in system</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  Role Assigned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.assignedRoles}</div>
                <p className="text-xs text-muted-foreground">Have standard roles</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Assessed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.assessedEmployees}</div>
                <p className="text-xs text-muted-foreground">AI skill assessments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Avg Match
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgMatchPercentage}%</div>
                <p className="text-xs text-muted-foreground">Role-skill alignment</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  At Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.highRiskCount}</div>
                <p className="text-xs text-muted-foreground">High risk employees</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Skills Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Assigned Role</TableHead>
                    <TableHead>Skills Match</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => {
                    const assessment = getEmployeeAssessment(employee.id);
                    const assignedRole = getAssignedRole(employee);
                    const matchLevel = assessment ? getMatchLevel(assessment.overall_match_percentage) : null;
                    
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
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {employee.current_position}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {employee.current_department}
                          </div>
                        </TableCell>
                        <TableCell>
                          {assignedRole ? (
                            <Badge variant="outline">
                              {assignedRole.role_title}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not assigned</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {assessment ? (
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={matchLevel?.textColor}
                              >
                                {Math.round(assessment.overall_match_percentage)}%
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {matchLevel?.level}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not assessed</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {employee.years_of_experience} years
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Rating: {employee.performance_rating || 'N/A'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={employee.role_assignment_status === 'manually_assigned' || employee.role_assignment_status === 'ai_suggested' ? 'default' : 'secondary'}
                          >
                            {employee.role_assignment_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Risk Analysis Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Rotation Risk</TableHead>
                    <TableHead>Churn Risk</TableHead>
                    <TableHead>Overall Status</TableHead>
                    <TableHead>AI Recommendations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => {
                    const assessment = getEmployeeAssessment(employee.id);
                    
                    if (!assessment) return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </div>
                        </TableCell>
                        <TableCell>{employee.current_position}</TableCell>
                        <TableCell colSpan={4}>
                          <span className="text-sm text-muted-foreground">Assessment pending</span>
                        </TableCell>
                      </TableRow>
                    );
                    
                    const rotationRisk = getRiskLevel(assessment.rotation_risk_score || 0);
                    const churnRisk = getRiskLevel(assessment.churn_risk_score || 0);
                    
                    return (
                      <TableRow key={employee.id}>
                        <TableCell>
                          <div className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </div>
                        </TableCell>
                        <TableCell>{employee.current_position}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={rotationRisk.textColor}>
                            {rotationRisk.level} ({Math.round(assessment.rotation_risk_score || 0)}%)
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={churnRisk.textColor}>
                            {churnRisk.level} ({Math.round(assessment.churn_risk_score || 0)}%)
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(assessment.rotation_risk_score > 70 || assessment.churn_risk_score > 70) ? (
                            <Badge variant="destructive">At Risk</Badge>
                          ) : (
                            <Badge variant="default">Stable</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs max-w-xs truncate">
                            {assessment.recommendations || 'No specific recommendations available'}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI Insights Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">Skills Coverage Analysis</h4>
                    <p className="text-sm text-muted-foreground">
                      AI analyzes employee skills against role requirements, identifying gaps and strengths across the organization
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Role Fit Evaluation</h4>
                    <p className="text-sm text-muted-foreground">
                      Evaluates how well employees match their assigned or potential roles based on comprehensive criteria
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Risk Prediction</h4>
                    <p className="text-sm text-muted-foreground">
                      Predicts rotation and churn risks using advanced algorithms that consider skills, performance, engagement, and market factors
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Data Sources Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Employee profiles and current skills</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Standard role definitions and requirements</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Performance ratings and evaluations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Experience levels and certifications</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Job descriptions and role mappings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Career aspirations and growth preferences</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};