# XLSMART HR Platform - Architecture Documentation

## Overview
XLSMART is an AI-powered HR platform built with React, TypeScript, and Supabase. This document outlines the architectural decisions, patterns, and conventions used throughout the application.

## Tech Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework with custom design system
- **Shadcn/ui** - High-quality component library
- **React Router** - Client-side routing
- **TanStack Query** - Server state management and caching
- **Recharts** - Data visualization library

### Backend
- **Supabase** - Backend-as-a-Service providing:
  - PostgreSQL database with Row Level Security (RLS)
  - Authentication and user management
  - Edge Functions for server-side logic
  - Real-time subscriptions
  - File storage

### AI Integration
- **OpenAI API** - GPT models for natural language processing
- **LiteLLM** - LLM proxy for standardized API access
- **Custom AI Functions** - Domain-specific AI operations

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base UI components (shadcn/ui)
│   ├── forms/           # Form-specific components
│   ├── charts/          # Data visualization components
│   └── layout/          # Layout-related components
├── features/            # Feature-based modules
│   ├── auth/           # Authentication feature
│   ├── employees/      # Employee management
│   ├── roles/          # Role management
│   ├── skills/         # Skills assessment
│   └── analytics/      # Analytics and reporting
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
├── pages/              # Route components
├── contexts/           # React contexts
├── types/              # TypeScript type definitions
└── integrations/       # External service integrations
    └── supabase/       # Supabase client and types
```

## Architecture Patterns

### Feature-Based Organization
- Each major feature is organized in its own directory
- Features contain their own components, hooks, types, and utilities
- Promotes modularity and maintainability

### Custom Hooks Pattern
- Business logic extracted into reusable custom hooks
- Hooks handle data fetching, state management, and side effects
- Examples: `useEmployeeAnalytics`, `useRoleManagement`, `useAIProcessing`

### Component Composition
- Small, focused components that do one thing well  
- Higher-order components for common patterns
- Render props and compound components for flexibility

### Error Boundaries and Loading States
- Consistent error handling across the application
- Loading states with skeleton components
- Toast notifications for user feedback

## Design System

### Colors and Theming
- HSL-based color system defined in `src/index.css`
- XLSMART brand colors with light/dark mode support
- Semantic color tokens (primary, secondary, accent, etc.)

### Component Variants
- Consistent component variants using `class-variance-authority`
- Button variants: primary, secondary, outline, ghost
- Card variants: default, elevated, outlined

### Typography
- Consistent font sizes and weights
- Semantic heading levels (h1-h6)
- Text color variants for hierarchy

## State Management

### Server State
- TanStack Query for server state management
- Automatic caching and background updates
- Optimistic updates for better UX

### Client State  
- React useState for local component state
- React Context for global app state (auth, theme)
- Zustand for complex client state (if needed)

### Form State
- React Hook Form for form management
- Zod for schema validation
- Custom form components with consistent styling

## Database Design

### Tables Structure
- `xlsmart_employees` - Employee data and profiles
- `xlsmart_standard_roles` - Standardized role definitions
- `xlsmart_job_descriptions` - AI-generated job descriptions
- `xlsmart_skill_assessments` - Skills analysis results
- `ai_analysis_results` - AI processing results
- `xlsmart_upload_sessions` - File upload tracking

### Row Level Security (RLS)
- All tables have RLS policies enabled
- User-based access control
- Role-based permissions (HR Manager, Super Admin, etc.)

### Relationships
- Foreign key constraints for data integrity
- Optimized queries with proper indexing
- JSONB columns for flexible data structures

## API Layer

### Edge Functions
- Serverless functions for AI processing
- OpenAI API integration
- Custom business logic
- File processing and analysis

### Function Categories
- `ai-*` - AI-powered analysis functions
- `employee-*` - Employee management functions  
- `role-*` - Role standardization functions
- `upload-*` - File upload processing

## Security

### Authentication
- Supabase Auth with email/password
- Role-based access control
- Session management with automatic refresh

### Authorization
- Row Level Security policies
- Function-level permissions
- API key management for external services

### Data Protection
- Environment variables for sensitive data
- Encrypted secrets in Supabase
- Input validation and sanitization

## Database Schema

### Core Tables Overview

The system uses PostgreSQL with the following core table categories:

#### User Management  
- **`profiles`** - User profiles with role-based access control
- Links to Supabase Auth users with role hierarchy (super_admin, hr_manager, candidate, client)

#### Employee Management
- **`xlsmart_employees`** - Core employee data with role assignment tracking
- **`employee_skills`** - Employee skill associations with proficiency levels
- **`employee_certifications`** - Professional certifications and credentials  
- **`employee_trainings`** - Training programs and completion records

#### Role Management
- **`xlsmart_standard_roles`** - Standardized role definitions and requirements
- **`xlsmart_role_mappings`** - Mapping between original and standardized roles
- **`skills_master`** - Master catalog of skills and competencies

#### Analytics & AI
- **`xlsmart_skill_assessments`** - Employee skill assessments and gap analysis
- **`xlsmart_job_descriptions`** - AI-generated job descriptions with approval workflow
- **`ai_analysis_results`** - Results from AI processing operations
- **`xlsmart_upload_sessions`** - Upload session tracking and progress monitoring

For complete database schema documentation, see **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)**.

### Database Features
- **Row Level Security**: All tables have RLS policies for secure data access
- **JSONB Storage**: Flexible JSON storage for skills, requirements, analysis results
- **Audit Trails**: Comprehensive tracking with created_at/updated_at timestamps
- **Referential Integrity**: Foreign key constraints maintain data consistency
- **Performance Optimization**: Strategic indexes for query performance

### Data Flow Architecture

```
User Interaction
       ↓
React Components
       ↓
Custom Hooks (useQuery, useMutation)
       ↓
API Layer (src/lib/api.ts)
       ↓
Supabase Client
       ↓
PostgreSQL Database
```

## Performance

### Code Splitting
- Route-based code splitting
- Lazy loading of heavy components
- Dynamic imports for optional features

### Caching Strategy
- TanStack Query for server state caching
- Browser caching for static assets
- CDN delivery for images and files

### Bundle Optimization
- Tree shaking for unused code elimination
- Asset optimization with Vite
- Gzip compression for smaller payloads

## Testing Strategy

### Unit Testing
- Jest for JavaScript testing
- React Testing Library for component testing
- Custom hook testing utilities

### Integration Testing
- API endpoint testing
- Database operation testing
- Edge function testing

### E2E Testing
- Playwright for end-to-end testing
- Critical user journey testing
- Cross-browser compatibility testing

## Development Guidelines

### Code Style
- ESLint configuration for code quality
- Prettier for code formatting
- TypeScript strict mode enabled

### Git Workflow
- Feature branch workflow
- Conventional commits
- Pull request reviews required

### Deployment
- Automatic deployment via Lovable
- Environment-based configurations
- Database migrations with Supabase

## Monitoring and Analytics

### Error Tracking
- Console error monitoring
- User feedback collection
- Performance metrics tracking

### Usage Analytics
- User interaction tracking
- Feature usage statistics
- Performance monitoring

## Scalability Considerations

### Database Scaling
- Optimized queries and indexing
- Connection pooling
- Read replicas for analytics

### Frontend Scaling
- Component lazy loading
- Virtual scrolling for large lists
- Efficient re-rendering patterns

### Backend Scaling
- Edge function optimization
- Caching strategies
- Rate limiting implementation