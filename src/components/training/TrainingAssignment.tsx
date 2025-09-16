import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  Clock, 
  Award, 
  Target,
  Brain,
  Loader2,
  AlertCircle,
  CheckCircle,
  BookOpen,
  UserPlus,
  Search
} from "lucide-react";
import { useTrainingManagement } from "@/hooks/useTrainingManagement";
import { useAITrainingAnalyzer } from "@/hooks/useAITrainingAnalyzer";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { TrainingProgram, TrainingEnrollment, TrainingRecommendation } from "@/types/training-management";
import { useToast } from "@/hooks/use-toast";


interface TrainingAssignmentProps {
  employeeId?: string;
  onAssignmentComplete?: () => void;
}

export default function TrainingAssignment({ employeeId, onAssignmentComplete }: TrainingAssignmentProps) {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [recommendations, setRecommendations] = useState<TrainingRecommendation | null>(null);
  const [assignmentData, setAssignmentData] = useState({
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    targetCompletionDate: '',
    enrollmentType: 'hr_assigned' as 'self_enrolled' | 'manager_assigned' | 'hr_assigned' | 'mandatory' | 'ai_recommended'
  });

  const { employees, loading: employeesLoading, error: employeesError } = useEmployees();
  const { 
    loading, 
    error, 
    assignTraining, 
    getTrainingPrograms,
    getEmployeeTrainings 
  } = useTrainingManagement();

  const { 
    loading: analyzeLoading, 
    error: analyzeError, 
    analyzeEmployeeTraining 
  } = useAITrainingAnalyzer();

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
    if (employeeId) {
      loadEmployeeData(employeeId);
    }
  }, [employeeId]);

  const loadData = async () => {
    try {
      // Load training programs
      const programsData = await getTrainingPrograms({ status: 'active' });
      setPrograms(programsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const loadEmployeeData = async (empId: string) => {
    try {
      // Load employee details and existing trainings
      const existingTrainings = await getEmployeeTrainings(empId);
      console.log('Existing trainings:', existingTrainings);
    } catch (err) {
      console.error('Failed to load employee data:', err);
    }
  };

  const handleAnalyzeEmployee = async (emp: any) => {
    try {
      console.log('Analyzing employee training needs for:', emp.first_name, emp.last_name);
      const recommendation = await analyzeEmployeeTraining(emp.id);
      console.log('AI recommendation received:', recommendation);
      setRecommendations(recommendation);
      setSelectedEmployee(emp);
      setIsAnalyzeDialogOpen(true);
    } catch (err) {
      console.error('Error analyzing employee:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to analyze employee training needs",
        variant: "destructive",
      });
    }
  };

  const handleAssignTraining = async () => {
    if (!selectedEmployee || !selectedProgram) return;

    try {
      console.log('Assigning training:', {
        employee: selectedEmployee.first_name + ' ' + selectedEmployee.last_name,
        program: selectedProgram.name,
        assignmentData
      });
      
      const result = await assignTraining({
        employeeId: selectedEmployee.id,
        trainingProgramId: selectedProgram.id,
        enrollmentType: assignmentData.enrollmentType,
        priority: assignmentData.priority,
        targetCompletionDate: assignmentData.targetCompletionDate,
        assignedBy: user?.id || '00000000-0000-0000-0000-000000000000'
      });
      
      console.log('Training assigned successfully:', result);

      toast({
        title: "Success",
        description: `Training assigned to ${selectedEmployee.first_name} ${selectedEmployee.last_name}`,
      });

      setIsAssignDialogOpen(false);
      setSelectedEmployee(null);
      setSelectedProgram(null);
      
      // Refresh the data
      loadData();
      
      // Call completion callback if provided
      onAssignmentComplete?.();
    } catch (err) {
      console.error('Error assigning training:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to assign training",
        variant: "destructive",
      });
    }
  };

  const handleQuickAssign = (emp: any, program: TrainingProgram) => {
    setSelectedEmployee(emp);
    setSelectedProgram(program);
    setIsAssignDialogOpen(true);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.current_position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === 'all' || emp.current_department === selectedDepartment;
    return matchesSearch && matchesDepartment && emp.is_active;
  });

  const departments = Array.from(new Set(
    employees
      .map(emp => emp.current_department)
      .filter(dept => dept && dept.trim() !== '') // Filter out empty/null departments
  ));

  if (loading || employeesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Training Assignment</h2>
          <p className="text-muted-foreground">
            Assign training programs to employees or use AI to get recommendations
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {(error || employeesError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || employeesError}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Available Training Programs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Available Training Programs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.slice(0, 6).map((program) => (
              <div key={program.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{program.name}</h4>
                    <Badge variant="outline" className="text-xs">{program.category}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{program.duration_hours}h</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {program.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{program.max_participants} max</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {program.difficulty_level}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employees ({filteredEmployees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmployees.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No employees found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedDepartment !== 'all' 
                  ? 'Try adjusting your search criteria'
                  : 'No active employees available for training assignment'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {employee.first_name[0]}{employee.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {employee.current_position} • {employee.current_department}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAnalyzeEmployee(employee)}
                      disabled={analyzeLoading}
                    >
                      {analyzeLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                      <span className="ml-1">Analyze</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedEmployee(employee);
                        setIsAssignDialogOpen(true);
                      }}
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="ml-1">Assign</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Training</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedEmployee && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium">
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedEmployee.current_position} • {selectedEmployee.current_department}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Training Program</Label>
              <Select value={selectedProgram?.id || ''} onValueChange={(value) => {
                const program = programs.find(p => p.id === value);
                setSelectedProgram(program || null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select training program" />
                </SelectTrigger>
                <SelectContent>
                  {programs
                    .filter(program => program.id && program.id.trim() !== '')
                    .map(program => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name} ({program.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={assignmentData.priority} onValueChange={(value: any) => 
                  setAssignmentData({ ...assignmentData, priority: value })
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Enrollment Type</Label>
                <Select value={assignmentData.enrollmentType} onValueChange={(value: any) => 
                  setAssignmentData({ ...assignmentData, enrollmentType: value })
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hr_assigned">HR Assigned</SelectItem>
                    <SelectItem value="manager_assigned">Manager Assigned</SelectItem>
                    <SelectItem value="mandatory">Mandatory</SelectItem>
                    <SelectItem value="ai_recommended">AI Recommended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target Completion Date</Label>
              <Input
                type="date"
                value={assignmentData.targetCompletionDate}
                onChange={(e) => setAssignmentData({ ...assignmentData, targetCompletionDate: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignTraining} disabled={!selectedProgram || loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Assign Training
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Analysis Dialog */}
      <Dialog open={isAnalyzeDialogOpen} onOpenChange={setIsAnalyzeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Training Analysis</DialogTitle>
          </DialogHeader>
          {recommendations && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium">
                  {recommendations.employeeName}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {recommendations.currentRole} • {recommendations.department}
                </p>
                <div className="mt-2">
                  <Badge variant="outline">
                    Training Readiness: {recommendations.overallScore}/100
                  </Badge>
                </div>
              </div>

              {recommendations.skillGaps.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Identified Skill Gaps</h5>
                  <div className="flex flex-wrap gap-2">
                    {recommendations.skillGaps.map((gap, index) => (
                      <Badge key={index} variant="destructive">{gap}</Badge>
                    ))}
                  </div>
                </div>
              )}



              {/* Show Available Training Programs from Database */}
              {programs.length > 0 && (
                <div>
                  <h5 className="font-medium mb-2">Training Programs for Assignment</h5>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {programs.map((program) => (
                      <div key={program.id} className="border rounded-lg p-3 bg-background">
                        <div className="flex items-start justify-between mb-2">
                          <h6 className="font-medium">{program.name}</h6>
                          <Badge variant="outline">{program.category}</Badge>
                        </div>
                        {program.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {program.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          <span>{program.duration_hours}h</span>
                          <span>{program.type}</span>
                          <span>Difficulty: {program.difficulty_level}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (selectedEmployee) {
                              setSelectedProgram(program);
                              setIsAnalyzeDialogOpen(false);
                              setIsAssignDialogOpen(true);
                            }
                          }}
                        >
                          Assign This Program
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
