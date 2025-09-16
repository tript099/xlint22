import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CheckCircle, Eye, ThumbsUp, ThumbsDown, Zap, MousePointer } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RoleMappingDetails } from "@/components/RoleMappingDetails";
import { RoleMappingPagination } from "@/components/RoleMappingPagination";
import { FILE_UPLOAD, PAGINATION, SUCCESS_MESSAGES, ERROR_MESSAGES } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface RoleMappingResult {
  id: string;
  originalTitle: string;
  originalDepartment: string;
  standardizedTitle: string;
  standardizedDepartment: string;
  jobFamily: string;
  confidence: number;
  requiresReview: boolean;
  status: 'auto_mapped' | 'manual_review' | 'approved' | 'rejected';
  roleLevel?: string;
  aiReasoning?: string;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

const LARGE_DATASET_THRESHOLD = 500; // Threshold for large dataset handling
const DEFAULT_PAGE_SIZE = PAGINATION.DEFAULT_PAGE_SIZE; // Default items per page

export const RoleUpload = () => {
  const { toast } = useToast();
  const [xlFile, setXlFile] = useState<File | null>(null);
  const [smartFile, setSmartFile] = useState<File | null>(null);
  const [fileFormat, setFileFormat] = useState<string>('');
  const [includeIndustryStandards, setIncludeIndustryStandards] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [catalogId, setCatalogId] = useState<string | null>(null);
  const [mappingResults, setMappingResults] = useState<RoleMappingResult[]>([]);
  const [allMappingResults, setAllMappingResults] = useState<RoleMappingResult[]>([]);
  const [showMappingReview, setShowMappingReview] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<RoleMappingResult | null>(null);
  const [showMappingDetails, setShowMappingDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [totalMappings, setTotalMappings] = useState(0);
  const [isLargeDataset, setIsLargeDataset] = useState(false);
  const [processingBatch, setProcessingBatch] = useState<{ current: number; total: number } | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, fileType: 'xl' | 'smart') => {
    const file = event.target.files?.[0];
    if (file) {
      if (fileType === 'xl') setXlFile(file);
      else if (fileType === 'smart') setSmartFile(file);
      setUploadStatus('idle');
    }
  };

  const processRoleStandardization = async () => {
    if (!xlFile || !smartFile || !fileFormat) {
      toast({
        title: "Missing Files",
        description: "Please upload both XL and SMART role files before processing.",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    setUploadStatus('processing');
    setUploadProgress(0);

    try {
      // Step 1: Create role catalog entry
      const { data: catalogData, error: catalogError } = await supabase
        .from('xlsmart_role_catalogs')
        .insert({
          source_company: 'both',
          file_name: includeIndustryStandards ? `${xlFile.name}, ${smartFile.name}, AI Industry Standards` : `${xlFile.name}, ${smartFile.name}`,
          file_format: fileFormat,
          file_size: xlFile.size + smartFile.size,
          upload_status: 'processing',
          uploaded_by: (await supabase.auth.getUser()).data.user?.id || null
        })
        .select()
        .single();

      if (catalogError) throw catalogError;
      setCatalogId(catalogData.id);

      setUploadProgress(20);

      // Step 2: Parse actual uploaded files
      const parseRoleFile = async (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = e.target?.result;
              
              if (fileFormat === 'json') {
                resolve(JSON.parse(data as string));
              } else if (fileFormat === 'csv') {
                const text = data as string;
                const lines = text.split('\n').filter(line => line.trim());
                if (lines.length === 0) {
                  resolve([]);
                  return;
                }
                const headers = lines[0].split(',');
                const roles = lines.slice(1).map(line => {
                  const values = line.split(',');
                  return headers.reduce((obj, header, index) => {
                    obj[header.trim()] = values[index]?.trim() || '';
                    return obj;
                  }, {} as any);
                });
                console.log('CSV headers found:', headers);
                console.log('Sample role data:', roles.slice(0, 2));
                
                // More flexible column name matching for CSV - including camelCase versions
                const titleColumns = ['title', 'name', 'role title', 'position', 'job title', 'role name', 
                                    'current position', 'role', 'designation', 'job role', 'function',
                                    'Title', 'Name', 'Role Title', 'Position', 'Job Title', 'Role Name',
                                    'Current Position', 'Role', 'Designation', 'Job Role', 'Function',
                                    'RoleTitle', 'JobTitle', 'RoleName', 'CurrentPosition'];  // Added camelCase versions
                
                const filteredRoles = roles.filter(role => {
                  return titleColumns.some(col => role[col] && String(role[col]).trim().length > 0);
                });
                
                console.log(`Found ${filteredRoles.length} valid roles out of ${roles.length} total rows`);
                resolve(filteredRoles);
              } else if (fileFormat === 'excel') {
                // Parse Excel file
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length === 0) {
                  resolve([]);
                  return;
                }
                
                const headers = jsonData[0] as string[];
                const roles = (jsonData.slice(1) as any[][]).map(row => {
                  return headers.reduce((obj, header, index) => {
                    if (header) {
                      obj[header] = row[index] || '';
                    }
                    return obj;
                  }, {} as any);
                });
                console.log('Excel headers found:', headers);
                console.log('Sample role data:', roles.slice(0, 2));
                
                // More flexible column name matching - including camelCase versions
                const titleColumns = ['title', 'name', 'role title', 'position', 'job title', 'role name', 
                                    'current position', 'role', 'designation', 'job role', 'function',
                                    'Title', 'Name', 'Role Title', 'Position', 'Job Title', 'Role Name',
                                    'Current Position', 'Role', 'Designation', 'Job Role', 'Function',
                                    'RoleTitle', 'JobTitle', 'RoleName', 'CurrentPosition'];  // Added camelCase versions
                
                const filteredRoles = roles.filter((role, index) => {
                  // Check if any title column exists and has a value
                  const hasValidTitle = titleColumns.some(col => role[col] && String(role[col]).trim().length > 0);
                  
                  // Debug ALL roles to see what's happening
                  console.log(`Role ${index + 1}:`, {
                    RoleTitle: `"${role.RoleTitle}"`,
                    RoleTitleType: typeof role.RoleTitle,
                    RoleTitleLength: role.RoleTitle ? String(role.RoleTitle).length : 0,
                    RoleTitleTrimmed: role.RoleTitle ? String(role.RoleTitle).trim() : '',
                    hasValidTitle,
                    allValues: Object.entries(role).slice(0, 5) // Show first 5 key-value pairs
                  });
                  
                  return hasValidTitle;
                });
                
                console.log(`Found ${filteredRoles.length} valid roles out of ${roles.length} total rows`);
                resolve(filteredRoles);
              } else {
                reject(new Error('Unsupported file format. Please use JSON, CSV, or Excel files.'));
              }
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error('File reading failed'));
          
          if (fileFormat === 'excel') {
            reader.readAsArrayBuffer(file);
          } else {
            reader.readAsText(file);
          }
        });
      };

      const xlRoles = await parseRoleFile(xlFile);
      const smartRoles = await parseRoleFile(smartFile);

      console.log('Parsed XL roles:', xlRoles);
      console.log('Parsed SMART roles:', smartRoles);

      if (xlRoles.length === 0 && smartRoles.length === 0) {
        throw new Error('No roles found in uploaded files. Please check the file format and content.');
      }

      // Check if this is a large dataset
      const totalRoles = xlRoles.length + smartRoles.length;
      setIsLargeDataset(totalRoles > LARGE_DATASET_THRESHOLD);
      
      if (totalRoles > LARGE_DATASET_THRESHOLD) {
        toast({
          title: "Large Dataset Detected",
          description: `Processing ${totalRoles} roles. This may take several minutes and will be processed in batches.`,
        });
      }

      setUploadProgress(40);

      // Step 3: Call AI standardization service with progress tracking
      setUploadProgress(50);
      const { data: standardizationResult, error: standardizationError } = await supabase.functions.invoke('standardize-roles', {
        body: {
          xlRoles: xlRoles,
          smartRoles: smartRoles,
          includeIndustryStandards: includeIndustryStandards,
          catalogId: catalogData.id
        }
      });

      if (standardizationError) {
        console.error('Standardization error:', standardizationError);
        throw new Error(`Standardization failed: ${standardizationError.message}`);
      }

      console.log('Standardization result:', standardizationResult);

      setUploadProgress(70);

      // Step 4: Fetch the created mappings with pagination for large datasets
      const fetchMappings = async (page: number = 1, limit: number = pageSize) => {
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        
        return await supabase
          .from('xlsmart_role_mappings')
          .select(`
            id,
            original_role_title,
            original_department,
            standardized_role_title,
            standardized_department,
            job_family,
            mapping_confidence,
            requires_manual_review,
            mapping_status,
            created_at
          `, { count: 'exact' })
          .eq('catalog_id', catalogData.id)
          .range(from, to)
          .order('created_at', { ascending: false });
      };

      const { data: mappingsData, error: mappingsError, count } = await fetchMappings(1, pageSize);

      if (mappingsError) {
        console.error('Mappings fetch error:', mappingsError);
        throw mappingsError;
      }

      console.log('Fetched mappings:', mappingsData);

      // Convert to display format
      const displayMappings: RoleMappingResult[] = mappingsData.map(mapping => ({
        id: mapping.id,
        originalTitle: mapping.original_role_title,
        originalDepartment: mapping.original_department || '',
        standardizedTitle: mapping.standardized_role_title,
        standardizedDepartment: mapping.standardized_department || '',
        jobFamily: mapping.job_family || '',
        confidence: mapping.mapping_confidence || 0,
        requiresReview: mapping.requires_manual_review || false,
        status: mapping.mapping_status as any,
        createdAt: mapping.created_at
      }));

      setMappingResults(displayMappings);
      setAllMappingResults(displayMappings);
      setTotalMappings(count || displayMappings.length);
      console.log('Setting mapping results:', displayMappings);
      setUploadProgress(100);
      setIsUploading(false);
      setUploadStatus('completed');

      toast({
        title: "Role Standardization Complete!",
        description: `Successfully processed ${standardizationResult.totalRoles} roles using AI. ${standardizationResult.autoMappedCount} auto-mapped, ${standardizationResult.manualReviewCount} need review.`
      });

    } catch (error) {
      console.error('Error during role standardization:', error);
      setIsUploading(false);
      setUploadStatus('error');
      toast({
        title: "Standardization Failed",
        description: "There was an error processing your file. Please try again.",
        variant: "destructive"
      });
    }
  };

  const fetchMappingsForPage = async (page: number) => {
    if (!catalogId) return;
    
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data: mappingsData, error: mappingsError, count } = await supabase
      .from('xlsmart_role_mappings')
      .select(`
        id,
        original_role_title,
        original_department,
        standardized_role_title,
        standardized_department,
        job_family,
        mapping_confidence,
        requires_manual_review,
        mapping_status,
        created_at
      `, { count: 'exact' })
      .eq('catalog_id', catalogId)
      .range(from, to)
      .order('created_at', { ascending: false });

    if (mappingsError) {
      console.error('Error fetching mappings:', mappingsError);
      return;
    }

    const displayMappings: RoleMappingResult[] = mappingsData.map(mapping => ({
      id: mapping.id,
      originalTitle: mapping.original_role_title,
      originalDepartment: mapping.original_department || '',
      standardizedTitle: mapping.standardized_role_title,
      standardizedDepartment: mapping.standardized_department || '',
      jobFamily: mapping.job_family || '',
      confidence: mapping.mapping_confidence || 0,
      requiresReview: mapping.requires_manual_review || false,
      status: mapping.mapping_status as any,
      createdAt: mapping.created_at
    }));

    setMappingResults(displayMappings);
    setTotalMappings(count || 0);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchMappingsForPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
    fetchMappingsForPage(1);
  };

  const handleMappingClick = (mapping: RoleMappingResult) => {
    setSelectedMapping(mapping);
    setShowMappingDetails(true);
  };

  const handleMappingReview = async (mappingId: string, approved: boolean) => {
    setMappingResults(prev => prev.map(mapping => 
      mapping.id === mappingId 
        ? { ...mapping, status: approved ? 'approved' : 'rejected' }
        : mapping
    ));

    try {
      // Update in database
      const { error } = await supabase
        .from('xlsmart_role_mappings')
        .update({
          mapping_status: approved ? 'approved' : 'rejected',
          reviewed_by: (await supabase.auth.getUser()).data.user?.id || null,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', mappingId);

      if (error) throw error;

      toast({
        title: approved ? "Mapping Approved" : "Mapping Rejected",
        description: `Role mapping has been ${approved ? 'approved' : 'rejected'} successfully.`
      });
      
      // Refresh current page data
      fetchMappingsForPage(currentPage);
    } catch (error) {
      console.error('Error updating mapping:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update mapping status. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleMappingEdit = (mappingId: string, updates: any) => {
    setMappingResults(prev => prev.map(mapping => 
      mapping.id === mappingId 
        ? { ...mapping, ...updates }
        : mapping
    ));
    
    // Refresh current page data
    fetchMappingsForPage(currentPage);
  };

  const resetUpload = () => {
    setXlFile(null);
    setSmartFile(null);
    setIncludeIndustryStandards(false);
    setUploadProgress(0);
    setUploadStatus('idle');
    setIsUploading(false);
    setCatalogId(null);
    setMappingResults([]);
    setAllMappingResults([]);
    setSelectedMapping(null);
    setShowMappingReview(false);
    setShowMappingDetails(false);
    setCurrentPage(1);
    setTotalMappings(0);
    setFileFormat('');
  };

  const totalPages = Math.ceil(totalMappings / pageSize);

  const autoMappedCount = totalMappings > 0 ? mappingResults.filter(m => m.status === 'auto_mapped').length : 0;
  const reviewRequiredCount = totalMappings > 0 ? mappingResults.filter(m => m.requiresReview && m.status === 'manual_review').length : 0;
  const overallAccuracy = totalMappings > 0 
    ? (mappingResults.reduce((acc, m) => acc + m.confidence, 0) / mappingResults.length).toFixed(1)
    : '0';

  return (
    <div className="space-y-6 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-card-foreground mb-2">AI-Powered Role Standardization</h2>
        <p className="text-muted-foreground">Upload XL and SMART role catalogs, optionally include AI-generated industry standards to create XLSMART roles</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-card-foreground">
            <Zap className="h-5 w-5 text-primary" />
            Bulk Role Upload & AI Standardization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="format" className="text-card-foreground">File Format</Label>
              <Select value={fileFormat} onValueChange={setFileFormat}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Select file format for uploads" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover border-border" sideOffset={5} alignOffset={0}>
                  <SelectItem value="excel" className="text-popover-foreground hover:bg-accent">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv" className="text-popover-foreground hover:bg-accent">CSV (.csv)</SelectItem>
                  <SelectItem value="json" className="text-popover-foreground hover:bg-accent">JSON (.json)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-card-foreground">Include Industry Standards</Label>
              <div className="flex items-center space-x-2 p-3 border border-border rounded-md bg-background">
                <input
                  type="checkbox"
                  id="include-industry"
                  checked={includeIndustryStandards}
                  onChange={(e) => setIncludeIndustryStandards(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="include-industry" className="text-sm text-foreground">
                  Use AI-generated industry standards
                </label>
              </div>
            </div>
          </div>

          {/* Two Required File Upload Sections */}
          <div className="space-y-6">
            {/* XL Roles Upload */}
            <div className="space-y-2">
              <Label className="text-card-foreground font-medium">1. XL Axiata Roles (Required)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center bg-background">
                <input
                  type="file"
                  id="xl-file-upload"
                  className="hidden"
                   accept={FILE_UPLOAD.ALLOWED_TYPES.map(type => {
                     if (type.includes('spreadsheetml')) return '.xlsx';
                     if (type.includes('ms-excel')) return '.xls';
                     if (type.includes('csv')) return '.csv';
                     return '';
                   }).join(',')}
                  onChange={(e) => handleFileSelect(e, 'xl')}
                />
                <label htmlFor="xl-file-upload" className="cursor-pointer flex flex-col items-center space-y-2">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium text-foreground">
                    {xlFile ? xlFile.name : "Upload XL Axiata role catalog"}
                  </div>
                </label>
              </div>
            </div>

            {/* SMART Roles Upload */}
            <div className="space-y-2">
              <Label className="text-card-foreground font-medium">2. SMART Telecom Roles (Required)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center bg-background">
                <input
                  type="file"
                  id="smart-file-upload"
                  className="hidden"
                   accept={FILE_UPLOAD.ALLOWED_TYPES.map(type => {
                     if (type.includes('spreadsheetml')) return '.xlsx';
                     if (type.includes('ms-excel')) return '.xls';
                     if (type.includes('csv')) return '.csv';
                     return '';
                   }).join(',')}
                  onChange={(e) => handleFileSelect(e, 'smart')}
                />
                <label htmlFor="smart-file-upload" className="cursor-pointer flex flex-col items-center space-y-2">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div className="text-sm font-medium text-foreground">
                    {smartFile ? smartFile.name : "Upload SMART Telecom role catalog"}
                  </div>
                </label>
              </div>
            </div>

            {/* Industry Standards Info */}
            {includeIndustryStandards && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <Zap className="h-4 w-4" />
                  <span className="font-medium">AI Industry Standards Enabled</span>
                </div>
                <p className="text-sm text-blue-700">
                  AI will generate telecommunications industry standard roles and include them in the XLSMART role creation process.
                </p>
              </div>
            )}
          </div>

            {(xlFile || smartFile) && (
              <div className="space-y-4">
                {/* File Summary */}
                <div className="p-4 bg-muted rounded-lg border border-border">
                  <h4 className="font-medium text-card-foreground mb-2">Upload Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={xlFile ? "text-green-600" : "text-muted-foreground"}>
                        XL Roles: {xlFile ? `✓ ${xlFile.name}` : "❌ Not uploaded"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={smartFile ? "text-green-600" : "text-muted-foreground"}>
                        SMART Roles: {smartFile ? `✓ ${smartFile.name}` : "❌ Not uploaded"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={includeIndustryStandards ? "text-green-600" : "text-muted-foreground"}>
                        Industry Standards: {includeIndustryStandards ? "✓ AI-generated" : "❌ Not included"}
                      </span>
                    </div>
                  </div>
                  {uploadStatus === 'completed' && (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-2" />
                  )}
                  {uploadStatus === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500 mt-2" />
                  )}
                </div>

                {uploadStatus === 'processing' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-card-foreground">
                      <span>AI creating XLSMART standard roles...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="bg-muted" />
                    <div className="text-xs text-muted-foreground text-center">
                      {uploadProgress < 30 && "Analyzing XL and SMART role catalogs..."}
                      {uploadProgress >= 30 && uploadProgress < 60 && includeIndustryStandards && "AI generating industry standards..."}
                      {uploadProgress >= 30 && uploadProgress < 60 && !includeIndustryStandards && "AI merging XL and SMART roles..."}
                      {uploadProgress >= 60 && uploadProgress < 90 && "Creating XLSMART standard roles..."}
                      {uploadProgress >= 90 && "Finalizing XLSMART catalog..."}
                    </div>
                  </div>
                )}

                {uploadStatus === 'completed' && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">XLSMART Role Catalog Created!</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      Successfully merged {mappingResults.length} roles from {includeIndustryStandards ? '3 sources (XL + SMART + AI Industry)' : '2 sources (XL + SMART)'} • Created unified XLSMART catalog • {reviewRequiredCount} mappings need review
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  {uploadStatus === 'idle' && (
                    <Button 
                      onClick={processRoleStandardization} 
                      disabled={isUploading || !xlFile || !smartFile || !fileFormat} 
                      className="xlsmart-button-primary"
                    >
                      <Zap className="mr-2 h-4 w-4" />
                      Create XLSMART Role Catalog
                    </Button>
                  )}
                  
                  {uploadStatus === 'completed' && (
                    <>
                      <Button onClick={() => setShowMappingReview(true)} className="xl-button-primary">
                        <Eye className="mr-2 h-4 w-4" />
                        Review XLSMART Catalog
                      </Button>
                      <Button variant="outline" onClick={resetUpload}>
                        Create New Catalog
                      </Button>
                    </>
                  )}
                  
                  {uploadStatus !== 'completed' && uploadStatus !== 'processing' && (
                    <Button variant="outline" onClick={resetUpload}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* AI Standardization Results */}
      {uploadStatus === 'completed' && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-card-foreground">XLSMART Role Catalog Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-2xl font-bold text-green-800">{autoMappedCount}</div>
                  <div className="text-sm text-green-700">Standard roles created</div>
                </div>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-800">{reviewRequiredCount}</div>
                  <div className="text-sm text-yellow-700">Need manual review</div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-2xl font-bold text-blue-800">{overallAccuracy}%</div>
                  <div className="text-sm text-blue-700">AI merge confidence</div>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">How XLSMART Role Creation Works:</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• AI analyzes role data from XL Axiata and SMART Telecom uploads</li>
                  {includeIndustryStandards && <li>• AI generates telecommunications industry standard roles for reference</li>}
                  <li>• Merges and reconciles overlapping roles to create unified XLSMART catalog</li>
                  <li>• Creates standardized job families, levels, and titles for telecommunications industry</li>
                  <li>• Flags roles requiring manual review when sources conflict or confidence is low</li>
                </ul>
              </div>
              
                    <Button 
                      onClick={() => {
                        setCurrentPage(1);
                        fetchMappingsForPage(1);
                        setShowMappingReview(true);
                      }} 
                      className="xl-button-primary"
                    >
                <Eye className="mr-2 h-4 w-4" />
                Review All AI Mappings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapping Review Dialog */}
      <Dialog open={showMappingReview} onOpenChange={setShowMappingReview}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-card-foreground">AI Role Mapping Review</h2>
              <p className="text-muted-foreground">Review and approve AI-generated role standardizations</p>
              <div className="mt-2 text-sm text-muted-foreground">
                Showing {mappingResults.length} of {totalMappings} total mappings
              </div>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">{autoMappedCount}</div>
                <div className="text-xs text-muted-foreground">Auto Mapped</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-600">{reviewRequiredCount}</div>
                <div className="text-xs text-muted-foreground">Need Review</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">{overallAccuracy}%</div>
                <div className="text-xs text-muted-foreground">Avg Confidence</div>
              </div>
            </div>
            
            <div className="space-y-3">
              {mappingResults.map((mapping) => (
                <Card 
                  key={mapping.id} 
                  className="border-border bg-card hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleMappingClick(mapping)}
                >
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                         <h3 className="font-semibold text-card-foreground mb-2">Original Role</h3>
                        <div className="space-y-1 text-sm">
                          <div><span className="font-medium">Title:</span> {mapping.originalTitle}</div>
                          <div><span className="font-medium">Department:</span> {mapping.originalDepartment}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-card-foreground mb-2">XLSMART Standard Role</h3>
                        <div className="space-y-1 text-sm">
                          <div><span className="font-medium">Title:</span> {mapping.standardizedTitle}</div>
                          <div><span className="font-medium">Department:</span> {mapping.standardizedDepartment}</div>
                          <div><span className="font-medium">Job Family:</span> {mapping.jobFamily}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={mapping.requiresReview ? "destructive" : "default"}>
                          AI: {mapping.confidence.toFixed(1)}% confidence
                        </Badge>
                        {mapping.status === 'approved' && (
                          <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>
                        )}
                        {mapping.status === 'rejected' && (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                        <MousePointer className="h-4 w-4 text-muted-foreground ml-2" />
                        <span className="text-xs text-muted-foreground">Click for details</span>
                      </div>
                      
                      {mapping.requiresReview && mapping.status === 'manual_review' && (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleMappingReview(mapping.id, false)}
                          >
                            <ThumbsDown className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleMappingReview(mapping.id, true)}
                            className="xl-button-primary"
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Pagination */}
            <RoleMappingPagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalMappings}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
            
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setShowMappingReview(false)}>
                Close Review
              </Button>
              <Button className="xl-button-primary">
                Generate Job Descriptions for Approved Roles
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mapping Details Dialog */}
      <Dialog open={showMappingDetails} onOpenChange={setShowMappingDetails}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          {selectedMapping && (
            <RoleMappingDetails
              mapping={selectedMapping}
              onApprove={(mappingId) => {
                handleMappingReview(mappingId, true);
                setShowMappingDetails(false);
              }}
              onReject={(mappingId) => {
                handleMappingReview(mappingId, false);
                setShowMappingDetails(false);
              }}
              onEdit={handleMappingEdit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};