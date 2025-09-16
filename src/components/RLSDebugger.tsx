import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const RLSDebugger: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testRLS = async () => {
      try {
        console.log('🔍 RLS Debugger: Starting tests...');
        
        // Test auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        // Test profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('role, id')
          .eq('id', user?.id)
          .single();
        
        // Test employee_training_enrollments
        const enrollmentsTest = await supabase
          .from('employee_training_enrollments')
          .select('*', { count: 'exact' })
          .limit(3);
        
        // Test with different approach
        const countTest = await supabase
          .from('employee_training_enrollments')
          .select('id', { count: 'exact', head: true });

        // Check what fields are actually available in the first record
        const sampleRecord = enrollmentsTest.data?.[0];
        const availableFields = sampleRecord ? Object.keys(sampleRecord) : [];
        
        const results = {
          user: {
            id: user?.id,
            email: user?.email,
            authError: authError?.message
          },
          profile: {
            data: profileData,
            error: profileError?.message
          },
          enrollments: {
            data: enrollmentsTest.data,
            count: enrollmentsTest.count,
            error: enrollmentsTest.error?.message,
            errorDetails: enrollmentsTest.error,
            availableFields,
            fullSampleRecord: sampleRecord
          },
          countOnly: {
            count: countTest.count,
            error: countTest.error?.message,
            errorDetails: countTest.error
          }
        };
        
        console.log('🔍 RLS Debug Results:', results);
        setDebugInfo(results);
        
      } catch (error) {
        console.error('🔍 RLS Debug Error:', error);
        setDebugInfo({ error: error.message });
      } finally {
        setLoading(false);
      }
    };

    testRLS();
  }, []);

  if (loading) {
    return <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
      🔍 Testing RLS permissions...
    </div>;
  }

  return (
    <div className="p-4 bg-gray-100 border rounded mb-4">
      <h3 className="font-bold text-lg mb-4">🔍 RLS Debug Info</h3>
      
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold">User Info:</h4>
          <pre className="text-xs bg-white p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo.user, null, 2)}
          </pre>
        </div>
        
        <div>
          <h4 className="font-semibold">Profile Info:</h4>
          <pre className="text-xs bg-white p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo.profile, null, 2)}
          </pre>
        </div>
        
        <div>
          <h4 className="font-semibold">Training Enrollments Test:</h4>
          <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(debugInfo.enrollments, null, 2)}
          </pre>
        </div>
        
        <div>
          <h4 className="font-semibold">Count Only Test:</h4>
          <pre className="text-xs bg-white p-2 rounded overflow-auto">
            {JSON.stringify(debugInfo.countOnly, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
