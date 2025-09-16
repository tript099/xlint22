import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AIInterviewService } from "@/services/aiInterviewService";
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Square, 
  Clock, 
  User, 
  Briefcase, 
  MessageSquare,
  TrendingUp,
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  Brain,
  Users,
  Target,
  Award,
  AlertCircle,
  CheckCircle,
  Loader2,
  Maximize
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CandidateAiInterviewModal from "@/components/modals/CandidateAiInterviewModal";

// Types for AI Interview system
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  current_position: string;
  current_department: string;
  performance_rating?: number;
  hire_date: string;
  avatar_url?: string;
}

interface JobDescription {
  id: string;
  title: string;
  department: string;
  level: string;
  description: string;
  requirements: string[];
  skills_required: string[];
}

interface InterviewSession {
  id: string;
  employee_id: string;
  job_description_id: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
  transcript?: string;
  ai_analysis?: any;
  score?: number;
  recommendations?: string[];
  created_at: string;
  employee?: Employee;
  job_description?: JobDescription;
}

export default function AIInterviewDashboard() {
  const { toast } = useToast();
  const aiService = AIInterviewService.getInstance();
  const [activeTab, setActiveTab] = useState("overview");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [interviewSessions, setInterviewSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // New interview state
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedJobDescription, setSelectedJobDescription] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [interviewNotes, setInterviewNotes] = useState("");

  // Active interview state
  const [selectedSessionForInterview, setSelectedSessionForInterview] = useState<InterviewSession | null>(null);
  const [isInterviewActive, setIsInterviewActive] = useState(false);
  
  // Interview window state - REMOVED OLD VARIABLES
  const [interviewStatus, setInterviewStatus] = useState<'idle' | 'connecting' | 'active' | 'paused'>('idle');

  // Computed values
  const activeInterview = interviewSessions.find(session => session.status === 'in_progress') || null;

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadEmployees(),
        loadJobDescriptions(),
        loadInterviewSessions()
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from('xlsmart_employees')
      .select('*')
      .order('first_name');
    
    if (error) throw error;
    setEmployees(data || []);
  };

  const loadJobDescriptions = async () => {
    // This would need to be adapted based on your actual job descriptions table structure
    const { data, error } = await supabase
      .from('xlsmart_job_descriptions')
      .select('*')
      .order('title');
    
    if (error) throw error;
    // Transform standardized roles to job descriptions format
    const jds = data?.map(role => ({
      id: role.id,
      title: role.title,
      department: role.department || 'General',
      level: role.level || 'Mid',
      description: role.description || '',
      requirements: role.requirements ? role.requirements.split(',') : [],
      skills_required: role.skills_required || []
    })) || [];
    setJobDescriptions(jds);
  };

  const loadInterviewSessions = async () => {
    try {
      const sessions = await aiService.getInterviewSessions();
      setInterviewSessions(sessions);
    } catch (error) {
      console.error('Error loading interview sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load interview sessions",
        variant: "destructive"
      });
    }
  };

  const scheduleInterview = async () => {
    if (!selectedEmployee || !selectedJobDescription || !scheduledDate) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Save interview session to database using AIInterviewService
      const sessionId = await aiService.scheduleInterview({
        employee_id: selectedEmployee,
        job_description_id: selectedJobDescription,
        interview_type: 'role_assessment',
        interview_notes: interviewNotes
      });

      // Reload interview sessions from database to show the new one
      await loadInterviewSessions();
      
      setIsScheduleDialogOpen(false);
      resetScheduleForm();

      const employee = employees.find(e => e.id === selectedEmployee);
      toast({
        title: "Interview Scheduled",
        description: `Interview scheduled successfully for ${employee?.first_name} ${employee?.last_name}`,
      });
    } catch (error) {
      console.error("Error scheduling interview:", error);
      toast({
        title: "Error",
        description: "Failed to schedule interview",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetScheduleForm = () => {
    setSelectedEmployee("");
    setSelectedJobDescription("");
    setScheduledDate("");
    setInterviewNotes("");
  };

  const startInterview = async (session: InterviewSession) => {
    setLoading(true);
    try {
      // Set the selected session to open the modal
      setSelectedSessionForInterview(session);
      
      toast({
        title: "Interview Interface Ready",
        description: `Opening AI Interview for ${session.employee?.first_name} ${session.employee?.last_name}`,
      });

    } catch (error) {
      console.error("Error preparing interview:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to prepare interview",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const endInterview = async () => {
    setInterviewStatus('idle');
    setSelectedSessionForInterview(null);
    await loadInterviewSessions(); // Refresh the sessions list
    toast({
      title: "Interview Ended",
      description: "Interview session has been terminated.",
    });
  };

  const handleInterviewComplete = () => {
    setSelectedSessionForInterview(null);
    loadInterviewSessions(); // Refresh the sessions list
    toast({
      title: "Interview Completed",
      description: "Interview has been saved and is being analyzed.",
    });
  };

  const filteredSessions = interviewSessions.filter(session => {
    const matchesSearch = !searchTerm || 
      session.employee?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.employee?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.job_description?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || session.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: InterviewSession['status']) => {
    const statusConfig = {
      scheduled: { color: "bg-blue-100 text-blue-800", icon: Calendar },
      in_progress: { color: "bg-yellow-100 text-yellow-800", icon: Loader2 },
      completed: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      cancelled: { color: "bg-red-100 text-red-800", icon: AlertCircle }
    };
    
    const config = statusConfig[status];
    const Icon = config.icon;
    
    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </Badge>
    );
  };

  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">AI Interview Center</h1>
          <p className="text-muted-foreground mt-2">
            Conduct AI-powered interviews for employee role assessments and career development
          </p>
        </div>
        
        <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Interview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule AI Interview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee">Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.first_name} {employee.last_name} - {employee.current_position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="jobDescription">Target Role</Label>
                  <Select value={selectedJobDescription} onValueChange={setSelectedJobDescription}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target role" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobDescriptions.map((jd) => (
                        <SelectItem key={jd.id} value={jd.id}>
                          {jd.title} - {jd.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="scheduledDate">Scheduled Date & Time</Label>
                <Input
                  id="scheduledDate"
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="notes">Interview Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any specific focus areas or notes for this interview..."
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={scheduleInterview} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Schedule Interview
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Interviews</p>
                <p className="text-3xl font-bold">{interviewSessions.length}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Sessions</p>
                <p className="text-3xl font-bold">
                  {interviewSessions.filter(s => s.status === 'in_progress').length}
                </p>
              </div>
              <Mic className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold">
                  {interviewSessions.filter(s => s.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Score</p>
                <p className="text-3xl font-bold">--</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Interview Sessions</TabsTrigger>
          <TabsTrigger value="active">Active Interview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search employees or roles..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Interview Sessions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Interview Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Target Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No interview sessions found. Schedule your first interview to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {session.employee?.first_name} {session.employee?.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {session.employee?.current_position}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{session.job_description?.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {session.job_description?.department}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>
                          {new Date(session.scheduled_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {session.duration_minutes ? `${session.duration_minutes}m` : '--'}
                        </TableCell>
                        <TableCell>
                          {session.score ? (
                            <Badge className="bg-green-100 text-green-800">
                              {session.score}/100
                            </Badge>
                          ) : '--'}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {session.status === 'scheduled' && (
                              <Button
                                size="sm"
                                onClick={() => startInterview(session)}
                                disabled={loading}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Start
                              </Button>
                            )}
                            {session.status === 'in_progress' && (
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => {
                                  setSelectedSessionForInterview(session);
                                }}
                              >
                                <Maximize className="h-3 w-3 mr-1" />
                                View Interview
                              </Button>
                            )}
                            {session.status === 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // Open the CandidateAiInterviewModal for completed sessions so users can view results
                                  setSelectedSessionForInterview(session);
                                }}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Results
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="active" className="space-y-6">
          {activeInterview ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <span>Active Interview Session</span>
                  {getStatusBadge(interviewStatus === 'active' ? 'in_progress' : 'scheduled')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Interview Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Employee</Label>
                      <p className="text-lg font-semibold">
                        {activeInterview.employee?.first_name} {activeInterview.employee?.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {activeInterview.employee?.current_position}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Target Role</Label>
                      <p className="text-lg font-semibold">
                        {activeInterview.job_description?.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {activeInterview.job_description?.department}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Interview Controls */}
                <div className="border rounded-lg p-6 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Interview Controls</h3>
                    <div className="flex items-center space-x-2">
                      {interviewStatus === 'connecting' && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Connecting...
                        </Badge>
                      )}
                      {interviewStatus === 'active' && (
                        <Badge className="bg-green-100 text-green-800">
                          <Mic className="h-3 w-3 mr-1" />
                          Recording
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-4">
                    {interviewStatus === 'active' ? (
                      <>
                        <Button variant="outline" disabled>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                        <Button variant="destructive" onClick={endInterview}>
                          <Square className="h-4 w-4 mr-2" />
                          End Interview
                        </Button>
                      </>
                    ) : (
                      <div className="text-center w-full py-4">
                        <p className="text-muted-foreground">
                          {interviewStatus === 'connecting' 
                            ? 'Connecting to AI interviewer...' 
                            : 'Interview controls will appear when session is active'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Transcript (placeholder) */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Live Transcript</h4>
                  <div className="bg-white border rounded p-4 h-40 overflow-y-auto">
                    {interviewStatus === 'active' ? (
                      <p className="text-muted-foreground italic">
                        Transcript will appear here during the interview...
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        Start the interview to see live transcript
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="text-center">
                  <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Interview</h3>
                  <p className="text-muted-foreground mb-4">
                    Start an interview from the sessions tab to begin
                  </p>
                  <Button onClick={() => setActiveTab("overview")}>
                    View Interview Sessions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Interview Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Analytics will be available after conducting interviews
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Performance Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Performance insights will be generated from interview results
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* AI Interview Modal */}
      <Dialog open={selectedSessionForInterview !== null} onOpenChange={() => setSelectedSessionForInterview(null)}>
        <DialogContent className="max-w-6xl h-[90vh]">
          {selectedSessionForInterview && (
            <CandidateAiInterviewModal
              interviewId={selectedSessionForInterview.id}
              jobTitle={selectedSessionForInterview.job_description?.title || 'Position Assessment'}
              companyName="XLSMART"
              onInterviewComplete={handleInterviewComplete}
              // If this modal was opened from a completed session, open results immediately
              initialShowResults={selectedSessionForInterview.status === 'completed'}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}