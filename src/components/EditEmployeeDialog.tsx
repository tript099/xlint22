import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from "@/lib/constants";
import { validateEmployee } from "@/lib/validations";
import { employeeApi } from "@/lib/api";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  current_position: string;
  current_department?: string;
  current_location?: string;
  email?: string;
  phone?: string;
  hire_date?: string;
  employee_number?: string;
  salary?: number;
  years_of_experience?: number;
}

interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSave: () => void;
}

export const EditEmployeeDialog = ({
  open,
  onOpenChange,
  employee,
  onSave
}: EditEmployeeDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const { toast } = useToast();

  useEffect(() => {
    if (employee) {
      setFormData(employee);
    }
  }, [employee]);

  const handleSave = async () => {
    if (!employee || !formData.email) return;

    // Validate data using validation schema
    const validation = validateEmployee(formData);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.issues[0]?.message || ERROR_MESSAGES.VALIDATION_FAILED,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await employeeApi.update(employee.id, validation.data);
      
      if (!result.success) {
        throw new Error(result.error || ERROR_MESSAGES.GENERIC);
      }

      toast({
        title: "Success",
        description: SUCCESS_MESSAGES.DATA_SAVED,
      });
      
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || ERROR_MESSAGES.GENERIC,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              value={formData.first_name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
              placeholder="Enter first name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              value={formData.last_name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
              placeholder="Enter last name"
            />
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email address"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="current_position">Position</Label>
            <Input
              id="current_position"
              value={formData.current_position || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, current_position: e.target.value }))}
              placeholder="Enter position"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="current_department">Department</Label>
            <Input
              id="current_department"
              value={formData.current_department || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, current_department: e.target.value }))}
              placeholder="Enter department"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="Enter phone number"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="current_location">Location</Label>
            <Input
              id="current_location"
              value={formData.current_location || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, current_location: e.target.value }))}
              placeholder="Enter location"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="hire_date">Hire Date</Label>
            <Input
              id="hire_date"
              type="date"
              value={formData.hire_date || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="years_of_experience">Years of Experience</Label>
            <Input
              id="years_of_experience"
              type="number"
              value={formData.years_of_experience || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, years_of_experience: parseInt(e.target.value) || 0 }))}
              placeholder="Enter years of experience"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="salary">Salary</Label>
            <Input
              id="salary"
              type="number"
              value={formData.salary || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, salary: parseFloat(e.target.value) || 0 }))}
              placeholder="Enter salary"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="employee_number">Employee Number</Label>
            <Input
              id="employee_number"
              value={formData.employee_number || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, employee_number: e.target.value }))}
              placeholder="Enter employee number"
              disabled
            />
            <p className="text-xs text-muted-foreground">Employee number cannot be changed</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};