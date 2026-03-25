# 502 Error Debugging Guide: /api/bookings/calculate

**Error:** 502 Bad Gateway  
**Endpoint:** `POST /api/bookings/calculate`  
**Response Time:** 442ms  
**Status:** Backend server error / crash

---

## 🔍 Quick Diagnostics

### Step 1: Check Railway Logs
1. Go to your **Railway Dashboard**
2. Select your **Backend Service**
3. Click **Logs** tab
4. Look for errors around the timestamp of the 502 error
5. Search for:
   - `Error:` in red
   - `Cannot read property`
   - `TypeError`
   - `ReferenceError`
   - `Cannot find module`

### Step 2: Check Backend Service Status
Run this from your terminal:
```bash
curl https://binti-backend-production.up.railway.app/api/health
```

Expected response (all good):
```json
{
  "status": "ok",
  "timestamp": "2026-03-20T12:00:00Z"
}
```

If this fails or times out → **Backend is down**

---

## 🛠️ Common Causes of 502 on /bookings/calculate

### Cause 1: Missing or Undefined TransportService
**What happens:** The endpoint calls `TransportService` but it's not exported or imported correctly

**Check in backend:**
```javascript
// backend/services/TransportService.js should exist
// backend/controllers/bookingController.js should import it
const TransportService = require('../services/TransportService');
```

**Fix:** Verify the file exists and is properly imported

---

### Cause 2: Database Connection Issues
**What happens:** The endpoint tries to calculate zones or save data but DB is unavailable

**Symptoms:**
- Works locally but fails on Railway
- Error mentions `connect ECONNREFUSED`
- Error mentions `no such table`

**Check:**
1. In Railway dashboard, verify**PostgreSQL is running** (if you have a database)
2. Check connection string in `.env`
3. Verify migrations have run

---

### Cause 3: Missing Environment Variables
**What happens:** The endpoint needs an env variable that's not set

**Check these are set in Railway:**
```
PORT=5000
NODE_ENV=production
SERVE_FRONTEND=false
```

**If using TransportService:**
- May need `GOOGLE_MAPS_KEY` or similar
- May need specific zone config

---

### Cause 4: Payload Validation Error
**What happens:** Frontend sends data the endpoint doesn't expect, crashes without error handling

**What frontend sends:**
```javascript
const payload = {
  bookingFlow: "tent",
  tentConfigs: [...],
  lighting: "yes",
  transport: "no",
  location: "Nairobi",
  eventDate: "2026-04-01",
  setupTime: "10:00",
  // ... more fields
};
```

**Backend should validate:** Check if backend has input validation in `bookingValidator.js`

---

### Cause 5: Unhandled Promise Rejection
**What happens:** An async operation fails and isn't caught with `.catch()`

**Example:**
```javascript
// BAD - will crash if API fails
const data = await ZoneService.identify(location);

// GOOD - has error handling
const data = await ZoneService.identify(location).catch(err => {
  // handle error
});
```

---

## 🔧 Debugging Steps (For Backend Developer)

### 1. Add Detailed Logging
In `backend/controllers/bookingController.js`, wrap the calculate endpoint:

```javascript
router.post('/calculate', (req, res) => {
  try {
    console.log('[CALCULATE] Received payload:', JSON.stringify(req.body, null, 2));
    
    // ... existing logic ...
    
    console.log('[CALCULATE] Sending response:', { success: true, breakdown: {...}, total: 0 });
    res.json({ success: true, breakdown: {...}, total: 0 });
  } catch (error) {
    console.error('[CALCULATE] ERROR:', error.message);
    console.error('[CALCULATE] Stack:', error.stack);
    res.status(500).json({ success: false, message: error.message });
  }
});
```

### 2. Check Railway Logs for Errors
After adding logging above, trigger the error again and check **Railway Logs** for:
- `[CALCULATE]` messages
- Full error stack trace

### 3. Test Endpoint Locally
```bash
cd backend
npm start  # Runs on localhost:5000

# In another terminal:
curl -X POST http://localhost:5000/api/bookings/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "bookingFlow": "tent",
    "tentConfigs": [{"type": "stretch", "size": "10x12"}],
    "location": "Nairobi",
    "lighting": "yes",
    "transport": "no",
    "eventDate": "2026-04-01"
  }'
```

---

## 📋 Likely Issues Based on Your Setup

Given your architecture, the most likely causes are:

### **Issue 1: TransportService Not Implemented** ⚠️ 
The frontend sends `transport: yes/no` but `bookingController` might not handle dynamic transport pricing correctly.

**Solution:** Check `backend/services/TransportService.js` exists and has:
```javascript
static async calculateTransportCost(location, eventDate) {
  // Should return { cost, zone, serviceArea, zoneInfo }
}
```

### **Issue 2: Zone Identification Failure**
The `/identify-zone` endpoint might be failing, causing calculate to fail.

**Solution:** Test the zone endpoint:
```bash
curl -X POST https://binti-backend-production.up.railway.app/api/bookings/identify-zone \
  -H "Content-Type: application/json" \
  -d '{"location": "Westlands"}'
```

### **Issue 3: Missing Tent Pricing Logic**
The backend might not have pricing for the tent types the frontend sends.

**Solution:** Verify backend has pricing for:
- Stretch: KES 250/m²
- Cheese: KES 15,000
- A-frame: KES 40,000/section
- B-line: KES 30,000

---

## ✅ Action Items

**For Frontend (you):**
1. ✅ Check browser DevTools Console → Network tab → find 502 request → see what you sent
2. ✅ Note the exact payload being sent
3. ✅ Share that payload with backend developer

**For Backend Developer:**
1. Add logging to `/api/bookings/calculate`
2. Check Railway logs for error messages
3. Verify all Services are properly exported
4. Test endpoint locally before deploying
5. Add try-catch and error handling

**Quick Test:**
```bash
# Check if backend is alive
curl https://binti-backend-production.up.railway.app/api/health -v

# Check logs in Railway dashboard
```

---

## 📞 Next Steps

1. **Check Railway Logs** - Look for the actual error message (this is key!)
2. **Share the error** from logs with your backend developer
3. **Test locally** - Reproduce the error on `localhost:5000` first
4. **Add error handling** - Make sure all endpoints have try-catch blocks

The error is happening in the backend, not the frontend. The 442ms response time suggests it's processing the request but crashing partway through.
