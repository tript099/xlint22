import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  XCircle, 
  FileText, 
  Calendar,
  Loader2,
  Eye,
  Edit3,
  Download
} from 'lucide-react';
import { generatePDF, PDFPreview } from './PDFGenerator';

interface JobDescription {
  id: string;
  title: string;
  summary: string | null;
  responsibilities: any;
  required_qualifications: any;
  preferred_qualifications: any;
  required_skills: any;
  preferred_skills: any;
  salary_range_min: number | null;
  salary_range_max: number | null;
  currency: string;
  status: string;
  experience_level: string | null;
  education_level: string | null;
  employment_type: string;
  location_type: string;
  created_at: string;
  updated_at: string;
  generated_by: string;
  reviewed_by: string | null;
  approved_by: string | null;
  ai_generated: boolean;
  job_identity?: any;
  key_contacts?: any;
  competencies?: any;
}

interface JobDescriptionDialogProps {
  statusFilters: string[];
  onActionPerformed?: () => void;
}

const JobDescriptionDialog: React.FC<JobDescriptionDialogProps> = ({ statusFilters, onActionPerformed }) => {
  const { toast } = useToast();
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJD, setSelectedJD] = useState<JobDescription | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadJobDescriptions();
  }, [statusFilters]);

  const loadJobDescriptions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('xlsmart_job_descriptions')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply status filter
      if (!statusFilters.includes('all')) {
        if (statusFilters.length === 1) {
          query = query.eq('status', statusFilters[0]);
        } else {
          query = query.in('status', statusFilters);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Type-safe conversion
      const typedData: JobDescription[] = (data || []).map(item => ({
        ...item,
        summary: item.summary || '',
        responsibilities: Array.isArray(item.responsibilities) ? item.responsibilities : [],
        required_qualifications: Array.isArray(item.required_qualifications) ? item.required_qualifications : [],
        preferred_qualifications: Array.isArray(item.preferred_qualifications) ? item.preferred_qualifications : [],
        required_skills: Array.isArray(item.required_skills) ? item.required_skills : [],
        preferred_skills: Array.isArray(item.preferred_skills) ? item.preferred_skills : [],
        salary_range_min: item.salary_range_min || 0,
        salary_range_max: item.salary_range_max || 0,
        experience_level: item.experience_level || '',
        education_level: item.education_level || ''
      }));
      
      setJobDescriptions(typedData);
      if (typedData.length > 0) setSelectedJD(typedData[0]); // Auto-select first item
    } catch (error) {
      console.error('Error loading job descriptions:', error);
      toast({
        title: "Error",
        description: "Failed to load job descriptions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (jdId: string) => {
    try {
      setActionLoading(jdId);
      const { error } = await supabase
        .from('xlsmart_job_descriptions')
        .update({
          status: 'approved',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', jdId);

      if (error) throw error;

      await loadJobDescriptions();
      toast({
        title: "✅ Approved!",
        description: "Job description has been approved successfully",
        duration: 3000,
      });
      // Notify parent component to refresh dashboard stats
      if (onActionPerformed) {
        onActionPerformed();
      }
    } catch (error) {
      console.error('Error approving JD:', error);
      toast({
        title: "Error",
        description: "Failed to approve job description",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (jdId: string) => {
    try {
      setActionLoading(jdId);
      const { error } = await supabase
        .from('xlsmart_job_descriptions')
        .update({
          status: 'declined',
          approved_by: null,
          reviewed_by: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', jdId);

      if (error) throw error;

      await loadJobDescriptions();
      toast({
        title: "❌ Declined!",
        description: "Job description has been declined",
        duration: 3000,
      });
      // Notify parent component to refresh dashboard stats
      if (onActionPerformed) {
        onActionPerformed();
      }
    } catch (error) {
      console.error('Error declining JD:', error);
      toast({
        title: "Error",
        description: "Failed to decline job description",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (jdId: string) => {
    try {
      setActionLoading(jdId);
      const { error } = await supabase
        .from('xlsmart_job_descriptions')
        .update({
          status: 'published',
          updated_at: new Date().toISOString()
        })
        .eq('id', jdId);

      if (error) throw error;

      await loadJobDescriptions();
      toast({
        title: "🚀 Published!",
        description: "Job description is now live and active",
        duration: 3000,
      });
      // Notify parent component to refresh dashboard stats
      if (onActionPerformed) {
        onActionPerformed();
      }
    } catch (error) {
      console.error('Error publishing JD:', error);
      toast({
        title: "Error",
        description: "Failed to publish job description",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMoveToDraft = async (jdId: string) => {
    try {
      setActionLoading(jdId);
      const { error } = await supabase
        .from('xlsmart_job_descriptions')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', jdId);

      if (error) throw error;

      await loadJobDescriptions();
      toast({
        title: "📝 Moved to Draft!",
        description: "Job description has been moved back to draft status",
        duration: 3000,
      });
      // Notify parent component to refresh dashboard stats
      if (onActionPerformed) {
        onActionPerformed();
      }
    } catch (error) {
      console.error('Error moving JD to draft:', error);
      toast({
        title: "Error",
        description: "Failed to move job description to draft",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-50 text-green-700 border-green-200';
      case 'published': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'review': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'draft': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'declined': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-3 w-3" />;
      case 'published': return <Eye className="h-3 w-3" />;
      case 'review': return <Edit3 className="h-3 w-3" />;
      case 'draft': return <FileText className="h-3 w-3" />;
      case 'declined': return <XCircle className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  const getFilterTitle = () => {
    if (statusFilters.includes('all')) return 'All Job Descriptions';
    if (statusFilters.length > 1) {
      if (statusFilters.includes('draft') && statusFilters.includes('review')) {
        return 'Pending Review Job Descriptions';
      }
      if (statusFilters.includes('approved') && statusFilters.includes('published')) {
        return 'Approved Job Descriptions';
      }
      return `${statusFilters.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' & ')} Job Descriptions`;
    }
    const status = statusFilters[0];
    switch (status) {
      case 'draft': return 'Draft Job Descriptions';
      case 'approved': return 'Approved Job Descriptions';
      case 'published': return 'Published Job Descriptions';
      case 'review': return 'Job Descriptions Under Review';
      case 'declined': return 'Declined Job Descriptions';
      default: return 'Job Descriptions';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin mr-3" />
        <span>Loading job descriptions...</span>
      </div>
    );
  }

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

  const handleDownloadPDF = (jd: JobDescription) => {
    generatePDF(jd);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{getFilterTitle()}</h2>
          <p className="text-muted-foreground">
            Review, approve, and manage job descriptions
          </p>
        </div>
        <Badge variant="secondary">{jobDescriptions.length} found</Badge>
      </div>

             <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
         {/* Job Descriptions List */}
         <div className="xl:col-span-1 min-w-0">
          <Card>
                         <CardHeader className="pb-1">
               <CardTitle className="flex items-center gap-2 text-sm">
                 <FileText className="h-3 w-3 text-primary" />
                 Job Descriptions ({jobDescriptions.length})
               </CardTitle>
             </CardHeader>
            <CardContent className="p-0">
                             <ScrollArea className="h-[500px] sm:h-[600px]">
                 <div className="space-y-1.5 p-2">
                  {jobDescriptions.map((jd) => (
                                                              <Card
                       key={jd.id}
                       className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
                         selectedJD?.id === jd.id ? 'ring-2 ring-primary bg-primary/5' : ''
                       }`}
                       onClick={() => setSelectedJD(jd)}
                     >
                                               <CardContent className="p-2.5">
                          <div className="space-y-1.5">
                                                       <div className="flex items-start justify-between gap-1.5">
                                                           <h4 className="font-medium text-xs leading-tight flex-1 min-w-0">
                                <span className="truncate block">{jd.title}</span>
                              </h4>
                                                           <Badge 
                                className={`text-xs flex-shrink-0 ${getStatusColor(jd.status)}`}
                                variant="secondary"
                              >
                                {getStatusIcon(jd.status)}
                                <span className="ml-0.5 capitalize">{jd.status}</span>
                              </Badge>
                           </div>
                                                       <p className="text-xs text-muted-foreground overflow-hidden" style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: '1.2'
                            }}>
                              {jd.summary || 'No summary available'}
                            </p>
                                                       <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                                                           <span className="flex items-center gap-1">
                                <Calendar className="h-2.5 w-2.5" />
                                {new Date(jd.created_at).toLocaleDateString()}
                              </span>
                                                           {jd.ai_generated && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 border-purple-200 flex-shrink-0">
                                  AI Generated
                                </Badge>
                              )}
                           </div>
                         </div>
                       </CardContent>
                     </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Job Description Details */}
        <div className="xl:col-span-2">
          {selectedJD ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {selectedJD.title}
                  </CardTitle>
                  <Badge className={getStatusColor(selectedJD.status)}>
                    {getStatusIcon(selectedJD.status)}
                    <span className="ml-1 capitalize">{selectedJD.status}</span>
                  </Badge>
                </div>
                
                                 {/* Action Buttons */}
                 <div className="flex items-center gap-2 pt-4 flex-wrap">
                   {(selectedJD.status === 'draft' || selectedJD.status === 'review') && (
                     <>
                       <Button
                         onClick={() => handleApprove(selectedJD.id)}
                         disabled={actionLoading === selectedJD.id}
                         className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm"
                         size="sm"
                       >
                         {actionLoading === selectedJD.id ? (
                           <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
                         ) : (
                           <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                         )}
                         Approve
                       </Button>
                       <Button
                         onClick={() => handleDecline(selectedJD.id)}
                         disabled={actionLoading === selectedJD.id}
                         variant="destructive"
                         className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm"
                         size="sm"
                       >
                         {actionLoading === selectedJD.id ? (
                           <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
                         ) : (
                           <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                         )}
                         Decline
                       </Button>
                     </>
                   )}
                   {selectedJD.status === 'approved' && (
                     <Button
                       onClick={() => handlePublish(selectedJD.id)}
                       disabled={actionLoading === selectedJD.id}
                       className="bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm"
                       size="sm"
                     >
                       {actionLoading === selectedJD.id ? (
                         <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
                       ) : (
                         <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                       )}
                       Publish
                     </Button>
                   )}
                   {selectedJD.status === 'declined' && (
                     <Button
                       onClick={() => handleMoveToDraft(selectedJD.id)}
                       disabled={actionLoading === selectedJD.id}
                       className="bg-gray-600 hover:bg-gray-700 text-xs sm:text-sm"
                       size="sm"
                     >
                       {actionLoading === selectedJD.id ? (
                         <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
                       ) : (
                         <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                       )}
                       Move to Draft
                     </Button>
                   )}
                  <Button
                    onClick={() => handleDownloadPDF(selectedJD)}
                    variant="outline"
                    className="ml-auto text-xs sm:text-sm"
                    size="sm"
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Download PDF
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent>
                <Tabs defaultValue="standard" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 text-xs sm:text-sm">
                    <TabsTrigger value="standard" className="text-xs sm:text-sm">Standard View</TabsTrigger>
                    <TabsTrigger value="structured" className="text-xs sm:text-sm">Structured Template</TabsTrigger>
                    <TabsTrigger value="pdf-preview" className="text-xs sm:text-sm">PDF Preview</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="standard" className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Summary</h4>
                      <p className="text-sm text-muted-foreground">{selectedJD.summary || 'No summary available'}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Salary Range</h4>
                        <p className="text-sm">
                          {selectedJD.currency} {selectedJD.salary_range_min?.toLocaleString() || 'N/A'} - {selectedJD.salary_range_max?.toLocaleString() || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Experience Level</h4>
                        <p className="text-sm capitalize">{selectedJD.experience_level || 'N/A'}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Key Responsibilities</h4>
                      <ul className="space-y-2">
                        {Array.isArray(selectedJD.responsibilities) && selectedJD.responsibilities.length > 0 ? (
                          selectedJD.responsibilities.map((resp: string, index: number) => (
                            <li key={index} className="text-sm flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{resp}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-muted-foreground">No responsibilities listed</li>
                        )}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Required Qualifications</h4>
                      <ul className="space-y-2">
                        {Array.isArray(selectedJD.required_qualifications) && selectedJD.required_qualifications.length > 0 ? (
                          selectedJD.required_qualifications.map((qual: string, index: number) => (
                            <li key={index} className="text-sm flex items-start gap-2">
                              <span className="text-red-500">•</span>
                              <span>{qual}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-muted-foreground">No required qualifications listed</li>
                        )}
                      </ul>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="structured" className="space-y-4">
                    <div className="space-y-4">
                      {/* Job Identity */}
                      <div>
                        <h4 className="font-medium mb-2 text-blue-600">1. JOB IDENTITY</h4>
                        <div className="bg-muted/50 p-3 rounded-lg text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <span className="font-medium">Position Title:</span>
                            <span>{selectedJD.job_identity?.positionTitle || selectedJD.title}</span>
                            <span className="font-medium">Directorate:</span>
                            <span>{selectedJD.job_identity?.directorate || 'Not specified'}</span>
                            {selectedJD.job_identity?.division && (
                              <>
                                <span className="font-medium">Division:</span>
                                <span>{selectedJD.job_identity.division}</span>
                              </>
                            )}
                            {selectedJD.job_identity?.department && (
                              <>
                                <span className="font-medium">Department:</span>
                                <span>{selectedJD.job_identity.department}</span>
                              </>
                            )}
                            <span className="font-medium">Direct Supervisor:</span>
                            <span>{selectedJD.job_identity?.directSupervisor || 'Not specified'}</span>
                          </div>
                          {selectedJD.job_identity?.directSubordinate && selectedJD.job_identity.directSubordinate.length > 0 && (
                            <div className="mt-2">
                              <span className="font-medium">Direct Subordinate:</span>
                              <ol className="list-decimal list-inside mt-1">
                                {selectedJD.job_identity.directSubordinate.map((sub: string, index: number) => (
                                  <li key={index} className="text-sm">{sub}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Job Purposes */}
                      <div>
                        <h4 className="font-medium mb-2 text-blue-600">2. JOB PURPOSES</h4>
                        <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedJD.summary || 'Not specified'}</p>
                      </div>

                      {/* Main Responsibility */}
                      <div>
                        <h4 className="font-medium mb-2 text-blue-600">3. MAIN RESPONSIBILITY</h4>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          {Array.isArray(selectedJD.responsibilities) && selectedJD.responsibilities.length > 0 ? (
                            <ol className="list-decimal list-inside space-y-2">
                              {selectedJD.responsibilities.map((resp: string, index: number) => (
                                <li key={index} className="text-sm">{resp}</li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-sm text-muted-foreground">Not specified</p>
                          )}
                        </div>
                      </div>

                      {/* Key Contacts */}
                      <div>
                        <h4 className="font-medium mb-2 text-blue-600">5. KEY CONTACTS & RELATIONSHIP</h4>
                        <div className="bg-muted/50 p-3 rounded-lg space-y-3">
                          <div>
                            <span className="font-medium text-sm">Internal:</span>
                            {selectedJD.key_contacts?.internal && selectedJD.key_contacts.internal.length > 0 ? (
                              <ol className="list-decimal list-inside mt-1">
                                {selectedJD.key_contacts.internal.map((contact: string, index: number) => (
                                  <li key={index} className="text-sm">{contact}</li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-sm text-muted-foreground ml-4">Not specified</p>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-sm">External:</span>
                            {selectedJD.key_contacts?.external && selectedJD.key_contacts.external.length > 0 ? (
                              <ol className="list-decimal list-inside mt-1">
                                {selectedJD.key_contacts.external.map((contact: string, index: number) => (
                                  <li key={index} className="text-sm">{contact}</li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-sm text-muted-foreground ml-4">Not specified</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Competencies */}
                      <div>
                        <h4 className="font-medium mb-2 text-blue-600">6. COMPETENCY SECTION</h4>
                        <div className="bg-muted/50 p-3 rounded-lg space-y-4">
                          <div>
                            <h5 className="font-medium text-sm text-green-600">A. FUNCTIONAL COMPETENCY</h5>
                            {selectedJD.competencies?.functional ? (
                              <div className="mt-2 space-y-1 text-sm">
                                <div><span className="font-medium">Academy Qualifications:</span> {selectedJD.competencies.functional.academyQualifications}</div>
                                <div><span className="font-medium">Professional Experience:</span> {selectedJD.competencies.functional.professionalExperience}</div>
                                <div><span className="font-medium">Certification/License:</span> {selectedJD.competencies.functional.certificationLicense}</div>
                                <div><span className="font-medium">Expertise:</span> {selectedJD.competencies.functional.expertise?.join(', ')}</div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Not specified</p>
                            )}
                          </div>
                          <div>
                            <h5 className="font-medium text-sm text-purple-600">B. LEADERSHIP COMPETENCY</h5>
                            {selectedJD.competencies?.leadership ? (
                              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                <div><span className="font-medium">Strategic accountability:</span> {selectedJD.competencies.leadership.strategicAccountability}</div>
                                <div><span className="font-medium">Customer centric:</span> {selectedJD.competencies.leadership.customerCentric}</div>
                                <div><span className="font-medium">Coalition Building:</span> {selectedJD.competencies.leadership.coalitionBuilding}</div>
                                <div><span className="font-medium">People First:</span> {selectedJD.competencies.leadership.peopleFirst}</div>
                                <div><span className="font-medium">Agile Leadership:</span> {selectedJD.competencies.leadership.agileLeadership}</div>
                                <div><span className="font-medium">Result Driven:</span> {selectedJD.competencies.leadership.resultDriven}</div>
                                <div><span className="font-medium">Technology Savvy:</span> {selectedJD.competencies.leadership.technologySavvy}</div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Not specified</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="pdf-preview" className="space-y-4">
                    <PDFPreview jd={selectedJD} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-[400px] sm:h-[500px]">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select a Job Description</h3>
                  <p className="text-muted-foreground">
                    Choose a job description from the list to review and manage
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobDescriptionDialog;