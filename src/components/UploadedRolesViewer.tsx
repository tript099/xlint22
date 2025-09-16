import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  Search, 
  Database, 
  FileText, 
  Users, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Eye,
  Brain,
  Trash2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoleMappingPagination } from "@/components/RoleMappingPagination";

interface UploadedRole {
  id: string;
  session_id: string;
  role_title: string;
  department?: string;
  role_family?: string;
  seniority_band?: string;
  role_level?: string; // Add this field
  role_purpose?: string;
  core_responsibilities?: string;
  required_skills?: string;
  preferred_skills?: string;
  certifications?: string;
  tools_platforms?: string;
  experience_min_years?: number;
  education?: string;
  location?: string;
  role_variant?: string;
  alternate_titles?: string;
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
  ai_analysis?: any;
}

export const UploadedRolesViewer = () => {
  const [uploadedRoles, setUploadedRoles] = useState<UploadedRole[]>([]);
  const [uploadSessions, setUploadSessions] = useState<UploadSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [standardizing, setStandardizing] = useState(false);
  const [standardizeProgress, setStandardizeProgress] = useState(0);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUploadedData();
    
    // Set up real-time subscriptions for automatic updates
    const xlRolesSubscription = supabase
      .channel('xl_roles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xl_roles_data' }, () => {
        console.log('XL Roles data changed, refreshing...');
        fetchUploadedData();
      })
      .subscribe();

    const smartRolesSubscription = supabase
      .channel('smart_roles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smart_roles_data' }, () => {
        console.log('SMART Roles data changed, refreshing...');
        fetchUploadedData();
      })
      .subscribe();

    const sessionsSubscription = supabase
      .channel('sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xlsmart_upload_sessions' }, () => {
        console.log('Upload sessions changed, refreshing...');
        fetchUploadedData();
      })
      .subscribe();

    // Set up polling as backup (refresh every 30 seconds)
    const pollingInterval = setInterval(() => {
      console.log('Polling refresh - checking for updates...');
      fetchUploadedData();
    }, 30000); // 30 seconds

    // Cleanup subscriptions and polling on unmount
    return () => {
      xlRolesSubscription.unsubscribe();
      smartRolesSubscription.unsubscribe();
      sessionsSubscription.unsubscribe();
      clearInterval(pollingInterval);
    };
  }, []);

  const fetchUploadedData = async () => {
    try {
      setLoading(true);

      // Fetch ALL upload sessions first, then filter appropriately
      const { data: allSessions, error: sessionsError } = await supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;
      
      // Filter for "Upload Only" sessions (not standardized yet)
      const uploadOnlySessions = allSessions?.filter(session => 
        session.session_name?.includes('Role Upload') || 
        session.status === 'processing' ||
        session.status === 'completed'  // Include completed uploads that haven't been standardized
      ) || [];

      console.log('All sessions:', allSessions);
      console.log('Filtered upload-only sessions:', uploadOnlySessions);
      
      setUploadSessions(uploadOnlySessions);

      // Get session IDs for fetching roles
      const sessionIds = uploadOnlySessions.map(s => s.id);
      console.log('Session IDs to query:', sessionIds);

      if (sessionIds.length === 0) {
        setUploadedRoles([]);
        return;
      }

      // Fetch uploaded roles from both tables for these sessions
      const [xlRoles, smartRoles] = await Promise.all([
        supabase
          .from('xl_roles_data')
          .select('*')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('smart_roles_data')
          .select('*')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: false })
      ]);

      console.log('XL Roles query result:', xlRoles);
      console.log('SMART Roles query result:', smartRoles);

      if (xlRoles.error) {
        console.error('XL Roles error:', xlRoles.error);
        throw xlRoles.error;
      }
      if (smartRoles.error) {
        console.error('SMART Roles error:', smartRoles.error);
        throw smartRoles.error;
      }

      if (xlRoles.error) throw xlRoles.error;
      if (smartRoles.error) throw smartRoles.error;

      const xlRolesWithType = (xlRoles.data || []).map(role => ({ ...role, source_type: 'xl' as const }));
      const smartRolesWithType = (smartRoles.data || []).map(role => ({ ...role, source_type: 'smart' as const }));

      setUploadedRoles([...xlRolesWithType, ...smartRolesWithType]);
      
      // Debug: Log the first few roles to see what data we actually have
      const combinedRoles = [...xlRolesWithType, ...smartRolesWithType];
      if (combinedRoles.length > 0) {
        console.log('🔍 First uploaded role data:', combinedRoles[0]);
        console.log('🔍 All field names:', Object.keys(combinedRoles[0]));
      }
    } catch (error) {
      console.error('Error fetching uploaded data:', error);
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
    const roleFamily = role.role_family?.toLowerCase() || '';
    const skills = role.required_skills?.toLowerCase() || '';
    const preferredSkills = role.preferred_skills?.toLowerCase() || '';
    
    return roleTitle.includes(searchLower) || 
           department.includes(searchLower) || 
           roleFamily.includes(searchLower) ||
           skills.includes(searchLower) ||
           preferredSkills.includes(searchLower);
  });

  const filteredBySession = selectedSession 
    ? filteredRoles.filter(role => role.session_id === selectedSession)
    : filteredRoles;

  const paginatedRoles = filteredBySession.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset to first page when search term or session filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSession]);

  // Adjust current page if it exceeds available pages after pageSize change
  useEffect(() => {
    const maxPage = Math.ceil(filteredBySession.length / pageSize);
    if (currentPage > maxPage && maxPage > 0) {
      setCurrentPage(maxPage);
    }
  }, [pageSize, filteredBySession.length, currentPage]);

  const handleStandardizeSession = async (sessionId: string) => {
    setStandardizing(true);
    setStandardizeProgress(0);

    try {
      // Find the session
      const session = uploadSessions.find(s => s.id === sessionId);
      if (!session) throw new Error('Session not found');

      setStandardizeProgress(20);

      // Get roles for this session
      const sessionRoles = uploadedRoles.filter(role => role.session_id === sessionId);
      const xlRoles = sessionRoles.filter(role => role.source_type === 'xl');
      const smartRoles = sessionRoles.filter(role => role.source_type === 'smart');

      setStandardizeProgress(40);

      // Call the AI standardization function
      const { data: result, error } = await supabase.functions.invoke('ai-role-standardization', {
        body: { 
          sessionId: sessionId,
          xlData: xlRoles,
          smartData: smartRoles
        }
      });

      if (error) throw error;

      setStandardizeProgress(80);

      if (!result?.success) {
        throw new Error(result?.error || 'Standardization failed');
      }

      setStandardizeProgress(100);

      toast({
        title: "✅ Standardization Complete!",
        description: `Successfully standardized ${result.standardRolesCreated || 0} roles`,
        duration: 5000
      });

      // Automatically refresh data after standardization
      await fetchUploadedData();

      // Refresh the data
      await fetchUploadedData();

    } catch (error) {
      console.error('Standardization error:', error);
      toast({
        title: "❌ Standardization Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive"
      });
    } finally {
      setStandardizing(false);
      setStandardizeProgress(0);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'uploading':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Uploading</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Ready to Standardize</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{status}</Badge>;
    }
  };

  const getSourceIcon = (sourceType: 'xl' | 'smart') => {
    return sourceType === 'xl' ? <FileText className="h-4 w-4" /> : <Database className="h-4 w-4" />;
  };

  const handleDeleteSession = async (sessionId: string) => {
    console.log('Starting delete for session:', sessionId);
    setDeletingSession(sessionId);
    
    try {
      // Delete roles from both tables
      console.log('Deleting from xl_roles_data...');
      const [xlDeleteResult, smartDeleteResult] = await Promise.all([
        supabase
          .from('xl_roles_data')
          .delete()
          .eq('session_id', sessionId),
        supabase
          .from('smart_roles_data')
          .delete()
          .eq('session_id', sessionId)
      ]);

      console.log('XL delete result:', xlDeleteResult);
      console.log('Smart delete result:', smartDeleteResult);

      if (xlDeleteResult.error) throw xlDeleteResult.error;
      if (smartDeleteResult.error) throw smartDeleteResult.error;

      // Delete the session itself
      console.log('Deleting session...');
      const { error: sessionDeleteError } = await supabase
        .from('xlsmart_upload_sessions')
        .delete()
        .eq('id', sessionId);

      if (sessionDeleteError) {
        console.error('Session delete error:', sessionDeleteError);
        throw sessionDeleteError;
      }

      console.log('Delete completed successfully');

      toast({
        title: "✅ Session Deleted",
        description: "Upload session and all associated roles have been deleted successfully",
        duration: 5000
      });

      // Refresh the data after successful deletion
      await fetchUploadedData();

    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "❌ Delete Failed",
        description: error instanceof Error ? error.message : 'Failed to delete session',
        variant: "destructive"
      });
    } finally {
      setDeletingSession(null);
    }
  };

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
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {uploadSessions.reduce((total, session) => total + (session.total_rows || 0), 0)} roles uploaded
            </span>
          </div>
          {searchTerm && (
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {filteredRoles.length} matching "{searchTerm}"
              </span>
            </div>
          )}
          {selectedSession && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {filteredBySession.length} in selected session
              </span>
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              console.log('Manual refresh triggered');
              fetchUploadedData();
              toast({
                title: "Data Refreshed",
                description: "Fetched latest data from database"
              });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Upload Sessions Overview */}
      {uploadSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Upload Sessions Ready for Standardization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadSessions.map((session) => {
                const sessionRoles = uploadedRoles.filter(role => role.session_id === session.id);
                const xlCount = sessionRoles.filter(role => role.source_type === 'xl').length;
                const smartCount = sessionRoles.filter(role => role.source_type === 'smart').length;

                return (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{session.session_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>{new Date(session.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{session.total_rows} total rows</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span>{xlCount} XL roles</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          <span>{smartCount} Smart roles</span>
                        </div>
                      </div>
                      
                      {/* Show sample role names if available */}
                      {sessionRoles.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <strong>Sample roles:</strong> {sessionRoles.slice(0, 3).map(role => role.role_title).join(', ')}
                          {sessionRoles.length > 3 && ` +${sessionRoles.length - 3} more`}
                        </div>
                      )}
                    </div>
                                         <div className="flex items-center gap-2">
                       {getStatusBadge(session.status)}
                       <Button
                         onClick={() => handleStandardizeSession(session.id)}
                         disabled={standardizing}
                         className="flex items-center gap-2"
                       >
                         {standardizing ? (
                           <>
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                             Standardizing...
                           </>
                         ) : (
                           <>
                             <Brain className="h-4 w-4" />
                             Standardize
                           </>
                         )}
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleDeleteSession(session.id)}
                         disabled={deletingSession === session.id || standardizing}
                         className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                       >
                         {deletingSession === session.id ? (
                           <>
                             <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600"></div>
                             Deleting...
                           </>
                         ) : (
                           <>
                             <Trash2 className="h-4 w-4" />
                             Delete
                           </>
                         )}
                       </Button>
                     </div>
                  </div>
                );
              })}
            </div>

            {standardizing && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Standardization Progress</span>
                  <span>{standardizeProgress}%</span>
                </div>
                <Progress value={standardizeProgress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Roles List - Only show if there are roles */}
      {uploadedRoles.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
                {uploadSessions.length > 1 && (
                  <Select value={selectedSession || "all"} onValueChange={(value) => setSelectedSession(value === "all" ? null : value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filter by session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                      {uploadSessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.session_name.substring(0, 30)}...
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedSession(null);
                    setSearchTerm("");
                  }}
                  disabled={!selectedSession && !searchTerm}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardHeader>
        <CardContent>
          {paginatedRoles.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {uploadSessions.length === 0 ? 
                  'No "Upload Only" sessions found' : 
                  'No roles found'
                }
              </h3>
              <p className="text-muted-foreground">
                {uploadSessions.length === 0 ?
                  'Upload roles using the "Upload Only" option to see them here. Roles from "Upload & Standardize" sessions are not shown in this view.' :
                  searchTerm ? 
                    `No roles match your search "${searchTerm}"` :
                    selectedSession ?
                      'No roles found in the selected session' :
                      'Upload session found but no role data loaded yet'
                }
              </p>
            </div>
          ) : (
            <>
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
                  {paginatedRoles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Users className="h-8 w-8" />
                          <p>
                            {searchTerm ? 
                              `No roles found matching "${searchTerm}"` : 
                              selectedSession ? 
                                "No roles in selected session" :
                                "No roles uploaded yet"
                            }
                          </p>
                          {searchTerm && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setSearchTerm("")}
                            >
                              Clear search
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">
                          <div className="max-w-xs" title={`Raw data - Title: "${role.role_title}" | Family: "${role.role_family}" | Dept: "${role.department}" | Alts: "${role.alternate_titles}" | Purpose: "${role.role_purpose}"`}>
                            {(() => {
                              // Try to get the actual role title, avoiding duplicates with department
                              const title = role.role_title?.trim();
                              const family = role.role_family?.trim();
                              const department = role.department?.trim();
                              const alternates = role.alternate_titles?.trim();
                              const purpose = role.role_purpose?.trim();
                              
                              // If role_title exists and is different from department AND looks like a real job title, use it
                              if (title && title !== 'Unknown Role' && title !== department && !title.endsWith(' Role')) {
                                return title;
                              }
                              
                              // Check if role_purpose might contain the actual job title
                              if (purpose && purpose !== 'Unknown Role' && purpose !== department && !purpose.endsWith(' Role')) {
                                // If purpose looks like a job title (not a long description), use it
                                if (purpose.length < 50 && !purpose.includes('.')) {
                                  return purpose;
                                }
                              }
                              
                              // If role_family exists and is different from department, use it
                              if (family && family !== 'Unknown Role' && family !== department && !family.endsWith(' Role')) {
                                return family;
                              }
                              
                              // Try alternate titles if they exist
                              if (alternates && alternates !== 'Unknown Role' && alternates !== department && !alternates.endsWith(' Role')) {
                                return alternates;
                              }
                              
                              // Show what we actually got as a fallback
                              if (title && title !== 'Unknown Role') {
                                return title;
                              }
                              
                              return 'Untitled Role';
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate">
                            {role.department || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {getSourceIcon(role.source_type)}
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
                    ))
                  )}
                </TableBody>
              </Table>

              <RoleMappingPagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredBySession.length / pageSize)}
                pageSize={pageSize}
                totalItems={filteredBySession.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                             />
             </>
           )}
         </CardContent>
        </Card>
      )}

     </div>
   );
 };
