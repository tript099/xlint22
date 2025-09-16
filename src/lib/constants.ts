/**
 * Application-wide constants
 * Centralized location for all constant values used throughout the application
 */

// File Upload Constants
export const FILE_UPLOAD = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
  ],
  BATCH_SIZE: 100, // Process files in batches of 100 records
} as const;

// AI Processing Constants
export const AI_PROCESSING = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000, // 30 seconds
  CONFIDENCE_THRESHOLD: 0.7,
  BATCH_SIZE: 50,
} as const;

// UI Constants
export const UI = {
  SKELETON_DELAY: 300, // Show skeleton after 300ms
  TOAST_DURATION: 5000, // 5 seconds
  DEBOUNCE_MS: 300,
  ANIMATION_DURATION: 300,
} as const;

// Pagination Constants
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
} as const;

// Employee Management Constants
export const EMPLOYEE = {
  REQUIRED_FIELDS: [
    'employee_number',
    'first_name', 
    'last_name',
    'email',
    'current_position',
    'source_company'
  ],
  OPTIONAL_FIELDS: [
    'phone',
    'hire_date',
    'years_of_experience',
    'salary',
    'current_department',
    'current_level',
    'skills',
    'certifications',
    'performance_rating'
  ],
  STATUS_OPTIONS: ['pending', 'approved', 'rejected'] as const,
} as const;

// Role Management Constants
export const ROLE = {
  SENIORITY_LEVELS: [
    'Junior',
    'Mid-Level', 
    'Senior',
    'Lead',
    'Principal',
    'Manager',
    'Director',
    'VP',
    'C-Level'
  ],
  CATEGORIES: [
    'Engineering',
    'Product',
    'Design',
    'Marketing',
    'Sales',
    'HR',
    'Finance',
    'Operations',
    'Customer Success',
    'Legal'
  ],
  CONFIDENCE_LEVELS: {
    HIGH: 0.8,
    MEDIUM: 0.6,
    LOW: 0.4,
  },
} as const;

// Skills Constants
export const SKILLS = {
  PROFICIENCY_LEVELS: [
    { value: 1, label: 'Beginner' },
    { value: 2, label: 'Intermediate' },
    { value: 3, label: 'Advanced' },
    { value: 4, label: 'Expert' },
    { value: 5, label: 'Master' },
  ],
  CATEGORIES: [
    'Technical',
    'Leadership',
    'Communication',
    'Analytical',
    'Creative',
    'Project Management',
    'Industry Specific',
    'Soft Skills'
  ],
} as const;

// Analytics Constants
export const ANALYTICS = {
  CHART_COLORS: [
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    'hsl(var(--secondary))',
    'hsl(234, 78%, 65%)',
    'hsl(320, 65%, 65%)',
    'hsl(240, 60%, 70%)',
  ],
  REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
} as const;

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  INPUT: 'yyyy-MM-dd',
  TIMESTAMP: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  API: 'yyyy-MM-dd HH:mm:ss',
} as const;

// Currency Constants
export const CURRENCY = {
  DEFAULT: 'IDR',
  SUPPORTED: ['IDR', 'USD', 'EUR', 'SGD', 'MYR'],
  FORMATS: {
    IDR: { symbol: 'Rp', decimals: 0 },
    USD: { symbol: '$', decimals: 2 },
    EUR: { symbol: '€', decimals: 2 },
    SGD: { symbol: 'S$', decimals: 2 },
    MYR: { symbol: 'RM', decimals: 2 },
  },
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  EMPLOYEES: '/employees',
  ROLES: '/roles', 
  SKILLS: '/skills',
  JOB_DESCRIPTIONS: '/job-descriptions',
  ANALYTICS: '/analytics',
  AI_ANALYSIS: '/ai-analysis',
  UPLOAD: '/upload',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  GENERIC: 'An unexpected error occurred. Please try again.',
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
  INVALID_FILE_TYPE: 'Invalid file type. Please upload an Excel or CSV file.',
  UPLOAD_FAILED: 'File upload failed. Please try again.',
  AI_PROCESSING_FAILED: 'AI processing failed. Please try again.',
  VALIDATION_FAILED: 'Please check your input and try again.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  UPLOAD_COMPLETE: 'File uploaded successfully!',
  ROLE_ASSIGNED: 'Role assigned successfully!',
  DATA_SAVED: 'Data saved successfully!',
  ANALYSIS_COMPLETE: 'Analysis completed successfully!',
  EXPORT_COMPLETE: 'Data exported successfully!',
} as const;

// Route Paths
export const ROUTES = {
  ROOT: '/',
  LOGIN: '/',
  DASHBOARD: '/dashboard',
  EMPLOYEES: '/dashboard/employees',
  ROLES: '/dashboard/roles',
  SKILLS: '/dashboard/skills',
  JOB_DESCRIPTIONS: '/dashboard/job-descriptions',
  ANALYTICS: '/dashboard/analytics',
  WORKFORCE_ANALYTICS: '/dashboard/workforce-analytics',
  CAREER_PATHS: '/dashboard/career-paths',
  MOBILITY: '/dashboard/mobility',
  DEVELOPMENT: '/dashboard/development',
  CERTIFICATIONS: '/dashboard/certifications',
  BULK_ROLE_ASSIGNMENT: '/dashboard/bulk-role-assignment',
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  THEME: 'xlsmart-theme',
  SIDEBAR_STATE: 'xlsmart-sidebar-state',
  USER_PREFERENCES: 'xlsmart-user-preferences',
  RECENT_SEARCHES: 'xlsmart-recent-searches',
} as const;

// Feature Flags
export const FEATURES = {
  AI_SUGGESTIONS: true,
  BULK_OPERATIONS: true,
  ADVANCED_ANALYTICS: true,
  EXPORT_FUNCTIONS: true,
  REAL_TIME_UPDATES: false, // Future feature
} as const;