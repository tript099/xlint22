import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TdOverviewData, TdOverviewHook } from "@/types/td-overview";

export const useTdOverview = (): TdOverviewHook => {
  const [data, setData] = useState<TdOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('td-overview');

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch training overview');
      }

      if (!response) {
        throw new Error('No data received from td-overview function');
      }

      setData(response);
    } catch (err) {
      console.error('Error fetching TD overview:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchOverview();
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  return {
    data,
    loading,
    error,
    refresh
  };
};


