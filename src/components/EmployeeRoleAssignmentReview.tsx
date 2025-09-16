import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, User, Brain, Edit, Save, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  current_position: string;
  current_department: string;
  current_level: string;
  years_of_experience: number;
  skills: any; // Can be string[] or Json from database
  certifications: any; // Can be string[] or Json from database
  original_role_title: string;
  ai_suggested_role_id: string | null;
  standard_role_id: string | null;
  role_assignment_status: string;
  assignment_notes: string;
}

interface StandardRole {
  id: string;
  role_title: string;
  job_family: string;
  role_level: string;
  role_category: string;
  department: string;
}

interface EmployeeRoleAssignmentReviewProps {
  sessionId: string;
}

export const EmployeeRoleAssignmentReview = ({ sessionId }: EmployeeRoleAssignmentReviewProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [standardRoles, setStandardRoles] = useState<StandardRole[]>([]);
  const [aiSuggestedRoles, setAiSuggestedRoles] = useState<Record<string, StandardRole>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>("");
  const [editingNotes, setEditingNotes] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get session details to find employees
      const { data: session } = await supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!session) return;

      // Get employees from this session (with AI suggestions)
      const sessionCreatedAt = new Date(session.created_at);
      const sessionStartTime = new Date(sessionCreatedAt.getTime() - (10 * 60 * 1000));
      const sessionEndTime = new Date(sessionCreatedAt.getTime() + (60 * 60 * 1000));

      // First, get employees that were successfully uploaded in this session
      const { data: newEmployeesData, error: newEmployeesError } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .gte('created_at', sessionStartTime.toISOString())
        .lte('created_at', sessionEndTime.toISOString())
        .eq('uploaded_by', session.created_by);

      if (newEmployeesError) throw newEmployeesError;

      // Also get existing employees that might need role assignments
      // (those that failed to upload due to duplicates but don't have role assignments)
      const { data: existingEmployeesData, error: existingEmployeesError } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('uploaded_by', session.created_by)
        .is('standard_role_id', null)
        .eq('is_active', true);

      if (existingEmployeesError) throw existingEmployeesError;

      // Combine and deduplicate employees, marking their status
      const allEmployees = [...(newEmployeesData || [])].map(emp => ({ ...emp, uploadStatus: 'newly_uploaded' }));
      const newEmployeeIds = new Set(newEmployeesData?.map(emp => emp.id) || []);
      
      // Add existing employees that aren't already in the new employees list
      existingEmployeesData?.forEach(emp => {
        if (!newEmployeeIds.has(emp.id)) {
          allEmployees.push({ ...emp, uploadStatus: 'existing_no_role' });
        }
      });

      // Get all standard roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('xlsmart_standard_roles')
        .select('*')
        .eq('is_active', true)
        .order('role_title');

      if (rolesError) throw rolesError;

      setEmployees(allEmployees || []);
      setStandardRoles(rolesData || []);

      // Create lookup for AI suggested roles
      const aiRolesLookup: Record<string, StandardRole> = {};
      allEmployees?.forEach(emp => {
        if (emp.ai_suggested_role_id) {
          const suggestedRole = rolesData?.find(role => role.id === emp.ai_suggested_role_id);
          if (suggestedRole) {
            aiRolesLookup[emp.id] = suggestedRole;
          }
        }
      });
      setAiSuggestedRoles(aiRolesLookup);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load employee data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleAssignment = async (employeeId: string, roleId: string, source: 'original' | 'ai' | 'manual', notes?: string) => {
    try {
      setSaving(employeeId);

      const { error } = await supabase
        .from('xlsmart_employees')
        .update({
          standard_role_id: roleId,
          role_assignment_status: source === 'ai' ? 'ai_suggested' : 'manually_assigned',
          assigned_by: (await supabase.auth.getUser()).data.user?.id,
          assignment_notes: notes || ''
        })
        .eq('id', employeeId);

      if (error) throw error;

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.id === employeeId 
          ? { 
              ...emp, 
              standard_role_id: roleId, 
              role_assignment_status: source === 'ai' ? 'ai_suggested' : 'manually_assigned',
              assignment_notes: notes || ''
            }
          : emp
      ));

      toast({
        title: "Role Assigned",
        description: "Employee role has been updated successfully",
      });

    } catch (error) {
      console.error('Error assigning role:', error);
      toast({
        title: "Error",
        description: "Failed to assign role",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const startEditing = (employee: Employee) => {
    setEditingEmployee(employee.id);
    setEditingRole(employee.standard_role_id || '');
    setEditingNotes(employee.assignment_notes || '');
  };

  const cancelEditing = () => {
    setEditingEmployee(null);
    setEditingRole('');
    setEditingNotes('');
  };

  const saveEdit = async () => {
    if (!editingEmployee || !editingRole) return;
    
    await handleRoleAssignment(editingEmployee, editingRole, 'manual', editingNotes);
    setEditingEmployee(null);
    setEditingRole('');
    setEditingNotes('');
  };

  const getAssignedRoleTitle = (employee: Employee) => {
    if (!employee.standard_role_id) return null;
    const role = standardRoles.find(r => r.id === employee.standard_role_id);
    return role?.role_title || 'Unknown Role';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'ai_suggested':
        return <Badge variant="secondary">AI Suggested</Badge>;
      case 'manually_assigned':
        return <Badge variant="default">Manually Assigned</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAcceptAllAI = async () => {
    try {
      setSaving("bulk");
      let acceptedCount = 0;

      // Accept all AI suggestions that haven't been manually assigned
      for (const employee of employees) {
        if (employee.ai_suggested_role_id && !employee.standard_role_id) {
          await handleRoleAssignment(employee.id, employee.ai_suggested_role_id, 'ai', 'Bulk accepted AI suggestion');
          acceptedCount++;
        }
      }

      toast({
        title: "AI Suggestions Accepted",
        description: `Successfully accepted ${acceptedCount} AI role suggestions`,
      });

    } catch (error) {
      console.error('Error accepting AI suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to accept all AI suggestions",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleFinalizeAssignments = async () => {
    try {
      setSaving("finalize");
      
      // Update all assigned employees to approved status
      const assignedEmployees = employees.filter(emp => emp.standard_role_id);
      
      for (const employee of assignedEmployees) {
        await handleRoleAssignment(employee.id, employee.standard_role_id!, 'ai', 'Finalized assignment');
      }

      // Update session status to indicate completion
      const { error: sessionError } = await supabase
        .from('xlsmart_upload_sessions')
        .update({ 
          status: 'completed',
          ai_analysis: {
            ...employees[0]?.uploadSession?.ai_analysis,
            finalized_at: new Date().toISOString(),
            finalized_count: assignedEmployees.length
          }
        })
        .eq('id', sessionId);

      if (sessionError) {
        console.error('Session update error:', sessionError);
      }

      toast({
        title: "Assignments Finalized",
        description: `Successfully finalized ${assignedEmployees.length} role assignments. The upload process is now complete!`,
      });

      // Refresh page after successful finalization
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error finalizing assignments:', error);
      toast({
        title: "Error",
        description: "Failed to finalize assignments",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading employee data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Employee Role Assignment Review
        </CardTitle>
         <p className="text-sm text-muted-foreground">
           Review and assign roles to uploaded employees. You can choose from original role, AI suggestion, or manually select a different role.
           <br />
           <span className="text-xs">Note: "Existing" employees were already in the system but need role assignments.</span>
         </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Employee</TableHead>
                <TableHead className="min-w-[150px]">Current Position</TableHead>
                <TableHead className="min-w-[120px]">Original Role</TableHead>
                <TableHead className="min-w-[120px]">AI Suggested</TableHead>
                <TableHead className="min-w-[150px]">Assigned Role</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                   <TableCell>
                     <div>
                       <div className="font-medium">
                         {employee.first_name} {employee.last_name}
                         {(employee as any).uploadStatus === 'existing_no_role' && (
                           <Badge variant="outline" className="ml-2 text-xs">
                             Existing
                           </Badge>
                         )}
                       </div>
                       <div className="text-sm text-muted-foreground">
                         {employee.employee_number}
                       </div>
                     </div>
                   </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{employee.current_position}</div>
                      <div className="text-sm text-muted-foreground">
                        {employee.current_department} • {employee.current_level}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{employee.original_role_title || employee.current_position}</div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRoleAssignment(employee.id, '', 'original')}
                        disabled={saving === employee.id}
                      >
                        Use Original
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {aiSuggestedRoles[employee.id] ? (
                      <div className="space-y-1">
                        <div className="font-medium">
                          {aiSuggestedRoles[employee.id].role_title}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {aiSuggestedRoles[employee.id].job_family} • {aiSuggestedRoles[employee.id].role_level}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRoleAssignment(employee.id, employee.ai_suggested_role_id!, 'ai')}
                          disabled={saving === employee.id}
                        >
                          <Brain className="h-3 w-3 mr-1" />
                          Use AI Suggestion
                        </Button>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No AI suggestion</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingEmployee === employee.id ? (
                      <div className="space-y-2">
                        <Select value={editingRole} onValueChange={setEditingRole}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            {standardRoles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.role_title} - {role.job_family}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Textarea
                          placeholder="Assignment notes (optional)"
                          value={editingNotes}
                          onChange={(e) => setEditingNotes(e.target.value)}
                          className="min-h-[60px]"
                        />
                      </div>
                    ) : (
                      <div>
                        {getAssignedRoleTitle(employee) || (
                          <span className="text-sm text-muted-foreground">Not assigned</span>
                        )}
                        {employee.assignment_notes && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {employee.assignment_notes}
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(employee.role_assignment_status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editingEmployee === employee.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={saveEdit}
                            disabled={!editingRole || saving === employee.id}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(employee)}
                          disabled={saving === employee.id}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {employees.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No employees found for this session.
          </div>
        )}

        {/* Action buttons for bulk operations */}
        {employees.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4 mt-6 pt-6 border-t">
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">
                {employees.filter(emp => emp.standard_role_id).length} of {employees.length} employees have assigned roles
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleAcceptAllAI}
                disabled={saving !== null}
                className="w-full sm:w-auto"
              >
                <Bot className="h-4 w-4 mr-2" />
                {saving === "bulk" ? "Accepting..." : "Accept All AI Suggestions"}
              </Button>
              <Button
                onClick={handleFinalizeAssignments}
                disabled={saving !== null || employees.filter(emp => emp.standard_role_id).length === 0}
                className="w-full sm:w-auto"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {saving === "finalize" ? "Finalizing..." : "Finalize & Complete"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};