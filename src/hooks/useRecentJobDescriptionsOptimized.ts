import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RecentJobDescription {
  id: string;
  title: string;
  status: string;
  created_at: string;
  department?: string;
  experience_level?: string;
}

// OPTIMIZED: Fetch recent JDs with smart ordering and caching
const fetchRecentJobDescriptions = async (): Promise<RecentJobDescription[]> => {
  try {
    const { data, error } = await supabase
      .from('xlsmart_job_descriptions')
      .select('id, title, status, created_at, department, experience_level')
      .order('created_at', { ascending: false })
      .limit(10); // Only fetch the 10 most recent

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching recent job descriptions:', error);
    throw error;
  }
};

export const useRecentJobDescriptionsOptimized = () => {
  const queryClient = useQueryClient();

  const recentQuery = useQuery({
    queryKey: ['recent-job-descriptions'],
    queryFn: fetchRecentJobDescriptions,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    // OPTIMIZED: Shorter background refresh for recent items
    refetchInterval: 60 * 1000, // 1 minute background refresh
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['recent-job-descriptions'] });
  };

  return {
    recentJDs: recentQuery.data || [],
    loading: recentQuery.isLoading,
    error: recentQuery.error,
    refetch,
  };
};