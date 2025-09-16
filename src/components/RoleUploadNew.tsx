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

export const RoleUploadNew = () => {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
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

    setIsProcessing(true);
    setProgress(0);

    try {
      // Parse files
      setProgress(20);
      const parsedFiles = await Promise.all(files.map(parseExcelFile));
      
      // Create upload session
      setProgress(40);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

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

      // Call AI standardization using supabase.functions.invoke
      setProgress(70);
      const { data: result, error: functionError } = await supabase.functions.invoke('role-standardize-simple', {
        body: {
          sessionId: session.id,
          parsedData: parsedFiles
        }
      });

      if (functionError) {
        throw new Error(`AI processing failed: ${functionError.message}`);
      }
      setProgress(100);

      toast({
        title: "✅ Success!",
        description: `Created ${result.standardRolesCreated} standard roles with ${result.mappingsCreated} mappings`,
        duration: 5000
      });

      // Refresh page after delay
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
          AI Role Standardization
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload Excel files with role data for AI-powered standardization
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
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
                {progress >= 30 && progress < 60 && "📤 Creating upload session..."}
                {progress >= 60 && progress < 100 && "🧠 AI processing roles..."}
                {progress === 100 && "✅ Complete!"}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || isProcessing}
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