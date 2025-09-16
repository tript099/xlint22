import { useEffect, useState } from "react";
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

export const useJobDescriptionStats = (): JobDescriptionStats => {
  const [stats, setStats] = useState<JobDescriptionStats>({
    totalJDs: 0,
    activeJDs: 0,
    draftJDs: 0,
    approvedJDs: 0,
    reviewJDs: 0,
    publishedJDs: 0,
    declinedJDs: 0,
    pendingJDs: 0,
    loading: true,
    refetch: () => {} // Placeholder, will be set below
  });

  const fetchStats = async () => {
    console.log('🔄 useJobDescriptionStats fetchStats called');
    let isMounted = true;
    
    try {
      console.log('Fetching JD stats...');
      
      // Get total count
      const { count: totalCount, error: totalError } = await supabase
        .from('xlsmart_job_descriptions')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        console.error('Error fetching total count:', totalError);
        return;
      }

      // Get counts by status
      const [
        { count: draftCount, error: draftError },
        { count: approvedCount, error: approvedError },
        { count: reviewCount, error: reviewError },
        { count: publishedCount, error: publishedError },
        { count: declinedCount, error: declinedError }
      ] = await Promise.all([
        supabase
          .from('xlsmart_job_descriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'draft'),
        supabase
          .from('xlsmart_job_descriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved'),
        supabase
          .from('xlsmart_job_descriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'review'),
        supabase
          .from('xlsmart_job_descriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'published'),
        supabase
          .from('xlsmart_job_descriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'declined')
      ]);

      if (draftError) console.error('Error fetching draft count:', draftError);
      if (approvedError) console.error('Error fetching approved count:', approvedError);
      if (reviewError) console.error('Error fetching review count:', reviewError);
      if (publishedError) console.error('Error fetching published count:', publishedError);
      if (declinedError) console.error('Error fetching declined count:', declinedError);

      // Published JDs should also count as approved (approved + published)
      const totalApprovedCount = (approvedCount || 0) + (publishedCount || 0);
      const activeCount = (publishedCount || 0);
      const pendingCount = (draftCount || 0) + (reviewCount || 0);

      console.log('JD Stats:', {
        total: totalCount,
        draft: draftCount,
        review: reviewCount,
        approved: approvedCount,
        published: publishedCount,
        declined: declinedCount,
        totalApproved: totalApprovedCount,
        pending: pendingCount
      });

      // Only update state if component is still mounted
      if (isMounted) {
        setStats(prev => ({
          ...prev,
          totalJDs: totalCount || 0,
          activeJDs: activeCount,
          draftJDs: draftCount || 0,
          approvedJDs: totalApprovedCount, // Include both approved and published
          reviewJDs: reviewCount || 0,
          publishedJDs: publishedCount || 0,
          declinedJDs: declinedCount || 0,
          pendingJDs: pendingCount,
          loading: false
        }));
      }
    } catch (error) {
      console.error('Error fetching job description stats:', error);
      if (isMounted) {
        setStats(prev => ({ ...prev, loading: false }));
      }
    }
  };

  // Create refetch function
  const refetch = () => {
    setStats(prev => ({ ...prev, loading: true }));
    fetchStats();
  };

  // Set the refetch function in state
  const [refetchFn] = useState(() => refetch);

  useEffect(() => {
    console.log('🔄 useJobDescriptionStats effect triggered');
    fetchStats();
  }, []); // Empty dependency array to run only once

  return {
    ...stats,
    refetch: refetchFn
  };
};