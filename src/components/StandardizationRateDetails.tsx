import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, CheckCircle, Clock, AlertTriangle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleMappingPagination } from "@/components/RoleMappingPagination";

interface StandardizationData {
  total_catalogs: number;
  completed_catalogs: number;
  pending_catalogs: number;
  total_roles_uploaded: number;
  total_roles_mapped: number;
  overall_rate: number;
  recent_uploads: CatalogStatus[];
}

interface CatalogStatus {
  id: string;
  catalog_name: string;
  total_roles: number;
  processed_roles: number;
  upload_status: string;
  mapping_accuracy: number;
  created_at: string;
  completion_rate: number;
}

export const StandardizationRateDetails = () => {
  const [data, setData] = useState<StandardizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchStandardizationData();
  }, []);

  const fetchStandardizationData = async () => {
    try {
      // Fetch role catalogs
      const { data: catalogs, error: catalogsError } = await supabase
        .from('xlsmart_role_catalogs')
        .select('*')
        .order('created_at', { ascending: false });

      if (catalogsError) throw catalogsError;

      // Fetch role mappings count
      const { count: totalMappings } = await supabase
        .from('xlsmart_role_mappings')
        .select('*', { count: 'exact', head: true });

      const catalogData = catalogs || [];
      const totalCatalogs = catalogData.length;
      const completedCatalogs = catalogData.filter(c => c.upload_status === 'completed').length;
      const pendingCatalogs = catalogData.filter(c => c.upload_status === 'processing' || c.upload_status === 'pending').length;
      
      const totalRolesUploaded = catalogData.reduce((sum, c) => sum + (c.total_roles || 0), 0);
      const totalRolesMapped = totalMappings || 0;
      
      const overallRate = totalRolesUploaded > 0 
        ? Math.round((totalRolesMapped / totalRolesUploaded) * 100)
        : 0;

      // Process recent uploads with completion rates
      const recentUploads: CatalogStatus[] = catalogData.slice(0, 20).map(catalog => ({
        id: catalog.id,
        catalog_name: catalog.file_name || `Catalog ${catalog.id.slice(-8)}`,
        total_roles: catalog.total_roles || 0,
        processed_roles: catalog.processed_roles || 0,
        upload_status: catalog.upload_status || 'pending',
        mapping_accuracy: catalog.mapping_accuracy || 0,
        created_at: catalog.created_at || '',
        completion_rate: catalog.total_roles > 0 
          ? Math.round((catalog.processed_roles / catalog.total_roles) * 100)
          : 0
      }));

      setData({
        total_catalogs: totalCatalogs,
        completed_catalogs: completedCatalogs,
        pending_catalogs: pendingCatalogs,
        total_roles_uploaded: totalRolesUploaded,
        total_roles_mapped: totalRolesMapped,
        overall_rate: overallRate,
        recent_uploads: recentUploads
      });
    } catch (error) {
      console.error('Error fetching standardization data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          <Clock className="h-3 w-3 mr-1" />
          Processing
        </Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Failed
        </Badge>;
      default:
        return <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>;
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Standardization Rate</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const paginatedUploads = data.recent_uploads.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(data.recent_uploads.length / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Role Standardization Rate</h2>
        <Badge variant="secondary">
          {data.overall_rate}% Overall Rate
        </Badge>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {data.total_roles_uploaded.toLocaleString()}
                </div>
                <p className="text-sm font-medium text-foreground">
                  Roles Uploaded
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {data.total_roles_mapped.toLocaleString()}
                </div>
                <p className="text-sm font-medium text-foreground">
                  Roles Mapped
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {data.completed_catalogs}
                </div>
                <p className="text-sm font-medium text-foreground">
                  Completed Catalogs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {data.pending_catalogs}
                </div>
                <p className="text-sm font-medium text-foreground">
                  Pending Catalogs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Standardization Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Standardization Rate</span>
              <span className="text-sm font-medium">{data.overall_rate}%</span>
            </div>
            <Progress value={data.overall_rate} className="h-3" />
            <div className="text-sm text-muted-foreground">
              {data.total_roles_mapped} out of {data.total_roles_uploaded} roles have been successfully standardized
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Uploads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Role Catalog Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catalog Name</TableHead>
                <TableHead>Total Roles</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Completion %</TableHead>
                <TableHead>Accuracy %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Upload Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUploads.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell>
                    <div className="font-medium">{upload.catalog_name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{upload.total_roles}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{upload.processed_roles}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Progress value={upload.completion_rate} className="w-16 h-2" />
                      <span className="text-sm font-medium">{upload.completion_rate}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{Math.round(upload.mapping_accuracy)}%</span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(upload.upload_status)}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(upload.created_at).toLocaleDateString()}
                    </span>
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
        totalItems={data.recent_uploads.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />
    </div>
  );
};