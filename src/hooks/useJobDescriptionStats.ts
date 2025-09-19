import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface JobDescriptionStats {
  totalJDs: number;
  activeJDs: number;
  draftJDs: number;
  approvedJDs: number;
  reviewJDs: number;
  publishedJDs: number;
  declinedJDs: number;
  pendingJDs: number; // draft + review combined
  loading: boolean;
  refetch: () => void;
}

// OPTIMIZATION: Fetch function for React Query
const fetchJobDescriptionStats = async () => {
  console.log('🔄 Fetching JD stats with React Query...');
  
  // OPTIMIZATION: Parallel execution using Promise.all
  const [
    totalResult,
    draftResult,
    approvedResult,
    reviewResult,
    publishedResult,
    declinedResult
  ] = await Promise.all([
    supabase.from('xlsmart_job_descriptions').select('*', { count: 'exact', head: true }),
    supabase.from('xlsmart_job_descriptions').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('xlsmart_job_descriptions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('xlsmart_job_descriptions').select('*', { count: 'exact', head: true }).eq('status', 'review'),
    supabase.from('xlsmart_job_descriptions').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('xlsmart_job_descriptions').select('*', { count: 'exact', head: true }).eq('status', 'declined')
  ]);

  // Check for errors
  const errors = [
    totalResult.error,
    draftResult.error,
    approvedResult.error,
    reviewResult.error,
    publishedResult.error,
    declinedResult.error
  ].filter(Boolean);
  
  if (errors.length > 0) {
    throw new Error(`Failed to fetch stats: ${errors.map(e => e?.message).join(', ')}`);
  }

  const totalApprovedCount = (approvedResult.count || 0) + (publishedResult.count || 0);
  const activeCount = publishedResult.count || 0;
  const pendingCount = (draftResult.count || 0) + (reviewResult.count || 0);

  const stats = {
    totalJDs: totalResult.count || 0,
    activeJDs: activeCount,
    draftJDs: draftResult.count || 0,
    approvedJDs: totalApprovedCount,
    reviewJDs: reviewResult.count || 0,
    publishedJDs: publishedResult.count || 0,
    declinedJDs: declinedResult.count || 0,
    pendingJDs: pendingCount
  };

  console.log('✅ JD stats fetched successfully:', stats);
  return stats;
};

export const useJobDescriptionStats = (): JobDescriptionStats => {
  // OPTIMIZATION: React Query with 5-minute cache
  const {
    data: stats,
    isLoading: loading,
    refetch
  } = useQuery({
    queryKey: ['jobDescriptionStats'],
    queryFn: fetchJobDescriptionStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2
  });

  return {
    totalJDs: stats?.totalJDs || 0,
    activeJDs: stats?.activeJDs || 0,
    draftJDs: stats?.draftJDs || 0,
    approvedJDs: stats?.approvedJDs || 0,
    reviewJDs: stats?.reviewJDs || 0,
    publishedJDs: stats?.publishedJDs || 0,
    declinedJDs: stats?.declinedJDs || 0,
    pendingJDs: stats?.pendingJDs || 0,
    loading,
    refetch: () => refetch()
  };
};