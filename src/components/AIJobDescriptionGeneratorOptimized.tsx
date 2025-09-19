import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Loader2, 
  Download, 
  Copy, 
  Sparkles, 
  Bot, 
  Send, 
  Zap,
  Users,
  MessageCircle,
  CheckCircle2
} from 'lucide-react';

// OPTIMIZED: Memoize form data interface
interface OptimizedFormData {
  position: string;
  department: string;
  experienceLevel: string;
  employmentType: string;
  locationType: string;
  salaryRange: string;
  urgency: string;
  specificRequirements: string;
  companyValues: string;
  benefits: string;
  useStandardRole: boolean;
  selectedStandardRole?: string;
}

// OPTIMIZED: Default form state
const DEFAULT_FORM_DATA: OptimizedFormData = {
  position: '',
  department: '',
  experienceLevel: '',
  employmentType: 'full-time',
  locationType: 'hybrid',
  salaryRange: '',
  urgency: 'normal',
  specificRequirements: '',
  companyValues: '',
  benefits: '',
  useStandardRole: false,
  selectedStandardRole: undefined,
};

interface AIJobDescriptionGeneratorOptimizedProps {
  onJDGenerated?: () => void;
}

// OPTIMIZED: Fetch standard roles with caching
const fetchStandardRoles = async () => {
  const { data, error } = await supabase
    .from('xlsmart_standard_roles')
    .select('id, role_title, department, role_level, standard_description')
    .order('role_title');

  if (error) throw error;
  return data || [];
};

// OPTIMIZED: Generate JD function with improved error handling
const generateJobDescription = async (formData: OptimizedFormData) => {
  const { data, error } = await supabase.functions.invoke('ai-job-description-generator', {
    body: {
      position: formData.position,
      department: formData.department,
      experienceLevel: formData.experienceLevel,
      employmentType: formData.employmentType,
      locationType: formData.locationType,
      salaryRange: formData.salaryRange,
      urgency: formData.urgency,
      specificRequirements: formData.specificRequirements,
      companyValues: formData.companyValues,
      benefits: formData.benefits,
      useStandardRole: formData.useStandardRole,
      selectedStandardRole: formData.selectedStandardRole,
    }
  });

  if (error) throw error;
  return data;
};

// OPTIMIZED: Memoized form field component
const FormField = memo(({ 
  label, 
  children, 
  required = false 
}: { 
  label: string; 
  children: React.ReactNode;
  required?: boolean;
}) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </Label>
    {children}
  </div>
));

// OPTIMIZED: Memoized progress indicator
const GenerationProgress = memo(({ step, totalSteps, currentAction }: {
  step: number;
  totalSteps: number;
  currentAction: string;
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">Generating Job Description</span>
      <span className="text-sm text-muted-foreground">{step}/{totalSteps}</span>
    </div>
    <Progress value={(step / totalSteps) * 100} className="w-full" />
    <div className="flex items-center space-x-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm text-muted-foreground">{currentAction}</span>
    </div>
  </div>
));

const AIJobDescriptionGeneratorOptimized: React.FC<AIJobDescriptionGeneratorOptimizedProps> = ({ 
  onJDGenerated 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // OPTIMIZED: Form state with useCallback to prevent re-renders
  const [formData, setFormData] = useState<OptimizedFormData>(DEFAULT_FORM_DATA);
  const [generatedJD, setGeneratedJD] = useState<any>(null);
  const [generationProgress, setGenerationProgress] = useState({ step: 0, action: '' });

  // OPTIMIZED: Memoized form update handler
  const updateFormData = useCallback((updates: Partial<OptimizedFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // OPTIMIZED: Use React Query for standard roles
  const { data: standardRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['standard-roles-for-jd'],
    queryFn: fetchStandardRoles,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });

  // OPTIMIZED: Generation mutation with progress tracking
  const generationMutation = useMutation({
    mutationFn: generateJobDescription,
    onMutate: () => {
      setGenerationProgress({ step: 1, action: 'Analyzing requirements...' });
    },
    onSuccess: (data) => {
      setGeneratedJD(data);
      setGenerationProgress({ step: 5, action: 'Generation complete!' });
      onJDGenerated?.();
      toast({ 
        title: "Success", 
        description: "Job description generated successfully!" 
      });
    },
    onError: (error) => {
      console.error('Generation error:', error);
      toast({ 
        title: "Error", 
        description: "Failed to generate job description", 
        variant: "destructive" 
      });
      setGenerationProgress({ step: 0, action: '' });
    },
  });

  // OPTIMIZED: Simulate progress during generation
  useEffect(() => {
    if (generationMutation.isPending) {
      const progressSteps = [
        'Analyzing requirements...',
        'Generating content structure...',
        'Creating responsibilities...',
        'Adding qualifications...',
        'Finalizing job description...'
      ];

      let currentStep = 1;
      const interval = setInterval(() => {
        if (currentStep < 5) {
          currentStep++;
          setGenerationProgress({ 
            step: currentStep, 
            action: progressSteps[currentStep - 1] 
          });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [generationMutation.isPending]);

  // OPTIMIZED: Memoized form validation
  const isFormValid = useMemo(() => {
    return formData.position.trim() && formData.department.trim();
  }, [formData.position, formData.department]);

  // OPTIMIZED: Memoized filtered standard roles
  const filteredStandardRoles = useMemo(() => {
    if (!formData.department) return standardRoles;
    return standardRoles.filter(role => 
      role.department?.toLowerCase().includes(formData.department.toLowerCase())
    );
  }, [standardRoles, formData.department]);

  // OPTIMIZED: Generate handler
  const handleGenerate = useCallback(() => {
    if (!isFormValid) {
      toast({ 
        title: "Validation Error", 
        description: "Please fill in all required fields", 
        variant: "destructive" 
      });
      return;
    }

    generationMutation.mutate(formData);
  }, [formData, isFormValid, generationMutation, toast]);

  // OPTIMIZED: Copy to clipboard handler
  const handleCopyToClipboard = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied", description: "Content copied to clipboard" });
  }, [toast]);

  // OPTIMIZED: Reset form handler
  const handleReset = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
    setGeneratedJD(null);
    setGenerationProgress({ step: 0, action: '' });
  }, []);

  if (rolesLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {generationMutation.isPending && (
        <Card>
          <CardContent className="p-6">
            <GenerationProgress 
              step={generationProgress.step}
              totalSteps={5}
              currentAction={generationProgress.action}
            />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="form" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form">Generate JD</TabsTrigger>
          <TabsTrigger value="result" disabled={!generatedJD}>
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Job Description Generator</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Position Title" required>
                  <Input
                    value={formData.position}
                    onChange={(e) => updateFormData({ position: e.target.value })}
                    placeholder="e.g. Senior Software Engineer"
                  />
                </FormField>

                <FormField label="Department" required>
                  <Input
                    value={formData.department}
                    onChange={(e) => updateFormData({ department: e.target.value })}
                    placeholder="e.g. Engineering"
                  />
                </FormField>

                <FormField label="Experience Level">
                  <Select 
                    value={formData.experienceLevel} 
                    onValueChange={(value) => updateFormData({ experienceLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry Level</SelectItem>
                      <SelectItem value="mid">Mid Level</SelectItem>
                      <SelectItem value="senior">Senior Level</SelectItem>
                      <SelectItem value="lead">Lead/Principal</SelectItem>
                      <SelectItem value="executive">Executive</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Employment Type">
                  <Select 
                    value={formData.employmentType} 
                    onValueChange={(value) => updateFormData({ employmentType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              {/* Standard Role Integration */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useStandardRole"
                    checked={formData.useStandardRole}
                    onChange={(e) => updateFormData({ useStandardRole: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="useStandardRole">Use Standard Role Template</Label>
                </div>

                {formData.useStandardRole && (
                  <FormField label="Standard Role">
                    <Select 
                      value={formData.selectedStandardRole} 
                      onValueChange={(value) => updateFormData({ selectedStandardRole: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a standard role" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStandardRoles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.role_title} - {role.department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              </div>

              {/* Additional Requirements */}
              <FormField label="Specific Requirements">
                <textarea
                  value={formData.specificRequirements}
                  onChange={(e) => updateFormData({ specificRequirements: e.target.value })}
                  placeholder="Any specific skills, technologies, or requirements..."
                  className="w-full p-3 border rounded-md min-h-[100px] resize-vertical"
                />
              </FormField>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleReset}>
                  Reset Form
                </Button>
                <Button 
                  onClick={handleGenerate}
                  disabled={!isFormValid || generationMutation.isPending}
                  className="flex items-center space-x-2"
                >
                  {generationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  <span>Generate Job Description</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="result" className="space-y-6">
          {generatedJD && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{generatedJD.title}</CardTitle>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyToClipboard(generatedJD.fullDescription)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground">{generatedJD.summary}</p>
                </div>

                {generatedJD.responsibilities && (
                  <div>
                    <h4 className="font-semibold mb-2">Key Responsibilities</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {generatedJD.responsibilities.map((resp: string, i: number) => (
                        <li key={i}>{resp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {generatedJD.requiredQualifications && (
                  <div>
                    <h4 className="font-semibold mb-2">Required Qualifications</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {generatedJD.requiredQualifications.map((qual: string, i: number) => (
                        <li key={i}>{qual}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {generatedJD.estimatedSalary && (
                  <div>
                    <h4 className="font-semibold mb-2">Salary Range</h4>
                    <p className="text-sm">
                      {generatedJD.estimatedSalary.currency} {generatedJD.estimatedSalary.min?.toLocaleString()} - {generatedJD.estimatedSalary.max?.toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="flex justify-center pt-4">
                  <Button onClick={() => handleGenerate()}>
                    Generate Another JD
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export { AIJobDescriptionGeneratorOptimized };