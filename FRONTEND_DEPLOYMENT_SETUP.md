# Frontend Deployment Setup

## Structure for Vercel Frontend Deployment

For Option 2 (clean root), deploy to Vercel from the **root folder** but Vercel will serve from the `public/` folder.

### Vercel Configuration (Already set up in `vercel.json`)

**Key settings:**
- **Root:** `.` (root of repository)
- **Build Output:** `public/`
- **Build Command:** None (static site)
- **Environment Variable:**
  - `REACT_APP_API_BASE_URL = https://binti-backend-production.up.railway.app/api`

### Files That Matter for Frontend Deployment

Keep in repo:
```
public/                    ← All frontend files (HTML, CSS, JS, images)
vercel.json                ← Deployment config
.gitignore                 ← Git ignore patterns
README.md                  ← Documentation
backend/                   ← Keep for git history (Vercel ignores)
```

### How to Deploy to Vercel

1. **Connect GitHub to Vercel:**
   - Go to vercel.com → Import Project
   - Select your GitHub repository
   - Click "Deploy"

2. **Vercel automatically detects:**
   - Project Type: Static Site
   - Output Directory: `public/`
   - No build command needed

3. **Environment Variables (if needed):**
   - Vercel sets `REACT_APP_API_BASE_URL` automatically from `vercel.json`
   - Or set in Vercel Dashboard → Settings → Environment Variables

4. **Custom Domain (optional):**
   - Vercel Dashboard → Settings → Domains
   - Point to your domain

### Files Safe to Ignore

These will NOT affect frontend deployment:
- `backend/` - separateBackend
- `server.js` - backend only
- `package.json` - backend only (Node dependencies)
- `Procfile` - Heroku/Railway config
- `railway.json` - Railway backend config
- `test-endpoints.js` - backend testing
- `.env.example` - backend config
- `node_modules/` - backend deps
- `*_DEPLOYMENT.md` - documention
- `DATABASE_*.md` - backend docs
- `ARCHITECTURE.md` - backend reference

Vercel will ignore these automatically based on the `vercel.json` build config.

### Testing Your Frontend

After deployment, test:

1. **Health check:**
   ```
   curl https://your-vercel-domain.com
   ```

2. **API calls work:**
   - Go to booking page → Try a booking
   - Check Network tab in DevTools
   - Requests should go to `binti-backend-production.up.railway.app`

3. **Contact form:**
   - Submit a test message
   - Should POST to backend API

### Redeploy When Needed

Push changes to GitHub → Vercel auto-deploys (configured in GitHub integration)

---

## Summary of Deployment

| Service | URL | Why |
|---------|-----|-----|
| **Frontend** | `https://your-vercel-domain.com` | Static HTML/CSS/.JS served worldwide by CDN |
| **Backend API** | `https://binti-backend-production.up.railway.app` | Express.js server, handles calculations, emails, payments |
