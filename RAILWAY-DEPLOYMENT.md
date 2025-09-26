# 🚀 Railway Deployment Guide for RealCode

This guide will help you deploy your full-stack RealCode application to Railway using Docker containers.

## 📋 Prerequisites

- [GitHub account](https://github.com) (for code hosting)
- [Railway account](https://railway.app) (free tier available)
- [Clerk account](https://clerk.dev) (for authentication)
- [MongoDB Atlas account](https://cloud.mongodb.com) (free tier available)

## 🛠️ Step 1: Prepare Your Environment Files

### 1.1 Server Environment (.env)

Create `server/.env` from the template:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with these **production values**:

```env
# =================================
# SERVER CONFIGURATION
# =================================
NODE_ENV=production
ENABLE_TERMINAL=false
DEV_MODE=false

# =================================
# DATABASE (MongoDB Atlas)
# =================================
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/realcode

# =================================
# SECURITY (IMPORTANT!)
# =================================
JWT_SECRET=your-super-secure-random-jwt-secret-here
ALLOWED_ORIGINS=https://your-client-app.railway.app
CLIENT_URL=https://your-client-app.railway.app

# =================================
# OPTIONAL: Email Configuration
# =================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="RealCode <your-email@gmail.com>"
```

### 1.2 Client Environment (.env)

Create `client/.env` from the template:

```bash
cp client/.env.example client/.env
```

Edit `client/.env`:

```env
# =================================
# CLERK AUTHENTICATION
# =================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your-actual-clerk-key
CLERK_SECRET_KEY=sk_live_your-actual-clerk-secret

# =================================
# BACKEND CONNECTION
# =================================
NEXT_PUBLIC_BACKEND_URL=https://your-server-app.railway.app
NEXT_PUBLIC_TERMINAL_WS_URL=wss://your-server-app.railway.app/terminal

# =================================
# OPTIONAL
# =================================
NEXT_TELEMETRY_DISABLED=1
```

## 🗂️ Step 2: Push to GitHub

Make sure all your changes are committed and pushed:

```bash
git add .
git commit -m "Add Railway deployment configuration"
git push origin main
```

## ☁️ Step 3: Set Up External Services

### 3.1 MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a new cluster (free tier is sufficient)
3. Create a database user
4. Add your IP address to the whitelist (or use 0.0.0.0/0 for all IPs)
5. Get your connection string: `mongodb+srv://username:password@cluster.mongodb.net/realcode`

### 3.2 Clerk Authentication Setup

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application
3. Get your API keys from the API Keys section:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

## 🚄 Step 4: Deploy to Railway

### 4.1 Create Railway Project

1. Go to [Railway](https://railway.app)
2. Click "Start a New Project"
3. Choose "Deploy from GitHub repo"
4. Select your repository
5. Railway will detect it's a multi-service project

### 4.2 Configure Server Service

1. Railway will create a "server" service automatically
2. Go to the server service settings
3. **Environment Variables** - Add these:

```env
NODE_ENV=production
ENABLE_TERMINAL=false
DEV_MODE=false
PORT=$PORT
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/realcode
JWT_SECRET=your-super-secure-random-jwt-secret-here
ALLOWED_ORIGINS=$RAILWAY_STATIC_URL
CLIENT_URL=$RAILWAY_STATIC_URL
```

4. **Custom Build Command**: `cd server && npm install`
5. **Custom Start Command**: `cd server && npm start`

### 4.3 Configure Client Service

1. Railway will create a "client" service automatically
2. Go to the client service settings
3. **Environment Variables** - Add these:

```env
NODE_ENV=production
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your-actual-clerk-key
CLERK_SECRET_KEY=sk_live_your-actual-clerk-secret
NEXT_PUBLIC_BACKEND_URL=https://server-production-xxxx.up.railway.app
NEXT_PUBLIC_TERMINAL_WS_URL=wss://server-production-xxxx.up.railway.app/terminal
NEXT_TELEMETRY_DISABLED=1
```

4. **Custom Build Command**: `cd client && npm install && npm run build`
5. **Custom Start Command**: `cd client && npm start`

### 4.4 Connect Services

1. In Railway, note the URLs of both services:
   - Server: `https://server-production-xxxx.up.railway.app`
   - Client: `https://client-production-xxxx.up.railway.app`

2. Update the client environment variables with the actual server URL
3. Update the server environment variables with the actual client URL

## 🔧 Step 5: Final Configuration

### 5.1 Update Clerk Settings

1. Go to your Clerk dashboard
2. Add your Railway client URL to:
   - **Allowed origins**
   - **Allowed redirect URLs**

### 5.2 Test Your Deployment

1. Visit your client URL: `https://client-production-xxxx.up.railway.app`
2. Test the main features:
   - User registration/login
   - Code editor functionality
   - Real-time collaboration
   - Terminal (if enabled)

## 📊 Step 6: Monitoring & Maintenance

### 6.1 Health Checks

- Server health: `https://your-server-url.railway.app/health`
- Database health: `https://your-server-url.railway.app/health/db`

### 6.2 Logs

View logs in the Railway dashboard for debugging:
- Go to your project → Select service → Logs tab

### 6.3 Environment Updates

To update environment variables:
1. Go to Railway dashboard
2. Select your service
3. Go to Variables tab
4. Add/update variables
5. Railway will automatically redeploy

## 🔒 Security Checklist

- [ ] `ENABLE_TERMINAL=false` in production
- [ ] Strong `JWT_SECRET` (use a password generator)
- [ ] Proper CORS origins configured
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Clerk production keys (not test keys)
- [ ] Environment variables properly set (no hardcoded secrets)

## 🚨 Troubleshooting

### Common Issues:

1. **Build fails**: Check build logs in Railway dashboard
2. **Services can't communicate**: Verify URLs and CORS settings
3. **Authentication fails**: Check Clerk configuration and keys
4. **Database connection fails**: Verify MongoDB connection string and IP whitelist

### Debug Commands:

```bash
# Check Railway deployment logs
railway logs

# Connect to Railway service
railway shell
```

## 💡 Tips

- Railway automatically provides SSL certificates
- Use Railway's internal networking for service-to-service communication
- Monitor your usage on Railway's free tier
- Set up custom domains in Railway settings if needed

## 🎉 Success!

Your RealCode application should now be live on Railway! 

- **Client**: `https://your-client-url.railway.app`
- **Server**: `https://your-server-url.railway.app`

Need help? Check the Railway documentation or reach out to the community.