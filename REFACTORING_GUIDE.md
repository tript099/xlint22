# Refactoring Guide

This document outlines the refactoring strategy and improvements made to create a more modular, maintainable codebase.

## Overview

The refactoring focused on:
- Extracting common patterns into reusable hooks and components
- Centralizing type definitions and constants
- Breaking down large components into smaller, focused ones
- Improving code reusability and maintainability

## New Architecture

### 1. Centralized Libraries (`src/lib/`)

#### `src/lib/types.ts`
- **Purpose**: Centralized type definitions for the entire application
- **What it contains**:
  - Common utility types (`Status`, `UploadMode`, etc.)
  - Progress tracking interfaces (`UploadProgress`, `BulkProgress`)
  - Entity types (`Employee`, `StandardizedRole`, `JobDescription`, etc.)
  - Form and UI types (`FormField`, `TableColumn`, `DialogProps`)
  - Analytics and dashboard types

#### `src/lib/constants.ts`
- **Purpose**: Application-wide constants and configuration
- **Key sections**:
  - File upload constants (`FILE_UPLOAD`)
  - AI processing settings (`AI_PROCESSING`)
  - UI configuration (`UI`, `PAGINATION`)
  - Entity defaults (`EMPLOYEE`, `ROLE`, `SKILLS`)
  - Error and success messages
  - Route definitions

#### `src/lib/validations.ts`
- **Purpose**: Zod validation schemas and utilities
- **Features**:
  - Type-safe validation schemas for all entities
  - Utility functions for validation (`validateEmployee`, `validateRole`)
  - Bulk validation functions (`validateEmployeeData`)
  - Form validation helpers

#### `src/lib/api.ts`
- **Purpose**: Type-safe API client with error handling
- **Features**:
  - Generic API methods (`get`, `create`, `update`, `delete`)
  - Entity-specific API clients (`employeeApi`, `roleApi`, etc.)
  - AI processing API (`aiApi`)
  - Upload API (`uploadApi`)
  - Consistent error handling and response types

### 2. Custom Hooks (`src/hooks/`)

#### `useProgressPolling.ts`
- **Purpose**: Handles progress polling operations
- **Usage**: Common pattern for tracking upload/processing progress
- **Features**:
  - Configurable polling intervals
  - Success/error callbacks
  - Automatic cleanup
  - Progress state management

```typescript
const { isPolling, progress, startPolling, stopPolling } = useProgressPolling();

// Start polling for a session
startPolling(sessionId, {
  endpoint: 'employee-upload-progress',
  onSuccess: (data) => console.log('Complete!', data),
  onError: (error) => console.error('Failed:', error)
});
```

#### `useFileProcessor.ts`
- **Purpose**: Handles file processing (Excel, CSV, JSON)
- **Features**:
  - File validation (size, type)
  - Multi-format parsing
  - Progress tracking
  - Error handling

```typescript
const { isProcessing, processedData, processFiles } = useFileProcessor();

// Process uploaded files
const results = await processFiles(files);
```

### 3. Common Components (`src/components/common/`)

#### `FileUploadZone.tsx`
- **Purpose**: Reusable drag & drop file upload component
- **Features**:
  - Drag and drop support
  - File type validation
  - Size limit enforcement
  - Error display

#### `ProgressCard.tsx`
- **Purpose**: Displays upload/processing progress
- **Features**:
  - Visual progress bar
  - Status indicators
  - Detailed progress metrics
  - Configurable display options

### 4. Feature-Specific Components (`src/components/upload/`)

#### `EmployeeUploadCard.tsx`
- **Purpose**: Individual upload mode card (extracted from large component)
- **Responsibilities**:
  - File selection UI
  - Upload button handling
  - Progress display

#### `SessionSelector.tsx`
- **Purpose**: Session selection for role assignment
- **Responsibilities**:
  - Session listing and selection
  - Session details display
  - Assignment trigger

## Refactoring Benefits

### 1. **Reduced Duplication**
- Progress polling logic extracted to `useProgressPolling`
- File processing logic centralized in `useFileProcessor`
- Common UI patterns in reusable components

### 2. **Improved Type Safety**
- Centralized type definitions in `src/lib/types.ts`
- Consistent interfaces across components
- Type-safe API clients and validation

### 3. **Better Maintainability**
- Smaller, focused components (vs 800+ line files)
- Clear separation of concerns
- Easier testing and debugging

### 4. **Enhanced Reusability**
- Common hooks can be used across features
- Reusable components reduce code duplication
- Consistent patterns across the application

### 5. **Standardized Error Handling**
- Centralized error messages
- Consistent API error handling
- Proper validation with user-friendly messages

## Migration Guide

### For Existing Components

1. **Import centralized types:**
```typescript
// Before
interface UploadProgress {
  total: number;
  processed: number;
  // ...
}

// After
import { UploadProgress } from '@/lib/types';
```

2. **Use constants instead of hardcoded values:**
```typescript
// Before
const maxSize = 10 * 1024 * 1024;

// After
import { FILE_UPLOAD } from '@/lib/constants';
const maxSize = FILE_UPLOAD.MAX_FILE_SIZE;
```

3. **Replace custom validation with schemas:**
```typescript
// Before
if (!email || !email.includes('@')) {
  // error handling
}

// After
import { validateEmployee } from '@/lib/validations';
const result = validateEmployee(data);
if (!result.success) {
  // handle validation errors
}
```

4. **Use API client instead of direct Supabase calls:**
```typescript
// Before
const { data, error } = await supabase.from('employees').select('*');

// After
import { employeeApi } from '@/lib/api';
const result = await employeeApi.getAll();
```

### For New Features

1. **Define types** in `src/lib/types.ts`
2. **Add constants** to `src/lib/constants.ts`
3. **Create validation schemas** in `src/lib/validations.ts`
4. **Add API methods** to `src/lib/api.ts`
5. **Extract common logic** to custom hooks
6. **Use common components** for UI patterns

## File Organization

```
src/
├── lib/
│   ├── types.ts          # Centralized type definitions
│   ├── constants.ts      # Application constants
│   ├── validations.ts    # Validation schemas
│   ├── api.ts           # API client
│   └── utils.ts         # Utility functions
├── hooks/
│   ├── useProgressPolling.ts    # Progress polling logic
│   ├── useFileProcessor.ts     # File processing logic
│   └── use-toast.ts           # Toast notifications
├── components/
│   ├── common/          # Reusable components
│   │   ├── FileUploadZone.tsx
│   │   └── ProgressCard.tsx
│   ├── upload/          # Upload-specific components
│   │   ├── EmployeeUploadCard.tsx
│   │   └── SessionSelector.tsx
│   └── ui/             # shadcn/ui components
└── pages/              # Route components
```

## Next Steps

### Recommended Further Refactoring

1. **Component Library**: Extract more common UI patterns
2. **Service Layer**: Create domain-specific services
3. **State Management**: Consider Zustand or Redux for complex state
4. **Testing**: Add unit tests for hooks and utilities
5. **Documentation**: Component Storybook documentation

### Performance Optimizations

1. **Code Splitting**: Lazy load large components
2. **Memoization**: Use React.memo for expensive components
3. **Virtual Scrolling**: For large data tables
4. **Caching**: Implement query result caching

This refactoring provides a solid foundation for scalable, maintainable code while preserving all existing functionality.