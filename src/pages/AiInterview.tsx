// AI Interviewer Integration – September 16, 2025
// src/pages/AiInterview.tsx

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import CandidateAiInterviewModal from '@/components/modals/CandidateAiInterviewModal';
import { 
  Play, 
  Calendar, 
  Clock, 
  User, 
  TrendingUp, 
  Users, 
  CheckCircle,
  Circle,
  Loader2
} from 'lucide-react';

interface InterviewSession {
  id: string;
  employee_id: string;
  job_description_id: string;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
  overall_score?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  interview_type: string;
  // Related data
  xlsmart_employees?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  xlsmart_job_descriptions?: {
    title: string;
    company_name: string;
  };
}

interface InterviewMetrics {
  total: number;
  active: number;
  completed: number;
  avgScore: number;
}

const AiInterview: React.FC = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [metrics, setMetrics] = useState<InterviewMetrics>({ total: 0, active: 0, completed: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Load interview sessions and metrics
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch interview sessions with related data
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('interview_sessions')
        .select(`
          *,
          xlsmart_employees!inner(first_name, last_name, email),
          xlsmart_job_descriptions!inner(title, company_name)
        `)
        .order('scheduled_at', { ascending: false })
        .limit(50);

      if (sessionsError) {
        throw sessionsError;
      }

      setSessions(sessionsData || []);

      // Calculate metrics
      const total = sessionsData?.length || 0;
      const active = sessionsData?.filter(s => s.status === 'in_progress').length || 0;
      const completed = sessionsData?.filter(s => s.status === 'completed').length || 0;
      const completedSessions = sessionsData?.filter(s => s.status === 'completed' && s.overall_score) || [];
      const avgScore = completedSessions.length > 0 
        ? completedSessions.reduce((sum, s) => sum + (s.overall_score || 0), 0) / completedSessions.length
        : 0;

      setMetrics({ total, active, completed, avgScore: Math.round(avgScore) });

    } catch (error: any) {
      console.error('Error loading interview data:', error);
      toast({
        title: "Error Loading Data",
        description: error.message || "Failed to load interview sessions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStartInterview = (session: InterviewSession) => {
    setSelectedSession(session);
    setModalOpen(true);
  };

  const handleInterviewComplete = () => {
    setModalOpen(false);
    setSelectedSession(null);
    // Reload data to reflect changes
    loadData();
    toast({
      title: "Interview Completed",
      description: "The interview has been saved successfully."
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'scheduled': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'in_progress': return <Loader2 className="w-4 h-4 animate-spin" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading interviews...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">AI Interviews</h1>
        <p className="text-muted-foreground">Conduct AI-powered voice interviews with real-time feedback</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Circle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgScore}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Interview Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No interview sessions found. Schedule interviews from the employee dashboard.
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(session.status)}
                      <Badge className={getStatusColor(session.status)}>
                        {session.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {session.xlsmart_employees?.first_name} {session.xlsmart_employees?.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {session.xlsmart_employees?.email}
                      </div>
                    </div>

                    <div>
                      <div className="font-medium">{session.xlsmart_job_descriptions?.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {session.xlsmart_job_descriptions?.company_name}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(session.scheduled_at)}
                      </div>
                      
                      {session.duration_minutes && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {session.duration_minutes}m
                        </div>
                      )}
                      
                      {session.overall_score && (
                        <div className="font-medium text-primary">
                          Score: {session.overall_score}%
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {session.status === 'scheduled' && (
                      <Button 
                        onClick={() => handleStartInterview(session)}
                        className="flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start Interview
                      </Button>
                    )}
                    
                    {session.status === 'in_progress' && (
                      <Button 
                        onClick={() => handleStartInterview(session)}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Resume
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interview Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-6xl h-[90vh]">
          {selectedSession && (
            <CandidateAiInterviewModal
              interviewId={selectedSession.id}
              jobTitle={selectedSession.xlsmart_job_descriptions?.title || 'Interview'}
              companyName={selectedSession.xlsmart_job_descriptions?.company_name || 'Company'}
              onInterviewComplete={handleInterviewComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AiInterview;