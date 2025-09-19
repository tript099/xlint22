import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface JobDescriptionStats {
  totalJDs: number;
  activeJDs: number;
  draftJDs: number;
  approvedJDs: number;
  reviewJDs: number;
  publishedJDs: number;
  declinedJDs: number;
  pendingJDs: number;
}

// OPTIMIZED: Fetch JD stats using a single optimized query
const fetchJobDescriptionStats = async (): Promise<JobDescriptionStats> => {
  try {
    // Single query with aggregation to get all counts efficiently
    const { data: allJDs, error } = await supabase
      .from('xlsmart_job_descriptions')
      .select('status');

    if (error) throw error;

    // Calculate counts in memory (more efficient than multiple DB queries)
    const statusCounts = (allJDs || []).reduce((acc, jd) => {
      acc[jd.status] = (acc[jd.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const draftCount = statusCounts.draft || 0;
    const approvedCount = statusCounts.approved || 0;
    const reviewCount = statusCounts.review || 0;
    const publishedCount = statusCounts.published || 0;
    const declinedCount = statusCounts.declined || 0;
    const totalCount = allJDs?.length || 0;

    // Published JDs should also count as approved (approved + published)
    const totalApprovedCount = approvedCount + publishedCount;
    const activeCount = publishedCount;
    const pendingCount = draftCount + reviewCount;

    return {
      totalJDs: totalCount,
      activeJDs: activeCount,
      draftJDs: draftCount,
      approvedJDs: totalApprovedCount,
      reviewJDs: reviewCount,
      publishedJDs: publishedCount,
      declinedJDs: declinedCount,
      pendingJDs: pendingCount,
    };
  } catch (error) {
    console.error('Error fetching job description stats:', error);
    throw error;
  }
};

export const useJobDescriptionStatsOptimized = () => {
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ['job-description-stats'],
    queryFn: fetchJobDescriptionStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    // OPTIMIZED: Enable background updates for better UX
    refetchInterval: 2 * 60 * 1000, // 2 minutes background refresh
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['job-description-stats'] });
  };

  return {
    ...statsQuery.data || {
      totalJDs: 0,
      activeJDs: 0,
      draftJDs: 0,
      approvedJDs: 0,
      reviewJDs: 0,
      publishedJDs: 0,
      declinedJDs: 0,
      pendingJDs: 0,
    },
    loading: statsQuery.isLoading,
    error: statsQuery.error,
    refetch,
  };
};