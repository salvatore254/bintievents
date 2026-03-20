# Frontend Deployment Configuration

This document explains how to configure and deploy the frontend separately from the backend.

---

## Overview

The frontend is now configured to:
1. Make API calls to a configurable backend URL
2. Support deployment on any static hosting service
3. Work with backend hosted on different domain
4. Support both development and production environments

---

## Key Configuration Changes

### 1. API Base URL Configuration

Frontend sets `window.API_BASE_URL` from (in order):
1. `window.API_BASE_URL` (if already set)
2. `VITE_API_URL` environment variable (for Vite projects)
3. `REACT_APP_API_URL` environment variable (for Create React App)
4. Falls back to `window.location.origin + '/api'`

Added configuration script in HTML head:
```html
<script>
  window.API_BASE_URL = window.API_BASE_URL || (
    window.location.origin + '/api'
  );
</script>
```

### 2. Fetch Calls Updated

All API calls now use:
```javascript
fetch(`${API_BASE_URL}/bookings/calculate`, { ... })
```

Instead of:
```javascript
fetch('/api/bookings/calculate', { ... })
```

This allows pointing to any backend URL.

### 3. HTML Pages Updated

Added configuration script to all pages that make API calls:
- `index.html`
- `bookings.html`
- `checkout.html`
- `contact.html`

---

## Environment Variables

### For Vercel
```
VITE_API_URL=https://your-backend-domain.com/api
```

### For Netlify
```
VITE_API_URL=https://your-backend-domain.com/api
```

### For GitHub Pages
Set in build workflow or deployment configuration

### For Local Development
Default: `http://localhost:5000/api`

---

## Deployment Platforms

### Option 1: Vercel (Recommended for Next.js/Vite)

#### Setup
1. Push code to GitHub
2. Go to vercel.com and import project
3. Select project and configure:
   - **Framework**: Other (or None if not using frameworks)
   - **Build Command**: Leave empty (static files)
   - **Install Command**: `npm install`

#### Environment Variables
1. In Vercel dashboard, go to Settings → Environment Variables
2. Add: `VITE_API_URL` = `https://your-backend.com/api`
3. Apply to: Production, Preview, Development

#### Deploy
```bash
# GitHub: Auto-deploys on push
# Or manually:
vercel --prod
```

#### Frontend URL
`https://your-project.vercel.app`

#### Update Backend
Set `FRONTEND_URL` in backend `.env`:
```env
FRONTEND_URL=https://your-project.vercel.app
```

---

### Option 2: Netlify

#### Setup
1. Push code to GitHub
2. Go to netlify.com and create new site
3. Connect GitHub repository
4. Configure Build Settings:
   - **Base directory**: (leave empty)
   - **Build command**: (leave empty - static files)
   - **Publish directory**: `public`

#### Environment Variables
1. Site settings → Build & deploy → Environment
2. Add: `VITE_API_URL` = `https://your-backend.com/api`

#### Deploy
```bash
# GitHub: Auto-deploys on push
# Or manually:
npm run deploy  # If using Netlify CLI
```

#### Frontend URL
`https://your-site.netlify.app`

#### Update Backend
Set `FRONTEND_URL` in backend `.env`:
```env
FRONTEND_URL=https://your-site.netlify.app
```

---

### Option 3: GitHub Pages

#### Setup
1. Configure repository for GitHub Pages
   - Settings → Pages → Deploy from branch
   - Select `main` branch, `/root` (or `/docs` if you use that)

#### Build & Deploy
Since this is static HTML, no build needed:

```bash
# Ensure all files in /public are committed
git add public/
git commit -m "deployment"
git push origin main
```

#### Frontend URL
`https://yourusername.github.io/repo-name`

#### Update Backend
Set `FRONTEND_URL` in backend `.env`:
```env
FRONTEND_URL=https://yourusername.github.io/repo-name
```

---

### Option 4: AWS S3 + CloudFront

#### Setup S3 Bucket
```bash
# Create bucket
aws s3 mb s3://binti-events-frontend

# Enable static website hosting
aws s3 website s3://binti-events-frontend \
  --index-document index.html \
  --error-document index.html
```

#### Upload Files
```bash
aws s3 sync public/ s3://binti-events-frontend --delete
```

#### Create CloudFront Distribution
1. AWS Console → CloudFront → Create distribution
2. Origin: Your S3 bucket
3. Default behavior:
   - Viewer protocol policy: Redirect to HTTPS
   - Cache policy: Managed-CachingDisabled

#### Frontend URL
`https://your-cloudfront-domain.cloudfront.net`

---

### Option 5: Traditional Hosting (cPanel, Shared Host)

#### Upload via FTP
1. Connect via FTP
2. Upload all files from `/public` to `public_html/` directory
3. Create `.htaccess` file (if Apache):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### Update index.html
Add API configuration before script.js loads:
```html
<script>
  // Set backend API URL for your hosting domain
  window.API_BASE_URL = 'https://api.your-domain.com/api';
</script>
```

---

## Configuration Examples

### Local Development (Frontend + Backend on same machine)
```html
<script>
  window.API_BASE_URL = 'http://localhost:5000/api';
</script>
```

### Frontend on Vercel, Backend on Heroku
```bash
# Frontend .env:
VITE_API_URL=https://binti-api.herokuapp.com/api

# Backend .env:
FRONTEND_URL=https://binti-frontend.vercel.app
```

### Frontend on Netlify, Backend on Railway
```bash
# Frontend .env:
VITE_API_URL=https://binti-api.railway.app/api

# Backend .env:
FRONTEND_URL=https://binti-frontend.netlify.app
```

---

## Testing API Connectivity

### Browser Console
Open DevTools (F12) in browser and test:
```javascript
fetch(window.API_BASE_URL + '/health')
  .then(r => r.json())
  .then(d => console.log(d))
```

### Command Line
```bash
# Test from frontend domain
curl https://your-frontend.com/bookings.html

# Test API endpoint
curl https://your-backend.com/api/health
```

---

## Troubleshooting

### API Calls Return CORS Error
**Problem**: `Access-Control-Allow-Origin` missing

**Solutions**:
1. Verify `FRONTEND_URL` is set on backend:
   ```bash
   echo $FRONTEND_URL
   ```
2. Restart backend after changing env vars
3. Check frontend is using correct API URL:
   ```javascript
   console.log(window.API_BASE_URL)
   ```

### API Calls Return 404
**Problem**: `Cannot POST /api/bookings/calculate`

**Solutions**:
1. Check backend is running: `curl https://backend.com/api/health`
2. Verify `VITE_API_URL` is set on frontend deployment
3. Check frontend console for correct API URL

### Page Refreshes Show 404
**Problem**: Direct URL access returns 404

**Solutions**:
- Vercel: Add `vercel.json` with rewrite rules ✓ (already provided)
- Netlify: Create `public/_redirects` file:
  ```
  /*    /index.html   200
  ```
- GitHub Pages: Add `.htaccess` rewrite rules
- Traditional host: Create `.htaccess` file above

### Blank Page or Styling Missing
**Problem**: Browser shows blank page or no CSS

**Solutions**:
1. Check all link paths are relative:
   - `<link rel="stylesheet" href="style.css">` ✓
   - NOT `<link rel="stylesheet" href="/style.css">` ✗
2. Verify files are being deployed (check source in DevTools)
3. Clear browser cache (Ctrl+Shift+Delete)

---

## Performance Optimization

### Enable Gzip Compression
Most modern hosts do this automatically. Verify:
```bash
curl -I https://your-frontend.com/index.html
# Look for: Content-Encoding: gzip
```

### Cache Static Assets
Add `.htaccess` (Apache):
```apache
<FilesMatch ".(jpg|jpeg|png|gif|css|js)$">
  Header set Cache-Control "max-age=31536000, public"
</FilesMatch>
```

### Minify CSS/JS
If using a build tool:
```bash
npm run build  # Creates minified files
```

---

## Security Checklist

- [ ] Use HTTPS for all connections
- [ ] Don't hardcode API URLs in code
- [ ] Use environment variables for API base URL
- [ ] Verify CORS is restricted to expected origin
- [ ] No sensitive data in frontend code
- [ ] Content Security Policy headers set
- [ ] X-Frame-Options header set (prevent clickjacking)

---

## Deployment Checklist

- [ ] All files in `/public` committed to Git
- [ ] Environment variables set on hosting platform
- [ ] Backend `FRONTEND_URL` matches deployment URL
- [ ] Frontend `VITE_API_URL` matches backend URL
- [ ] API health check returns 200
- [ ] Test booking calculation flow
- [ ] Test contact form submission
- [ ] Check browser console for errors
- [ ] Test on mobile/tablet devices
- [ ] Performance metrics acceptable (< 3s load time)

---

## Quick Deployment Reference

| Platform | Command | Config File |
|----------|---------|-------------|
| Vercel | `vercel --prod` | `vercel.json` |
| Netlify | Auto (GitHub) | `netlify.toml` |
| GitHub Pages | Auto (GitHub) | `.github/workflows/` |
| AWS S3 | `aws s3 sync` | N/A |
| Heroku | `git push heroku` | `Procfile` |

---

For complete deployment guide, see `DEPLOYMENT_GUIDE.md`
