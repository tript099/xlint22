/**
 * Validation schemas and utilities
 * Centralized validation logic using Zod
 */

import { z } from 'zod';
import { EMPLOYEE, FILE_UPLOAD } from './constants';

// Base validation schemas
export const emailSchema = z.string().email('Invalid email address');
export const phoneSchema = z.string().optional().refine(
  (val) => !val || /^[\+]?[1-9][\d]{0,15}$/.test(val),
  'Invalid phone number format'
);

// Employee validation schemas
export const employeeSchema = z.object({
  employee_number: z.string().min(1, 'Employee number is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: emailSchema,
  phone: phoneSchema,
  current_position: z.string().min(1, 'Current position is required'),
  source_company: z.string().min(1, 'Source company is required'),
  current_department: z.string().optional(),
  current_level: z.string().optional(),
  hire_date: z.string().optional(),
  years_of_experience: z.number().min(0).max(50).optional(),
  salary: z.number().min(0).optional(),
  currency: z.string().optional(),
  skills: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  performance_rating: z.number().min(1).max(5).optional(),
  is_active: z.boolean().default(true),
});

export const employeeUpdateSchema = employeeSchema.partial().extend({
  id: z.string().uuid(),
});

// Role validation schemas
export const roleSchema = z.object({
  role_title: z.string().min(1, 'Role title is required'),
  job_family: z.string().min(1, 'Job family is required'),
  role_level: z.string().min(1, 'Role level is required'),
  role_category: z.string().min(1, 'Role category is required'),
  department: z.string().min(1, 'Department is required'),
  standard_description: z.string().optional(),
  core_responsibilities: z.array(z.string()).default([]),
  required_skills: z.array(z.string()).default([]),
  experience_range_min: z.number().min(0).default(0),
  experience_range_max: z.number().min(0).default(50),
  education_requirements: z.array(z.string()).default([]),
  salary_grade: z.string().optional(),
  industry_alignment: z.string().default('Telecommunications'),
  keywords: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
});

export const roleUpdateSchema = roleSchema.partial().extend({
  id: z.string().uuid(),
});

// Skills validation schemas
export const skillSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  category: z.string().min(1, 'Skill category is required'),
  description: z.string().optional(),
});

export const employeeSkillSchema = z.object({
  employee_id: z.string().uuid(),
  skill_id: z.string().uuid(),
  input_level: z.number().min(1).max(5),
  ai_assessed_level: z.number().min(1).max(5).optional(),
});

// Job Description validation schemas
export const jobDescriptionSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  summary: z.string().optional(),
  responsibilities: z.array(z.string()).default([]),
  required_qualifications: z.array(z.string()).default([]),
  preferred_qualifications: z.array(z.string()).default([]),
  required_skills: z.array(z.string()).default([]),
  preferred_skills: z.array(z.string()).default([]),
  experience_level: z.string().optional(),
  education_level: z.string().optional(),
  salary_range_min: z.number().min(0).optional(),
  salary_range_max: z.number().min(0).optional(),
  currency: z.string().default('IDR'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'internship']).default('full_time'),
  location_type: z.enum(['office', 'remote', 'hybrid']).default('office'),
  status: z.enum(['draft', 'review', 'approved', 'published']).default('draft'),
  tone: z.enum(['professional', 'casual', 'innovative', 'corporate']).default('professional'),
  language: z.enum(['en', 'id']).default('id'),
});

// File upload validation schemas
export const fileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine((file) => file.size <= FILE_UPLOAD.MAX_FILE_SIZE, 'File size too large')
    .refine(
      (file) => FILE_UPLOAD.ALLOWED_TYPES.includes(file.type as any),
      'Invalid file type'
    ),
});

export const bulkUploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1, 'At least one file is required'),
  session_name: z.string().min(1, 'Session name is required'),
  upload_mode: z.enum(['upload_only', 'upload_assign']).default('upload_assign'),
});

// AI Analysis validation schemas
export const aiAnalysisSchema = z.object({
  analysis_type: z.string().min(1, 'Analysis type is required'),
  input_parameters: z.record(z.any()),
  function_name: z.string().min(1, 'Function name is required'),
});

// Search and filter validation schemas
export const searchSchema = z.object({
  query: z.string().optional(),
  filters: z.record(z.any()).optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  page_size: z.number().min(1).max(100).default(10),
});

// Authentication validation schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(8, 'Password confirmation is required'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  role: z.enum(['hr_manager', 'super_admin', 'candidate']).default('hr_manager'),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

// Form validation utilities
export const validateEmployee = (data: unknown) => {
  return employeeSchema.safeParse(data);
};

export const validateRole = (data: unknown) => {
  return roleSchema.safeParse(data);
};

export const validateJobDescription = (data: unknown) => {
  return jobDescriptionSchema.safeParse(data);
};

export const validateFileUpload = (file: File) => {
  return fileUploadSchema.safeParse({ file });
};

// Custom validation functions
export const validateRequiredFields = (
  data: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; missing: string[] } => {
  const missing = requiredFields.filter(field => 
    !data[field] || (typeof data[field] === 'string' && data[field].trim() === '')
  );
  
  return {
    valid: missing.length === 0,
    missing
  };
};

export const validateEmployeeData = (data: any[]) => {
  const results = {
    valid: [],
    invalid: [],
    errors: []
  };

  data.forEach((row, index) => {
    const validation = validateEmployee(row);
    if (validation.success) {
      results.valid.push({ ...validation.data, row_index: index });
    } else {
      results.invalid.push({ ...row, row_index: index });
      results.errors.push({
        row_index: index,
        errors: validation.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      });
    }
  });

  return results;
};

// Export types for validation schemas
export type Employee = z.infer<typeof employeeSchema>;
export type EmployeeUpdate = z.infer<typeof employeeUpdateSchema>;
export type Role = z.infer<typeof roleSchema>;
export type RoleUpdate = z.infer<typeof roleUpdateSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type EmployeeSkill = z.infer<typeof employeeSkillSchema>;
export type JobDescription = z.infer<typeof jobDescriptionSchema>; 
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type BulkUpload = z.infer<typeof bulkUploadSchema>;
export type AIAnalysis = z.infer<typeof aiAnalysisSchema>;
export type SearchParams = z.infer<typeof searchSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type SignupData = z.infer<typeof signupSchema>;