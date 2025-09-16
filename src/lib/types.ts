/**
 * Centralized type definitions
 * All interfaces and types used across the application
 */

// Common utility types
export type Status = 'idle' | 'loading' | 'success' | 'error';
export type UploadMode = 'upload_only' | 'upload_assign';

// Progress tracking types
export interface UploadProgress {
  total: number;
  processed: number;
  assigned: number;
  errors: number;
}

export interface BulkProgress {
  total: number;
  processed: number;
  completed: number;
  errors: number;
}

// Employee related types
export interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  current_position: string;
  current_department?: string;
  current_level?: string;
  source_company: string;
  hire_date?: string;
  years_of_experience?: number;
  salary?: number;
  currency?: string;
  skills?: string[];
  certifications?: string[];
  performance_rating?: number;
  is_active?: boolean;
  uploaded_by?: string;
  created_at?: string;
  updated_at?: string;
  standard_role_id?: string;
  ai_suggested_role_id?: string;
  assigned_by?: string;
  original_role_title?: string;
  role_assignment_status?: string;
  assignment_notes?: string;
}

// Role related types
export interface StandardizedRole {
  id: string;
  role_title: string;
  job_family: string;
  role_level: string;
  role_category: string;
  department: string;
  standard_description?: string;
  core_responsibilities?: string[];
  required_skills?: string[];
  experience_range_min?: number;
  experience_range_max?: number;
  education_requirements?: string[];
  salary_grade?: string;
  industry_alignment?: string;
  keywords?: string[];
  is_active?: boolean;
  created_by?: string;
  approved_by?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface RoleMappingResult {
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

// Session types
export interface UploadSession {
  id: string;
  session_name: string;
  status: string;
  total_rows: number;
  created_at: string;
  ai_analysis?: any;
  file_names?: string[];
  temp_table_names?: string[];
  error_message?: string;
  created_by?: string;
  updated_at?: string;
}

// Skill related types
export interface Skill {
  id: string;
  name: string;
  category: string;
  description?: string;
  created_at?: string;
}

export interface EmployeeSkill {
  id: string;
  employee_id: string;
  skill_id: string;
  input_level?: number;
  ai_assessed_level?: number;
  last_assessment_date?: string;
  created_at?: string;
  updated_at?: string;
}

// Job Description types
export interface JobDescription {
  id: string;
  title: string;
  summary?: string;
  responsibilities?: string[];
  required_qualifications?: string[];
  preferred_qualifications?: string[];
  required_skills?: string[];
  preferred_skills?: string[];
  experience_level?: string;
  education_level?: string;
  salary_range_min?: number;
  salary_range_max?: number;
  currency?: string;
  employment_type?: 'full_time' | 'part_time' | 'contract' | 'internship';
  location_type?: 'office' | 'remote' | 'hybrid';
  status?: 'draft' | 'review' | 'approved' | 'published';
  tone?: 'professional' | 'casual' | 'innovative' | 'corporate';
  language?: 'en' | 'id';
  ai_generated?: boolean;
  generated_by?: string;
  reviewed_by?: string;
  approved_by?: string;
  created_at?: string;
  updated_at?: string;
  standard_role_id?: string;
  ai_prompt_used?: string;
}

// AI Analysis types
export interface AIAnalysisResult {
  id: string;
  analysis_type: string;
  function_name: string;
  input_parameters: Record<string, any>;
  analysis_result: Record<string, any>;
  status: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// Form types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'select' | 'textarea' | 'date';
  required?: boolean;
  options?: { value: string; label: string; }[];
  placeholder?: string;
  validation?: any;
}

// Table types
export interface TableColumn<T = any> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

// Dialog types
export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

// File upload types
export interface FileUploadResult {
  success: boolean;
  data?: any;
  error?: string;
  sessionId?: string;
}

export interface ProcessedFileData {
  data: any[];
  fileName: string;
  sheetName?: string;
  headers: string[];
  rowCount: number;
}

// Analytics types
export interface AnalyticsData {
  employeeCount: number;
  roleCount: number;
  skillCount: number;
  averageAccuracy: number;
  recentActivities: any[];
}

// Dashboard types
export interface DashboardCard {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'stable';
  icon?: React.ComponentType;
}

// Navigation types
export interface NavigationItem {
  title: string;
  href: string;
  icon?: React.ComponentType;
  badge?: string | number;
  children?: NavigationItem[];
}

// Search and filter types
export interface SearchFilters {
  query?: string;
  department?: string;
  role?: string;
  status?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}