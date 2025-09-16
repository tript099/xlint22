import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SUCCESS_MESSAGES, ERROR_MESSAGES, ROLE } from "@/lib/constants";
import { validateRole } from "@/lib/validations";
import { roleApi } from "@/lib/api";

interface StandardizedRole {
  id: string;
  role_title: string;
  role_level?: string;
  department?: string;
  required_skills?: any;
  standard_description?: string;
  created_at?: string;
}

interface EditRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: StandardizedRole | null;
  onSave: () => void;
}

export const EditRoleDialog = ({
  open,
  onOpenChange,
  role,
  onSave
}: EditRoleDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<StandardizedRole>>({});
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (role) {
      setFormData(role);
      setSkills(Array.isArray(role.required_skills) ? role.required_skills : []);
    }
  }, [role]);

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(skill => skill !== skillToRemove));
  };

  const handleSave = async () => {
    if (!role || !formData.role_title) return;

    // Validate data using validation schema
    const roleData = {
      ...formData,
      required_skills: skills,
      role_category: formData.department || ROLE.CATEGORIES[0],
      job_family: formData.role_title,
      role_level: formData.role_level || ROLE.SENIORITY_LEVELS[0]
    };

    const validation = validateRole(roleData);
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
      const result = await roleApi.update(role.id, validation.data);
      
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
          <DialogTitle>Edit Standardized Role</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role_title">Role Title</Label>
              <Input
                id="role_title"
                value={formData.role_title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, role_title: e.target.value }))}
                placeholder="Enter role title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role_level">Role Level</Label>
              <Input
                id="role_level"
                value={formData.role_level || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, role_level: e.target.value }))}
                placeholder="Enter role level (e.g., M1, L3)"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={formData.department || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
              placeholder="Enter department"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="standard_description">Description</Label>
            <Textarea
              id="standard_description"
              value={formData.standard_description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, standard_description: e.target.value }))}
              placeholder="Enter role description"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Required Skills</Label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder="Add a skill"
                onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
              />
              <Button type="button" onClick={handleAddSkill}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {skills.map((skill, index) => (
                <Badge key={index} variant="outline" className="pr-1">
                  {skill}
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
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