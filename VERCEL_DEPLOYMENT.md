# 🚀 Deploy to Vercel - Complete Guide

## Prerequisites

✅ GitHub repository: https://github.com/Crypto-Papi/Financetracker  
✅ Code pushed to GitHub (in progress)  
✅ Firebase project (you'll need to create this)

---

## Step 1: Create Firebase Project (Required for Data Persistence)

### 1.1 Go to Firebase Console
Visit: https://console.firebase.google.com/

### 1.2 Create New Project
1. Click **"Add project"**
2. Enter project name: `finance-tracker` (or any name you like)
3. Click **Continue**
4. Disable Google Analytics (optional, you can enable later)
5. Click **Create project**
6. Wait for project to be created
7. Click **Continue**

### 1.3 Enable Firestore Database
1. In the left sidebar, click **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for now, we'll secure it later)
4. Click **Next**
5. Select your location (choose closest to you)
6. Click **Enable**

### 1.4 Get Firebase Configuration
1. Click the **gear icon** (⚙️) next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"**
4. Click the **Web icon** (`</>`)
5. Enter app nickname: `finance-tracker-web`
6. Click **"Register app"**
7. **COPY** the `firebaseConfig` object - you'll need this for Vercel!

It looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

**SAVE THESE VALUES!** You'll need them in Step 3.

---

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Website (Easiest)

#### 2.1 Go to Vercel
Visit: https://vercel.com/

#### 2.2 Sign Up / Sign In
- Click **"Sign Up"** or **"Log In"**
- Choose **"Continue with GitHub"**
- Authorize Vercel to access your GitHub account

#### 2.3 Import Your Repository
1. Click **"Add New..."** → **"Project"**
2. Find **"Crypto-Papi/Financetracker"** in the list
3. Click **"Import"**

#### 2.4 Configure Project
1. **Project Name**: `finance-tracker` (or keep default)
2. **Framework Preset**: Vite (should auto-detect)
3. **Root Directory**: `./` (leave as is)
4. **Build Command**: `npm run build` (should be auto-filled)
5. **Output Directory**: `dist` (should be auto-filled)

#### 2.5 Add Environment Variables (IMPORTANT!)
Click **"Environment Variables"** and add these:

| Name | Value |
|------|-------|
| `VITE_FIREBASE_API_KEY` | Your Firebase `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Your Firebase `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Your Firebase `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your Firebase `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | Your Firebase `appId` |

**Example:**
```
VITE_FIREBASE_API_KEY = AIzaSyAbc123...
VITE_FIREBASE_AUTH_DOMAIN = finance-tracker-abc123.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = finance-tracker-abc123
VITE_FIREBASE_STORAGE_BUCKET = finance-tracker-abc123.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID = 123456789012
VITE_FIREBASE_APP_ID = 1:123456789012:web:abc123def456
```

#### 2.6 Deploy!
1. Click **"Deploy"**
2. Wait 1-2 minutes for deployment
3. You'll get a URL like: `https://finance-tracker-xyz.vercel.app`

---

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? finance-tracker
# - Directory? ./
# - Override settings? No

# Add environment variables
vercel env add VITE_FIREBASE_API_KEY
vercel env add VITE_FIREBASE_AUTH_DOMAIN
vercel env add VITE_FIREBASE_PROJECT_ID
vercel env add VITE_FIREBASE_STORAGE_BUCKET
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID
vercel env add VITE_FIREBASE_APP_ID

# Deploy to production
vercel --prod
```

---

## Step 3: Update App to Use Environment Variables

I need to update your `src/App.jsx` to read Firebase config from environment variables.

**Current code:**
```javascript
if (window.__firebase_config) {
  app = initializeApp(window.__firebase_config)
  // ...
}
```

**Updated code (for Vercel):**
```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
}
```

**Would you like me to update this now?**

---

## Step 4: Secure Your Firestore Database

After deployment, update Firestore security rules:

1. Go to Firebase Console
2. Click **"Firestore Database"**
3. Click **"Rules"** tab
4. Replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. Click **"Publish"**

---

## Step 5: Test Your Deployed App

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Add a transaction
3. Refresh the page
4. **Transaction should still be there!** ✅

---

## Automatic Deployments

Every time you push to GitHub, Vercel will automatically:
- Build your app
- Deploy the new version
- Give you a preview URL

---

## Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Click **"Settings"** → **"Domains"**
3. Add your custom domain
4. Follow DNS configuration instructions

---

## Troubleshooting

### Issue: "Firebase not configured"
**Solution:** Make sure all environment variables are set in Vercel

### Issue: "Transactions not saving"
**Solution:** Check Firestore rules and Firebase config

### Issue: "Build failed"
**Solution:** Check build logs in Vercel dashboard

---

## Summary

✅ Create Firebase project  
✅ Enable Firestore  
✅ Get Firebase config  
✅ Deploy to Vercel  
✅ Add environment variables  
✅ Update security rules  
✅ Test the app  

**Your app will be live at: `https://your-app.vercel.app`**

---

## Need Help?

Let me know if you need me to:
1. Update the code to use environment variables
2. Help with Firebase setup
3. Troubleshoot any deployment issues

🚀 **Let's get your app deployed!**

