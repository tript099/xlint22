# Contributing to XLSMART HR Platform

## Development Setup

1. **Prerequisites**
   - Node.js 18+
   - npm or yarn
   - Git

2. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd xlsmart-hr-platform
   npm install
   npm run dev
   ```

## Code Standards

### TypeScript
- Use strict TypeScript configuration
- Define proper interfaces for all data structures
- Avoid `any` types when possible

### Component Guidelines
```tsx
// ✅ Good - Proper typing and error handling
interface ComponentProps {
  data: Employee[];
  onUpdate: (id: string) => void;
  className?: string;
}

export const Component: FC<ComponentProps> = ({ data, onUpdate, className }) => {
  // Implementation
};

// ❌ Bad - No typing, unclear props
export const Component = ({ data, onUpdate, ...props }) => {
  // Implementation
};
```

### Custom Hooks
```tsx
// ✅ Good - Proper error handling and loading states
export const useEmployeeData = () => {
  const [data, setData] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Implementation with proper error handling
  
  return { data, loading, error, refetch };
};
```

### Styling Guidelines
- Use semantic design tokens from `src/index.css`
- Follow XLSMART brand guidelines
- Responsive design patterns

```tsx
// ✅ Good - Semantic tokens
<Button variant="primary" size="lg">Submit</Button>

// ❌ Bad - Direct styling
<button className="bg-blue-500 text-white px-4 py-2">Submit</button>
```

## Git Workflow

### Branch Naming
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/documentation-update` - Documentation changes
- `refactor/component-name` - Code refactoring

### Commit Messages
Follow conventional commits format:
```
type(scope): description

feat(auth): add user authentication
fix(ui): resolve button alignment issue
docs(readme): update installation instructions
refactor(hooks): simplify data fetching logic
```

### Pull Request Process
1. Create feature branch from `main`
2. Make changes following code standards
3. Test changes thoroughly
4. Update documentation if needed
5. Create PR with descriptive title and description
6. Address review feedback
7. Merge after approval

## Testing

### Unit Tests
```tsx
import { render, screen } from '@testing-library/react';
import { Component } from './Component';

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component data={mockData} />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Integration Tests
- Test API integrations
- Test database operations
- Test user workflows

## Documentation

### Code Documentation
- Document complex business logic
- Add JSDoc comments for public APIs
- Update README for major changes

### Component Documentation
```tsx
/**
 * Employee management component that displays employee data
 * and provides CRUD operations.
 * 
 * @param employees - Array of employee objects
 * @param onUpdate - Callback function when employee is updated
 * @param loading - Loading state indicator
 */
export const EmployeeManager: FC<EmployeeManagerProps> = ({ ... }) => {
  // Implementation
};
```

## Performance Guidelines

### Code Splitting
- Use React.lazy() for heavy components
- Implement route-based splitting
- Lazy load third-party libraries

### Optimization
- Use React.memo for expensive components
- Implement proper useCallback/useMemo usage
- Optimize database queries

## Security Guidelines

### Data Handling
- Validate all user inputs
- Use Zod schemas for validation
- Sanitize data before database operations

### Authentication
- Never store credentials in code
- Use environment variables for API keys
- Implement proper session management

## Deployment

### Environment Variables
- Use `.env.example` as template
- Document all required variables
- Never commit actual API keys

### Database Changes
- Use Supabase migrations for schema changes
- Test migrations on staging first
- Document breaking changes

## Code Review Checklist

- [ ] Code follows TypeScript best practices
- [ ] Components are properly typed
- [ ] Error handling is implemented
- [ ] Loading states are handled
- [ ] Tests are included
- [ ] Documentation is updated
- [ ] Performance considerations addressed
- [ ] Security guidelines followed
- [ ] Responsive design implemented
- [ ] Accessibility guidelines followed

## Common Issues

### TypeScript Errors
- Check import paths
- Verify type definitions
- Update Supabase types if needed

### Build Issues
- Clear node_modules and reinstall
- Check for circular dependencies
- Verify all imports exist

### Supabase Issues
- Check RLS policies
- Verify API keys
- Check function permissions

## Getting Help

- Review [Developer Guide](./DEVELOPER_GUIDE.md)
- Check [Architecture Documentation](./ARCHITECTURE.md)
- Create GitHub issues for bugs
- Use discussions for questions