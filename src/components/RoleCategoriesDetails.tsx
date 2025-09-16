import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, Users, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleMappingPagination } from "@/components/RoleMappingPagination";

interface RoleCategory {
  job_family: string;
  role_count: number;
  avg_experience: number;
  departments: string[];
  sample_roles: string[];
}

export const RoleCategoriesDetails = () => {
  const [categories, setCategories] = useState<RoleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCategories, setTotalCategories] = useState(0);

  useEffect(() => {
    fetchRoleCategories();
  }, []);

  const fetchRoleCategories = async () => {
    try {
      // Fetch all standard roles grouped by job_family
      const { data: roles, error } = await supabase
        .from('xlsmart_standard_roles')
        .select('job_family, role_title, department, experience_range_min, experience_range_max')
        .not('job_family', 'is', null)
        .order('job_family');

      if (error) throw error;

      // Group roles by job_family
      const categoryMap = new Map<string, {
        roles: any[];
        departments: Set<string>;
        totalExperience: number;
        experienceCount: number;
      }>();

      roles?.forEach(role => {
        if (!categoryMap.has(role.job_family)) {
          categoryMap.set(role.job_family, {
            roles: [],
            departments: new Set(),
            totalExperience: 0,
            experienceCount: 0
          });
        }

        const category = categoryMap.get(role.job_family)!;
        category.roles.push(role);
        
        if (role.department) {
          category.departments.add(role.department);
        }

        if (role.experience_range_min !== null) {
          category.totalExperience += role.experience_range_min;
          category.experienceCount++;
        }
      });

      // Convert to array format
      const categoriesData: RoleCategory[] = Array.from(categoryMap.entries()).map(([jobFamily, data]) => ({
        job_family: jobFamily,
        role_count: data.roles.length,
        avg_experience: data.experienceCount > 0 ? Math.round(data.totalExperience / data.experienceCount) : 0,
        departments: Array.from(data.departments),
        sample_roles: data.roles.slice(0, 3).map(r => r.role_title)
      }));

      categoriesData.sort((a, b) => b.role_count - a.role_count);
      setCategories(categoriesData);
      setTotalCategories(categoriesData.length);
    } catch (error) {
      console.error('Error fetching role categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const paginatedCategories = categories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(totalCategories / pageSize);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <Briefcase className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Role Categories</h2>
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
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Briefcase className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Role Categories (Job Families)</h2>
        <Badge variant="secondary">
          {totalCategories} Categories
        </Badge>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {totalCategories}
                </div>
                <p className="text-sm font-medium text-foreground">
                  Total Categories
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {categories.reduce((sum, cat) => sum + cat.role_count, 0)}
                </div>
                <p className="text-sm font-medium text-foreground">
                  Total Roles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {categories.length > 0 ? Math.round(categories.reduce((sum, cat) => sum + cat.avg_experience, 0) / categories.length) : 0}
                </div>
                <p className="text-sm font-medium text-foreground">
                  Avg Experience (Years)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle>Role Categories Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Family</TableHead>
                <TableHead>Role Count</TableHead>
                <TableHead>Avg Experience</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead>Sample Roles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCategories.map((category) => (
                <TableRow key={category.job_family}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Briefcase className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{category.job_family}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{category.role_count}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{category.avg_experience} years</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {category.departments.slice(0, 2).map((dept, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {dept}
                        </Badge>
                      ))}
                      {category.departments.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{category.departments.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {category.sample_roles.map((role, index) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          {role}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <RoleMappingPagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalCategories}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />
    </div>
  );
};