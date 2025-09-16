import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Certification {
  id: string;
  employee_id: string;
  certification_name: string;
  issuing_authority: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  certificate_url: string | null;
  created_at: string;
  xlsmart_employees?: {
    first_name: string;
    last_name: string;
    current_department: string | null;
  };
}

export interface AvailableCertification {
  id: string;
  certification_name: string;
  issuing_authority: string | null;
  description: string | null;
  duration: string | null;
  cost: number | null;
  external_url: string | null;
  requirements: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PopularCertification {
  certification_name: string;
  enrollment_count: number;
  issuing_authority: string | null;
}

export interface CertificationStats {
  totalCertifications: number;
  activeCertifications: number;
  expiringSoon: number;
  renewalRate: number;
  complianceRate: number;
  totalEmployees: number;
  loading: boolean;
}

export const useCertifications = () => {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCertifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employee_certifications')
        .select(`
          *,
          xlsmart_employees (
            first_name,
            last_name,
            current_department
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCertifications(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertifications();
  }, []);

  return {
    certifications,
    loading,
    error,
    refetch: fetchCertifications
  };
};

export const useCertificationStats = (refreshTrigger?: number): CertificationStats => {
  const [stats, setStats] = useState<CertificationStats>({
    totalCertifications: 0,
    activeCertifications: 0,
    expiringSoon: 0,
    renewalRate: 0,
    complianceRate: 0,
    totalEmployees: 0,
    loading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        console.log('Fetching certification stats...');
        
        // Get employee certifications (assigned to employees)
        const { count: employeeCerts } = await supabase
          .from('employee_certifications')
          .select('*', { count: 'exact', head: true });

        console.log('Employee certifications:', employeeCerts);

        // Get available certifications (not yet assigned)
        const { count: availableCerts, error: availableError } = await supabase
          .from('available_certifications' as any)
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (availableError) {
          console.error('Error fetching available certifications:', availableError);
        }

        console.log('Available certifications:', availableCerts);

        // Total certifications = employee certs + available certs
        const totalCerts = (employeeCerts || 0) + (availableCerts || 0);

        // Get active employee certifications (not expired)
        const { count: activeCerts } = await supabase
          .from('employee_certifications')
          .select('*', { count: 'exact', head: true })
          .or('expiry_date.is.null,expiry_date.gte.' + new Date().toISOString().split('T')[0]);

        // Add available certifications to active count
        const totalActiveCerts = (activeCerts || 0) + (availableCerts || 0);

        // Get certifications expiring in next 90 days
        const expiry90Days = new Date();
        expiry90Days.setDate(expiry90Days.getDate() + 90);
        const { count: expiringSoon } = await supabase
          .from('employee_certifications')
          .select('*', { count: 'exact', head: true })
          .gte('expiry_date', new Date().toISOString().split('T')[0])
          .lte('expiry_date', expiry90Days.toISOString().split('T')[0]);

        // Get total employees with certifications
        const { data: employeeCertsData } = await supabase
          .from('employee_certifications')
          .select('employee_id');

        const uniqueEmployeeIds = [...new Set(employeeCertsData?.map(cert => cert.employee_id) || [])];
        const totalEmployees = uniqueEmployeeIds.length;

        // Calculate renewal rate (simplified - certifications renewed in last year vs expired)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const { count: recentCerts } = await supabase
          .from('employee_certifications')
          .select('*', { count: 'exact', head: true })
          .gte('issue_date', oneYearAgo.toISOString().split('T')[0]);

        const renewalRate = totalCerts && totalCerts > 0 ? Math.round((recentCerts || 0) / totalCerts * 100) : 0;

        // Calculate compliance rate (active vs total)
        const complianceRate = totalCerts && totalCerts > 0 ? Math.round(totalActiveCerts / totalCerts * 100) : 0;

        const newStats = {
          totalCertifications: totalCerts,
          activeCertifications: totalActiveCerts,
          expiringSoon: expiringSoon || 0,
          renewalRate,
          complianceRate,
          totalEmployees,
          loading: false
        };

        console.log('Computed stats:', newStats);
        setStats(newStats);
      } catch (error) {
        console.error('Error fetching certification stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, [refreshTrigger]);

  return stats;
};

export const useAvailableCertifications = () => {
  const [availableCertifications, setAvailableCertifications] = useState<AvailableCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailableCertifications = async () => {
    try {
      setLoading(true);
      
      // Using a direct query since the types might not be updated yet
      const { data, error } = await supabase
        .from('available_certifications' as any)
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableCertifications(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableCertifications();
  }, []);

  return {
    availableCertifications,
    loading,
    error,
    refetch: fetchAvailableCertifications
  };
};

export const usePopularCertifications = () => {
  const [popularCertifications, setPopularCertifications] = useState<PopularCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPopularCertifications = async () => {
    try {
      setLoading(true);
      
      // Get all employee certifications and count by certification name
      const { data: employeeCerts, error } = await supabase
        .from('employee_certifications')
        .select('certification_name, issuing_authority');

      if (error) throw error;

      if (!employeeCerts || employeeCerts.length === 0) {
        setPopularCertifications([]);
        setLoading(false);
        return;
      }

      // Count certifications by name and authority
      const certificationCounts = employeeCerts.reduce((acc, cert) => {
        const key = `${cert.certification_name}|${cert.issuing_authority || 'Unknown'}`;
        if (!acc[key]) {
          acc[key] = {
            certification_name: cert.certification_name,
            issuing_authority: cert.issuing_authority,
            enrollment_count: 0
          };
        }
        acc[key].enrollment_count++;
        return acc;
      }, {} as Record<string, PopularCertification>);

      // Convert to array and sort by enrollment count
      const sortedCertifications = Object.values(certificationCounts)
        .sort((a, b) => b.enrollment_count - a.enrollment_count)
        .slice(0, 10) as PopularCertification[]; // Top 10 most popular

      setPopularCertifications(sortedCertifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPopularCertifications();
  }, []);

  return {
    popularCertifications,
    loading,
    error,
    refetch: fetchPopularCertifications
  };
};
