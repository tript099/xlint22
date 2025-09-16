import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AIAnalysisResult {
  id: string;
  analysis_type: string;
  function_name: string;
  input_parameters: any;
  analysis_result: any;
  created_at: string;
  updated_at: string;
  status: string;
}

interface AIAnalyticsStats {
  totalAnalyses: number;
  recentAnalyses: AIAnalysisResult[];
  analysesByType: Record<string, number>;
  loading: boolean;
}

export const useAIAnalytics = (): AIAnalyticsStats => {
  const [stats, setStats] = useState<AIAnalyticsStats>({
    totalAnalyses: 0,
    recentAnalyses: [],
    analysesByType: {},
    loading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get total count
        const { count: totalCount } = await supabase
          .from('ai_analysis_results')
          .select('*', { count: 'exact', head: true });

        // Get recent analyses (last 10)
        const { data: recentData } = await supabase
          .from('ai_analysis_results')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        // Get all analyses to calculate by type
        const { data: allAnalyses } = await supabase
          .from('ai_analysis_results')
          .select('analysis_type');

        // Calculate analyses by type
        const analysesByType: Record<string, number> = {};
        if (allAnalyses) {
          allAnalyses.forEach(analysis => {
            const type = analysis.analysis_type;
            analysesByType[type] = (analysesByType[type] || 0) + 1;
          });
        }

        setStats({
          totalAnalyses: totalCount || 0,
          recentAnalyses: recentData || [],
          analysesByType,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching AI analytics stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  return stats;
};