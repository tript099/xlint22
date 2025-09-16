# 🚀 XLSmart Local Setup Guide

## Prerequisites ✅
- Node.js 18+ (You have v20.18.0 ✅)
- npm (You have v10.8.2 ✅)
- Git ✅
- Supabase account

## Step 1: Create Supabase Project

1. **Go to [supabase.com](https://supabase.com)** and sign in/create account
2. **Click "New Project"**
3. **Project Settings:**
   - Name: `xlsmart-hr-platform`
   - Database Password: Create a strong password (save this!)
   - Region: Choose closest to your location
4. **Wait for project creation** (2-3 minutes)

## Step 2: Get Supabase Credentials

From your Supabase dashboard:
1. **Go to Settings > API**
2. **Copy these values:**
   - Project URL: `https://[your-project-id].supabase.co`
   - Anon/Public Key: `eyJhbGci...` (long string)

## Step 3: Environment Configuration

Create a `.env` file in the project root with:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# OpenAI Configuration (for AI features)
OPENAI_API_KEY=your-openai-api-key-here

# Application Settings
VITE_APP_TITLE=XLSmart HR Platform
VITE_APP_ENVIRONMENT=development
```

## Step 4: Install Dependencies

```bash
npm install
```

## Step 5: Update Supabase Client

We need to update the hardcoded Supabase configuration to use environment variables.

## Step 6: Setup Database Schema

We'll need to run the database migrations to set up all the tables.

## Step 7: Deploy Edge Functions

Deploy all 50+ Edge Functions to your Supabase project.

## Step 8: Test the Application

```bash
npm run dev
```

---

## Next Steps After You Create Supabase Project

Once you have your Supabase project ready, provide me with:
1. Your Project URL
2. Your Anon Key

And I'll help you configure everything automatically! 🎯 