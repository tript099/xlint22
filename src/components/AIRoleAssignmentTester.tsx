import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, AlertTriangle, Bot, Loader2 } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: any;
}

const AIRoleAssignmentTester = () => {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const { toast } = useToast();

  const updateTestResult = (name: string, status: TestResult['status'], message: string, details?: any) => {
    setTestResults(prev => {
      const existing = prev.find(r => r.name === name);
      const newResult = { name, status, message, details };
      
      if (existing) {
        return prev.map(r => r.name === name ? newResult : r);
      } else {
        return [...prev, newResult];
      }
    });
  };

  const runTests = async () => {
    setTesting(true);
    setTestResults([]);

    const tests = [
      { name: 'OpenAI API Key Test', function: 'test-openai-key' },
      { name: 'Bulk Role Assignment', function: 'bulk-assign-roles' },
      { name: 'Employee Role Assignment', function: 'employee-role-assignment' },
      { name: 'AI Employee Assignment', function: 'ai-employee-assignment' }
    ];

    // Initialize all tests as pending
    tests.forEach(test => {
      updateTestResult(test.name, 'pending', 'Waiting to run...');
    });

    for (const test of tests) {
      try {
        console.log(`Testing ${test.name}...`);
        updateTestResult(test.name, 'pending', 'Running test...');

        let result;
        if (test.function === 'test-openai-key') {
          result = await supabase.functions.invoke(test.function, {
            body: {}
          });
        } else if (test.function === 'bulk-assign-roles') {
          result = await supabase.functions.invoke(test.function, {
            body: { dryRun: true } // Test mode to avoid actual assignments
          });
        } else if (test.function === 'employee-role-assignment') {
          // Get a sample session ID for testing
          const { data: sessions } = await supabase
            .from('xlsmart_upload_sessions')
            .select('id')
            .eq('status', 'completed')
            .limit(1);
          
          if (sessions && sessions.length > 0) {
            result = await supabase.functions.invoke(test.function, {
              body: { 
                sessionId: sessions[0].id,
                dryRun: true 
              }
            });
          } else {
            updateTestResult(test.name, 'error', 'No completed upload sessions found for testing');
            continue;
          }
        } else if (test.function === 'ai-employee-assignment') {
          // Get sample employee IDs for testing
          const { data: employees } = await supabase
            .from('xlsmart_employees')
            .select('id')
            .is('standard_role_id', null)
            .limit(2);
          
          if (employees && employees.length > 0) {
            result = await supabase.functions.invoke(test.function, {
              body: { 
                employeeIds: employees.map(e => e.id),
                assignImmediately: false, // Test mode
                dryRun: true
              }
            });
          } else {
            updateTestResult(test.name, 'error', 'No unassigned employees found for testing');
            continue;
          }
        }

        if (result?.error) {
          console.error(`${test.name} failed:`, result.error);
          updateTestResult(
            test.name, 
            'error', 
            result.error.message || 'Function call failed',
            result.error
          );
        } else {
          console.log(`${test.name} succeeded:`, result?.data);
          updateTestResult(
            test.name, 
            'success', 
            result?.data?.message || 'Test passed successfully',
            result?.data
          );
        }

      } catch (error) {
        console.error(`${test.name} error:`, error);
        updateTestResult(
          test.name, 
          'error', 
          error.message || 'Unexpected error occurred',
          error
        );
      }

      // Wait a bit between tests to avoid overwhelming the functions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setTesting(false);
    
    const successful = testResults.filter(r => r.status === 'success').length;
    const total = tests.length;
    
    toast({
      title: "AI Role Assignment Tests Complete",
      description: `${successful}/${total} tests passed successfully`,
      variant: successful === total ? "default" : "destructive",
    });
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending':
        return <Badge variant="secondary">Running...</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Role Assignment System Tester
        </CardTitle>
        <CardDescription>
          Test all AI role assignment functions to ensure proper configuration and functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={runTests} 
            disabled={testing}
            className="flex items-center gap-2"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                Run Complete Test Suite
              </>
            )}
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Test Results</h3>
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div 
                  key={index}
                  className="flex items-start justify-between p-4 border rounded-lg bg-card"
                >
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(result.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{result.name}</h4>
                        {getStatusBadge(result.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      {result.details && result.status === 'success' && (
                        <div className="mt-2 text-xs text-green-600">
                          {typeof result.details === 'object' ? 
                            JSON.stringify(result.details, null, 2).slice(0, 200) + '...' : 
                            result.details
                          }
                        </div>
                      )}
                      {result.details && result.status === 'error' && (
                        <div className="mt-2 text-xs text-red-600">
                          Error details: {result.details.message || JSON.stringify(result.details)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                <strong>Summary:</strong> {testResults.filter(r => r.status === 'success').length} passed, {' '}
                {testResults.filter(r => r.status === 'error').length} failed, {' '}
                {testResults.filter(r => r.status === 'pending').length} pending
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t text-sm text-muted-foreground">
          <h4 className="font-medium mb-2">What this tests:</h4>
          <ul className="space-y-1 list-disc list-inside">
            <li>OpenAI API key configuration and connectivity</li>
            <li>Bulk role assignment functionality</li>
            <li>Employee role assignment with upload sessions</li>
            <li>AI-powered employee assignment system</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIRoleAssignmentTester;