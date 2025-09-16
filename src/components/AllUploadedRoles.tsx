import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, FileText, Search, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UploadedRole {
  id: string;
  session_id: string;
  role_title: string;
  department?: string;
  role_family?: string;
  seniority_band?: string;
  source_type: 'xl' | 'smart';
  created_at: string;
}

export const AllUploadedRoles = () => {
  const [allRoles, setAllRoles] = useState<UploadedRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const fetchAllRoles = async () => {
    try {
      setLoading(true);
      
      // Fetch from both tables
      const [xlRoles, smartRoles] = await Promise.all([
        supabase
          .from('xl_roles_data')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('smart_roles_data')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      if (xlRoles.error) throw xlRoles.error;
      if (smartRoles.error) throw smartRoles.error;

      // Combine and mark source
      const xlRolesWithType = (xlRoles.data || []).map(role => ({
        ...role,
        source_type: 'xl' as const
      }));

      const smartRolesWithType = (smartRoles.data || []).map(role => ({
        ...role,
        source_type: 'smart' as const
      }));

      setAllRoles([...xlRolesWithType, ...smartRolesWithType]);
    } catch (error) {
      console.error('Error fetching all roles:', error);
      toast({
        title: "❌ Error",
        description: "Failed to fetch uploaded roles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllRoles();
  }, []);

  const filteredRoles = allRoles.filter(role =>
    role.role_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.role_family?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              All Uploaded Roles ({allRoles.length})
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRoles.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {searchTerm ? "No matching roles found" : "No roles uploaded"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? "Try adjusting your search terms" : "Upload role data to see them here"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role Family</TableHead>
                  <TableHead>Seniority</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Upload Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={`${role.source_type}-${role.id}`}>
                    <TableCell className="font-medium">{role.role_title}</TableCell>
                    <TableCell>{role.department || "—"}</TableCell>
                    <TableCell>{role.role_family || "—"}</TableCell>
                    <TableCell>{role.seniority_band || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={role.source_type === 'xl' ? 'default' : 'secondary'}>
                        {role.source_type === 'xl' ? (
                          <>
                            <FileText className="h-3 w-3 mr-1" />
                            XL
                          </>
                        ) : (
                          <>
                            <Database className="h-3 w-3 mr-1" />
                            Smart
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(role.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
