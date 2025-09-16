import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, Zap } from "lucide-react";

export function LiteLLMTest() {
  const [loading, setLoading] = useState(false);
  const [testMessage, setTestMessage] = useState("Test LiteLLM connection");
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const aiFunctions = [
    { name: 'test-litellm-direct', description: 'Test basic LiteLLM connection' },
    { name: 'ai-chat', description: 'General AI chat functionality' },
    { name: 'ai-skills-assessment', description: 'Employee skills assessment' },
    { name: 'ai-employee-engagement', description: 'Employee engagement analysis' },
    { name: 'ai-succession-planning', description: 'Succession planning analysis' },
    { name: 'ai-diversity-inclusion', description: 'Diversity & inclusion analysis' },
    { name: 'ai-advanced-role-intelligence', description: 'Advanced role intelligence' },
    { name: 'ai-compensation-intelligence', description: 'Compensation analysis' },
    { name: 'ai-learning-development', description: 'Learning development analysis' },
    { name: 'ai-job-descriptions-intelligence', description: 'Job description analysis' }
  ];

  const testSingleFunction = async (functionName: string) => {
    try {
      console.log(`Testing function: ${functionName}`);
      
      let payload;
      if (functionName === 'test-litellm-direct') {
        payload = { message: testMessage };
      } else if (functionName === 'ai-chat') {
        payload = { message: testMessage, context: "hr_assistant" };
      } else if (functionName === 'ai-skills-assessment') {
        // Skills assessment needs specific employee and role data
        payload = {
          employeeId: 'test-employee-id',
          targetRoleId: 'test-role-id',
          assessmentType: 'role_fit',
          additionalSkills: []
        };
      } else {
        // For intelligence functions, provide basic test parameters
        payload = {
          analysisType: getDefaultAnalysisType(functionName),
          departmentFilter: null,
          timeFrame: '3_months'
        };
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      if (error) throw error;

      return {
        function: functionName,
        status: 'success',
        response: data,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error(`Error testing ${functionName}:`, error);
      return {
        function: functionName,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  const getDefaultAnalysisType = (functionName: string) => {
    const defaults: Record<string, string> = {
      'ai-employee-engagement': 'sentiment_analysis',
      'ai-succession-planning': 'leadership_pipeline',
      'ai-diversity-inclusion': 'diversity_metrics',
      'ai-advanced-role-intelligence': 'role_evolution',
      'ai-compensation-intelligence': 'pay_equity',
      'ai-learning-development': 'personalized_learning',
      'ai-job-descriptions-intelligence': 'jd_optimization'
    };
    return defaults[functionName] || 'default';
  };

  const testAllFunctions = async () => {
    setLoading(true);
    setResults([]);
    
    try {
      // Test functions in batches to avoid overwhelming the server
      const batchSize = 3;
      const allResults: any[] = [];
      
      for (let i = 0; i < aiFunctions.length; i += batchSize) {
        const batch = aiFunctions.slice(i, i + batchSize);
        const batchPromises = batch.map(func => testSingleFunction(func.name));
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
        
        // Update results incrementally
        setResults([...allResults]);
        
        // Small delay between batches
        if (i + batchSize < aiFunctions.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const successCount = allResults.filter(r => r.status === 'success').length;
      const errorCount = allResults.filter(r => r.status === 'error').length;

      toast({
        title: "Testing Complete",
        description: `${successCount} functions working, ${errorCount} functions have issues`,
        variant: successCount === allResults.length ? "default" : "destructive"
      });

    } catch (error: any) {
      console.error('Error testing functions:', error);
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            LiteLLM AI Functions Test
          </CardTitle>
          <CardDescription>
            Test all {aiFunctions.length} AI functions to ensure they're using LiteLLM correctly and the API key is working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="test-message" className="text-sm font-medium">
              Test Message:
            </label>
            <Textarea
              id="test-message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Enter a test message for AI functions..."
              className="min-h-[80px]"
            />
          </div>
          
          <Button
            onClick={testAllFunctions}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing AI Functions...
              </>
            ) : (
              `Test All ${aiFunctions.length} AI Functions`
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Results from testing AI functions ({results.length}/{aiFunctions.length} completed)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{result.function}</span>
                      {result.status === 'success' ? (
                        <Badge variant="default" className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Error
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {result.status === 'success' ? (
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">
                        ✅ Function working correctly with LiteLLM
                      </p>
                      {result.response && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            View response details
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                            {JSON.stringify(result.response, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-red-600">
                        ❌ Error: {result.error}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}