# 🚀 XLSmart Deployment Guide for Coolify

## 📋 Prerequisites

1. **Coolify Instance**: Running Coolify v4+ instance
2. **Git Repository**: Code pushed to GitHub/GitLab/Gitea
3. **Domain**: Domain name pointed to your Coolify server
4. **Supabase Project**: Active Supabase project with deployed edge functions

## 🔧 Deployment Steps

### Step 1: Prepare Repository

Ensure these files are in your repository root:
- ✅ `Dockerfile` - Multi-stage Docker build
- ✅ `nginx.conf` - Production nginx configuration
- ✅ `docker-compose.yml` - Local development setup
- ✅ `.dockerignore` - Docker build optimization

### Step 2: Coolify Configuration

1. **Create New Resource**:
   - Go to your Coolify dashboard
   - Click "New Resource" → "Application"
   - Select "Public Repository" or connect your private repo

2. **Repository Settings**:
   ```
   Git Repository: https://github.com/yourusername/xlsmart
   Branch: main
   Build Pack: Docker
   ```

3. **Environment Variables**:
   ```bash
   # Supabase Configuration
   VITE_SUPABASE_URL=https://lmzzskcneufwglycfdov.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   
   # Application Settings
   VITE_APP_TITLE=XLSmart HR Platform
   VITE_APP_ENVIRONMENT=production
   
   # Optional Customization
   VITE_APP_COMPANY_NAME=Your Company Name
   VITE_APP_SUPPORT_EMAIL=support@yourcompany.com
   ```

4. **Port Configuration**:
   ```
   Port: 80
   Health Check: /health
   ```

5. **Domain Configuration**:
   ```
   Domain: your-domain.com
   SSL: Auto (Let's Encrypt)
   ```

### Step 3: Build Configuration

1. **Dockerfile Settings**:
   - Build Context: `/`
   - Dockerfile: `./Dockerfile`
   - Target: `production`

2. **Resource Allocation**:
   ```
   CPU: 1 core (minimum)
   Memory: 512MB (minimum)
   Storage: 2GB
   ```

### Step 4: Advanced Configuration

1. **Health Checks**:
   ```bash
   Health Check Path: /health
   Health Check Interval: 30s
   Health Check Timeout: 10s
   Health Check Retries: 3
   ```

2. **Auto-Deployment**:
   - Enable "Auto Deploy" for main branch
   - Set up webhooks for automatic deployments

### Step 5: Deploy!

1. Click "Deploy" in Coolify
2. Monitor build logs
3. Access your application at your configured domain

## 🔍 Monitoring & Troubleshooting

### Build Logs
Monitor the deployment process:
```bash
# Build stage
- Installing dependencies
- Building React application
- Creating production build

# Runtime stage
- Setting up nginx
- Copying built files
- Starting nginx server
```

### Common Issues

1. **Environment Variables Not Loading**:
   - Ensure all VITE_ prefixed variables are set
   - Check that Supabase URL/key are correct

2. **Build Failures**:
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Review build logs for specific errors

3. **Runtime Issues**:
   - Check nginx logs
   - Verify port 80 is accessible
   - Test health endpoint: `/health`

### Health Monitoring

Access these endpoints:
```
Health Check: https://your-domain.com/health
Application: https://your-domain.com/
API Status: Check Supabase dashboard
```

## 🚀 Production Optimizations

### Performance
- ✅ Gzip compression enabled
- ✅ Static asset caching (1 year)
- ✅ React Router support
- ✅ Security headers

### Security
- ✅ X-Frame-Options: SAMEORIGIN
- ✅ X-Content-Type-Options: nosniff
- ✅ X-XSS-Protection enabled
- ✅ Referrer-Policy configured

### Scalability
- Horizontal scaling ready
- Load balancer compatible
- CDN friendly static assets

## 📊 Post-Deployment Checklist

- [ ] Application loads successfully
- [ ] Login/authentication works
- [ ] Supabase connection established
- [ ] Edge functions accessible
- [ ] File uploads working
- [ ] AI features functional
- [ ] All dashboard sections load
- [ ] Mobile responsiveness verified
- [ ] SSL certificate active
- [ ] Health checks passing

## 🔄 Continuous Deployment

Set up automatic deployments:

1. **GitHub Actions** (optional):
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to Coolify
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Trigger Coolify Deploy
           run: |
             curl -X POST "${{ secrets.COOLIFY_WEBHOOK_URL }}"
   ```

2. **Coolify Webhooks**:
   - Auto-deploy on push to main
   - Manual deployment controls
   - Rollback capabilities

## 🎯 Next Steps

After successful deployment:

1. **Configure DNS**: Point your domain to Coolify server
2. **SSL Setup**: Enable Let's Encrypt SSL
3. **Monitoring**: Set up uptime monitoring
4. **Backups**: Configure automatic backups
5. **Scaling**: Monitor resource usage and scale as needed

---

**Need Help?** 
- Check Coolify documentation
- Review deployment logs
- Test locally with `docker-compose up`
- Verify Supabase edge function deployment
