# Finance Tracker - Deployment Guide

## 🚀 Deploy to Vercel (Free & Easy)

### Step 1: Create Vercel Account
1. Go to https://vercel.com
2. Click "Sign Up"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your GitHub account

### Step 2: Import Your Project
1. Click "New Project"
2. Select your "Financetracker" repository
3. Click "Import"

### Step 3: Add Environment Variables
1. In the "Environment Variables" section, add:
   - `VITE_FIREBASE_API_KEY` = `AIzaSyBWffURf2K0vWxDv3kr8x2v1FtnnhSAjwM`
   - `VITE_FIREBASE_AUTH_DOMAIN` = `financeapp-13f67.firebaseapp.com`
   - `VITE_FIREBASE_PROJECT_ID` = `financeapp-13f67`
   - `VITE_FIREBASE_STORAGE_BUCKET` = `financeapp-13f67.firebasestorage.app`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` = `83328545198`
   - `VITE_FIREBASE_APP_ID` = `1:83328545198:web:7634bc775c25574852983f`

### Step 4: Deploy
1. Click "Deploy"
2. Wait 2-3 minutes for deployment to complete
3. You'll get a URL like: `https://financetracker-xxx.vercel.app`

---

## 👥 Share with Your Wife

### Option 1: Shared Account (Recommended)
1. Both use the same email/password to log in
2. All data is automatically shared
3. **Pros:** Simple, no setup needed
4. **Cons:** No individual tracking

### Option 2: Separate Accounts (Coming Soon)
- Each person has their own account
- Add a "shared workspace" feature
- Both can see and edit shared transactions

---

## 🔐 Firebase Security Rules

Your data is protected by Firebase security rules. Only authenticated users can access their own data.

To view/modify rules:
1. Go to Firebase Console
2. Select your project
3. Go to Firestore Database → Rules
4. Current rules ensure each user can only access their own data

---

## 📱 Access from Anywhere

Once deployed to Vercel:
- ✅ Access from any device (phone, tablet, laptop)
- ✅ Works offline (data syncs when online)
- ✅ No installation needed
- ✅ Just visit the URL and log in

---

## 🆘 Troubleshooting

### "Firebase config not found"
- Make sure all environment variables are set in Vercel
- Redeploy after adding variables

### "Can't log in"
- Check Firebase Authentication is enabled
- Go to Firebase Console → Authentication → Sign-in method
- Make sure "Email/Password" is enabled

### "Data not saving"
- Check browser console for errors (F12)
- Make sure you're logged in
- Check Firebase Firestore has data (Firebase Console → Firestore)

---

## 📞 Support

For issues, check:
1. Firebase Console for errors
2. Browser console (F12 → Console tab)
3. Vercel deployment logs

