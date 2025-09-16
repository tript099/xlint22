# XLSMART Developer Guide

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd xlsmart-hr-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173`

## Development Workflow

### Creating New Features

1. **Create feature branch**
   ```bash
   git checkout -b feature/new-feature-name
   ```

2. **Feature structure**
   ```
   src/features/new-feature/
   ├── components/          # Feature-specific components
   ├── hooks/              # Custom hooks for this feature
   ├── types/              # TypeScript types
   ├── utils/              # Helper functions
   └── index.ts            # Public API exports
   ```

3. **Follow naming conventions**
   - Components: PascalCase (`EmployeeCard.tsx`)
   - Hooks: camelCase starting with `use` (`useEmployeeData.ts`)
   - Utilities: camelCase (`formatEmployeeName.ts`)
   - Constants: UPPER_SNAKE_CASE (`MAX_UPLOAD_SIZE`)

### Component Development

#### Base Component Template
```tsx
import { FC } from 'react';
import { cn } from '@/lib/utils';

interface ComponentNameProps {
  className?: string;
  // Add your props here
}

export const ComponentName: FC<ComponentNameProps> = ({ 
  className,
  ...props 
}) => {
  return (
    <div className={cn("base-styles", className)}>
      {/* Component content */}
    </div>
  );
};
```

#### Custom Hook Template
```tsx
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseFeatureNameOptions {
  // Hook options
}

export const useFeatureName = (options: UseFeatureNameOptions) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch data logic
  }, []);

  return {
    data,
    loading,
    error,
    // Action functions
  };
};
```

### Database Operations

#### Using Supabase Client
```tsx
import { supabase } from '@/integrations/supabase/client';

// Query data
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', 'value');

// Insert data
const { data, error } = await supabase
  .from('table_name')
  .insert([{ column: 'value' }]);

// Update data
const { data, error } = await supabase
  .from('table_name')
  .update({ column: 'new_value' })
  .eq('id', id);
```

#### Creating Database Migrations
1. Use Lovable's migration tool or create SQL files
2. Follow naming convention: `YYYYMMDD_HHMMSS_description.sql`
3. Include rollback instructions in comments

### Edge Functions

#### Creating New Edge Function
```typescript
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Function logic here
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

### Styling Guidelines

#### Design System Usage
```tsx
// ✅ Good - Use semantic tokens
<Button variant="primary" size="lg">Click me</Button>
<Card className="xlsmart-card">Content</Card>

// ❌ Bad - Direct color usage
<button className="bg-blue-500 text-white">Click me</button>
```

#### Custom Component Styling
```tsx
// Use class-variance-authority for variants
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### Error Handling

#### Component Error Boundaries
```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({error, resetErrorBoundary}) {
  return (
    <div role="alert" className="text-center p-6">
      <h2>Something went wrong:</h2>
      <p className="text-destructive">{error.message}</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// Usage
<ErrorBoundary FallbackComponent={ErrorFallback}>
  <YourComponent />
</ErrorBoundary>
```

#### Async Error Handling
```tsx
const [error, setError] = useState<string | null>(null);

try {
  const result = await riskyOperation();
  // Handle success
} catch (err) {
  const message = err instanceof Error ? err.message : 'An error occurred';
  setError(message);
  toast({
    title: "Error",
    description: message,
    variant: "destructive",
  });
}
```

### Testing

#### Component Testing
```tsx
import { render, screen } from '@testing-library/react';
import { ComponentName } from './ComponentName';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

#### Hook Testing
```tsx
import { renderHook } from '@testing-library/react';
import { useCustomHook } from './useCustomHook';

describe('useCustomHook', () => {
  it('returns expected data', () => {
    const { result } = renderHook(() => useCustomHook());
    expect(result.current.data).toBeDefined();
  });
});
```

## Common Patterns

### Data Fetching with Loading States
```tsx
export const DataComponent = () => {
  const { data, loading, error, refetch } = useDataFetching();

  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} onRetry={refetch} />;
  if (!data) return <EmptyState />;

  return <DataDisplay data={data} />;
};
```

### Form Handling
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

export const FormComponent = () => {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    // Handle form submission
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </Form>
  );
};
```

### Modal/Dialog Pattern
```tsx
export const ActionDialog = ({ isOpen, onClose, onConfirm }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

## Performance Best Practices

### Lazy Loading
```tsx
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

export const App = () => (
  <Suspense fallback={<Skeleton />}>
    <HeavyComponent />
  </Suspense>
);
```

### Memoization
```tsx
import { memo, useMemo, useCallback } from 'react';

export const ExpensiveComponent = memo(({ data, onUpdate }) => {
  const processedData = useMemo(() => 
    data.map(item => expensiveTransform(item)), 
    [data]
  );

  const handleUpdate = useCallback((id) => {
    onUpdate(id);
  }, [onUpdate]);

  return <div>{/* Render processed data */}</div>;
});
```

## Deployment

### Environment Variables
```bash
# Development
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Production - Managed by Lovable
```

### Build Process
```bash
# Development build
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

## Troubleshooting

### Common Issues

1. **TypeScript Errors**
   - Check import paths
   - Verify type definitions
   - Update Supabase types if needed

2. **Build Failures** 
   - Clear node_modules and reinstall
   - Check for circular dependencies
   - Verify all imports exist

3. **Supabase Connection Issues**
   - Verify environment variables
   - Check RLS policies
   - Confirm API keys are correct

### Debug Tools
- React Developer Tools
- Supabase Dashboard
- Network tab for API calls
- Console logs for errors

## Code Review Checklist

- [ ] TypeScript types are properly defined
- [ ] Components are properly tested
- [ ] Error handling is implemented
- [ ] Loading states are handled
- [ ] Accessibility guidelines followed
- [ ] Performance considerations addressed
- [ ] Security best practices followed
- [ ] Documentation is updated

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Shadcn/ui Components](https://ui.shadcn.com)