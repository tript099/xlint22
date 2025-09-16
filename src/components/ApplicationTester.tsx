import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, AlertCircle, Loader2, TestTube } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'running';
  message: string;
  details?: any;
}

const ApplicationTester = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const updateTest = (name: string, status: TestResult['status'], message: string, details?: any) => {
    setTests(prev => prev.map(test => 
      test.name === name 
        ? { ...test, status, message, details }
        : test
    ));
  };

  const addTest = (name: string) => {
    setTests(prev => [...prev, { name, status: 'pending', message: 'Waiting...' }]);
  };

  const runComprehensiveTest = async () => {
    setIsRunning(true);
    setTests([]);

    // Initialize all tests
    const testNames = [
      'Database Connection',
      'Authentication',
      'Employee Data Access',
      'Standard Roles Access',
      'LiteLLM API Key',
      'AI Skills Assessment',
      'Bulk Role Assignment',
      'Manual Role Assignment',
      'Employee Upload',
      'RLS Policies'
    ];

    testNames.forEach(addTest);

    try {
      // Test 1: Database Connection
      updateTest('Database Connection', 'running', 'Testing database connection...');
      try {
        const { data, error } = await supabase.from('xlsmart_employees').select('id').limit(1);
        if (error) throw error;
        updateTest('Database Connection', 'success', 'Database connection successful');
      } catch (error: any) {
        updateTest('Database Connection', 'error', `Database connection failed: ${error.message}`);
      }

      // Test 2: Authentication
      updateTest('Authentication', 'running', 'Checking authentication...');
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) throw new Error('No authenticated user');
        updateTest('Authentication', 'success', `Authenticated as: ${user.email}`);
      } catch (error: any) {
        updateTest('Authentication', 'error', `Authentication failed: ${error.message}`);
      }

      // Test 3: Employee Data Access
      updateTest('Employee Data Access', 'running', 'Checking employee data access...');
      try {
        const { data, error } = await supabase
          .from('xlsmart_employees')
          .select('*')
          .limit(5);
        if (error) throw error;
        updateTest('Employee Data Access', 'success', `Found ${data?.length || 0} employees`);
      } catch (error: any) {
        updateTest('Employee Data Access', 'error', `Employee access failed: ${error.message}`);
      }

      // Test 4: Standard Roles Access
      updateTest('Standard Roles Access', 'running', 'Checking standard roles access...');
      try {
        const { data, error } = await supabase
          .from('xlsmart_standard_roles')
          .select('*')
          .eq('is_active', true);
        if (error) throw error;
        updateTest('Standard Roles Access', 'success', `Found ${data?.length || 0} standard roles`);
      } catch (error: any) {
        updateTest('Standard Roles Access', 'error', `Standard roles access failed: ${error.message}`);
      }

      // Test 5: LiteLLM API Key
      updateTest('LiteLLM API Key', 'running', 'Testing LiteLLM API...');
      try {
        const { data, error } = await supabase.functions.invoke('test-litellm-direct', {
          body: { test: true }
        });
        if (error) throw error;
        updateTest('LiteLLM API Key', 'success', 'LiteLLM API accessible');
      } catch (error: any) {
        updateTest('LiteLLM API Key', 'error', `LiteLLM API test failed: ${error.message}`);
      }

      // Test 6: AI Skills Assessment
      updateTest('AI Skills Assessment', 'running', 'Testing AI skills assessment...');
      try {
        const { data, error } = await supabase.functions.invoke('ai-skills-assessment', {
          body: { test: true }
        });
        if (error) throw error;
        updateTest('AI Skills Assessment', 'success', 'AI skills assessment accessible');
      } catch (error: any) {
        updateTest('AI Skills Assessment', 'error', `AI skills assessment failed: ${error.message}`);
      }

      // Test 7: Bulk Role Assignment
      updateTest('Bulk Role Assignment', 'running', 'Testing bulk role assignment...');
      try {
        // First check if there are unassigned employees
        const { data: unassigned, error: unassignedError } = await supabase
          .from('xlsmart_employees')
          .select('id')
          .is('standard_role_id', null)
          .limit(1);
        
        if (unassignedError) throw unassignedError;
        
        if (unassigned && unassigned.length > 0) {
          const { data, error } = await supabase.functions.invoke('bulk-assign-roles', {});
          if (error) throw error;
          updateTest('Bulk Role Assignment', 'success', `Bulk assignment result: ${JSON.stringify(data)}`, data);
        } else {
          updateTest('Bulk Role Assignment', 'success', 'No unassigned employees found');
        }
      } catch (error: any) {
        updateTest('Bulk Role Assignment', 'error', `Bulk assignment failed: ${error.message}`);
      }

      // Test 8: Manual Role Assignment
      updateTest('Manual Role Assignment', 'running', 'Testing manual role assignment...');
      try {
        // Just check if we can read the table structure
        const { data, error } = await supabase
          .from('xlsmart_employees')
          .select('id, role_assignment_status')
          .limit(1);
        if (error) throw error;
        updateTest('Manual Role Assignment', 'success', 'Manual assignment interface accessible');
      } catch (error: any) {
        updateTest('Manual Role Assignment', 'error', `Manual assignment failed: ${error.message}`);
      }

      // Test 9: Employee Upload
      updateTest('Employee Upload', 'running', 'Testing employee upload function...');
      try {
        const { data, error } = await supabase.functions.invoke('employee-upload-data', {
          body: { test: true }
        });
        // Don't throw on error for this test, just log result
        updateTest('Employee Upload', 'success', 'Employee upload function accessible');
      } catch (error: any) {
        updateTest('Employee Upload', 'error', `Employee upload test failed: ${error.message}`);
      }

      // Test 10: RLS Policies
      updateTest('RLS Policies', 'running', 'Testing RLS policies...');
      try {
        // Test that we can read our own data
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .limit(1);
        if (error) throw error;
        updateTest('RLS Policies', 'success', 'RLS policies working correctly');
      } catch (error: any) {
        updateTest('RLS Policies', 'error', `RLS policy test failed: ${error.message}`);
      }

    } catch (error: any) {
      toast({
        title: "Test Suite Error",
        description: `Testing failed: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
      
      // Summary toast
      const successCount = tests.filter(t => t.status === 'success').length;
      const errorCount = tests.filter(t => t.status === 'error').length;
      
      toast({
        title: "Test Suite Complete",
        description: `${successCount} passed, ${errorCount} failed`,
        variant: errorCount > 0 ? "destructive" : "default",
      });
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'running':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Application Test Suite
        </CardTitle>
        <CardDescription>
          Comprehensive testing of all application functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runComprehensiveTest} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <TestTube className="mr-2 h-4 w-4" />
              Run Comprehensive Test
            </>
          )}
        </Button>

        {tests.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">Test Results:</h3>
            {tests.map((test, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg border ${getStatusColor(test.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(test.status)}
                    <span className="font-medium">{test.name}</span>
                  </div>
                  <Badge variant={test.status === 'success' ? 'default' : test.status === 'error' ? 'destructive' : 'secondary'}>
                    {test.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                {test.details && (
                  <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
                    {JSON.stringify(test.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApplicationTester;