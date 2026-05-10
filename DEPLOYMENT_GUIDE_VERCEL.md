# LearnTrack Hosting Guide (Vercel Domain)

This guide is the safest way to host your current project online.

## Recommended Architecture

- **Frontend (`learntrack-client`)** -> Vercel
- **Backend (`backend`)** -> Render / Railway / Fly.io (Node server)
- **Domain** managed in Vercel:
  - `www.yourdomain.com` -> frontend
  - `api.yourdomain.com` -> backend

Why this is recommended:
- Your backend is a full Express server (`backend/src/app.js`) with many routes.
- Vercel is best for frontend + serverless functions; full Node API is usually easier on Render/Railway.

---

## 1) Deploy Frontend to Vercel

1. Push code to GitHub.
2. In Vercel -> **Add New Project** -> import repo.
3. Set project root to: `learntrack/learntrack-client`
4. Build settings:
   - Framework: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
5. Add env var in Vercel:
   - `VITE_API_URL=https://api.yourdomain.com/api/v1`
6. Deploy.

Frontend already reads this in `learntrack-client/src/api/index.js`.

---

## 2) Deploy Backend (Render example)

1. In Render -> **New Web Service** -> connect repo.
2. Root directory: `learntrack/backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables:
   - `NODE_ENV=production`
   - `PORT=10000` (Render can inject; keep if needed)
   - `SUPABASE_URL=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `JWT_SECRET=...`
   - `CLIENT_ORIGIN=https://www.yourdomain.com`
6. Deploy backend.

Test backend health:
- `https://<backend-url>/api/v1/health`

---

## 3) Connect Your Vercel Domain

In Vercel dashboard:

1. Add your domain to frontend project (`www.yourdomain.com`).
2. Add subdomain `api.yourdomain.com`.
3. Point `api.yourdomain.com` DNS to your backend host target:
   - If backend provider gives CNAME, add that in Vercel DNS.
4. Wait for SSL issuance.

After DNS is live, update frontend env:
- `VITE_API_URL=https://api.yourdomain.com/api/v1`

Redeploy frontend.

---

## 4) Supabase Production Settings (Very Important)

In Supabase dashboard:

1. Authentication -> URL Configuration
   - Site URL: `https://www.yourdomain.com`
   - Additional redirect URLs (if needed):
     - `https://www.yourdomain.com/*`
     - `https://api.yourdomain.com/*` (only if required by your auth flow)
2. Ensure DB schema (`backend/src/db/ddl.sql`) is already applied in production DB.

---

## 5) CORS + Auth Checklist

Your backend CORS uses `CLIENT_ORIGIN` in `backend/src/app.js`.

Set:
- `CLIENT_ORIGIN=https://www.yourdomain.com`

If you use both root and www, either:
- force one canonical domain, or
- update CORS logic to allow both origins.

---

## 6) Pre-Launch Test Checklist

- Open frontend domain and login/register works.
- `Network` tab shows API calls going to `api.yourdomain.com`.
- `GET /api/v1/health` returns 200.
- Create course, enroll student, submit quiz attempt.
- Analytics endpoints return data.
- No CORS errors in browser console.

---

## 7) If You Want Backend Also on Vercel

Possible, but requires converting backend to serverless function style (or wrapper under `/api`).
For viva/project submission speed, use:
- frontend on Vercel
- backend on Render/Railway

This is faster and more reliable for your current codebase.

---

## 8) Common Deployment Errors and Fixes

### Error: CORS blocked
- Fix `CLIENT_ORIGIN` to exact frontend URL.

### Error: 401 everywhere
- Check `JWT_SECRET` and token flow.
- Confirm frontend `VITE_API_URL` points to correct backend.

### Error: 500 from backend
- Usually missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.

### Error: frontend works local, fails online
- Env var not set in Vercel production.
- Redeploy after adding env vars.

