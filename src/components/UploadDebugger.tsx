import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Database, FileCheck, AlertCircle, Briefcase, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const UploadDebugger = () => {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [fixingSession, setFixingSession] = useState<string | null>(null);
  const { toast } = useToast();

  const checkDatabase = async () => {
    setLoading(true);
    try {
      // Check recent upload sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // Check standardized roles
      const { data: roles, error: rolesError } = await supabase
        .from('xlsmart_standard_roles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Check role mappings
      const { data: mappings, error: mappingsError } = await supabase
        .from('xlsmart_role_mappings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Check role catalogs
      const { data: catalogs, error: catalogsError } = await supabase
        .from('xlsmart_role_catalogs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setData({
        sessions: { data: sessions, error: sessionsError },
        roles: { data: roles, error: rolesError },
        mappings: { data: mappings, error: mappingsError },
        catalogs: { data: catalogs, error: catalogsError }
      });

    } catch (error) {
      console.error('Database check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fixStuckSession = async (sessionId: string) => {
    setFixingSession(sessionId);
    try {
      // Update session status to completed
      const { error } = await supabase
        .from('xlsmart_upload_sessions')
        .update({ 
          status: 'completed',
          ai_analysis: { 
            ...data.sessions.data.find((s: any) => s.id === sessionId)?.ai_analysis,
            fixed_at: new Date().toISOString(),
            fixed_reason: 'Manual intervention - processing timeout'
          }
        })
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Session Fixed",
        description: "Upload session marked as completed. You may need to re-run standardization.",
      });

      // Refresh data
      await checkDatabase();
    } catch (error: any) {
      console.error('Error fixing session:', error);
      toast({
        title: "Fix Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setFixingSession(null);
    }
  };

  useEffect(() => {
    checkDatabase();
  }, []);

  const getStatusBadge = (error: any, dataLength: number) => {
    if (error) {
      return <Badge variant="destructive" className="ml-2">Error: {error.message}</Badge>;
    }
    if (dataLength === 0) {
      return <Badge variant="secondary" className="ml-2">No Data</Badge>;
    }
    return <Badge variant="default" className="ml-2">{dataLength} records</Badge>;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            🔍 Upload Status Debugger
          </span>
          <Button onClick={checkDatabase} disabled={loading} size="sm">
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Latest Upload Results - NEW SECTION */}
          {data.sessions?.data?.[0]?.ai_analysis?.createdRoles && (
            <div className="p-3 border-2 border-green-200 bg-green-50 rounded-lg">
              <h4 className="font-medium flex items-center text-green-700">
                <Zap className="h-4 w-4 mr-2" />
                🎉 Latest Upload Results - Roles Created This Session
                <Badge variant="default" className="ml-2 bg-green-500">
                  {data.sessions.data[0].ai_analysis.createdRoles.length} new roles
                </Badge>
              </h4>
              <div className="mt-3 grid gap-2">
                {data.sessions.data[0].ai_analysis.createdRoles.map((role: any, index: number) => (
                  <div key={role.id || index} className="p-2 bg-white rounded border border-green-200">
                    <div className="font-medium text-sm text-green-800">{role.title}</div>
                    <div className="text-xs text-green-600">
                      {role.department} • {role.level} • {role.family}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-green-600">
                Processed at: {new Date(data.sessions.data[0].ai_analysis.processedAt || data.sessions.data[0].created_at).toLocaleString()}
              </div>
            </div>
          )}

          {/* Upload Sessions */}
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium flex items-center">
              <FileCheck className="h-4 w-4 mr-2" />
              Recent Upload Sessions
              {getStatusBadge(data.sessions?.error, data.sessions?.data?.length || 0)}
            </h4>
            {data.sessions?.data?.length > 0 ? (
              <div className="mt-2 space-y-1">
                {data.sessions.data.slice(0, 3).map((session: any) => (
                  <div key={session.id} className="text-sm text-muted-foreground border-l-2 border-gray-200 pl-3 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        • {session.session_name} - Status: <Badge size="sm">{session.status}</Badge>
                        {session.status === 'processing' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="ml-2 h-6"
                            onClick={() => fixStuckSession(session.id)}
                            disabled={fixingSession === session.id}
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            {fixingSession === session.id ? 'Fixing...' : 'Fix Stuck'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Created: {new Date(session.created_at).toLocaleString()} | Total Rows: {session.total_rows}
                      {session.ai_analysis && <div className="mt-1">AI Analysis: {JSON.stringify(session.ai_analysis).substring(0, 100)}...</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No upload sessions found</p>
            )}
          </div>

          {/* Standardized Roles */}
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium flex items-center">
              <Briefcase className="h-4 w-4 mr-2" />
              Standardized Roles
              {getStatusBadge(data.roles?.error, data.roles?.data?.length || 0)}
            </h4>
            {data.roles?.data?.length > 0 ? (
              <div className="mt-2 space-y-1">
                {data.roles.data.slice(0, 5).map((role: any) => (
                  <div key={role.id} className="text-sm text-muted-foreground">
                    • {role.role_title} ({role.department || 'No dept'})
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No standardized roles found</p>
            )}
          </div>

          {/* Role Mappings */}
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              Role Mappings
              {getStatusBadge(data.mappings?.error, data.mappings?.data?.length || 0)}
            </h4>
            {data.mappings?.data?.length > 0 ? (
              <div className="mt-2 space-y-1">
                {data.mappings.data.slice(0, 5).map((mapping: any) => (
                  <div key={mapping.id} className="text-sm text-muted-foreground">
                    • {mapping.original_role_title} → {mapping.standardized_role_title}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No role mappings found</p>
            )}
          </div>

          {/* Role Catalogs */}
          <div className="p-3 border rounded-lg">
            <h4 className="font-medium flex items-center">
              <Database className="h-4 w-4 mr-2" />
              Role Catalogs
              {getStatusBadge(data.catalogs?.error, data.catalogs?.data?.length || 0)}
            </h4>
            {data.catalogs?.data?.length > 0 ? (
              <div className="mt-2 space-y-1">
                {data.catalogs.data.slice(0, 3).map((catalog: any) => (
                  <div key={catalog.id} className="text-sm text-muted-foreground">
                    • {catalog.source_company} - Status: <Badge size="sm">{catalog.upload_status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">No role catalogs found</p>
            )}
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
