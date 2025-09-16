import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Zap, TrendingUp, AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleMappingPagination } from "@/components/RoleMappingPagination";
import { useToast } from "@/hooks/use-toast";

interface RoleMapping {
  id: string;
  employee_name?: string;
  original_role_title: string;
  standardized_role_title?: string;
  mapped_role?: string;
  mapping_confidence: number;
  mapping_status?: string;
  created_at?: string;
  updated_at?: string;
}

interface AccuracyStats {
  averageAccuracy: number;
  totalMappings: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  pendingReview: number;
}

export const MappingAccuracyDetails = () => {
  const [mappings, setMappings] = useState<RoleMapping[]>([]);
  const [stats, setStats] = useState<AccuracyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [fixingMappings, setFixingMappings] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMappingData();
  }, []);

  const fetchMappingData = async () => {
    try {
      const { data, error } = await supabase
        .from('xlsmart_role_mappings')
        .select('*')
        .order('mapping_confidence', { ascending: false });

      if (error) throw error;

      const mappingData = data || [];
      console.log('🔍 DEBUG: Raw mapping data:', mappingData);
      console.log('🔍 DEBUG: Confidence values:', mappingData.map(m => m.mapping_confidence));
      
      setMappings(mappingData);

      // Calculate stats
      const totalMappings = mappingData.length;
      const averageAccuracy = totalMappings > 0 
        ? Math.round(mappingData.reduce((sum, m) => sum + (m.mapping_confidence || 0), 0) / totalMappings)
        : 0;

      console.log('🔍 DEBUG: Total mappings:', totalMappings);
      console.log('🔍 DEBUG: Average accuracy:', averageAccuracy);

      // Handle confidence values as percentages (already stored as percentages by AI function)
      const highConfidence = mappingData.filter(m => (m.mapping_confidence || 0) >= 80).length;
      const mediumConfidence = mappingData.filter(m => (m.mapping_confidence || 0) >= 60 && (m.mapping_confidence || 0) < 80).length;
      const lowConfidence = mappingData.filter(m => (m.mapping_confidence || 0) < 60).length;
      const pendingReview = mappingData.filter(m => m.mapping_status === 'pending_review').length;

      console.log('🔍 DEBUG: High confidence count:', highConfidence);
      console.log('🔍 DEBUG: Medium confidence count:', mediumConfidence);
      console.log('🔍 DEBUG: Low confidence count:', lowConfidence);

      setStats({
        averageAccuracy,
        totalMappings,
        highConfidence,
        mediumConfidence,
        lowConfidence,
        pendingReview
      });
    } catch (error) {
      console.error('Error fetching mapping data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fixExistingMappings = async () => {
    setFixingMappings(true);
    try {
      // Calculate real confidence values for existing mappings
      const updates = [];
      
      for (const mapping of mappings) {
        if (!mapping.original_role_title || !mapping.standardized_role_title) continue;
        
        // Calculate similarity
        const normalized1 = mapping.original_role_title.toLowerCase().trim();
        const normalized2 = mapping.standardized_role_title.toLowerCase().trim();
        
        let confidence = 0;
        
        // Exact match
        if (normalized1 === normalized2) {
          confidence = 100;
        } else {
          // Word similarity
          const words1 = normalized1.split(/\s+/);
          const words2 = normalized2.split(/\s+/);
          
          let exactWordMatches = 0;
          for (const word1 of words1) {
            if (words2.includes(word1)) {
              exactWordMatches++;
            }
          }
          
          const wordSimilarity = exactWordMatches / Math.max(words1.length, words2.length);
          
          // Substring bonus
          const containsMatch = normalized1.includes(normalized2) || normalized2.includes(normalized1);
          const substringBonus = containsMatch ? 0.2 : 0;
          
          // Keyword bonus
          const commonKeywords = ['engineer', 'manager', 'analyst', 'specialist', 'coordinator', 'lead', 'senior', 'junior'];
          let keywordMatches = 0;
          for (const keyword of commonKeywords) {
            if (normalized1.includes(keyword) && normalized2.includes(keyword)) {
              keywordMatches++;
            }
          }
          const keywordBonus = (keywordMatches / commonKeywords.length) * 0.3;
          
          confidence = Math.min((wordSimilarity + substringBonus + keywordBonus) * 100, 95);
        }
        
        const confidencePercentage = Math.round(confidence);
        const currentConfidence = mapping.mapping_confidence || 0;
        
        // Only update if significantly different
        if (Math.abs(confidencePercentage - currentConfidence) > 5) {
          updates.push({
            id: mapping.id,
            mapping_confidence: confidencePercentage,
            requires_manual_review: confidencePercentage < 80
          });
        }
      }
      
      // Update mappings in database
      let fixedCount = 0;
      for (const update of updates) {
        const { error } = await supabase
          .from('xlsmart_role_mappings')
          .update({
            mapping_confidence: update.mapping_confidence,
            requires_manual_review: update.requires_manual_review
          })
          .eq('id', update.id);
        
        if (!error) {
          fixedCount++;
        }
      }
      
      if (fixedCount > 0) {
        toast({
          title: "Mappings Fixed!",
          description: `Successfully updated ${fixedCount} mappings with realistic confidence values.`,
        });
        // Refresh the data
        await fetchMappingData();
      } else {
        toast({
          title: "No Updates Needed",
          description: "All mappings already have realistic confidence values.",
        });
      }
    } catch (error) {
      console.error('Error fixing mappings:', error);
      toast({
        title: "Error",
        description: "Failed to fix existing mappings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setFixingMappings(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    // Confidence is already stored as percentage by AI function
    const confidencePercent = Math.round(confidence);
    
    if (confidencePercent >= 80) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">High ({confidencePercent}%)</Badge>;
    } else if (confidencePercent >= 60) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Medium ({confidencePercent}%)</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Low ({confidencePercent}%)</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending_review':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'rejected':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const totalPages = Math.ceil(mappings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedMappings = mappings.slice(startIndex, startIndex + pageSize);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <Zap className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Mapping Accuracy Analysis</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Zap className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Mapping Accuracy Analysis</h2>
        <div className="ml-auto flex items-center gap-2">
          {mappings.length > 0 && (
            <Button
              onClick={fixExistingMappings}
              disabled={fixingMappings}
              size="sm"
              variant="outline"
              className="bg-blue-50 hover:bg-blue-100 border-blue-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${fixingMappings ? 'animate-spin' : ''}`} />
              {fixingMappings ? 'Fixing...' : 'Fix Confidence Values'}
            </Button>
          )}
          <Badge variant="secondary">
            {stats?.averageAccuracy}% Average Accuracy
          </Badge>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{stats.averageAccuracy}%</div>
                  <p className="text-sm text-muted-foreground">Overall Accuracy</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{stats.highConfidence}</div>
                  <p className="text-sm text-muted-foreground">High Confidence (≥80%)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{stats.mediumConfidence}</div>
                  <p className="text-sm text-muted-foreground">Medium Confidence (60-79%)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{stats.lowConfidence}</div>
                  <p className="text-sm text-muted-foreground">Low Confidence (&lt;60%)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accuracy Distribution */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confidence Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">High Confidence (≥80%)</span>
                <span className="text-sm text-muted-foreground">
                  {stats.highConfidence} of {stats.totalMappings}
                </span>
              </div>
              <Progress value={(stats.highConfidence / stats.totalMappings) * 100} className="h-2" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Medium Confidence (60-79%)</span>
                <span className="text-sm text-muted-foreground">
                  {stats.mediumConfidence} of {stats.totalMappings}
                </span>
              </div>
              <Progress value={(stats.mediumConfidence / stats.totalMappings) * 100} className="h-2" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Low Confidence (&lt;60%)</span>
                <span className="text-sm text-muted-foreground">
                  {stats.lowConfidence} of {stats.totalMappings}
                </span>
              </div>
              <Progress value={(stats.lowConfidence / stats.totalMappings) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Role Mappings</CardTitle>
        </CardHeader>
                 <CardContent>
           {mappings.length === 0 ? (
             <div className="text-center py-8">
               <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
               <h3 className="text-lg font-medium mb-2">No Role Mappings Found</h3>
               <p className="text-muted-foreground mb-4">
                 Role mappings will appear here after you upload and standardize role catalogs.
               </p>
               <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                 <h4 className="font-medium text-blue-900 mb-2">How to get started:</h4>
                 <ol className="text-sm text-blue-800 space-y-1 text-left">
                   <li>1. Go to the <strong>Standardization</strong> tab</li>
                   <li>2. Upload XL and SMART role files</li>
                   <li>3. Run the AI standardization process</li>
                   <li>4. View your mapping accuracy here</li>
                 </ol>
               </div>
             </div>
           ) : (
             <div className="space-y-4">
               {paginatedMappings.map((mapping) => (
              <div key={mapping.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {mapping.employee_name && (
                      <span className="font-medium">{mapping.employee_name}</span>
                    )}
                    {getStatusIcon(mapping.mapping_status || 'pending')}
                  </div>
                                     <div className="text-sm text-muted-foreground">
                     <span className="font-medium">Original:</span> {mapping.original_role_title}
                     {(mapping.standardized_role_title || mapping.mapped_role) && (
                       <>
                         <span className="mx-2">→</span>
                         <span className="font-medium">Mapped:</span> {mapping.standardized_role_title || mapping.mapped_role}
                       </>
                     )}
                   </div>
                  {mapping.created_at && (
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(mapping.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {getConfidenceBadge(mapping.mapping_confidence)}
                </div>
              </div>
             ))}

             {/* Pagination */}
             <RoleMappingPagination
               currentPage={currentPage}
               totalPages={totalPages}
               pageSize={pageSize}
               totalItems={mappings.length}
               onPageChange={setCurrentPage}
               onPageSizeChange={(newSize) => {
                 setPageSize(newSize);
                 setCurrentPage(1);
               }}
             />
           </div>
         )}
         </CardContent>
      </Card>
    </div>
  );
};