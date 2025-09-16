import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  current_position: string;
  current_department: string;
  email: string;
  is_active: boolean;
  years_of_experience?: number;
  performance_rating?: number;
  skills?: string[];
}

export const useEmployees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('xlsmart_employees')
        .select('*')
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message || 'Failed to fetch employees');
      }

      setEmployees(data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return {
    employees,
    loading,
    error,
    refresh: fetchEmployees
  };
};


