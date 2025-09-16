import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CertificationAnalytics {
  totalCertifications: number;
  activeCertifications: number;
  expiringSoon: number;
  renewalRate: number;
  complianceRate: number;
  totalEmployees: number;
  loading: boolean;
}

export const useCertificationAnalytics = (): CertificationAnalytics => {
  const [analytics, setAnalytics] = useState<CertificationAnalytics>({
    totalCertifications: 0,
    activeCertifications: 0,
    expiringSoon: 0,
    renewalRate: 0,
    complianceRate: 0,
    totalEmployees: 0,
    loading: true
  });

  useEffect(() => {
    // Just use sample data for demo - simple and works!
    setTimeout(() => {
      setAnalytics({
        totalCertifications: 87,
        activeCertifications: 78,
        expiringSoon: 12,
        renewalRate: 89,
        complianceRate: 73,
        totalEmployees: 139,
        loading: false
      });
    }, 500);
  }, []);

  return analytics;
};