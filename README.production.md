# 🎯 XLSmart HR Platform

[![Deploy with Coolify](https://img.shields.io/badge/Deploy%20with-Coolify-blue)](https://coolify.io)
[![React](https://img.shields.io/badge/React-18+-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-green)](https://supabase.com/)

> **Modern AI-Powered HR Management Platform**  
> Streamline recruitment, role management, and workforce analytics with cutting-edge AI technology.

## 🚀 **Quick Deploy to Coolify**

### **One-Click Deployment**

1. **Fork this repository**
2. **Create new app in Coolify**
3. **Connect your forked repository**
4. **Set environment variables** (see below)
5. **Deploy!** 🎉

### **Environment Variables**

```bash
# Required - Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional - Customization
VITE_APP_TITLE=XLSmart HR Platform
VITE_APP_ENVIRONMENT=production
VITE_APP_COMPANY_NAME=Your Company Name
```

## ✨ **Features**

### **🤖 AI-Powered Analytics**
- **Intelligent Role Mapping** - Automated role standardization
- **Career Path Planning** - AI-generated development pathways  
- **Skills Assessment** - Comprehensive skill gap analysis
- **Employee Mobility** - Strategic workforce planning
- **Training Intelligence** - Personalized learning recommendations

### **📊 Advanced HR Management**
- **Role Standardization** - Consistent job classification
- **Bulk Operations** - Process hundreds of employees efficiently
- **Real-time Analytics** - Live workforce insights
- **Document Generation** - Automated reports and certificates
- **Multi-user Support** - Role-based access control

### **🔒 Enterprise Security**
- **Row-Level Security** - Database-level access control
- **JWT Authentication** - Secure user sessions
- **Audit Trails** - Complete activity tracking
- **Data Encryption** - End-to-end security

## 🛠️ **Technology Stack**

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS  
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: LiteLLM (OpenAI, Anthropic, etc.)
- **Deployment**: Docker + Nginx + Coolify

## 📋 **System Requirements**

- **Node.js**: 18+ 
- **Memory**: 512MB minimum (1GB recommended)
- **Storage**: 2GB for application + database
- **Domain**: Custom domain with SSL support

## 🎯 **Quick Start**

### **Local Development**

```bash
# Clone repository
git clone <your-repo-url>
cd xlsmart

# Install dependencies  
npm install --legacy-peer-deps

# Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

### **Production Build**

```bash
# Build for production
npm run build:prod

# Preview production build
npm run preview

# Build and run with Docker
docker-compose up
```

## 🔧 **Coolify Configuration**

### **Application Settings**
- **Build Pack**: Docker
- **Port**: 80
- **Health Check**: `/health`
- **Auto Deploy**: Enabled

### **Resource Requirements**
- **CPU**: 1 core minimum
- **Memory**: 512MB minimum  
- **Storage**: 2GB
- **Network**: SSL/TLS support

## 📊 **Performance**

- **Build Time**: ~45 seconds
- **Bundle Size**: 460KB (gzipped)
- **First Load**: < 2 seconds
- **Lighthouse Score**: 95+ Performance

## 🔍 **Monitoring**

### **Health Endpoints**
- **Application**: `https://your-domain.com/`
- **Health Check**: `https://your-domain.com/health`
- **API Status**: Supabase Dashboard

### **Logs & Analytics**
- **Application Logs**: Coolify dashboard
- **Database Logs**: Supabase dashboard  
- **AI Functions**: Edge function logs

## 🚀 **Scaling**

- **Horizontal Scaling**: Multi-instance support
- **Load Balancing**: Nginx + Coolify
- **CDN Ready**: Static asset optimization
- **Database**: PostgreSQL connection pooling

## 🛡️ **Security Features**

- **Headers**: CORS, XSS, CSRF protection
- **Authentication**: Supabase Auth + JWT
- **Database**: Row-level security policies
- **Environment**: Secure variable management

## 📞 **Support**

- **Documentation**: Complete guides in `/docs`
- **Issues**: GitHub Issues for bug reports
- **Community**: Join our discussions

---

**🎉 Ready to revolutionize your HR processes with AI?**  
**Deploy XLSmart in under 5 minutes with Coolify!**

## 📄 **License**

MIT License - see LICENSE file for details.

---

*Built with ❤️ using React, TypeScript, Supabase, and AI*
