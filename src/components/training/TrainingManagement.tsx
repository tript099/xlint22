import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Clock, 
  Award, 
  Target,
  Brain,
  Loader2,
  AlertCircle,
  CheckCircle,
  BookOpen,
  RefreshCw
} from "lucide-react";
import { useTrainingManagement } from "@/hooks/useTrainingManagement";
import { useAITrainingAnalyzer } from "@/hooks/useAITrainingAnalyzer";
import { useAuth } from "@/contexts/AuthContext";
import { TrainingProgram, CreateTrainingProgramData } from "@/types/training-management";
import { useToast } from "@/hooks/use-toast";

export default function TrainingManagement() {
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [analyzingEmployee, setAnalyzingEmployee] = useState<string | null>(null);

  const { 
    loading, 
    error, 
    createTrainingProgram, 
    updateTrainingProgram, 
    deleteTrainingProgram, 
    getTrainingPrograms 
  } = useTrainingManagement();

  const { 
    loading: analyzeLoading, 
    error: analyzeError, 
    analyzeEmployeeTraining 
  } = useAITrainingAnalyzer();

  const { user } = useAuth();
  const { toast } = useToast();

  const [newProgram, setNewProgram] = useState<CreateTrainingProgramData>({
    name: '',
    description: '',
    category: '',
    type: 'online',
    duration_hours: 0,
    duration_weeks: 0,
    difficulty_level: 'Beginner',
    target_audience: [],
    learning_objectives: [],
    tags: [],
    max_participants: 50,
    cost_per_participant: 0,
    certification_provided: false,
    content_url: '',
    schedule_type: 'self_paced',
    created_by: user?.id || '00000000-0000-0000-0000-000000000000' // Use actual user ID
  });

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      console.log('Loading training programs...');
      const data = await getTrainingPrograms({ status: 'active' });
      console.log('Training programs loaded:', data);
      setPrograms(data);
      
      if (data.length === 0) {
        console.log('No training programs found');
      }
    } catch (err) {
      console.error('Failed to load programs:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load training programs",
        variant: "destructive",
      });
    }
  };

  const handleCreateProgram = async () => {
    // Basic validation
    if (!newProgram.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Program name is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!newProgram.category.trim()) {
      toast({
        title: "Validation Error", 
        description: "Category is required",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Creating training program:', newProgram);
      const result = await createTrainingProgram(newProgram);
      console.log('Training program created:', result);
      
      toast({
        title: "Success",
        description: "Training program created successfully",
      });
      setIsCreateDialogOpen(false);
      setNewProgram({
        name: '',
        description: '',
        category: '',
        type: 'online',
        duration_hours: 0,
        duration_weeks: 0,
        difficulty_level: 'Beginner',
        target_audience: [],
        learning_objectives: [],
        tags: [],
        max_participants: 50,
        cost_per_participant: 0,
        certification_provided: false,
        content_url: '',
        schedule_type: 'self_paced',
        created_by: user?.id || '00000000-0000-0000-0000-000000000000'
      });
      loadPrograms();
    } catch (err) {
      console.error('Error creating training program:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create training program",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProgram = async () => {
    if (!selectedProgram) return;

    try {
      await updateTrainingProgram(selectedProgram.id, newProgram);
      toast({
        title: "Success",
        description: "Training program updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedProgram(null);
      loadPrograms();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update training program",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProgram = async (programId: string) => {
    if (!confirm('Are you sure you want to delete this training program?')) return;

    try {
      await deleteTrainingProgram(programId);
      toast({
        title: "Success",
        description: "Training program deleted successfully",
      });
      loadPrograms();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete training program",
        variant: "destructive",
      });
    }
  };

  const handleAnalyzeEmployee = async (employeeId: string) => {
    try {
      setAnalyzingEmployee(employeeId);
      const recommendation = await analyzeEmployeeTraining(employeeId);
      toast({
        title: "Analysis Complete",
        description: `Found ${recommendation.recommendedTrainings.length} training recommendations`,
      });
      // You can show the recommendations in a modal or navigate to a details page
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to analyze employee training needs",
        variant: "destructive",
      });
    } finally {
      setAnalyzingEmployee(null);
    }
  };

  const filteredPrograms = programs.filter(program => {
    const matchesSearch = program.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         program.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || program.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(programs.map(p => p.category)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Training Management</h1>
          <p className="text-muted-foreground text-lg">
            Create, manage, and assign training programs
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={loadPrograms}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          
          <Dialog open={isAnalyzeDialogOpen} onOpenChange={setIsAnalyzeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI Analysis
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>AI Training Analysis</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Analyze employee training needs using AI to get personalized recommendations.
                </p>
                <Button 
                  onClick={() => handleAnalyzeEmployee('employee-id-here')}
                  disabled={analyzeLoading}
                  className="w-full"
                >
                  {analyzeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Brain className="h-4 w-4 mr-2" />
                  )}
                  Analyze All Employees
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Program
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Training Program</DialogTitle>
              </DialogHeader>
              <TrainingProgramForm 
                program={newProgram}
                setProgram={setNewProgram}
                onSubmit={handleCreateProgram}
                loading={loading}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <Input
            placeholder="Search training programs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Programs Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredPrograms.map((program) => (
          <Card key={program.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{program.name}</CardTitle>
                  <Badge variant="outline">{program.category}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedProgram(program);
                      setNewProgram(program);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteProgram(program.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
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
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <Award className="h-4 w-4" />
                    <span>Certification Available</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Users className="h-4 w-4 mr-1" />
                    Assign
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <BookOpen className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPrograms.length === 0 && (
        <div className="text-center py-8">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No training programs found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search criteria'
              : 'Create your first training program to get started'
            }
          </p>
          
          {error && (
            <Alert variant="destructive" className="max-w-md mx-auto mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="text-sm text-muted-foreground mb-4">
            Total programs loaded: {programs.length}
          </div>
          
          {(!searchTerm && selectedCategory === 'all') && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Program
            </Button>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Training Program</DialogTitle>
          </DialogHeader>
          <TrainingProgramForm 
            program={newProgram}
            setProgram={setNewProgram}
            onSubmit={handleUpdateProgram}
            loading={loading}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TrainingProgramFormProps {
  program: CreateTrainingProgramData;
  setProgram: (program: CreateTrainingProgramData) => void;
  onSubmit: () => void;
  loading: boolean;
}

function TrainingProgramForm({ program, setProgram, onSubmit, loading }: TrainingProgramFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Program Name</Label>
          <Input
            id="name"
            value={program.name}
            onChange={(e) => setProgram({ ...program, name: e.target.value })}
            placeholder="Enter program name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={program.category} onValueChange={(value) => setProgram({ ...program, category: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Leadership">Leadership</SelectItem>
              <SelectItem value="Technical">Technical</SelectItem>
              <SelectItem value="Soft Skills">Soft Skills</SelectItem>
              <SelectItem value="Compliance">Compliance</SelectItem>
              <SelectItem value="Safety">Safety</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={program.description}
          onChange={(e) => setProgram({ ...program, description: e.target.value })}
          placeholder="Enter program description"
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content_url">Program URL</Label>
        <Input
          id="content_url"
          type="url"
          value={program.content_url || ''}
          onChange={(e) => setProgram({ ...program, content_url: e.target.value })}
          placeholder="e.g., https://learning.company.com/courses/leadership-training"
        />
        <p className="text-xs text-gray-500">Optional: Link to training materials, course platform, or registration page</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select value={program.type} onValueChange={(value: any) => setProgram({ ...program, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="classroom">Classroom</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="certification">Certification</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration_hours">Duration (Hours)</Label>
          <Input
            id="duration_hours"
            type="number"
            value={program.duration_hours}
            onChange={(e) => setProgram({ ...program, duration_hours: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select value={program.difficulty_level} onValueChange={(value: any) => setProgram({ ...program, difficulty_level: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Beginner">Beginner</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="max_participants">Max Participants</Label>
          <Input
            id="max_participants"
            type="number"
            value={program.max_participants}
            onChange={(e) => setProgram({ ...program, max_participants: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Cost per Participant</Label>
          <Input
            id="cost"
            type="number"
            value={program.cost_per_participant}
            onChange={(e) => setProgram({ ...program, cost_per_participant: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="certification"
          checked={program.certification_provided}
          onChange={(e) => setProgram({ ...program, certification_provided: e.target.checked })}
        />
        <Label htmlFor="certification">Certification Provided</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => {}}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Save Program
        </Button>
      </div>
    </div>
  );
}


