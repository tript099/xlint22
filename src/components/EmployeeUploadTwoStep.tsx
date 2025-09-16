import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, Users, CheckCircle, AlertCircle, Loader2, Brain, ArrowRight, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeRoleAssignmentReview } from "@/components/EmployeeRoleAssignmentReview";
import { EmployeeRoleAssignment } from "@/components/EmployeeRoleAssignment";
import { FILE_UPLOAD, SUCCESS_MESSAGES, ERROR_MESSAGES } from "@/lib/constants";
import { validateEmployeeData } from "@/lib/validations";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface UploadProgress {
  total: number;
  processed: number;
  assigned: number;
  errors: number;
}

interface UploadSession {
  id: string;
  session_name: string;
  status: string;
  total_rows: number;
  created_at: string;
  ai_analysis?: any; // Use any to handle Json type from database
}

export const EmployeeUploadTwoStep = () => {
  // Upload Only states
  const [uploadOnlyFiles, setUploadOnlyFiles] = useState<FileList | null>(null);
  const [uploadOnlyProgress, setUploadOnlyProgress] = useState<UploadProgress>({ total: 0, processed: 0, assigned: 0, errors: 0 });
  const [uploadOnlyComplete, setUploadOnlyComplete] = useState(false);
  const [uploadOnlyUploading, setUploadOnlyUploading] = useState(false);

  // Upload & Assign states  
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ total: 0, processed: 0, assigned: 0, errors: 0 });
  const [assignmentProgress, setAssignmentProgress] = useState<UploadProgress>({ total: 0, processed: 0, assigned: 0, errors: 0 });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [assignmentComplete, setAssignmentComplete] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<UploadSession[]>([]);
  const [selectedSessionForAssignment, setSelectedSessionForAssignment] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("upload");
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, mode: 'upload-only' | 'upload-assign') => {
    const selectedFiles = event.target.files;
    if (mode === 'upload-only') {
      setUploadOnlyFiles(selectedFiles);
      setUploadOnlyComplete(false);
      setUploadOnlyProgress({ total: 0, processed: 0, assigned: 0, errors: 0 });
    } else {
      setFiles(selectedFiles);
      setUploadComplete(false);
      setUploadProgress({ total: 0, processed: 0, assigned: 0, errors: 0 });
    }
  };

  const processExcelFiles = async (files: FileList) => {
    const processedData: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length > 1) {
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];
          
          rows.forEach(row => {
            if (row.some(cell => cell !== undefined && cell !== null && cell !== '')) {
              const rowData: any = {};
              headers.forEach((header, index) => {
                if (header && row[index] !== undefined) {
                  rowData[header.toString().trim()] = row[index];
                }
              });
              processedData.push({
                ...rowData,
                sourceFile: file.name,
                sourceSheet: sheetName
              });
            }
          });
        }
      });
    }
    
    return processedData;
  };

  const handleUploadOnlyData = async () => {
    if (!uploadOnlyFiles || uploadOnlyFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select Excel files to upload",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploadOnlyUploading(true);
      
      // Process Excel files
      const employeeData = await processExcelFiles(uploadOnlyFiles);
      setUploadOnlyProgress(prev => ({ ...prev, total: employeeData.length }));

      toast({
        title: "Processing employee data...",
        description: `Found ${employeeData.length} employee records`
      });

      // Upload to Supabase function (Upload Only - no role assignment)
      const { data, error } = await supabase.functions.invoke('employee-upload-data', {
        body: {
          employees: employeeData,
          sessionName: `Employee Upload Only ${new Date().toISOString()}: ${Array.from(uploadOnlyFiles).map(f => f.name).join(', ')}`,
          skipRoleAssignment: true
        }
      });

      if (error) throw error;

      // Poll for upload progress
      const pollProgress = setInterval(async () => {
        const { data: progressData } = await supabase.functions.invoke('employee-upload-progress', {
          body: { sessionId: data.sessionId }
        });

        if (progressData) {
          setUploadOnlyProgress(progressData.progress);
          
          if (progressData.status === 'completed') {
            clearInterval(pollProgress);
            setUploadOnlyComplete(true);
            setUploadOnlyUploading(false);
            toast({
              title: "Upload Complete!",
              description: `Successfully uploaded ${progressData.progress.processed} employee records without role assignment`
            });
          } else if (progressData.status === 'error') {
            clearInterval(pollProgress);
            setUploadOnlyUploading(false);
            toast({
              title: "Upload Failed",
              description: progressData.error || "An error occurred during upload",
              variant: "destructive"
            });
          }
        }
      }, 2000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadOnlyUploading(false);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload employee data",
        variant: "destructive"
      });
    }
  };

  const handleUploadData = async () => {
    if (!files || files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select Excel files to upload",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);
      
      // Process Excel files
      const employeeData = await processExcelFiles(files);
      setUploadProgress(prev => ({ ...prev, total: employeeData.length }));

      toast({
        title: "Processing employee data...",
        description: `Found ${employeeData.length} employee records`
      });

      // Upload to Supabase function (Step 1: Data only)
      const { data, error } = await supabase.functions.invoke('employee-upload-data', {
        body: {
          employees: employeeData,
          sessionName: `Employee Upload ${new Date().toISOString()}: ${Array.from(files).map(f => f.name).join(', ')}`
        }
      });

      if (error) throw error;

      setSessionId(data.sessionId);
      
      // Poll for upload progress
      const pollProgress = setInterval(async () => {
        const { data: progressData } = await supabase.functions.invoke('employee-upload-progress', {
          body: { sessionId: data.sessionId }
        });

        if (progressData) {
          setUploadProgress(progressData.progress);
          
          if (progressData.status === 'completed') {
            clearInterval(pollProgress);
            setUploadComplete(true);
            setUploading(false);
            toast({
              title: "Data Upload Complete!",
              description: `Successfully uploaded ${progressData.progress.processed} employee records`
            });
            // Switch to assignment tab
            setActiveTab("assign");
            loadAvailableSessions();
          } else if (progressData.status === 'error') {
            clearInterval(pollProgress);
            setUploading(false);
            toast({
              title: "Upload Failed",
              description: progressData.error || "An error occurred during upload",
              variant: "destructive"
            });
          }
        }
      }, 2000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploading(false);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload employee data",
        variant: "destructive"
      });
    }
  };

  const loadAvailableSessions = async () => {
    try {
      // Load completed employee upload sessions
      const { data, error } = await supabase
        .from('xlsmart_upload_sessions')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Filter sessions that contain employee data (sessions with employee uploads)
      const employeeSessions = data?.filter(session => 
        session.session_name && session.total_rows > 0
      ) || [];
      
      setAvailableSessions(employeeSessions);
    } catch (error) {
      console.error('Error loading employee sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load employee upload sessions",
        variant: "destructive",
      });
    }
  };

  const handleAssignRoles = async () => {
    if (!selectedSessionForAssignment) {
      toast({
        title: "No session selected",
        description: "Please select an upload session to assign roles",
        variant: "destructive"
      });
      return;
    }

    try {
      setAssigning(true);
      setAssignmentProgress({ total: 0, processed: 0, assigned: 0, errors: 0 });

      // Start AI role assignment (Step 2)
      const { data, error } = await supabase.functions.invoke('employee-role-assignment', {
        body: {
          sessionId: selectedSessionForAssignment
        }
      });

      if (error) throw error;

      toast({
        title: "Starting AI role analysis...",
        description: "Analyzing employee data and generating role suggestions"
      });
      
      // Poll for assignment progress
      const pollProgress = setInterval(async () => {
        const { data: progressData } = await supabase.functions.invoke('employee-upload-progress', {
          body: { sessionId: selectedSessionForAssignment }
        });

        if (progressData) {
          setAssignmentProgress(progressData.progress);
          
          if (progressData.status === 'roles_assigned') {
            clearInterval(pollProgress);
            setAssignmentComplete(true);
            setAssigning(false);
            toast({
              title: "AI Analysis Complete!",
              description: `Generated ${progressData.progress.assigned} role suggestions for review`
            });
            // Switch to review tab
            setActiveTab("review");
          } else if (progressData.status === 'error') {
            clearInterval(pollProgress);
            setAssigning(false);
            toast({
              title: "Assignment Failed",
              description: progressData.error || "An error occurred during role assignment",
              variant: "destructive"
            });
          }
        }
      }, 2000);

    } catch (error: any) {
      console.error('Assignment error:', error);
      setAssigning(false);
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign roles",
        variant: "destructive"
      });
    }
  };

  const getProgressPercentage = (progress: UploadProgress) => {
    if (progress.total === 0) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          Employee Management Options
        </h2>
        <p className="text-muted-foreground mt-2">
          Choose how you want to process your employee data
        </p>
      </div>

      {/* Option Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Option 1: Upload Only */}
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Upload Only</CardTitle>
            <p className="text-muted-foreground text-sm">
              Upload employee data without AI role assignment (roles already assigned)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="employee-files-upload-only">Employee Data Files</Label>
                <Input
                  id="employee-files-upload-only"
                  type="file"
                  multiple
                  accept={FILE_UPLOAD.ALLOWED_TYPES.map(type => {
                    if (type.includes('spreadsheetml')) return '.xlsx';
                    if (type.includes('ms-excel')) return '.xls';
                    if (type.includes('csv')) return '.csv';
                    return '';
                  }).join(',')}
                  onChange={(e) => handleFileChange(e, 'upload-only')}
                  disabled={uploadOnlyUploading}
                />
              </div>
              
              {uploadOnlyFiles && uploadOnlyFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files:</Label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(uploadOnlyFiles).map((file, index) => (
                      <Badge key={index} variant="outline">
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleUploadOnlyData}
                disabled={!uploadOnlyFiles || uploadOnlyFiles.length === 0 || uploadOnlyUploading}
                className="w-full"
                variant="outline"
              >
                {uploadOnlyUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Employee Data
                  </>
                )}
              </Button>

              {uploadOnlyUploading && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Upload Progress</span>
                      <span>{getProgressPercentage(uploadOnlyProgress)}%</span>
                    </div>
                    <Progress value={getProgressPercentage(uploadOnlyProgress)} className="w-full" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary">{uploadOnlyProgress.total}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-500">{uploadOnlyProgress.processed}</div>
                      <div className="text-sm text-muted-foreground">Processed</div>
                    </div>
                  </div>
                </div>
              )}

              {uploadOnlyComplete && (
                <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Upload Completed Successfully!</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Records Uploaded:</span> {uploadOnlyProgress.processed}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Option 2: Upload & Assign */}
        <Card className="hover:shadow-lg transition-shadow duration-200 border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/20 rounded-full flex items-center justify-center mb-4">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Upload & Assign</CardTitle>
            <p className="text-muted-foreground text-sm">
              Upload employee data and use AI to suggest role assignments
            </p>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="upload" className="text-xs">
                  <Upload className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="assign" className="text-xs">
                  <Brain className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="review" className="text-xs">
                  <UserCheck className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="manage" className="text-xs">
                  <Users className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>

              {/* Step 1: Upload Data */}
              <TabsContent value="upload" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="employee-files">Employee Data Files</Label>
                  <Input
                    id="employee-files"
                    type="file"
                    multiple
                     accept={FILE_UPLOAD.ALLOWED_TYPES.map(type => {
                       if (type.includes('spreadsheetml')) return '.xlsx';
                       if (type.includes('ms-excel')) return '.xls';
                       if (type.includes('csv')) return '.csv';
                       return '';
                     }).join(',')}
                    onChange={(e) => handleFileChange(e, 'upload-assign')}
                    disabled={uploading}
                  />
                </div>

                {files && files.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Files:</Label>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(files).map((file, index) => (
                        <Badge key={index} variant="outline">
                          {file.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleUploadData} 
                  disabled={!files || files.length === 0 || uploading}
                  className="w-full"
                  size="sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-3 w-3" />
                      Upload Data
                    </>
                  )}
                </Button>

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Upload Progress</span>
                      <span>{getProgressPercentage(uploadProgress)}%</span>
                    </div>
                    <Progress value={getProgressPercentage(uploadProgress)} className="w-full" />
                  </div>
                )}

                {uploadComplete && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium text-sm">Upload Complete!</span>
                    </div>
                    <Button onClick={() => setActiveTab("assign")} size="sm" className="mt-2 w-full">
                      Next: Assign Roles <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Step 2: Generate AI Suggestions */}
              <TabsContent value="assign" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Select Session</Label>
                    <Button onClick={loadAvailableSessions} variant="outline" size="sm">
                      Refresh
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {availableSessions.slice(0, 3).map((session) => (
                      <div 
                        key={session.id}
                        className={`p-2 border rounded cursor-pointer text-sm ${
                          selectedSessionForAssignment === session.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedSessionForAssignment(session.id)}
                      >
                        <div className="font-medium truncate">{session.session_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {session.total_rows} employees
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleAssignRoles} 
                  disabled={!selectedSessionForAssignment || assigning}
                  className="w-full"
                  size="sm"
                >
                  {assigning ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-3 w-3" />
                      Generate AI Suggestions
                    </>
                  )}
                </Button>

                {assigning && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Assignment Progress</span>
                      <span>{getProgressPercentage(assignmentProgress)}%</span>
                    </div>
                    <Progress value={getProgressPercentage(assignmentProgress)} className="w-full" />
                  </div>
                )}

                {assignmentComplete && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium text-sm">AI Analysis Complete!</span>
                    </div>
                    <Button onClick={() => setActiveTab("review")} size="sm" className="mt-2 w-full">
                      Review Suggestions <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Step 3: Review & Assign */}
              <TabsContent value="review" className="mt-4">
                {selectedSessionForAssignment ? (
                  <EmployeeRoleAssignmentReview sessionId={selectedSessionForAssignment} />
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      Please select a session first to review role assignments.
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Manage Assignments */}
              <TabsContent value="manage" className="mt-4">
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Manage existing role assignments for all employees.
                  </p>
                  <EmployeeRoleAssignment />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};