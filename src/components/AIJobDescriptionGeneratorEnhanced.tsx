import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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

interface GeneratedJD {
  id?: string;
  title: string;
  summary: string;
  responsibilities: string[];
  requiredQualifications: string[];
  preferredQualifications: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  benefits: string[];
  fullDescription: string;
  keywords: string[];
  estimatedSalary: {
    min: number;
    max: number;
    currency: string;
  };
  experienceLevel?: string;
  educationLevel?: string;
  employmentType?: string;
  locationType?: string;
  // New structured template fields
  jobIdentity?: {
    positionTitle: string;
    directorate: string;
    division?: string;
    department?: string;
    directSupervisor: string;
    directSubordinate: string[];
  };
  keyContacts?: {
    internal: string[];
    external: string[];
  };
  competencies?: {
    functional: {
      academyQualifications: string;
      professionalExperience: string;
      certificationLicense: string;
      expertise: string[];
    };
    leadership: {
      strategicAccountability: string;
      customerCentric: string;
      coalitionBuilding: string;
      peopleFirst: string;
      agileLeadership: string;
      resultDriven: string;
      technologySavvy: string;
    };
  };
}

interface StandardRole {
  id: string;
  role_title: string;
  job_family: string;
  role_level: string;
  department: string;
  standard_description: string;
  core_responsibilities: any; // JSON type from database
  required_skills: any; // JSON type from database
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIJobDescriptionGeneratorEnhancedProps {
  onJDGenerated?: () => void; // Callback to notify parent when JD is generated
}

export const AIJobDescriptionGeneratorEnhanced: React.FC<AIJobDescriptionGeneratorEnhancedProps> = ({ onJDGenerated }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('bulk');
  
  // Bulk Generation
  const [standardRoles, setStandardRoles] = useState<StandardRole[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isBulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState<{success: number, failed: number, total: number}>({
    success: 0, failed: 0, total: 0
  });

  // Chatbot for JD Updates
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedJDForChat, setSelectedJDForChat] = useState<GeneratedJD | null>(null);
  const [existingJDs, setExistingJDs] = useState<GeneratedJD[]>([]);
  const [updatedJDContent, setUpdatedJDContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Load standard roles and existing JDs on component mount
  useEffect(() => {
    console.log('🔄 AIJobDescriptionGeneratorEnhanced mounted, loading data...');
    loadStandardRoles();
    loadExistingJDs();
  }, []);

  const loadStandardRoles = async () => {
    try {
      console.log('Loading standard roles...');
      
      // Get all standard roles
      const { data: allRoles, error: rolesError } = await supabase
        .from('xlsmart_standard_roles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (rolesError) {
        console.error('Supabase error:', rolesError);
        throw rolesError;
      }

      // Get all existing job descriptions with their standard_role_id
      const { data: existingJDs, error: jdError } = await supabase
        .from('xlsmart_job_descriptions')
        .select('standard_role_id')
        .not('standard_role_id', 'is', null);

      if (jdError) {
        console.error('Error fetching existing JDs:', jdError);
        throw jdError;
      }

      // Extract role IDs that already have JDs
      const rolesWithJDs = new Set(
        (existingJDs || []).map(jd => jd.standard_role_id).filter(Boolean)
      );

      // Filter out roles that already have JDs created
      const availableRoles = (allRoles || []).filter(role => !rolesWithJDs.has(role.id));
      
      console.log('Standard roles loaded:', allRoles?.length || 0);
      console.log('Roles with existing JDs:', rolesWithJDs.size);
      console.log('Available roles for JD creation:', availableRoles.length);
      
      setStandardRoles(availableRoles);
      
      if (availableRoles.length === 0) {
        toast({
          title: "All Roles Have Job Descriptions",
          description: "All active standard roles already have job descriptions created. No roles available for bulk generation.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error loading standard roles:', error);
      toast({
        title: "Error Loading Roles",
        description: error instanceof Error ? error.message : "Failed to load standard roles. Please check your permissions.",
        variant: "destructive",
      });
    }
  };

  const loadExistingJDs = async () => {
    try {
      const { data, error } = await supabase
        .from('xlsmart_job_descriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const formattedJDs: GeneratedJD[] = (data || []).map(jd => ({
        id: jd.id,
        title: jd.title,
        summary: jd.summary || '',
        responsibilities: Array.isArray(jd.responsibilities) ? (jd.responsibilities as string[]) : [],
        requiredQualifications: Array.isArray(jd.required_qualifications) ? (jd.required_qualifications as string[]) : [],
        preferredQualifications: Array.isArray(jd.preferred_qualifications) ? (jd.preferred_qualifications as string[]) : [],
        requiredSkills: Array.isArray(jd.required_skills) ? (jd.required_skills as string[]) : [],
        preferredSkills: Array.isArray(jd.preferred_skills) ? (jd.preferred_skills as string[]) : [],
        benefits: [],
        fullDescription: (jd as any).full_description || `${jd.summary || ''}\n\nResponsibilities:\n${
          Array.isArray(jd.responsibilities) ? (jd.responsibilities as string[]).join('\n') : ''
        }\n\nQualifications:\n${
          Array.isArray(jd.required_qualifications) ? (jd.required_qualifications as string[]).join('\n') : ''
        }`,
        keywords: [],
        estimatedSalary: {
          min: jd.salary_range_min || 0,
          max: jd.salary_range_max || 0,
          currency: jd.currency || 'IDR'
        },
        experienceLevel: jd.experience_level || '',
        educationLevel: jd.education_level || '',
        employmentType: jd.employment_type || 'full_time',
        locationType: jd.location_type || 'office',
        // New structured template fields
        jobIdentity: (jd as any).job_identity || undefined,
        keyContacts: (jd as any).key_contacts || undefined,
        competencies: (jd as any).competencies || undefined
      }));
      
      setExistingJDs(formattedJDs);
    } catch (error) {
      console.error('Error loading existing JDs:', error);
    }
  };

  const generatePDF = (jd: GeneratedJD) => {
    // Create PDF content using the structured template
    const pdfContent = `
JOB DESCRIPTION

1. JOB IDENTITY
${jd.jobIdentity ? `
Position Title: ${jd.jobIdentity.positionTitle}
Directorate: ${jd.jobIdentity.directorate}
${jd.jobIdentity.division ? `Division: ${jd.jobIdentity.division}` : ''}
${jd.jobIdentity.department ? `Department: ${jd.jobIdentity.department}` : ''}
Direct Supervisor: ${jd.jobIdentity.directSupervisor}
Direct Subordinate:
${jd.jobIdentity.directSubordinate.map((sub, index) => `${index + 1}. ${sub}`).join('\n')}
` : ''}

2. JOB PURPOSES
${jd.summary}

3. MAIN RESPONSIBILITY
${jd.responsibilities.map((resp, index) => `${index + 1}. ${resp}`).join('\n\n')}

4. KEY OUTPUT
${jd.benefits.map(benefit => `• ${benefit}`).join('\n')}

5. KEY CONTACTS & RELATIONSHIP
Internal:
${jd.keyContacts?.internal.map((contact, index) => `${index + 1}. ${contact}`).join('\n') || 'Not specified'}

External:
${jd.keyContacts?.external.map((contact, index) => `${index + 1}. ${contact}`).join('\n') || 'Not specified'}

6. COMPETENCY SECTION

A. FUNCTIONAL COMPETENCY
${jd.competencies?.functional ? `
Academy Qualifications: ${jd.competencies.functional.academyQualifications}
Professional Experience: ${jd.competencies.functional.professionalExperience}
Certification/License: ${jd.competencies.functional.certificationLicense}
Expertise: ${jd.competencies.functional.expertise.join(', ')}
` : 'Not specified'}

B. LEADERSHIP COMPETENCY
${jd.competencies?.leadership ? `
Strategic accountability: ${jd.competencies.leadership.strategicAccountability}
Customer centric: ${jd.competencies.leadership.customerCentric}
Coalition Building: ${jd.competencies.leadership.coalitionBuilding}
People First: ${jd.competencies.leadership.peopleFirst}
Agile Leadership: ${jd.competencies.leadership.agileLeadership}
Result Driven: ${jd.competencies.leadership.resultDriven}
Technology Savvy: ${jd.competencies.leadership.technologySavvy}
` : 'Not specified'}
    `.trim();

    // Create and download PDF
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jd.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_job_description.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "📄 PDF Generated!",
      description: `Job description for ${jd.title} has been downloaded`,
      duration: 3000,
    });
  };

  const handleBulkGenerate = async () => {
    if (selectedRoles.length === 0) {
      toast({
        title: "No Roles Selected",
        description: "Please select at least one role for bulk generation",
        variant: "destructive",
      });
      return;
    }

    setBulkGenerating(true);
    setBulkProgress(0);
    setBulkResults({ success: 0, failed: 0, total: selectedRoles.length });

    const rolesToProcess = standardRoles.filter(role => selectedRoles.includes(role.id));
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rolesToProcess.length; i++) {
      const role = rolesToProcess[i];
      
      try {
        const { data, error } = await supabase.functions.invoke('ai-job-description-generator', {
          body: {
            roleTitle: role.role_title,
            department: role.department,
            level: role.role_level,
            standardRoleId: role.id, // Link to the standardized role
            employmentType: 'full_time',
            locationStatus: 'office',
            requirements: Array.isArray(role.required_skills) ? (role.required_skills as string[]).join(', ') : '',
            customInstructions: `Based on standardized role: ${role.standard_description}`,
            tone: 'professional',
            language: 'en'
          }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.message);

        successCount++;
      } catch (error) {
        console.error(`Error generating JD for ${role.role_title}:`, error);
        failedCount++;
      }

      const progress = ((i + 1) / rolesToProcess.length) * 100;
      setBulkProgress(progress);
      setBulkResults({ success: successCount, failed: failedCount, total: selectedRoles.length });

      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await loadExistingJDs(); // Refresh the list
    setBulkGenerating(false);

    // Notify parent component that JDs were generated
    if (onJDGenerated && successCount > 0) {
      onJDGenerated();
    }

    toast({
      title: "🎉 Bulk Generation Complete!",
      description: `Generated ${successCount} JDs successfully. ${failedCount} failed.`,
      duration: 8000,
    });
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || !selectedJDForChat) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Use the dedicated JD updater function with structured data
      const { data, error } = await supabase.functions.invoke('ai-jd-updater', {
        body: {
          currentContent: updatedJDContent || selectedJDForChat.fullDescription,
          updateRequest: chatInput,
          jobDescription: {
            title: selectedJDForChat.title,
            summary: selectedJDForChat.summary,
            responsibilities: selectedJDForChat.responsibilities,
            required_qualifications: selectedJDForChat.requiredQualifications,
            preferred_qualifications: selectedJDForChat.preferredQualifications,
            required_skills: selectedJDForChat.requiredSkills || [],
            preferred_skills: selectedJDForChat.preferredSkills || [],
            salary_range_min: selectedJDForChat.estimatedSalary.min,
            salary_range_max: selectedJDForChat.estimatedSalary.max,
            currency: selectedJDForChat.estimatedSalary.currency,
            experience_level: selectedJDForChat.experienceLevel || '',
            education_level: selectedJDForChat.educationLevel || '',
            employment_type: selectedJDForChat.employmentType || 'full_time',
            location_type: selectedJDForChat.locationType || 'office',
            job_identity: selectedJDForChat.jobIdentity,
            key_contacts: selectedJDForChat.keyContacts,
            competencies: selectedJDForChat.competencies
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);
      
      console.log('AI Response Data:', data);
      console.log('Updated Content:', data.updatedContent);
      console.log('Updated Job Description:', data.updatedJobDescription);
      
      // Update with the formatted content and structured data
      setUpdatedJDContent(data.updatedContent);
      
      // Update the selected JD with the new structured data
      if (data.updatedJobDescription) {
        setSelectedJDForChat(prev => prev ? {
          ...prev,
          ...data.updatedJobDescription,
          fullDescription: data.updatedContent
        } : null);
      }

      // Determine if this was a "show" request or an "update" request
      const isShowRequest = /show|display|view|see|preview/i.test(chatInput);
      
      let responseContent = '';
      if (isShowRequest) {
        responseContent = `Here's the current job description for "${selectedJDForChat.title}":\n\n`;
      } else {
        responseContent = `I've updated the job description based on your request: "${chatInput}"\n\n`;
      }
      
      if (data.updatedContent) {
        responseContent += data.updatedContent;
      } else {
        responseContent += "The job description content is ready for review.";
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error in chat:', error);
      toast({
        title: "Chat Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive",
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSaveUpdatedJD = async () => {
    if (!selectedJDForChat || !updatedJDContent) return;

    setIsSaving(true);
    try {
      // Get the updated structured data from the selected JD
      const updateData: any = {
        title: selectedJDForChat.title,
        summary: selectedJDForChat.summary,
        responsibilities: selectedJDForChat.responsibilities,
        required_qualifications: selectedJDForChat.requiredQualifications,
        preferred_qualifications: selectedJDForChat.preferredQualifications,
        required_skills: selectedJDForChat.requiredSkills || [],
        preferred_skills: selectedJDForChat.preferredSkills || [],
        salary_range_min: selectedJDForChat.estimatedSalary.min,
        salary_range_max: selectedJDForChat.estimatedSalary.max,
        currency: selectedJDForChat.estimatedSalary.currency,
        experience_level: selectedJDForChat.experienceLevel || '',
        education_level: selectedJDForChat.educationLevel || '',
        employment_type: selectedJDForChat.employmentType || 'full_time',
        location_type: selectedJDForChat.locationType || 'office',
        status: 'draft', // Reset to draft for re-approval
        updated_at: new Date().toISOString(),
        reviewed_by: null, // Clear previous review
        approved_by: null  // Clear previous approval
      };

      // Add structured template fields if they exist
      if (selectedJDForChat.jobIdentity) {
        updateData.job_identity = selectedJDForChat.jobIdentity;
      }
      if (selectedJDForChat.keyContacts) {
        updateData.key_contacts = selectedJDForChat.keyContacts;
      }
      if (selectedJDForChat.competencies) {
        updateData.competencies = selectedJDForChat.competencies;
      }

      const { error } = await supabase
        .from('xlsmart_job_descriptions')
        .update(updateData)
        .eq('id', selectedJDForChat.id);

      if (error) throw error;

      await loadExistingJDs(); // Refresh the list
      toast({
        title: "✅ Job Description Updated!",
        description: "Your changes have been saved and sent for re-approval",
        duration: 5000,
      });

      // Update the selected JD with new content
      setSelectedJDForChat(prev => prev ? {
        ...prev,
        fullDescription: updatedJDContent
      } : null);
      
    } catch (error) {
      console.error('Error saving JD:', error);
      toast({
        title: "❌ Save Failed",
        description: error instanceof Error ? error.message : 'Failed to save job description',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "✅ Copied!",
        description: "Text copied to clipboard",
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const downloadAsText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Sparkles className="h-6 w-6 text-primary" />
            AI-Powered Job Description Generator
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate JDs in bulk for standardized roles or update existing JDs with AI assistance
          </p>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Bulk Generation
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Update with AI
              </TabsTrigger>
            </TabsList>

            {/* Bulk Generation */}
            <TabsContent value="bulk" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Standard Roles</h3>
                    <Badge variant="secondary">{standardRoles.length} available</Badge>
                  </div>
                  
                  <ScrollArea className="h-96 border rounded-md p-4">
                    <div className="space-y-2">
                      {standardRoles.map((role) => (
                        <div key={role.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                          <input
                            type="checkbox"
                            checked={selectedRoles.includes(role.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRoles(prev => [...prev, role.id]);
                              } else {
                                setSelectedRoles(prev => prev.filter(id => id !== role.id));
                              }
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{role.role_title}</h4>
                            <p className="text-xs text-muted-foreground">{role.department} • {role.role_level}</p>
                            <p className="text-xs text-muted-foreground mt-1">{role.standard_description?.substring(0, 100)}...</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedRoles(standardRoles.map(r => r.id))}
                      disabled={isBulkGenerating}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedRoles([])}
                      disabled={isBulkGenerating}
                    >
                      Clear All
                    </Button>
                  </div>

                  <Button
                    onClick={handleBulkGenerate}
                    disabled={isBulkGenerating || selectedRoles.length === 0}
                    className="w-full xl-button-primary"
                    size="lg"
                  >
                    {isBulkGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating {selectedRoles.length} JDs...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Generate {selectedRoles.length} Job Descriptions
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Bulk Generation Progress</h3>
                  
                  {isBulkGenerating && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{Math.round(bulkProgress)}%</span>
                      </div>
                      <Progress value={bulkProgress} className="w-full" />
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-green-600">{bulkResults.success}</div>
                          <div className="text-xs text-muted-foreground">Success</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-red-600">{bulkResults.failed}</div>
                          <div className="text-xs text-muted-foreground">Failed</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{bulkResults.total}</div>
                          <div className="text-xs text-muted-foreground">Total</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isBulkGenerating && selectedRoles.length > 0 && (
                    <Card className="border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Ready to generate {selectedRoles.length} job descriptions
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* AI Chat for Updates */}
            <TabsContent value="chat" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Select Job Description to Update</h3>
                  
                  <ScrollArea className="h-96 border rounded-md p-4">
                    <div className="space-y-2">
                      {existingJDs.map((jd) => (
                        <Card 
                          key={jd.id} 
                          className={`cursor-pointer transition-colors ${
                            selectedJDForChat?.id === jd.id ? 'border-primary' : 'border-border'
                          }`}
                           onClick={() => {
                             setSelectedJDForChat(jd);
                             setUpdatedJDContent(jd.fullDescription);
                             setChatMessages([{
                               id: 'welcome',
                               role: 'assistant',
                               content: `I'll help you with the job description for "${jd.title}". You can ask me to show you the current JD or make updates. What would you like to do?`,
                               timestamp: new Date()
                             }]);
                           }}
                        >
                          <CardContent className="p-4">
                            <h4 className="font-medium text-sm">{jd.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{jd.summary.substring(0, 100)}...</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="space-y-4">
                  {selectedJDForChat ? (
                    <>
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        AI Assistant - {selectedJDForChat.title}
                      </h3>
                      
                      <Card className="border-border">
                        <CardContent className="p-0">
                          <ScrollArea className="h-80 p-4">
                            <div className="space-y-4">
                              {chatMessages.map((message) => (
                                <div
                                  key={message.id}
                                  className={`flex gap-3 ${
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                      message.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-card-foreground'
                                    }`}
                                  >
                                    <div className="text-sm whitespace-pre-wrap">
                                      {message.role === 'assistant' ? (
                                        <div 
                                          className="prose prose-sm max-w-none"
                                          dangerouslySetInnerHTML={{ 
                                            __html: message.content
                                              .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700; color: inherit;">$1</strong>')
                                              .replace(/\n/g, '<br>')
                                          }} 
                                        />
                                      ) : (
                                        <p>{message.content}</p>
                                      )}
                                    </div>
                                    <p className="text-xs opacity-70 mt-1">
                                      {message.timestamp.toLocaleTimeString()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {isChatLoading && (
                                <div className="flex gap-3 justify-start">
                                  <div className="bg-muted rounded-lg px-4 py-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                          
                                                     <div className="flex gap-2 p-4 border-t border-border">
                             <Input
                               value={chatInput}
                               onChange={(e) => setChatInput(e.target.value)}
                               onKeyPress={(e) => {
                                 if (e.key === 'Enter' && !e.shiftKey) {
                                   e.preventDefault();
                                   handleChatSend();
                                 }
                               }}
                               placeholder="Ask me to show or update the job description..."
                               disabled={isChatLoading}
                               className="flex-1 bg-background border-border"
                             />
                             <Button 
                               onClick={handleChatSend} 
                               disabled={isChatLoading || !chatInput.trim()}
                               size="icon"
                               className="xl-button-primary"
                             >
                               <Send className="h-4 w-4" />
                             </Button>
                             <Button 
                               onClick={() => {
                                 console.log('Current updatedJDContent:', updatedJDContent);
                                 console.log('Current selectedJDForChat:', selectedJDForChat);
                                 setUpdatedJDContent('TEST UPDATE: ' + new Date().toISOString());
                               }}
                               variant="outline"
                               size="icon"
                               title="Debug: Test Update"
                             >
                               🐛
                             </Button>
                           </div>
                        </CardContent>
                       </Card>

                                               {/* Updated JD Preview and Save Button */}
                        {updatedJDContent && (
                         <Card className="border-border bg-muted/50">
                           <CardHeader className="pb-3">
                                                           <CardTitle className="text-lg flex items-center justify-between">
                                Updated Job Description {updatedJDContent !== selectedJDForChat.fullDescription && '(Modified)'}
                               <div className="flex items-center gap-2">
                                 <Button
                                   onClick={() => downloadAsText(updatedJDContent, `${selectedJDForChat.title}_updated.txt`)}
                                   variant="outline"
                                   size="sm"
                                 >
                                   <Download className="mr-2 h-4 w-4" />
                                   Download
                                 </Button>
                                 <Button
                                   onClick={handleSaveUpdatedJD}
                                   disabled={isSaving}
                                   className="xl-button-primary"
                                 >
                                   {isSaving ? (
                                     <>
                                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                       Saving...
                                     </>
                                   ) : (
                                     <>
                                       <CheckCircle2 className="mr-2 h-4 w-4" />
                                       Save Changes
                                     </>
                                   )}
                                 </Button>
                               </div>
                             </CardTitle>
                           </CardHeader>
                           <CardContent>
                             <Tabs defaultValue="formatted" className="w-full">
                               <TabsList className="grid w-full grid-cols-2">
                                 <TabsTrigger value="formatted">Formatted View</TabsTrigger>
                                 <TabsTrigger value="structured">Structured Template</TabsTrigger>
                               </TabsList>
                               
                               <TabsContent value="formatted" className="mt-4">
                                 <ScrollArea className="h-60 p-4 bg-background rounded border">
                                   <pre className="text-sm whitespace-pre-wrap">{updatedJDContent}</pre>
                                 </ScrollArea>
                               </TabsContent>
                               
                               <TabsContent value="structured" className="mt-4">
                                 <ScrollArea className="h-60 p-4 bg-background rounded border">
                                   <div className="space-y-4 text-sm">
                                     {/* Job Identity */}
                                     <div>
                                       <h4 className="font-medium mb-2 text-blue-600">1. JOB IDENTITY</h4>
                                       <div className="bg-muted/50 p-3 rounded-lg">
                                         <div className="grid grid-cols-2 gap-2">
                                           <span className="font-medium">Position Title:</span>
                                           <span>{selectedJDForChat.jobIdentity?.positionTitle || selectedJDForChat.title}</span>
                                           <span className="font-medium">Directorate:</span>
                                           <span>{selectedJDForChat.jobIdentity?.directorate || 'Not specified'}</span>
                                           {selectedJDForChat.jobIdentity?.division && (
                                             <>
                                               <span className="font-medium">Division:</span>
                                               <span>{selectedJDForChat.jobIdentity.division}</span>
                                             </>
                                           )}
                                           {selectedJDForChat.jobIdentity?.department && (
                                             <>
                                               <span className="font-medium">Department:</span>
                                               <span>{selectedJDForChat.jobIdentity.department}</span>
                                             </>
                                           )}
                                           <span className="font-medium">Direct Supervisor:</span>
                                           <span>{selectedJDForChat.jobIdentity?.directSupervisor || 'Not specified'}</span>
                                         </div>
                                         {selectedJDForChat.jobIdentity?.directSubordinate && selectedJDForChat.jobIdentity.directSubordinate.length > 0 && (
                                           <div className="mt-2">
                                             <span className="font-medium">Direct Subordinate:</span>
                                             <ol className="list-decimal list-inside mt-1">
                                               {selectedJDForChat.jobIdentity.directSubordinate.map((sub: string, index: number) => (
                                                 <li key={index}>{sub}</li>
                                               ))}
                                             </ol>
                                           </div>
                                         )}
                                       </div>
                                     </div>

                                     {/* Job Purposes */}
                                     <div>
                                       <h4 className="font-medium mb-2 text-blue-600">2. JOB PURPOSES</h4>
                                       <p className="bg-muted/50 p-3 rounded-lg">{selectedJDForChat.summary || 'Not specified'}</p>
                                     </div>

                                     {/* Main Responsibility */}
                                     <div>
                                       <h4 className="font-medium mb-2 text-blue-600">3. MAIN RESPONSIBILITY</h4>
                                       <div className="bg-muted/50 p-3 rounded-lg">
                                         {selectedJDForChat.responsibilities.length > 0 ? (
                                           <ol className="list-decimal list-inside space-y-2">
                                             {selectedJDForChat.responsibilities.map((resp: string, index: number) => (
                                               <li key={index}>{resp}</li>
                                             ))}
                                           </ol>
                                         ) : (
                                           <p className="text-muted-foreground">Not specified</p>
                                         )}
                                       </div>
                                     </div>

                                     {/* Key Contacts */}
                                     <div>
                                       <h4 className="font-medium mb-2 text-blue-600">5. KEY CONTACTS & RELATIONSHIP</h4>
                                       <div className="bg-muted/50 p-3 rounded-lg space-y-3">
                                         <div>
                                           <span className="font-medium">Internal:</span>
                                           {selectedJDForChat.keyContacts?.internal && selectedJDForChat.keyContacts.internal.length > 0 ? (
                                             <ol className="list-decimal list-inside mt-1">
                                               {selectedJDForChat.keyContacts.internal.map((contact: string, index: number) => (
                                                 <li key={index}>{contact}</li>
                                               ))}
                                             </ol>
                                           ) : (
                                             <p className="text-muted-foreground ml-4">Not specified</p>
                                           )}
                                         </div>
                                         <div>
                                           <span className="font-medium">External:</span>
                                           {selectedJDForChat.keyContacts?.external && selectedJDForChat.keyContacts.external.length > 0 ? (
                                             <ol className="list-decimal list-inside mt-1">
                                               {selectedJDForChat.keyContacts.external.map((contact: string, index: number) => (
                                                 <li key={index}>{contact}</li>
                                               ))}
                                             </ol>
                                           ) : (
                                             <p className="text-muted-foreground ml-4">Not specified</p>
                                           )}
                                         </div>
                                       </div>
                                     </div>

                                     {/* Competencies */}
                                     <div>
                                       <h4 className="font-medium mb-2 text-blue-600">6. COMPETENCY SECTION</h4>
                                       <div className="bg-muted/50 p-3 rounded-lg space-y-4">
                                         <div>
                                           <h5 className="font-medium text-green-600">A. FUNCTIONAL COMPETENCY</h5>
                                           {selectedJDForChat.competencies?.functional ? (
                                             <div className="mt-2 space-y-1">
                                               <div><span className="font-medium">Academy Qualifications:</span> {selectedJDForChat.competencies.functional.academyQualifications}</div>
                                               <div><span className="font-medium">Professional Experience:</span> {selectedJDForChat.competencies.functional.professionalExperience}</div>
                                               <div><span className="font-medium">Certification/License:</span> {selectedJDForChat.competencies.functional.certificationLicense}</div>
                                               <div><span className="font-medium">Expertise:</span> {selectedJDForChat.competencies.functional.expertise?.join(', ')}</div>
                                             </div>
                                           ) : (
                                             <p className="text-muted-foreground">Not specified</p>
                                           )}
                                         </div>
                                         <div>
                                           <h5 className="font-medium text-purple-600">B. LEADERSHIP COMPETENCY</h5>
                                           {selectedJDForChat.competencies?.leadership ? (
                                             <div className="mt-2 grid grid-cols-2 gap-2">
                                               <div><span className="font-medium">Strategic accountability:</span> {selectedJDForChat.competencies.leadership.strategicAccountability}</div>
                                               <div><span className="font-medium">Customer centric:</span> {selectedJDForChat.competencies.leadership.customerCentric}</div>
                                               <div><span className="font-medium">Coalition Building:</span> {selectedJDForChat.competencies.leadership.coalitionBuilding}</div>
                                               <div><span className="font-medium">People First:</span> {selectedJDForChat.competencies.leadership.peopleFirst}</div>
                                               <div><span className="font-medium">Agile Leadership:</span> {selectedJDForChat.competencies.leadership.agileLeadership}</div>
                                               <div><span className="font-medium">Result Driven:</span> {selectedJDForChat.competencies.leadership.resultDriven}</div>
                                               <div><span className="font-medium">Technology Savvy:</span> {selectedJDForChat.competencies.leadership.technologySavvy}</div>
                                             </div>
                                           ) : (
                                             <p className="text-muted-foreground">Not specified</p>
                                           )}
                                         </div>
                                       </div>
                                     </div>
                                   </div>
                                 </ScrollArea>
                               </TabsContent>
                             </Tabs>
                           </CardContent>
                         </Card>
                       )}
                     </>
                   ) : (
                    <Card className="border-border border-dashed">
                      <CardContent className="flex items-center justify-center h-80">
                        <div className="text-center text-muted-foreground">
                          <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Select a job description to start updating with AI</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};