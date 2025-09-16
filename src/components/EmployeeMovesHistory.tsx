import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowRight, Calendar, User, Building, CheckCircle, Clock, XCircle, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeMove {
  id: string;
  employee_id: string;
  move_type: string;
  previous_position: string;
  previous_department: string;
  previous_level: string;
  new_position: string;
  new_department: string;
  new_level: string;
  move_date: string;
  effective_date: string;
  move_status: string;
  reason: string;
  notes: string;
  mobility_plan_id: string;
  requested_by: string;
  approved_by: string | null;
  approval_date: string | null;
  created_at: string;
  xlsmart_employees: {
    first_name: string;
    last_name: string;
    current_position: string;
    current_department: string;
    current_level: string;
  };
}

export const EmployeeMovesHistory = () => {
  const [moves, setMoves] = useState<EmployeeMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMove, setSelectedMove] = useState<EmployeeMove | null>(null);

  useEffect(() => {
    console.log('EmployeeMovesHistory component mounted, fetching moves...');
    fetchMoves();
    
    // Listen for move execution events to refresh the list
    const handleMoveExecuted = () => {
      console.log('Move executed event received, refreshing moves...');
      fetchMoves();
    };
    
    window.addEventListener('moveExecuted', handleMoveExecuted);
    
    return () => {
      window.removeEventListener('moveExecuted', handleMoveExecuted);
    };
  }, []);

  const fetchMoves = async () => {
    try {
      console.log('Fetching employee moves...');
      
      // First, get the moves without the join
      const { data: movesData, error: movesError } = await supabase
        .from('employee_moves')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (movesError) {
        console.error('Error fetching moves:', movesError);
        throw movesError;
      }

      console.log('Raw moves data:', movesData);

      // Then, get employee details separately and join them
      if (movesData && movesData.length > 0) {
        const employeeIds = movesData.map(move => move.employee_id);
        
        const { data: employeesData, error: employeesError } = await supabase
          .from('xlsmart_employees')
          .select('id, first_name, last_name, current_position, current_department, current_level')
          .in('id', employeeIds);

        if (employeesError) {
          console.error('Error fetching employees:', employeesError);
          // Continue without employee data rather than failing completely
        }

        // Manually join the data
        const enrichedMoves = movesData.map(move => ({
          ...move,
          xlsmart_employees: employeesData?.find(emp => emp.id === move.employee_id) || null
        }));

        console.log('Enriched moves data:', enrichedMoves);
        setMoves(enrichedMoves);
      } else {
        console.log('No moves found');
        setMoves([]);
      }
    } catch (error) {
      console.error('Error fetching moves:', error);
      // You could also add a toast notification here to show the user there's an error
    } finally {
      setLoading(false);
    }
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'executed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'executed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getMoveTypeColor = (type: string) => {
    switch (type) {
      case 'promotion':
        return 'text-green-600';
      case 'lateral_move':
        return 'text-blue-600';
      case 'department_transfer':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Recent Internal Moves
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading moves history...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRight className="h-5 w-5" />
          Employee Moves History
          <Badge variant="outline" className="ml-auto">
            {moves.length} total
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          View all executed employee moves and their details. Click "View" to see full move information.
        </p>
      </CardHeader>
      <CardContent>
        {moves.length > 0 ? (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Move Details</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moves.map((move) => (
                  <TableRow key={move.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {move.xlsmart_employees?.first_name} {move.xlsmart_employees?.last_name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{move.previous_position}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{move.new_position}</span>
                        </div>
                        {move.previous_department !== move.new_department && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building className="h-3 w-3" />
                            <span>{move.previous_department}</span>
                            <ArrowRight className="h-2 w-2" />
                            <span>{move.new_department}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getMoveTypeColor(move.move_type)}>
                        {move.move_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(move.move_date).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(move.move_status)}
                        <Badge variant={getStatusVariant(move.move_status)}>
                          {move.move_status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedMove(move)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Move Details</DialogTitle>
                            </DialogHeader>
                            {selectedMove && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium">Employee</Label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedMove.xlsmart_employees?.first_name} {selectedMove.xlsmart_employees?.last_name}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Move Type</Label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedMove.move_type.replace('_', ' ')}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium">From</Label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedMove.previous_position}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {selectedMove.previous_department} • {selectedMove.previous_level}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">To</Label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedMove.new_position}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {selectedMove.new_department} • {selectedMove.new_level}
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  <Label className="text-sm font-medium">Reason</Label>
                                  <p className="text-sm text-muted-foreground">
                                    {selectedMove.reason}
                                  </p>
                                </div>

                                {selectedMove.notes && (
                                  <div>
                                    <Label className="text-sm font-medium">Notes</Label>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedMove.notes}
                                    </p>
                                  </div>
                                )}


                                {selectedMove.move_status === 'executed' && (
                                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="h-5 w-5 text-green-600" />
                                      <span className="text-sm font-medium text-green-800">
                                        Move Executed Successfully
                                      </span>
                                    </div>
                                    <p className="text-sm text-green-700 mt-1">
                                      Employee data has been updated with the new position.
                                    </p>
                                  </div>
                                )}

                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <ArrowRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No Moves Yet</h3>
            <p className="text-muted-foreground mb-4">
              No internal moves have been executed yet. Use the "Execute Move Now" button in mobility analysis to execute moves directly.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
