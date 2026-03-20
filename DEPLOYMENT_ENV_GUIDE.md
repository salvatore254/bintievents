# Deployment Environment Variables

## Backend (Railway)

Your backend is now deployed at: **https://binti-backend-production.up.railway.app**

### In Railway Dashboard - Backend Service Settings:

Set these environment variables:

```
PORT=5000
NODE_ENV=production
SERVE_FRONTEND=false
FRONTEND_URL=<your-frontend-domain>
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_app_password
ADMIN_EMAIL=admin@bintievents.com
PESAPAL_CONSUMER_KEY=your_key
PESAPAL_CONSUMER_SECRET=your_secret
MPESA_CONSUMER_KEY=your_key
MPESA_CONSUMER_SECRET=your_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_passkey
```

**Important:** Set `FRONTEND_URL` to your frontend's actual domain once deployed.

---

## Frontend (Vercel/Netlify)

When deploying the frontend, you need to set:

```
REACT_APP_API_BASE_URL=https://binti-backend-production.up.railway.app/api
```

Or in `public/script.js`, the API will automatically use:
```javascript
window.API_BASE_URL = https://binti-backend-production.up.railway.app/api
```

---

## CORS Configuration

Backend allows requests from:
- Any origin (if FRONTEND_URL not set - good for development)
- Specific origin if FRONTEND_URL is set (good for production)

**When deploying frontend:**
1. Deploy frontend to Vercel/Netlify
2. Get the frontend URL (e.g., `binti-events.vercel.app`)
3. Update backend's `FRONTEND_URL` env var in Railway
4. Restart backend service
5. Update frontend's `REACT_APP_API_BASE_URL` to use the Railway backend URL
6. Redeploy frontend

---

## Testing the Deployment

Check that backend is running:
```
curl https://binti-backend-production.up.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-20T..."
}
```
