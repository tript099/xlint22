import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RecentJobDescription {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

// OPTIMIZATION: Fetch function for React Query
const fetchRecentJobDescriptions = async (): Promise<RecentJobDescription[]> => {
  console.log('🔄 Fetching recent JDs with React Query...');
  
  const { data, error } = await supabase
    .from('xlsmart_job_descriptions')
    .select('id, title, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching recent job descriptions:', error);
    throw error;
  }

  console.log('✅ Recent JDs fetched successfully:', data?.length || 0);
  return data || [];
};

export const useRecentJobDescriptions = () => {
  // OPTIMIZATION: React Query with 2-minute cache
  const {
    data: recentJDs = [],
    isLoading: loading,
    refetch
  } = useQuery({
    queryKey: ['recentJobDescriptions'],
    queryFn: fetchRecentJobDescriptions,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1
  });

  return { 
    recentJDs, 
    loading, 
    refetch: () => refetch() 
  };
};