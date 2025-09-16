import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Users, CheckCircle, AlertCircle } from 'lucide-react';

const BulkRoleAssignment = () => {
  const [isAssigning, setIsAssigning] = useState(false);
  const [progress, setProgress] = useState({ assigned: 0, failed: 0, total: 0 });
  const { toast } = useToast();

  const handleBulkAssign = async () => {
    setIsAssigning(true);
    setProgress({ assigned: 0, failed: 0, total: 0 });

    try {
      console.log('Starting bulk assignment...');
      
      const { data, error } = await supabase.functions.invoke('bulk-assign-roles', {
        body: {}
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      if (data?.success) {
        setProgress({
          assigned: data.assigned || 0,
          failed: data.failed || 0,
          total: data.total || 0
        });

        toast({
          title: "Assignment Result",
          description: `${data.message}. Assigned: ${data.assigned}, Failed: ${data.failed}`,
          variant: data.failed > 0 ? "destructive" : "default",
        });
      } else {
        console.error('Function returned failure:', data);
        throw new Error(data?.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Bulk assignment error:', error);
      toast({
        title: "Assignment Failed",
        description: `Error: ${error.message || "Failed to assign roles. Please try again."}`,
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const progressPercentage = progress.total > 0 ? ((progress.assigned + progress.failed) / progress.total) * 100 : 0;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Bulk Role Assignment
        </CardTitle>
        <CardDescription>
          Automatically assign standard roles to all employees using AI analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          This will assign standard roles to all employees without current role assignments
        </div>

        {progress.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress.assigned + progress.failed} / {progress.total}</span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                <span>Assigned: {progress.assigned}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-500" />
                <span>Failed: {progress.failed}</span>
              </div>
            </div>
          </div>
        )}

        <Button 
          onClick={handleBulkAssign} 
          disabled={isAssigning}
          className="w-full"
        >
          {isAssigning ? 'Assigning Roles...' : 'Start Bulk Role Assignment'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default BulkRoleAssignment;