@echo off
echo 🚀 XLSmart Production Repository Setup
echo =====================================

set /p REPO_PATH="Enter path for new production repository (e.g., ..\xlsmart-production): "

echo.
echo Creating production repository directory...
mkdir "%REPO_PATH%" 2>nul
cd /d "%REPO_PATH%"

echo Initializing git repository...
git init

echo.
echo Copying essential application files...
robocopy "%~dp0src" "src" /E /XD node_modules .git dist
robocopy "%~dp0public" "public" /E
robocopy "%~dp0supabase" "supabase" /E

echo.
echo Copying configuration files...
copy "%~dp0package.json" .
copy "%~dp0package-lock.json" .
copy "%~dp0tsconfig.json" .
copy "%~dp0tsconfig.app.json" .
copy "%~dp0tsconfig.node.json" .
copy "%~dp0vite.config.ts" .
copy "%~dp0tailwind.config.ts" .
copy "%~dp0postcss.config.js" .
copy "%~dp0components.json" .
copy "%~dp0eslint.config.js" .
copy "%~dp0index.html" .

echo.
echo Copying deployment files...
copy "%~dp0Dockerfile" .
copy "%~dp0nginx.conf" .
copy "%~dp0docker-compose.yml" .
copy "%~dp0.dockerignore" .
copy "%~dp0DEPLOYMENT.md" .

echo.
echo Setting up production configurations...
copy "%~dp0.gitignore.production" ".gitignore"
copy "%~dp0README.production.md" "README.md"

echo.
echo ✅ Production repository setup complete!
echo.
echo Next steps:
echo 1. cd "%REPO_PATH%"
echo 2. git remote add origin ^<your-repo-url^>
echo 3. git add .
echo 4. git commit -m "🚀 Initial production deployment"
echo 5. git push -u origin main
echo.
echo 🎯 Then connect to Coolify and deploy!

pause
