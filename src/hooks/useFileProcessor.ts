/**
 * Custom hook for file processing operations
 * Handles Excel, CSV, and JSON file parsing with validation
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FILE_UPLOAD, ERROR_MESSAGES } from '@/lib/constants';
import { ProcessedFileData } from '@/lib/types';
import * as XLSX from 'xlsx';

interface FileProcessorOptions {
  allowedTypes?: string[];
  maxFileSize?: number;
  onProgress?: (progress: number) => void;
}

export const useFileProcessor = (options: FileProcessorOptions = {}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedFileData[]>([]);
  const { toast } = useToast();

  const {
    allowedTypes = FILE_UPLOAD.ALLOWED_TYPES,
    maxFileSize = FILE_UPLOAD.MAX_FILE_SIZE,
    onProgress
  } = options;

  const validateFile = useCallback((file: File): boolean => {
    // Check file size
    if (file.size > maxFileSize) {
      toast({
        title: "File Too Large",
        description: ERROR_MESSAGES.FILE_TOO_LARGE,
        variant: "destructive"
      });
      return false;
    }

    // Check file type - convert allowedTypes array to check against file type
    const isValidType = allowedTypes.some(type => file.type === type);
    if (!isValidType) {
      toast({
        title: "Invalid File Type",
        description: ERROR_MESSAGES.INVALID_FILE_TYPE,
        variant: "destructive"
      });
      return false;
    }

    return true;
  }, [allowedTypes, maxFileSize, toast]);

  const parseExcelFile = useCallback(async (file: File): Promise<ProcessedFileData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(data, { type: 'array' });
          
          const allData: any[] = [];
          let headers: string[] = [];
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length > 1) {
              const sheetHeaders = jsonData[0] as string[];
              const rows = jsonData.slice(1) as any[][];
              
              if (headers.length === 0) {
                headers = sheetHeaders;
              }
              
              rows.forEach(row => {
                if (row.some(cell => cell !== undefined && cell !== null && cell !== '')) {
                  const rowData: any = {};
                  sheetHeaders.forEach((header, index) => {
                    if (header && row[index] !== undefined) {
                      rowData[header.toString().trim()] = row[index];
                    }
                  });
                  rowData._sourceSheet = sheetName;
                  allData.push(rowData);
                }
              });
            }
          });
          
          resolve({
            data: allData,
            fileName: file.name,
            headers,
            rowCount: allData.length
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const parseCSVFile = useCallback(async (file: File): Promise<ProcessedFileData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            resolve({
              data: [],
              fileName: file.name,
              headers: [],
              rowCount: 0
            });
            return;
          }
          
          const headers = lines[0].split(',').map(h => h.trim());
          const data = lines.slice(1).map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, index) => {
              obj[header] = values[index]?.trim() || '';
              return obj;
            }, {} as any);
          });
          
          resolve({
            data,
            fileName: file.name,
            headers,
            rowCount: data.length
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read CSV file'));
      reader.readAsText(file);
    });
  }, []);

  const parseJSONFile = useCallback(async (file: File): Promise<ProcessedFileData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const data = JSON.parse(text);
          
          if (!Array.isArray(data)) {
            reject(new Error('JSON file must contain an array of objects'));
            return;
          }
          
          const headers = data.length > 0 ? Object.keys(data[0]) : [];
          
          resolve({
            data,
            fileName: file.name,
            headers,
            rowCount: data.length
          });
        } catch (error) {
          reject(new Error('Invalid JSON format'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read JSON file'));
      reader.readAsText(file);
    });
  }, []);

  const processFiles = useCallback(async (files: FileList | File[]): Promise<ProcessedFileData[]> => {
    setIsProcessing(true);
    setProcessedData([]);
    
    try {
      const fileArray = Array.from(files);
      const results: ProcessedFileData[] = [];
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        if (!validateFile(file)) {
          continue;
        }
        
        onProgress?.(Math.round(((i + 1) / fileArray.length) * 100));
        
        let result: ProcessedFileData;
        
        if (file.type.includes('spreadsheetml') || file.type.includes('ms-excel')) {
          result = await parseExcelFile(file);
        } else if (file.type.includes('csv')) {
          result = await parseCSVFile(file);
        } else if (file.type.includes('json')) {
          result = await parseJSONFile(file);
        } else {
          throw new Error(`Unsupported file type: ${file.type}`);
        }
        
        results.push(result);
      }
      
      setProcessedData(results);
      return results;
    } catch (error: any) {
      console.error('File processing error:', error);
      toast({
        title: "Processing Failed",
        description: error.message || ERROR_MESSAGES.GENERIC,
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [validateFile, parseExcelFile, parseCSVFile, parseJSONFile, onProgress, toast]);

  const reset = useCallback(() => {
    setProcessedData([]);
    setIsProcessing(false);
  }, []);

  return {
    isProcessing,
    processedData,
    processFiles,
    reset
  };
};