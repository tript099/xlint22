import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  ThumbsUp, 
  ThumbsDown, 
  Eye, 
  Edit2, 
  Save, 
  X,
  Building,
  User,
  TrendingUp,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RoleMappingDetailsProps {
  mapping: {
    id: string;
    originalTitle: string;
    originalDepartment: string;
    standardizedTitle: string;
    standardizedDepartment: string;
    jobFamily: string;
    confidence: number;
    requiresReview: boolean;
    status: 'auto_mapped' | 'manual_review' | 'approved' | 'rejected';
    originalSkills?: string[];
    standardizedSkills?: string[];
    roleLevel?: string;
    salaryRange?: string;
    reportingStructure?: string;
    keyResponsibilities?: string[];
    requiredQualifications?: string[];
    aiReasoning?: string;
    createdAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
  };
  onApprove: (mappingId: string) => void;
  onReject: (mappingId: string) => void;
  onEdit: (mappingId: string, updates: any) => void;
}

export const RoleMappingDetails = ({ 
  mapping, 
  onApprove, 
  onReject, 
  onEdit 
}: RoleMappingDetailsProps) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedMapping, setEditedMapping] = useState(mapping);
  const [comments, setComments] = useState("");

  const handleSaveEdit = async () => {
    try {
      const { error } = await supabase
        .from('xlsmart_role_mappings')
        .update({
          standardized_role_title: editedMapping.standardizedTitle,
          standardized_department: editedMapping.standardizedDepartment,
          job_family: editedMapping.jobFamily,
          role_level: editedMapping.roleLevel,
          review_comments: comments,
          updated_at: new Date().toISOString()
        })
        .eq('id', mapping.id);

      if (error) throw error;

      onEdit(mapping.id, editedMapping);
      setIsEditing(false);
      
      toast({
        title: "Mapping Updated",
        description: "Role mapping details have been successfully updated.",
      });
    } catch (error) {
      console.error('Error updating mapping:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update mapping details. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 border-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300';
      case 'manual_review': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'auto_mapped': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-card-foreground">Role Mapping Details</h3>
          <p className="text-sm text-muted-foreground">
            Review and manage AI-generated role standardization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(mapping.status)}>
            {mapping.status.replace('_', ' ').toUpperCase()}
          </Badge>
          <Badge variant="outline" className={getConfidenceColor(mapping.confidence)}>
            {mapping.confidence.toFixed(1)}% Confidence
          </Badge>
        </div>
      </div>

      {/* Main Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original Role */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Building className="h-5 w-5 text-muted-foreground" />
              Original Role
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Job Title</Label>
                <p className="text-sm text-card-foreground mt-1">{mapping.originalTitle}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                <p className="text-sm text-card-foreground mt-1">{mapping.originalDepartment || 'Not specified'}</p>
              </div>
              {mapping.originalSkills && mapping.originalSkills.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Skills</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {mapping.originalSkills.map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Standardized Role */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <TrendingUp className="h-5 w-5 text-primary" />
              XLSMART Standardized Role
              {!isEditing && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(true)}
                  className="ml-auto"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Job Title</Label>
                  <Textarea
                    value={editedMapping.standardizedTitle}
                    onChange={(e) => setEditedMapping(prev => ({ ...prev, standardizedTitle: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Department</Label>
                  <Textarea
                    value={editedMapping.standardizedDepartment}
                    onChange={(e) => setEditedMapping(prev => ({ ...prev, standardizedDepartment: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Job Family</Label>
                  <Textarea
                    value={editedMapping.jobFamily}
                    onChange={(e) => setEditedMapping(prev => ({ ...prev, jobFamily: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Review Comments</Label>
                  <Textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add your review comments..."
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Job Title</Label>
                  <p className="text-sm text-card-foreground mt-1">{mapping.standardizedTitle}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                  <p className="text-sm text-card-foreground mt-1">{mapping.standardizedDepartment || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Job Family</Label>
                  <p className="text-sm text-card-foreground mt-1">{mapping.jobFamily || 'Not classified'}</p>
                </div>
                {mapping.roleLevel && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Role Level</Label>
                    <p className="text-sm text-card-foreground mt-1">{mapping.roleLevel}</p>
                  </div>
                )}
                {mapping.standardizedSkills && mapping.standardizedSkills.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Standardized Skills</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {mapping.standardizedSkills.map((skill, index) => (
                        <Badge key={index} variant="default" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis Section */}
      {mapping.aiReasoning && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Eye className="h-5 w-5 text-primary" />
              AI Analysis & Reasoning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted/30 rounded-lg border border-border">
              <p className="text-sm text-card-foreground whitespace-pre-wrap">
                {mapping.aiReasoning}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Details */}
      {(mapping.keyResponsibilities || mapping.requiredQualifications) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mapping.keyResponsibilities && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-card-foreground">Key Responsibilities</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-card-foreground">
                  {mapping.keyResponsibilities.map((responsibility, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{responsibility}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {mapping.requiredQualifications && (
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-card-foreground">Required Qualifications</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-card-foreground">
                  {mapping.requiredQualifications.map((qualification, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{qualification}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Review Actions */}
      {mapping.requiresReview && mapping.status === 'manual_review' && !isEditing && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Manual Review Required</p>
                  <p className="text-sm text-yellow-700">
                    This mapping requires manual review due to low confidence or conflicting data.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onReject(mapping.id)}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <ThumbsDown className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => onApprove(mapping.id)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card className="border-border bg-muted/30">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p className="text-card-foreground">
                {mapping.createdAt ? new Date(mapping.createdAt).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <p className="text-card-foreground capitalize">
                {mapping.status.replace('_', ' ')}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">AI Confidence</Label>
              <p className={`font-medium ${getConfidenceColor(mapping.confidence)}`}>
                {mapping.confidence.toFixed(1)}%
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Review Status</Label>
              <p className="text-card-foreground">
                {mapping.requiresReview ? 'Manual Review' : 'Auto Mapped'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};