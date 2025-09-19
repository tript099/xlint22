import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, Search, Briefcase, Star, Users, Grid3X3, List, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EditRoleDialog } from "@/components/EditRoleDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { RoleMappingPagination } from "@/components/RoleMappingPagination";
import { useStandardizedRoles } from "@/hooks/useStandardizedRoles";

// OPTIMIZED: Virtual scrolling configuration
const ITEM_HEIGHT = 180; // Height of each role card
const CONTAINER_HEIGHT = 600; // Fixed height for virtual scrolling container
const OVERSCAN = 3; // Number of items to render outside visible area

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
  // OPTIMIZED: Use React Query hook for caching and optimized data fetching
  const { roles, isLoading, deleteRole, isDeleting, refreshRoles, error } = useStandardizedRoles();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [editRole, setEditRole] = useState<StandardizedRole | null>(null);
  const [deleteRoleToDelete, setDeleteRoleToDelete] = useState<StandardizedRole | null>(null);
  const { toast } = useToast();
  const [pageSize, setPageSize] = useState(8);
  
  // OPTIMIZED: Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // OPTIMIZED: Debounce search term to prevent excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page on search
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // OPTIMIZED: Memoize filtered results to prevent unnecessary recalculations
  const filteredRoles = useMemo(() => {
    return roles.filter(role =>
      role.role_title?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      role.department?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      role.role_level?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [roles, debouncedSearchTerm]);

  // OPTIMIZED: Virtual scrolling calculations
  const virtualItems = useMemo(() => {
    if (viewMode === 'list' || filteredRoles.length <= 10) {
      // Use pagination for list view or small datasets
      const totalPages = Math.ceil(filteredRoles.length / pageSize);
      const startIndex = (currentPage - 1) * pageSize;
      const paginatedRoles = filteredRoles.slice(startIndex, startIndex + pageSize);
      return { totalPages, paginatedRoles, useVirtualScrolling: false };
    }

    // Use virtual scrolling for card view with large datasets
    const itemsPerRow = 2; // Based on md:grid-cols-2
    const rowHeight = ITEM_HEIGHT;
    const totalRows = Math.ceil(filteredRoles.length / itemsPerRow);
    const visibleRows = Math.ceil(CONTAINER_HEIGHT / rowHeight);
    
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.min(startRow + visibleRows + OVERSCAN, totalRows);
    const visibleStartIndex = Math.max(0, startRow - OVERSCAN) * itemsPerRow;
    const visibleEndIndex = Math.min(endRow * itemsPerRow, filteredRoles.length);
    
    const visibleRoles = filteredRoles.slice(visibleStartIndex, visibleEndIndex);
    const offsetY = Math.max(0, startRow - OVERSCAN) * rowHeight;
    const totalHeight = totalRows * rowHeight;

    return {
      totalPages: 1,
      paginatedRoles: visibleRoles,
      useVirtualScrolling: true,
      offsetY,
      totalHeight,
      visibleStartIndex
    };
  }, [filteredRoles, currentPage, pageSize, viewMode, scrollTop]);

  // OPTIMIZED: Handle virtual scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // OPTIMIZED: Memoize pagination calculations for non-virtual mode
  const paginationData = useMemo(() => {
    if (virtualItems.useVirtualScrolling) {
      return virtualItems;
    }
    const totalPages = Math.ceil(filteredRoles.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedRoles = filteredRoles.slice(startIndex, startIndex + pageSize);
    
    return { totalPages, paginatedRoles };
  }, [filteredRoles, currentPage, pageSize, virtualItems]);

  // OPTIMIZED: Memoize delete handler to prevent re-renders
  const handleDelete = useCallback(async () => {
    if (!deleteRoleToDelete) return;

    try {
      await deleteRole(deleteRoleToDelete.id);
      
      toast({
        title: "Success",
        description: "Role deleted successfully",
      });
      
      setDeleteRoleToDelete(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete role",
        variant: "destructive",
      });
    }
  }, [deleteRoleToDelete, deleteRole, toast]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Target className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Standardized Roles</h2>
          <Badge variant="secondary" className="animate-pulse">
            Loading...
          </Badge>
        </div>
        
        {/* Search skeleton */}
        <div className="relative">
          <Skeleton className="h-10 w-full" />
        </div>

        {/* View toggle skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // OPTIMIZED: Error handling with retry functionality
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Target className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Standardized Roles</h2>
          <Badge variant="destructive">
            Error
          </Badge>
        </div>
        
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-6 text-center space-y-4">
            <div className="text-destructive text-lg font-medium">
              Failed to load standardized roles
            </div>
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <Button 
              onClick={() => refreshRoles()} 
              variant="outline"
              className="mt-4"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // OPTIMIZED: Empty state handling
  if (!isLoading && roles.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Target className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Standardized Roles</h2>
          <Badge variant="secondary">
            0 Roles
          </Badge>
        </div>
        
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <Briefcase className="h-16 w-16 mx-auto text-muted-foreground/50" />
            <div className="text-lg font-medium text-muted-foreground">
              No standardized roles found
            </div>
            <p className="text-muted-foreground">
              Upload and standardize role catalogs to see them here.
            </p>
            <Button 
              onClick={() => refreshRoles()} 
              variant="outline"
              className="mt-4"
            >
              Refresh
            </Button>
          </CardContent>
        </Card>
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
        filteredRoles.length > 10 ? (
          // OPTIMIZED: Virtual scrolling for large datasets
          <div 
            ref={scrollElementRef}
            className="relative"
            style={{ height: CONTAINER_HEIGHT, overflow: 'auto' }}
            onScroll={handleScroll}
          >
            <div style={{ height: virtualItems.totalHeight, position: 'relative' }}>
              <div 
                style={{
                  transform: `translateY(${virtualItems.offsetY}px)`,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {virtualItems.paginatedRoles.map((role, index) => (
                    <Card key={`${role.id}-${virtualItems.visibleStartIndex + index}`} className="hover:shadow-lg transition-shadow">
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
                              {role.required_skills.slice(0, 4).map((skill: string, skillIndex: number) => (
                                <Badge key={skillIndex} variant="outline" className="text-xs">
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
                              onClick={() => setDeleteRoleToDelete(role)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Regular grid for smaller datasets
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paginationData.paginatedRoles.map((role) => (
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
                        onClick={() => setDeleteRoleToDelete(role)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
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
            {paginationData.paginatedRoles.map((role) => (
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
                      onClick={() => setDeleteRoleToDelete(role)}
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
        onSave={refreshRoles}
      />

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteRoleToDelete}
        onOpenChange={(open) => !open && setDeleteRoleToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Role"
        description={`Are you sure you want to delete the role "${deleteRoleToDelete?.role_title}"? This action cannot be undone.`}
        loading={isDeleting}
      />

      {/* Pagination - only show for non-virtual scrolling */}
      {(!virtualItems.useVirtualScrolling || viewMode === 'list') && (
        <RoleMappingPagination
          currentPage={currentPage}
          totalPages={paginationData.totalPages}
          pageSize={pageSize}
          totalItems={filteredRoles.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}

      {/* Virtual scrolling info */}
      {virtualItems.useVirtualScrolling && viewMode === 'card' && (
        <div className="flex justify-center items-center text-sm text-muted-foreground">
          <span>
            Showing {virtualItems.paginatedRoles.length} of {filteredRoles.length} roles
            {debouncedSearchTerm && ` (filtered from ${roles.length} total)`}
          </span>
        </div>
      )}
    </div>
  );
};