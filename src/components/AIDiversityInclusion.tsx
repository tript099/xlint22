import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, BarChart3, Heart, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const AIDiversityInclusion = () => {
  const [selectedAnalysis, setSelectedAnalysis] = useState('bias_detection');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const analysisTypes = [
    { value: 'bias_detection', label: 'Bias Detection', icon: Shield },
    { value: 'diversity_metrics', label: 'Diversity Metrics', icon: BarChart3 },
    { value: 'inclusion_sentiment', label: 'Inclusion Sentiment', icon: Heart },
    { value: 'pay_equity_analysis', label: 'Pay Equity', icon: DollarSign }
  ];

  const handleAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-diversity-inclusion', {
        body: { analysisType: selectedAnalysis, departmentFilter: departmentFilter || undefined }
      });
      if (error) throw error;
      setResults(data);
      toast({ title: "Analysis Complete", description: "D&I analysis completed successfully!" });
    } catch (error) {
      toast({ title: "Analysis Failed", description: "Failed to complete D&I analysis", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Select value={selectedAnalysis} onValueChange={setSelectedAnalysis}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {analysisTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center gap-2">
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAnalysis} disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>

      {results && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><div className="text-2xl font-bold">Analysis Complete</div></CardContent></Card>
          </div>
        </div>
      )}
    </div>
  );
};