import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, 
  Upload, 
  Database, 
  FileText, 
  Target, 
  TrendingUp,
  Users,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UploadedRole {
  id: string;
  session_id: string;
  role_title: string;
  department?: string;
  role_family?: string;
  seniority_band?: string;
  role_level?: string;
  required_skills?: string;
  preferred_skills?: string;
  created_at: string;
  source_type: 'xl' | 'smart';
}

interface UploadSession {
  id: string;
  session_name: string;
  file_names: string[];
  total_rows: number;
  status: string;
  created_at: string;
}

export const AIUploadedRolesIntelligence = () => {
  const { toast } = useToast();
  const [uploadedRoles, setUploadedRoles] = useState<UploadedRole[]>([]);
  const [uploadSessions, setUploadSessions] = useState<UploadSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUploadedData();
  }, []);

  const fetchUploadedData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Starting data fetch...');

      // First, let's see what sessions exist
      const { data: allSessions, error: sessionsError } = await supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (sessionsError) {
        console.error('❌ Sessions error:', sessionsError);
        throw sessionsError;
      }
      
      console.log('🔍 All sessions found:', allSessions);
      
      // Get all sessions for now
      setUploadSessions(allSessions || []);

      // Try to fetch ALL roles from both tables
      console.log('🔍 Fetching all roles...');
      const [xlRoles, smartRoles] = await Promise.all([
        supabase
          .from('xl_roles_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('smart_roles_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)
      ]);

      console.log('🔍 XL Roles result:', xlRoles);
      console.log('🔍 Smart Roles result:', smartRoles);

      if (xlRoles.error) {
        console.error('❌ XL Roles error:', xlRoles.error);
        throw xlRoles.error;
      }
      if (smartRoles.error) {
        console.error('❌ Smart Roles error:', smartRoles.error);
        throw smartRoles.error;
      }

      const xlRolesWithType = (xlRoles.data || []).map(role => ({ ...role, source_type: 'xl' as const }));
      const smartRolesWithType = (smartRoles.data || []).map(role => ({ ...role, source_type: 'smart' as const }));

      const allRoles = [...xlRolesWithType, ...smartRolesWithType];
      console.log('🔍 Combined roles:', allRoles);
      setUploadedRoles(allRoles);

      toast({
        title: "Data Loaded",
        description: `Found ${allRoles.length} roles from ${allSessions?.length || 0} sessions`,
      });

    } catch (error) {
      console.error('❌ Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch uploaded roles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRoles = uploadedRoles.filter(role => {
    const searchLower = searchTerm.toLowerCase();
    const roleTitle = role.role_title?.toLowerCase() || '';
    const department = role.department?.toLowerCase() || '';
    return roleTitle.includes(searchLower) || department.includes(searchLower);
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Uploaded Roles Intelligence
          </h2>
          <p className="text-muted-foreground">
            AI-powered analysis of uploaded roles for insights and optimization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchUploadedData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              console.log('🔍 Testing database...');
              const { data, error } = await supabase
                .from('xlsmart_upload_sessions')
                .select('count')
                .limit(1);
              console.log('🔍 Test result:', { data, error });
              toast({
                title: "Database Test",
                description: error ? `Error: ${error.message}` : "Connection successful",
              });
            }}
          >
            <Database className="h-4 w-4 mr-2" />
            Test DB
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Upload className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{uploadedRoles.length}</div>
                <p className="text-sm text-muted-foreground">Total Uploaded Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-green-100">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {uploadedRoles.filter(r => r.source_type === 'xl').length}
                </div>
                <p className="text-sm text-muted-foreground">XL Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {uploadedRoles.filter(r => r.source_type === 'smart').length}
                </div>
                <p className="text-sm text-muted-foreground">Smart Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {uploadSessions.length}
                </div>
                <p className="text-sm text-muted-foreground">Upload Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Uploaded Roles</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRoles.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No uploaded roles found
              </h3>
              <p className="text-muted-foreground">
                Upload roles using the "Upload Only" option to see them here
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.slice(0, 20).map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="max-w-xs truncate" title={role.role_title}>
                        {role.role_title || 'Untitled Role'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {role.department || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {role.source_type === 'xl' ? (
                          <FileText className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Database className="h-4 w-4 text-purple-500" />
                        )}
                        <span className="capitalize">{role.source_type === 'xl' ? 'XL' : 'Smart'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate">
                        {role.seniority_band || role.role_level || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={role.required_skills || role.preferred_skills || ''}>
                        {role.required_skills || role.preferred_skills || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(role.created_at).toLocaleDateString()}
                      </span>
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
