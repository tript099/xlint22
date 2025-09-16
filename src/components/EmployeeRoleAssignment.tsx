import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Clock, UserCheck, Brain, Save, RefreshCw, Zap, Users, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  original_role_title: string;
  source_company: string;
  current_position: string;
  years_of_experience: number;
  role_assignment_status: string;
  standard_role_id: string | null;
  ai_suggested_role_id: string | null;
  skills: any; // Handle Json type from database
}

interface StandardRole {
  id: string;
  role_title: string;
  job_family: string;
  role_level: string;
  department: string;
  role_category: string;
}

export const EmployeeRoleAssignment = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [standardRoles, setStandardRoles] = useState<StandardRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [aiAssigning, setAiAssigning] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ processed: number; total: number } | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const { toast } = useToast();

  const fetchUnassignedEmployees = async () => {
    try {
      console.log('Fetching unassigned employees...');
      const { data, error } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .is('standard_role_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Fetched employees:', data?.length || 0, data);
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Error fetching unassigned employees:', error);
      toast({
        title: "Error",
        description: "Failed to fetch unassigned employees",
        variant: "destructive",
      });
    }
  };

  const fetchStandardRoles = async () => {
    try {
      console.log('Fetching standard roles...');
      const { data, error } = await supabase
        .from('xlsmart_standard_roles')
        .select('id, role_title, job_family, role_level, department, role_category')
        .eq('is_active', true)
        .order('role_title');

      if (error) throw error;
      console.log('Fetched standard roles:', data?.length || 0, data);
      setStandardRoles(data || []);
    } catch (error: any) {
      console.error('Error fetching standard roles:', error);
      toast({
        title: "Error", 
        description: "Failed to fetch standard roles",
        variant: "destructive",
      });
    }
  };

  const getAISuggestedRole = (employee: Employee) => {
    if (!employee.ai_suggested_role_id) return null;
    return standardRoles.find(role => role.id === employee.ai_suggested_role_id);
  };

  const acceptAISuggestion = async (employeeId: string, roleId: string) => {
    setSelectedRoles(prev => ({ ...prev, [employeeId]: roleId }));
    await assignRole(employeeId, roleId);
  };

  const assignRole = async (employeeId: string, roleId: string) => {
    try {
      setSaving(employeeId);
      
      console.log(`Assigning role ${roleId} to employee ${employeeId}`);
      
      // Get current user first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }
      
      console.log('User authenticated:', user.id);
      
      const { error } = await supabase
        .from('xlsmart_employees')
        .update({
          standard_role_id: roleId,
          role_assignment_status: 'manually_assigned',
          assigned_by: user.id
        })
        .eq('id', employeeId);

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      console.log('Role assigned successfully');
      
      toast({
        title: "Success",
        description: "Role assigned successfully",
      });

      // Remove the employee from the list since they're now assigned
      setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
      
    } catch (error: any) {
      console.error('Error assigning role:', error);
      toast({
        title: "Error",
        description: `Failed to assign role: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleRoleSelection = (employeeId: string, roleId: string) => {
    setSelectedRoles(prev => ({ ...prev, [employeeId]: roleId }));
  };

  const handleSaveAssignment = async (employeeId: string) => {
    const selectedRoleId = selectedRoles[employeeId];
    if (!selectedRoleId) {
      toast({
        title: "Error",
        description: "Please select a role to assign",
        variant: "destructive",
      });
      return;
    }
    await assignRole(employeeId, selectedRoleId);
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    setSelectedEmployees(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(employeeId);
      } else {
        newSet.delete(employeeId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedEmployees(new Set(employees.map(emp => emp.id)));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const assignSelectedEmployees = async () => {
    const selectedEmployeeIds = Array.from(selectedEmployees);
    if (selectedEmployeeIds.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select employees to assign roles",
        variant: "destructive",
      });
      return;
    }

    // Check if all selected employees have roles assigned
    const missingRoles = selectedEmployeeIds.filter(id => !selectedRoles[id]);
    if (missingRoles.length > 0) {
      toast({
        title: "Missing Role Assignments",
        description: `Please assign roles to all selected employees (${missingRoles.length} missing)`,
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving('bulk');
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Batch update all selected employees
      const updates = selectedEmployeeIds.map(employeeId => ({
        id: employeeId,
        standard_role_id: selectedRoles[employeeId],
        role_assignment_status: 'manually_assigned',
        assigned_by: user.id
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('xlsmart_employees')
          .update({
            standard_role_id: update.standard_role_id,
            role_assignment_status: update.role_assignment_status,
            assigned_by: update.assigned_by
          })
          .eq('id', update.id);

        if (error) {
          console.error(`Error updating employee ${update.id}:`, error);
          throw error;
        }
      }

      toast({
        title: "Bulk Assignment Successful",
        description: `Successfully assigned roles to ${selectedEmployeeIds.length} employees`,
      });

      // Refresh the employee list
      await fetchUnassignedEmployees();
      setSelectedEmployees(new Set());
      setSelectAll(false);
      
    } catch (error: any) {
      console.error('Error in bulk assignment:', error);
      toast({
        title: "Bulk Assignment Failed",
        description: error.message || "Failed to assign roles to selected employees",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleAIAssignAll = async () => {
    if (employees.length === 0) {
      toast({
        title: "No employees",
        description: "No unassigned employees found",
        variant: "destructive",
      });
      return;
    }

    // Use selected employees if any are selected, otherwise use all
    const employeesToProcess = selectedEmployees.size > 0 
      ? employees.filter(emp => selectedEmployees.has(emp.id))
      : employees;

    if (employeesToProcess.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select employees for AI assignment or use 'Assign All'",
        variant: "destructive",
      });
      return;
    }

    try {
      setAiAssigning(true);
      setAiProgress({ processed: 0, total: employeesToProcess.length });

      toast({
        title: "AI Assignment Started",
        description: `Analyzing ${employeesToProcess.length} employees for role suggestions...`,
      });

      // Get the employee IDs to process
      const employeeIds = employeesToProcess.map(emp => emp.id);
      
      console.log('Calling ai-employee-assignment function with employee IDs:', employeeIds);

      // Call the new simplified AI assignment function
      const { data, error } = await supabase.functions.invoke('ai-employee-assignment', {
        body: { 
          employeeIds,
          assignImmediately: true
        }
      });

      console.log('AI assignment function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw new Error(`AI assignment failed: ${error.message}`);
      }

      if (data?.success) {
        setAiProgress({ processed: data.processed, total: data.processed });
        
        // Refresh the employee list
        await fetchUnassignedEmployees();
        setSelectedEmployees(new Set());
        setSelectAll(false);
        
        toast({
          title: "AI Assignment Completed",
          description: data.message || `Assigned roles to ${data.assigned} employees`,
          variant: data.errors > 0 ? 'default' : 'default'
        });
      } else {
        throw new Error(data?.error || 'AI assignment failed');
      }

    } catch (error: any) {
      console.error('Error in AI assignment:', error);
      toast({
        title: "AI Assignment Failed",
        description: error.message || "Failed to assign roles with AI",
        variant: "destructive",
      });
    } finally {
      setAiAssigning(false);
      setAiProgress(null);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      console.log('Starting to load data...');
      setLoading(true);
      try {
        await Promise.all([
          fetchUnassignedEmployees(),
          fetchStandardRoles()
        ]);
        console.log('Data loading completed');
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      const interval = setInterval(() => {
        fetchUnassignedEmployees();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [loading]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading employees...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Employees Pending Role Assignment
                <Badge variant="secondary">{employees.length} unassigned</Badge>
              </CardTitle>
              
              {selectedEmployees.size > 0 && (
                <Badge variant="outline">
                  {selectedEmployees.size} selected
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {selectedEmployees.size > 0 && (
                <>
                  <Button
                    onClick={assignSelectedEmployees}
                    disabled={saving === 'bulk' || loading}
                    variant="outline"
                  >
                    {saving === 'bulk' ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <Target className="h-4 w-4 mr-2" />
                        Assign Selected ({selectedEmployees.size})
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleAIAssignAll}
                    disabled={aiAssigning || loading}
                    variant="outline"
                  >
                    {aiAssigning ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        AI Assigning...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        AI Assign Selected ({selectedEmployees.size})
                      </>
                    )}
                  </Button>
                </>
              )}
              
              {employees.length > 0 && (
                <Button
                  onClick={handleAIAssignAll}
                  disabled={aiAssigning || loading}
                  className="ml-auto"
                >
                  {aiAssigning ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      AI Assigning...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Assign All with AI
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          {aiProgress && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Brain className="h-4 w-4" />
                AI Progress: {aiProgress.processed}/{aiProgress.total} employees processed
              </div>
              <div className="w-full bg-secondary rounded-full h-2 mt-1">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(aiProgress.processed / aiProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center p-8">
              <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">All Employees Assigned!</h3>
              <p className="text-muted-foreground">
                All employees have been assigned to standard roles.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all employees"
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Original Role</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>AI Suggestion</TableHead>
                  <TableHead>Assign Role</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const aiSuggestion = getAISuggestedRole(employee);
                  const selectedRole = selectedRoles[employee.id];
                  
                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedEmployees.has(employee.id)}
                          onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked as boolean)}
                          aria-label={`Select ${employee.first_name} ${employee.last_name}`}
                        />
                      </TableCell>
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
                          {employee.original_role_title}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {employee.source_company}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {employee.years_of_experience} years
                      </TableCell>
                      <TableCell>
                        {aiSuggestion ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Brain className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">
                                {aiSuggestion.role_title}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acceptAISuggestion(employee.id, aiSuggestion.id)}
                              disabled={saving === employee.id}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Accept
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">No suggestion</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selectedRole || ""}
                          onValueChange={(value) => handleRoleSelection(employee.id, value)}
                          disabled={saving === employee.id}
                        >
                          <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select a standard role..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background border border-border shadow-md z-50">
                            {standardRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                <div>
                                  <div className="font-medium">{role.role_title}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {role.job_family} • {role.role_level} • {role.department}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleSaveAssignment(employee.id)}
                          disabled={!selectedRole || saving === employee.id}
                        >
                          {saving === employee.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Save className="h-3 w-3 mr-1" />
                          )}
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};