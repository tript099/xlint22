import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, Search, Briefcase, Star, Users, Grid3X3, List, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EditRoleDialog } from "@/components/EditRoleDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { RoleMappingPagination } from "@/components/RoleMappingPagination";

interface StandardizedRole {
  id: string;
  role_title: string;
  role_level?: string;
  department?: string;
  required_skills?: any;
  standard_description?: string;
  created_at?: string;
  employee_count?: number;
}

export const StandardizedRolesDetails = () => {
  const [roles, setRoles] = useState<StandardizedRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [editRole, setEditRole] = useState<StandardizedRole | null>(null);
  const [deleteRole, setDeleteRole] = useState<StandardizedRole | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { toast } = useToast();
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    fetchStandardizedRoles();
  }, []);

  const fetchStandardizedRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('xlsmart_standard_roles')
        .select('*')
        .order('role_title');

      if (error) throw error;
      
      // Add employee count for each role
      const rolesWithCount = await Promise.all(
        (data || []).map(async (role) => {
          const { count } = await supabase
            .from('xlsmart_employees')
            .select('*', { count: 'exact', head: true })
            .eq('current_position', role.role_title);
          
          return {
            ...role,
            employee_count: count || 0
          };
        })
      );

      setRoles(rolesWithCount);
    } catch (error) {
      console.error('Error fetching standardized roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRoles = roles.filter(role =>
    role.role_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.role_level?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteRole) return;

    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('xlsmart_standard_roles')
        .delete()
        .eq('id', deleteRole.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Role deleted successfully",
      });
      
      fetchStandardizedRoles();
      setDeleteRole(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(filteredRoles.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRoles = filteredRoles.slice(startIndex, startIndex + pageSize);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <Target className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Standardized Roles</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Target className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Standardized Roles</h2>
          <Badge variant="secondary">
            {roles.length} Standard Roles
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'card' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('card')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search roles by name, department, or level..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Roles Grid or List */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {paginatedRoles.map((role) => (
            <Card key={role.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{role.role_title}</CardTitle>
                      {role.role_level && (
                        <Badge variant="outline" className="mt-1">
                          {role.role_level}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{role.employee_count}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {role.department && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Department:</span>
                    <Badge variant="secondary" className="ml-2">
                      {role.department}
                    </Badge>
                  </div>
                )}
                
                {role.standard_description && (
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Description:</span>
                    <p className="text-sm mt-1 text-gray-700 line-clamp-2">
                      {role.standard_description}
                    </p>
                  </div>
                )}
                
                {role.required_skills && Array.isArray(role.required_skills) && role.required_skills.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Required Skills:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {role.required_skills.slice(0, 4).map((skill: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {role.required_skills.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{role.required_skills.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-2 border-t">
                  {role.created_at && (
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(role.created_at).toLocaleDateString()}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditRole(role)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteRole(role)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Title</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRoles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Briefcase className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{role.role_title}</div>
                      {role.standard_description && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {role.standard_description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {role.role_level ? (
                    <Badge variant="outline">{role.role_level}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {role.department ? (
                    <Badge variant="secondary">{role.department}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{role.employee_count}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {role.created_at ? (
                    <span className="text-sm">{new Date(role.created_at).toLocaleDateString()}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditRole(role)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteRole(role)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit Dialog */}
      <EditRoleDialog
        open={!!editRole}
        onOpenChange={(open) => !open && setEditRole(null)}
        role={editRole}
        onSave={fetchStandardizedRoles}
      />

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteRole}
        onOpenChange={(open) => !open && setDeleteRole(null)}
        onConfirm={handleDelete}
        title="Delete Role"
        description={`Are you sure you want to delete the role "${deleteRole?.role_title}"? This action cannot be undone.`}
        loading={deleteLoading}
      />

      {/* Pagination */}
      <RoleMappingPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredRoles.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />
    </div>
  );
};