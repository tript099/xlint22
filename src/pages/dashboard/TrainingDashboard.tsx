import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { 
  BookOpen, 
  Users, 
  TrendingUp, 
  Award, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Play,
  Target,
  BarChart3,
  Loader2,
  RefreshCw,
  Info,
  AlertTriangle,
  Plus,
  Edit
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTdOverview } from "@/hooks/useTdOverview";
import { useTrainingManagement } from "@/hooks/useTrainingManagement";
import { supabase } from "@/integrations/supabase/client";
import TrainingManagement from "@/components/training/TrainingManagement";
import TrainingAssignment from "@/components/training/TrainingAssignment";


export default function TrainingDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const { data: tdData, loading, error, refresh } = useTdOverview();
  const { getTrainingPrograms, loading: programsLoading } = useTrainingManagement();
  const [realTimePrograms, setRealTimePrograms] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalEnrollments: 0,
    activeEnrollments: 0,
    completedEnrollments: 0,
    completionRate: 0
  });
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [progressData, setProgressData] = useState({
    progress_percentage: 0,
    status: 'enrolled'
  });

  // Load real-time training programs
  const loadRealTimePrograms = async () => {
    try {
      const programs = await getTrainingPrograms({ status: 'active' });
      setRealTimePrograms(programs || []);
    } catch (err) {
      console.error('Failed to load real-time programs:', err);
    }
  };

  // Load enrollments
  const loadEnrollments = async () => {
    try {
      console.log('Loading enrollments...');
      
      // First, let's check if there's ANY data in the table
      const { data: countData, error: countError } = await supabase
        .from('employee_training_enrollments')
        .select('id', { count: 'exact' });
      
      if (countError) {
        console.error('Count query error:', countError);
      } else {
        console.log('Total records in employee_training_enrollments:', countData?.length || 0);
      }
      
      // Then try to get actual data
      const { data, error } = await supabase
        .from('employee_training_enrollments')
        .select(`
          *,
          training_programs(name, category, duration_hours),
          xlsmart_employees!employee_training_enrollments_employee_id_fkey(first_name, last_name, current_position, current_department)
        `)
        .order('enrollment_date', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Enrollment query error:', error);
        throw error;
      }
      
      console.log('Raw enrollment data:', data);
      setEnrollments(data || []);

      // Calculate analytics from enrollment data
      const totalEnrollments = data?.length || 0;
      const activeEnrollments = data?.filter(e => ['enrolled', 'in_progress'].includes(e.status)).length || 0;
      const completedEnrollments = data?.filter(e => e.status === 'completed').length || 0;
      const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

      console.log('Enrollment analytics:', { totalEnrollments, activeEnrollments, completedEnrollments });

      setAnalytics({
        totalEnrollments,
        activeEnrollments,
        completedEnrollments,
        completionRate
      });
    } catch (err) {
      console.error('Failed to load enrollments:', err);
    }
  };

  // Load programs on component mount and when tab changes
  useEffect(() => {
    loadRealTimePrograms();
    loadEnrollments();
  }, [activeTab]);

  // Refresh both overview and real-time data
  const refreshAllData = async () => {
    console.log('Refreshing all data after assignment...');
    refresh();
    loadRealTimePrograms();
    
    // Add a small delay and then refresh enrollments
    setTimeout(() => {
      console.log('Refreshing enrollments with delay...');
      loadEnrollments();
    }, 1000);
  };

  // Update enrollment progress
  const updateEnrollmentProgress = async () => {
    if (!selectedEnrollment) return;

    try {
      const { data, error } = await supabase
        .from('employee_training_enrollments')
        .update({
          progress_percentage: progressData.progress_percentage,
          status: progressData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedEnrollment.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `Progress updated for ${selectedEnrollment.xlsmart_employees?.first_name} ${selectedEnrollment.xlsmart_employees?.last_name}`,
      });

      setIsProgressDialogOpen(false);
      setSelectedEnrollment(null);
      loadEnrollments(); // Refresh the enrollments list
    } catch (err) {
      console.error('Error updating progress:', err);
      toast({
        title: "Error",
        description: "Failed to update progress. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Open progress dialog
  const openProgressDialog = (enrollment) => {
    setSelectedEnrollment(enrollment);
    setProgressData({
      progress_percentage: enrollment.progress_percentage || 0,
      status: enrollment.status || 'enrolled'
    });
    setIsProgressDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Loading training data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load training data: {error}
          </AlertDescription>
        </Alert>
        <Button onClick={refresh} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (!tdData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No training data available</p>
        <Button onClick={refresh} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Training & Development</h1>
        <p className="text-muted-foreground text-lg">
          Comprehensive training program management and analytics
        </p>
      </div>

      {/* Training Stats */}
      <section className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl p-6 border">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Training Overview</h2>
            <p className="text-muted-foreground">
              Comprehensive training program management and insights
            </p>
          </div>
          <Button 
            onClick={refreshAllData} 
            disabled={loading || programsLoading}
            className="flex items-center gap-2"
          >
            {(loading || programsLoading) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh Data
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{realTimePrograms.length || tdData?.overview.totalPrograms || 0}</p>
                  <p className="text-sm text-muted-foreground">
                    {realTimePrograms.length === 0 && !tdData?.overview.totalPrograms ? 'Programs (Click Create to add)' : 'Total Programs'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-secondary" />
                <div>
                  <p className="text-2xl font-bold">{analytics.activeEnrollments}</p>
                  <p className="text-sm text-muted-foreground">
                    {analytics.activeEnrollments === 0 ? 'Participants (Ready for enrollment)' : 'Active Enrollments'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-accent" />
                <div>
                  <p className="text-2xl font-bold">{analytics.completionRate}%</p>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {realTimePrograms.reduce((total, program) => total + (program.duration_hours || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Hours Available</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 lg:w-fit">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="programs" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Programs</span>
          </TabsTrigger>
          <TabsTrigger value="assignment" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Assignment</span>
          </TabsTrigger>
          <TabsTrigger value="enrollments" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Enrollments</span>
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Management</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Top Training Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {realTimePrograms.length > 0 ? (
                    (() => {
                      // Calculate categories from real programs
                      const categoryCount = realTimePrograms.reduce((acc, program) => {
                        const category = program.category || 'General';
                        acc[category] = (acc[category] || 0) + 1;
                        return acc;
                      }, {});
                      
                      return Object.entries(categoryCount)
                        .sort(([,a], [,b]) => (b as number) - (a as number))
                        .slice(0, 5)
                        .map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{name}</span>
                            <Badge variant="outline">{count as number} programs</Badge>
                          </div>
                        ));
                    })()
                  ) : (
                    <p className="text-sm text-muted-foreground">No training programs yet. Create some programs to see categories!</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Program Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Programs</span>
                    <Badge variant="default">
                      {realTimePrograms.filter(p => p.status === 'active').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Inactive Programs</span>
                    <Badge variant="secondary">
                      {realTimePrograms.filter(p => p.status === 'inactive').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Programs</span>
                    <Badge variant="outline">{realTimePrograms.length}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Training Programs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Recent Training Programs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {realTimePrograms.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-3">
                    {realTimePrograms.slice(0, 4).map((program) => (
                      <div key={program.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium">{program.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {program.category || 'General'} • {program.duration_hours || 0}h
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={program.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {program.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  {realTimePrograms.length > 4 && (
                    <Button 
                      variant="outline" 
                      className="w-full mt-3"
                      onClick={() => setActiveTab("programs")}
                    >
                      View All Programs ({realTimePrograms.length})
                    </Button>
                  )}
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No training programs found. Create your first program to get started!
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignment" className="space-y-6 mt-6">
          <TrainingAssignment onAssignmentComplete={refreshAllData} />
        </TabsContent>

        <TabsContent value="enrollments" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Training Enrollments ({enrollments.length})
                </div>
                <Button 
                  onClick={loadEnrollments} 
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enrollments.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Current Enrollments</h4>
                        <p className="text-sm text-muted-foreground">
                          Active training assignments and progress tracking
                        </p>
                      </div>
                      <Button onClick={() => setActiveTab("assignment")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add More Enrollments
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {enrollments.map((enrollment) => (
                        <div 
                          key={enrollment.id} 
                          className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md hover:bg-muted/50 transition-all cursor-pointer group"
                          onClick={() => openProgressDialog(enrollment)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {enrollment.xlsmart_employees?.first_name?.[0]}{enrollment.xlsmart_employees?.last_name?.[0]}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-medium">
                                  {enrollment.xlsmart_employees?.first_name} {enrollment.xlsmart_employees?.last_name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {enrollment.xlsmart_employees?.current_position} • {enrollment.xlsmart_employees?.current_department}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Enrolled: {new Date(enrollment.enrollment_date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-medium text-sm">{enrollment.training_programs?.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {enrollment.training_programs?.category} • {enrollment.training_programs?.duration_hours}h
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={enrollment.progress_percentage || 0} className="w-20 h-2" />
                                <span className="text-xs text-muted-foreground">
                                  {enrollment.progress_percentage || 0}%
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={
                                enrollment.status === 'completed' ? 'default' :
                                enrollment.status === 'in_progress' ? 'secondary' :
                                enrollment.status === 'enrolled' ? 'outline' : 'destructive'
                              }>
                                {enrollment.status.replace('_', ' ')}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {enrollment.priority} priority
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Type: {enrollment.enrollment_type?.replace('_', ' ')}
                              </div>
                              <Edit className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 bg-muted rounded-lg">
                      <div className="text-center">
                        <p className="text-lg font-bold">{analytics.totalEnrollments}</p>
                        <p className="text-xs text-muted-foreground">Total Enrollments</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{analytics.activeEnrollments}</p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{analytics.completedEnrollments}</p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{analytics.completionRate}%</p>
                        <p className="text-xs text-muted-foreground">Success Rate</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Enrollments Found</h3>
                    <p className="text-muted-foreground mb-4">
                      {analytics.totalEnrollments === 0 
                        ? "No training assignments have been created yet. Use the Assignment tab to create enrollments."
                        : "Enrollments may still be loading. Try refreshing the data."
                      }
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={() => setActiveTab("assignment")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Enrollment
                      </Button>
                      <Button onClick={loadEnrollments} variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Data
                      </Button>
                    </div>
                    <div className="mt-4 text-xs text-muted-foreground">
                      Debug: Found {analytics.totalEnrollments} total enrollments in database
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Progress Update Dialog */}
          <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Update Training Progress</DialogTitle>
              </DialogHeader>
              
              {selectedEnrollment && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-lg font-medium text-primary">
                        {selectedEnrollment.xlsmart_employees?.first_name?.[0]}{selectedEnrollment.xlsmart_employees?.last_name?.[0]}
                      </span>
                    </div>
                    <h3 className="font-medium">
                      {selectedEnrollment.xlsmart_employees?.first_name} {selectedEnrollment.xlsmart_employees?.last_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedEnrollment.training_programs?.name}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="progress">Progress: {progressData.progress_percentage}%</Label>
                      <div className="space-y-3 mt-2">
                        <Slider
                          value={[progressData.progress_percentage]}
                          onValueChange={(value) => {
                            const newProgress = value[0];
                            setProgressData(prev => ({
                              ...prev,
                              progress_percentage: newProgress,
                              status: newProgress === 100 ? 'completed' : 
                                     newProgress > 0 ? 'in_progress' : 'enrolled'
                            }));
                          }}
                          max={100}
                          step={25}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0%</span>
                          <span>25%</span>
                          <span>50%</span>
                          <span>75%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={progressData.status} 
                        onValueChange={(value) => setProgressData(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enrolled">Enrolled</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button 
                        onClick={updateEnrollmentProgress}
                        className="flex-1"
                      >
                        Update Progress
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setIsProgressDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="management" className="space-y-6 mt-6">
          <TrainingManagement />
        </TabsContent>

        <TabsContent value="programs" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Training Programs ({realTimePrograms.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {realTimePrograms.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {realTimePrograms.map((program) => (
                      <Card key={program.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{program.name}</CardTitle>
                          <Badge variant="outline">{program.category}</Badge>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {program.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{program.duration_hours}h</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span>{program.max_participants}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Target className="h-4 w-4 text-muted-foreground" />
                              <span>{program.difficulty_level}</span>
                            </div>
                          </div>
                          {program.certification_provided && (
                            <div className="flex items-center gap-1 text-sm text-green-600 mt-2">
                              <Award className="h-4 w-4" />
                              <span>Certification Available</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Training Programs Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Create your first training program to get started
                    </p>
                    <Button onClick={() => setActiveTab("management")}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Program
                    </Button>
                  </div>
                )}
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Training programs can be created and managed in the Management tab. 
                    Use the Assignment tab to assign programs to employees.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="participants" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Training Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enrollments.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Current Enrollments ({enrollments.length})</h4>
                        <p className="text-sm text-muted-foreground">
                          Active training assignments and progress
                        </p>
                      </div>
                      <Button onClick={() => setActiveTab("assignment")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Assign More Training
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      {enrollments.map((enrollment) => (
                        <div key={enrollment.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {enrollment.xlsmart_employees?.first_name?.[0]}{enrollment.xlsmart_employees?.last_name?.[0]}
                                </span>
                              </div>
                              <div>
                                <h4 className="font-medium">
                                  {enrollment.xlsmart_employees?.first_name} {enrollment.xlsmart_employees?.last_name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {enrollment.xlsmart_employees?.current_position} • {enrollment.xlsmart_employees?.current_department}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-medium text-sm">{enrollment.training_programs?.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {enrollment.training_programs?.category} • {enrollment.training_programs?.duration_hours}h
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant={
                                enrollment.status === 'completed' ? 'default' :
                                enrollment.status === 'in_progress' ? 'secondary' :
                                enrollment.status === 'enrolled' ? 'outline' : 'destructive'
                              }>
                                {enrollment.status}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {enrollment.priority} priority
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Current Enrollments</h4>
                        <p className="text-sm text-muted-foreground">
                          No training assignments yet
                        </p>
                      </div>
                      <Button onClick={() => setActiveTab("assignment")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Assign Training
                      </Button>
                    </div>
                    
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">No Training Assignments Yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Start by assigning training programs to employees using the Assignment tab.
                      </p>
                      <Button onClick={() => setActiveTab("assignment")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Assign Training
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Training Effectiveness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completion Rate</span>
                    <span className="text-2xl font-bold text-green-600">{analytics.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${analytics.completionRate}%` }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold">{analytics.totalEnrollments}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{analytics.activeEnrollments}</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{analytics.completedEnrollments}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Real-time enrollment data from database
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Program Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tdData.categories.length > 0 ? (
                    tdData.categories.map((category) => (
                      <div key={category.name} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{category.name}</span>
                        <Badge variant="outline">{category.count} programs</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No categories available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Training Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">{tdData.overview.totalHours}</p>
                    <p className="text-sm text-muted-foreground">Total Training Hours</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{tdData.programStatus.active}</p>
                    <p className="text-sm text-muted-foreground">Active Programs</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Programs Table:</span>
                    <Badge variant={tdData.schemaNotes.programsTable ? "default" : "destructive"}>
                      {tdData.schemaNotes.programsTable ? "Found" : "Missing"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Participants Table:</span>
                    <Badge variant={tdData.schemaNotes.participantsTable ? "default" : "destructive"}>
                      {tdData.schemaNotes.participantsTable ? "Found" : "Missing"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pathways Table:</span>
                    <Badge variant={tdData.pathwaysHealth.tableFound ? "default" : "destructive"}>
                      {tdData.pathwaysHealth.tableFound ? "Found" : "Missing"}
                    </Badge>
                  </div>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => toast({ title: "Diagnostics", description: "Visit /admin/td-diagnostics for detailed system health information." })}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    View Diagnostics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
