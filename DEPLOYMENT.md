# SmartStock Enterprise - Production Deployment Guide

## 🚀 Complete Deployment in 30 Minutes

### Phase 1: Database (Supabase) - 5 minutes

#### Step 1: Create Supabase Project
1. Go to https://supabase.io
2. Click "New Project"
3. Choose region closest to your users
4. Wait for initialization (~2 min)

#### Step 2: Run SQL Scripts
1. In Supabase, go to SQL Editor
2. Create new query
3. Copy-paste from `supabase/schema.sql` → Execute
4. Copy-paste from `supabase/realtime.sql` → Execute
5. Copy-paste from `supabase/cron.sql` → Execute

#### Step 3: Get Connection String
1. Settings → Database → Connection String
2. Copy PostgreSQL connection string
3. Save for backend setup

---

### Phase 2: Backend Deployment (Vercel) - 10 minutes

#### Local Build & Test
```bash
cd backend

# Build JAR
mvn clean package

# Test locally
java -jar target/smartstock-enterprise-1.0.0.jar
# Should start on http://localhost:8080
```

#### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Choose settings as prompted
# - Project name: smartstock-enterprise
# - Framework: Other
```

#### Configure Environment Variables

In Vercel Dashboard:
1. Go to Project Settings
2. Environment Variables
3. Add these variables:

```
SPRING_DATASOURCE_URL=postgresql://[user]:[password]@[host]:5432/[db]
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=[your-password]
RAZORPAY_KEY=rzp_test_[your-test-key]
RAZORPAY_SECRET=[your-test-secret]
SERVER_PORT=8080
SPRING_JPA_HIBERNATE_DDL_AUTO=update
```

4. Redeploy: `vercel --prod`

---

### Phase 3: Frontend Deployment (Netlify) - 10 minutes

#### Option A: GitHub + Netlify (Recommended)
1. Push code to GitHub:
```bash
git init
git add .
git commit -m "SmartStock Enterprise v1.0"
git push origin main
```

2. Connect to Netlify:
   - Go to https://netlify.com
   - Click "New site from Git"
   - Select GitHub repo
   - Settings:
     - Build command: (leave empty)
     - Publish directory: `frontend`
   - Deploy

3. Update API URL in `frontend/script.js`:
```javascript
// Line ~10
const API_BASE = 'https://smartstock-enterprise.vercel.app/api';
```

4. Redeploy

#### Option B: Manual Upload
1. Go to https://netlify.com → Drag & Drop
2. Select all files from `frontend/` folder
3. Done!

---

### Phase 4: Payment Setup (Razorpay) - 5 minutes

1. Create test account at https://razorpay.com/account/test-mode
2. Get Test Key ID and Key Secret
3. Update in frontend `script.js`:

```javascript
const RAZORPAY_KEY = 'rzp_test_YOUR_TEST_KEY';
```

4. Update Vercel env vars with secret

---

## 📋 Deployment Checklist

### Database
- [ ] Supabase project created
- [ ] All SQL scripts executed
- [ ] Connection string saved
- [ ] Auto-expiry CRON running

### Backend
- [ ] JAR builds without errors
- [ ] Vercel project created
- [ ] Environment variables set
- [ ] `/api/products` responds
- [ ] API CORS enabled

### Frontend
- [ ] HTML files in deploy folder
- [ ] API_BASE URL correct
- [ ] RAZORPAY_KEY configured
- [ ] Netlify deployment works
- [ ] Mobile view responsive

### Testing
- [ ] OTP login works
- [ ] Products load
- [ ] Add to cart (test stock)
- [ ] Smart locks functional
- [ ] Razorpay modal appears
- [ ] Admin dashboard accessible

---

## 🔍 Post-Deployment Validation

### Unit Test: Products API
```bash
curl https://smartstock-enterprise.vercel.app/api/products

# Expected: JSON array of 25 products
```

### Unit Test: Smart Locks
```bash
curl -X POST https://smartstock-enterprise.vercel.app/api/cart/add \
  -H "Content-Type: application/json" \
  -d '{
    "phone":"9876543210",
    "productId":11,
    "quantity":1
  }'

# Expected: {"isLocked":true,"lockId":X,"lockExpiresAt":"..."}
```

### Integration Test: Full Flow
1. Visit https://smartstock-enterprise.netlify.app
2. Phone: 9876543210, OTP: 123456
3. Add 5 products to cart
4. Go to checkout
5. Pay with test card: 4111 1111 1111 1111
6. Verify order success

---

## ⚠️ Common Issues & Fixes

### Issue: Backend returns 500 Error
```
Solution:
1. Check database connection in logs
2. Verify Supabase IP is whitelisted
3. Check SSL certificate (add sslmode=require)
```

### Issue: Frontend blank page
```
Solution:
1. Check console (F12) for errors
2. Verify API_BASE URL matches backend
3. Check CORS is enabled in backend
```

### Issue: Razorpay modal doesn't appear
```
Solution:
1. Verify test key in script.js
2. Check browser console for JS errors
3. Verify amount > 0
```

### Issue: Locks not auto-expiring
```
Solution:
1. Verify pg_cron is enabled: SELECT * FROM cron.job;
2. Check cron logs in Supabase
3. Manually test: SELECT expire_old_locks();
```

---

## 📊 Performance Monitoring

### Supabase Monitoring
1. Dashboard → Logs
2. Monitor query performance
3. Check realtime subscriptions

### Vercel Monitoring
1. Analytics → Requests
2. Monitor error rates
3. Check function duration

---

## 🔄 Continuous Deployment

### GitHub Actions (Optional)
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy SmartStock

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        run: npx vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
      - name: Deploy Frontend
        run: npx netlify-cli deploy --prod --dir frontend
```

---

## 🛡️ Security Checklist

- [ ] HTTPS enforced (auto on Vercel/Netlify/Supabase)
- [ ] CORS configured for production domain
- [ ] Database credentials only in env vars
- [ ] Razorpay test keys only (never prod in demo)
- [ ] RLS policies enforced on Supabase
- [ ] No API keys in frontend code
- [ ] SQL injection protection (using JPA)

---

## 📈 Scaling Considerations

### When traffic increases:
1. **Supabase**: Auto-scales with plan (upgrade if needed)
2. **Vercel**: Automatically scales (no config needed)
3. **Netlify**: CDN auto-scales (static files)

### Monitor these metrics:
- Database connection pool
- API response times
- CRON job execution times
- Realtime message throughput

---

## 💾 Backup & Recovery

### Database Backup (Supabase)
1. Supabase → Backups (automatic daily)
2. Manual: pg_dump command

### Code Backup
- GitHub repo (version control)
- Vercel auto-backs up recent deployments

---

## 🚨 Monitoring & Alerts

### Set up Supabase alerts:
1. Go to Project Settings
2. Enable notifications
3. Alert on query duration, error rate

### Set up Vercel alerts:
1. Under Settings
2. Enable error tracking
3. Get email on deployment failures

---

## 🎓 Production Checklist

Before going live, verify:

1. **Functionality**
   - [ ] All 20+ endpoints tested
   - [ ] Smart locking works perfectly
   - [ ] Payment flow end-to-end tested
   - [ ] Admin dashboard accessible
   - [ ] CRON jobs running

2. **Performance**
   - [ ] API response < 500ms
   - [ ] Frontend load < 3s
   - [ ] Lock expiry < 1 second
   - [ ] Handles 100 concurrent users

3. **Security**
   - [ ] HTTPS on all pages
   - [ ] No sensitive data in logs
   - [ ] Input validation enforced
   - [ ] CORS properly configured

4. **Data**
   - [ ] Database backed up
   - [ ] Test data loaded
   - [ ] Audit logs enabled
   - [ ] Growth plan confirmed

---

## 📞 Support

- Check logs: `vercel logs`, `netlify logs`, Supabase Dashboard
- GitHub Issues: for bug reports
- Documentation: README.md

---

**Deployed! 🎉**

Your SmartStock Enterprise is now live and ready for 7-minute grocery delivery!
