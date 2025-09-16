import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Info,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TdOverviewData, TdOverviewHealth } from "@/types/td-overview";

export default function TdDiagnostics() {
  const [overviewData, setOverviewData] = useState<TdOverviewData | null>(null);
  const [healthData, setHealthData] = useState<TdOverviewHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async (refreshCache = false) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch overview data
      const overviewUrl = refreshCache ? 'td-overview?refresh=1' : 'td-overview';
      const { data: overview, error: overviewError } = await supabase.functions.invoke(overviewUrl);

      if (overviewError) {
        throw new Error(`Overview fetch failed: ${overviewError.message}`);
      }

      setOverviewData(overview);

      // Fetch health data
      const { data: health, error: healthError } = await supabase.functions.invoke('td-overview/health');

      if (healthError) {
        throw new Error(`Health check failed: ${healthError.message}`);
      }

      setHealthData(health);

    } catch (err) {
      console.error('Error fetching diagnostics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const refreshSchema = () => {
    fetchDiagnostics(true);
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getStatusBadge = (condition: boolean, trueText: string, falseText: string) => {
    return (
      <Badge variant={condition ? "default" : "destructive"}>
        {condition ? trueText : falseText}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Training & Development Diagnostics</h1>
          <p className="text-muted-foreground text-lg">
            Schema mapping and system health monitoring
          </p>
        </div>
        <Button 
          onClick={refreshSchema} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Re-scan Schema
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Health Status */}
      {healthData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                {getStatusIcon(healthData.ok)}
                <span className="font-medium">Status:</span>
                {getStatusBadge(healthData.ok, "Healthy", "Unhealthy")}
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Version:</span>
                <Badge variant="outline">{healthData.version}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Last Check:</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(healthData.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schema Mapping */}
      {overviewData?.schemaNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Schema Mapping
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Training Tables</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Programs Table:</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(!!overviewData.schemaNotes.programsTable)}
                        <span className="text-sm font-mono">
                          {overviewData.schemaNotes.programsTable || 'Not found'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Participants Table:</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(!!overviewData.schemaNotes.participantsTable)}
                        <span className="text-sm font-mono">
                          {overviewData.schemaNotes.participantsTable || 'Not found'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Progress Table:</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(!!overviewData.schemaNotes.progressTable)}
                        <span className="text-sm font-mono">
                          {overviewData.schemaNotes.progressTable || 'Not found'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Sessions Table:</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(!!overviewData.schemaNotes.sessionsTable)}
                        <span className="text-sm font-mono">
                          {overviewData.schemaNotes.sessionsTable || 'Not found'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Pathways & Categories</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Pathways Table:</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(!!overviewData.schemaNotes.pathwaysTable)}
                        <span className="text-sm font-mono">
                          {overviewData.schemaNotes.pathwaysTable || 'Not found'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Categories Field:</span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(!!overviewData.schemaNotes.categoriesField)}
                        <span className="text-sm font-mono">
                          {overviewData.schemaNotes.categoriesField || 'Not found'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {overviewData.schemaNotes.warnings.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-amber-600 mb-2">Warnings</h4>
                  <div className="space-y-1">
                    {overviewData.schemaNotes.warnings.map((warning, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">{warning}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Data */}
      {overviewData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Raw Overview Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(overviewData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Pathways Health */}
      {overviewData?.pathwaysHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Development Pathways Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(overviewData.pathwaysHealth.tableFound)}
                  <span className="font-medium">Table Found:</span>
                  {getStatusBadge(overviewData.pathwaysHealth.tableFound, "Yes", "No")}
                </div>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Row Count:</span>
                  <Badge variant="outline">{overviewData.pathwaysHealth.rowCount}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Last Created:</span>
                  <span className="text-sm text-muted-foreground">
                    {overviewData.pathwaysHealth.lastCreatedAt 
                      ? new Date(overviewData.pathwaysHealth.lastCreatedAt).toLocaleDateString()
                      : 'Never'
                    }
                  </span>
                </div>
              </div>

              {overviewData.pathwaysHealth.sample.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Sample Pathways</h4>
                  <div className="space-y-2">
                    {overviewData.pathwaysHealth.sample.map((pathway) => (
                      <div key={pathway.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <span className="font-medium">{pathway.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({pathway.status})
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(pathway.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!overviewData.pathwaysHealth.tableFound && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No pathways table found in Supabase. If the analysis is running, ensure it persists to the pathways table.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


