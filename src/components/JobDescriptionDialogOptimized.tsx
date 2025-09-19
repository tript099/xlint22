import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckCircle, 
  XCircle, 
  FileText, 
  Calendar,
  Loader2,
  Eye,
  Edit3,
  Download,
  Search,
  Filter
} from 'lucide-react';

// OPTIMIZED: Virtual scrolling configuration
const ITEM_HEIGHT = 120; // Height of each JD card
const CONTAINER_HEIGHT = 600; // Fixed height for virtual scrolling container
const OVERSCAN = 3; // Number of items to render outside visible area

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

interface JobDescriptionDialogOptimizedProps {
  statusFilters: string[];
  onActionPerformed?: () => void;
}

// OPTIMIZED: Fetch JDs with intelligent caching and filtering
const fetchJobDescriptions = async (statusFilters: string[]): Promise<JobDescription[]> => {
  try {
    let query = supabase
      .from('xlsmart_job_descriptions')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply status filters
    if (statusFilters.length > 0 && !statusFilters.includes('all')) {
      query = query.in('status', statusFilters);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching job descriptions:', error);
    throw error;
  }
};

// OPTIMIZED: Memoized JD card component
const JobDescriptionCard = React.memo(({ jd, onStatusUpdate, onView }: {
  jd: JobDescription;
  onStatusUpdate: (id: string, status: string) => void;
  onView: (jd: JobDescription) => void;
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'text-blue-600 bg-blue-50';
      case 'approved': return 'text-green-600 bg-green-50';
      case 'review': return 'text-yellow-600 bg-yellow-50';
      case 'draft': return 'text-gray-600 bg-gray-50';
      case 'declined': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">{jd.title}</h3>
              <Badge className={getStatusColor(jd.status)}>
                {jd.status}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
              {jd.summary || 'No summary available'}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(jd.created_at).toLocaleDateString()}
              </span>
              {jd.experience_level && (
                <span>{jd.experience_level}</span>
              )}
              {jd.employment_type && (
                <span>{jd.employment_type}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(jd)}
            >
              <Eye className="h-3 w-3" />
            </Button>
            
            {jd.status === 'draft' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusUpdate(jd.id, 'review')}
              >
                Submit for Review
              </Button>
            )}
            
            {jd.status === 'review' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusUpdate(jd.id, 'approved')}
                >
                  <CheckCircle className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusUpdate(jd.id, 'declined')}
                >
                  <XCircle className="h-3 w-3" />
                </Button>
              </>
            )}
            
            {jd.status === 'approved' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusUpdate(jd.id, 'published')}
              >
                Publish
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

const JobDescriptionDialogOptimized: React.FC<JobDescriptionDialogOptimizedProps> = ({
  statusFilters,
  onActionPerformed
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJD, setSelectedJD] = useState<JobDescription | null>(null);
  
  // OPTIMIZED: Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const pageSize = 20;

  // OPTIMIZED: Use React Query for data fetching
  const { data: jobDescriptions = [], isLoading, error } = useQuery({
    queryKey: ['job-descriptions', statusFilters],
    queryFn: () => fetchJobDescriptions(statusFilters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // OPTIMIZED: Filter and search in memory
  const filteredJDs = useMemo(() => {
    return jobDescriptions.filter(jd => {
      const matchesSearch = !searchTerm || 
        jd.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        jd.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        jd.experience_level?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    }).sort((a, b) => {
      if (sortBy === 'created_at') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  }, [jobDescriptions, searchTerm, sortBy]);

  // OPTIMIZED: Virtual scrolling calculations
  const virtualItems = useMemo(() => {
    if (filteredJDs.length <= 20) {
      // Use pagination for smaller datasets
      const totalPages = Math.ceil(filteredJDs.length / pageSize);
      const startIndex = (currentPage - 1) * pageSize;
      const paginatedJDs = filteredJDs.slice(startIndex, startIndex + pageSize);
      return { totalPages, paginatedJDs, useVirtualScrolling: false };
    }

    // Use virtual scrolling for large datasets
    const totalItems = filteredJDs.length;
    const visibleItems = Math.ceil(CONTAINER_HEIGHT / ITEM_HEIGHT);
    
    const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
    const endIndex = Math.min(startIndex + visibleItems + OVERSCAN, totalItems);
    const visibleStartIndex = Math.max(0, startIndex - OVERSCAN);
    
    const visibleJDs = filteredJDs.slice(visibleStartIndex, endIndex);
    const offsetY = visibleStartIndex * ITEM_HEIGHT;
    const totalHeight = totalItems * ITEM_HEIGHT;

    return {
      totalPages: 1,
      paginatedJDs: visibleJDs,
      useVirtualScrolling: true,
      offsetY,
      totalHeight,
      visibleStartIndex
    };
  }, [filteredJDs, currentPage, scrollTop]);

  // OPTIMIZED: Handle virtual scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // OPTIMIZED: Status update mutation
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('xlsmart_job_descriptions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-descriptions'] });
      queryClient.invalidateQueries({ queryKey: ['job-description-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-job-descriptions'] });
      onActionPerformed?.();
      toast({ title: "Success", description: "Status updated successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: "Failed to update status", 
        variant: "destructive" 
      });
    },
  });

  const handleStatusUpdate = useCallback((id: string, status: string) => {
    statusUpdateMutation.mutate({ id, status });
  }, [statusUpdateMutation]);

  const handleView = useCallback((jd: JobDescription) => {
    setSelectedJD(jd);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Error loading job descriptions</p>
        <Button 
          variant="outline" 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['job-descriptions'] })}
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with search and filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Job Descriptions</h2>
          <Badge variant="secondary">
            {filteredJDs.length} {filteredJDs.length === 1 ? 'JD' : 'JDs'}
          </Badge>
        </div>
        
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search job descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Sort by Date</SelectItem>
              <SelectItem value="title">Sort by Title</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Job Descriptions List */}
      {filteredJDs.length === 0 ? (
        <div className="text-center p-8">
          <p className="text-muted-foreground">No job descriptions found</p>
        </div>
      ) : virtualItems.useVirtualScrolling ? (
        // OPTIMIZED: Virtual scrolling for large datasets
        <div 
          ref={scrollElementRef}
          className="relative border rounded-lg"
          style={{ height: CONTAINER_HEIGHT, overflow: 'auto' }}
          onScroll={handleScroll}
        >
          <div style={{ height: virtualItems.totalHeight, position: 'relative' }}>
            <div 
              style={{
                transform: `translateY(${virtualItems.offsetY}px)`,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
              }}
            >
              <div className="space-y-4 p-4">
                {virtualItems.paginatedJDs.map((jd, index) => (
                  <JobDescriptionCard
                    key={`${jd.id}-${virtualItems.visibleStartIndex + index}`}
                    jd={jd}
                    onStatusUpdate={handleStatusUpdate}
                    onView={handleView}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Regular list for smaller datasets
        <div className="space-y-4">
          {virtualItems.paginatedJDs.map((jd) => (
            <JobDescriptionCard
              key={jd.id}
              jd={jd}
              onStatusUpdate={handleStatusUpdate}
              onView={handleView}
            />
          ))}
        </div>
      )}

      {/* Pagination for non-virtual mode */}
      {!virtualItems.useVirtualScrolling && virtualItems.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} of {virtualItems.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(virtualItems.totalPages, p + 1))}
            disabled={currentPage === virtualItems.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Virtual scrolling info */}
      {virtualItems.useVirtualScrolling && (
        <div className="flex justify-center items-center text-sm text-muted-foreground">
          <span>
            Showing {virtualItems.paginatedJDs.length} of {filteredJDs.length} job descriptions
            {searchTerm && ` (filtered from ${jobDescriptions.length} total)`}
          </span>
        </div>
      )}

      {/* JD Detail View */}
      {selectedJD && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">{selectedJD.title}</h3>
              <Button variant="outline" size="sm" onClick={() => setSelectedJD(null)}>
                Close
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground">{selectedJD.summary}</p>
              </div>
              
              {selectedJD.responsibilities && (
                <div>
                  <h4 className="font-semibold mb-2">Responsibilities</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {Array.isArray(selectedJD.responsibilities) 
                      ? selectedJD.responsibilities.map((resp: string, i: number) => (
                          <li key={i}>{resp}</li>
                        ))
                      : <li>{selectedJD.responsibilities}</li>
                    }
                  </ul>
                </div>
              )}
              
              {selectedJD.required_qualifications && (
                <div>
                  <h4 className="font-semibold mb-2">Required Qualifications</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {Array.isArray(selectedJD.required_qualifications) 
                      ? selectedJD.required_qualifications.map((qual: string, i: number) => (
                          <li key={i}>{qual}</li>
                        ))
                      : <li>{selectedJD.required_qualifications}</li>
                    }
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDescriptionDialogOptimized;