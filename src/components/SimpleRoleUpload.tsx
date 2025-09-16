import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';

export const SimpleRoleUpload = () => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
  };

  const parseExcelFile = (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];
          
          resolve({
            fileName: file.name,
            headers: headers.filter(h => h && String(h).trim()),
            rows: rows.filter(row => row.some(cell => cell && String(cell).trim()))
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one Excel file",
        variant: "destructive"
      });
      return;
    }

    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenAI API key",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Parse files
      setProgress(20);
      const parsedFiles = await Promise.all(files.map(parseExcelFile));
      
      // Get user
      setProgress(30);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Create upload session
      setProgress(40);
      const { data: session, error: sessionError } = await supabase
        .from('xlsmart_upload_sessions')
        .insert({
          session_name: files.map(f => f.name).join(' + '),
          file_names: files.map(f => f.name),
          temp_table_names: [],
          total_rows: parsedFiles.reduce((sum, file) => sum + file.rows.length, 0),
          status: 'analyzing',
          created_by: user.user.id,
          ai_analysis: { raw_data: parsedFiles }
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Call OpenAI directly
      setProgress(60);
      const prompt = `Analyze this role data and create 5-8 standardized telecommunications roles:

${parsedFiles.map((file: any) => `
File: ${file.fileName}
Sample roles: ${JSON.stringify(file.rows.slice(0, 3))}
`).join('\n')}

Return valid JSON only:
{
  "standardRoles": [
    {
      "role_title": "Network Engineer",
      "department": "Network Operations", 
      "job_family": "Engineering",
      "role_level": "IC3-IC5",
      "role_category": "Technology",
      "standard_description": "Manages network infrastructure"
    }
  ],
  "mappings": [
    {
      "original_role_title": "RAN Performance Engineer",
      "standardized_role_title": "Network Engineer",
      "mapping_confidence": 85,
      "catalog_id": "${session.id}"
    }
  ]
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert HR analyst. Create standardized role definitions. Respond only with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI error: ${response.statusText}`);
      }

      const aiData = await response.json();
      const analysis = JSON.parse(aiData.choices[0].message.content);

      setProgress(80);

      // Insert standard roles
      const { data: createdRoles, error: rolesError } = await supabase
        .from('xlsmart_standard_roles')
        .insert(
          analysis.standardRoles.map((role: any) => ({
            ...role,
            created_by: user.user.id
          }))
        )
        .select();

      if (rolesError) throw rolesError;

      // Insert mappings
      const { data: createdMappings, error: mappingsError } = await supabase
        .from('xlsmart_role_mappings')
        .insert(analysis.mappings)
        .select();

      if (mappingsError) throw mappingsError;

      // Update session
      await supabase
        .from('xlsmart_upload_sessions')
        .update({ 
          status: 'completed',
          ai_analysis: {
            standardRolesCreated: createdRoles?.length || 0,
            mappingsCreated: createdMappings?.length || 0
          }
        })
        .eq('id', session.id);

      setProgress(100);

      toast({
        title: "✅ Success!",
        description: `Created ${createdRoles?.length || 0} standard roles with ${createdMappings?.length || 0} mappings`,
        duration: 5000
      });

      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "❌ Upload Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Simple AI Role Standardization
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload Excel files and enter your OpenAI API key for role standardization
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="api-key">OpenAI API Key</Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            disabled={isProcessing}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">OpenAI Dashboard</a>
          </p>
        </div>

        <div>
          <Label htmlFor="files">Excel Files</Label>
          <Input
            id="files"
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={handleFileChange}
            disabled={isProcessing}
          />
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected files:</p>
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            ))}
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                {progress < 30 && "📊 Parsing Excel files..."}
                {progress >= 30 && progress < 50 && "📤 Creating session..."}
                {progress >= 50 && progress < 90 && "🧠 AI processing roles..."}
                {progress >= 90 && "💾 Saving results..."}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || !apiKey.trim() || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Brain className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload & Standardize Roles
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};