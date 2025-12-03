# Finance Tracker - Quick Start (5 Minutes)

## 🎯 Your Goal
Get your Finance Tracker running in the cloud so you and your wife can access it from anywhere.

---

## ⚡ Quick Setup (Do This Now)

### 1️⃣ Enable Firebase Authentication (2 min)
```
1. Go to: https://console.firebase.google.com/
2. Select: financeapp-13f67
3. Click: Authentication (left sidebar)
4. Click: Sign-in method
5. Click: Email/Password
6. Toggle: Enable (turn it ON)
7. Click: Save
```

### 2️⃣ Create Firestore Database (2 min)
```
1. Click: Firestore Database (left sidebar)
2. Click: Create Database
3. Choose: Production mode
4. Region: us-central1
5. Click: Create
```

### 3️⃣ Update Security Rules (1 min)
```
1. In Firestore, click: Rules tab
2. Replace all text with:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/users/{userId}/transactions/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}

3. Click: Publish
```

---

## 🚀 Deploy to Vercel (3 min)

### Step 1: Go to Vercel
```
https://vercel.com
→ Sign in with GitHub
→ Click "New Project"
```

### Step 2: Select Your Repository
```
→ Find "Financetracker"
→ Click "Import"
```

### Step 3: Add Environment Variables
```
Click "Environment Variables" and add these 6 variables:

VITE_FIREBASE_API_KEY = AIzaSyBWffURf2K0vWxDv3kr8x2v1FtnnhSAjwM
VITE_FIREBASE_AUTH_DOMAIN = financeapp-13f67.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = financeapp-13f67
VITE_FIREBASE_STORAGE_BUCKET = financeapp-13f67.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 83328545198
VITE_FIREBASE_APP_ID = 1:83328545198:web:7634bc775c25574852983f
```

### Step 4: Deploy
```
→ Click "Deploy"
→ Wait 2-3 minutes
→ You'll get a URL like: https://financetracker-xxx.vercel.app
```

---

## ✅ Test It Works

1. **Visit your URL** (from Vercel)
2. **Click "Sign Up"**
3. **Enter email and password**
4. **Add a transaction**
5. **Refresh page** - data should still be there ✅

---

## 👥 Share with Your Wife

1. **Give her the Vercel URL**
2. **She clicks "Sign Up"**
3. **She uses SAME email and password as you**
4. **Both see the same data!** ✅

---

## 📱 Access from Anywhere

- **Desktop:** Visit the Vercel URL
- **Mobile:** Visit the same URL on your phone
- **Tablet:** Visit the same URL on your tablet
- **Offline:** Data syncs when online

---

## 🎯 Start Using It

1. **Add your income** (salary, side gigs, etc.)
2. **Add your expenses** (rent, groceries, etc.)
3. **Add your debts** with interest rates
4. **Follow Debt Avalanche** strategy
5. **Track your progress!**

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't log in | Make sure Email/Password is enabled in Firebase |
| Data not saving | Check you're logged in (see email at top) |
| Can't access from phone | Use the Vercel URL, not localhost |
| Deployment failed | Check all 6 environment variables are set |

---

## 📚 Need More Help?

- **SETUP_GUIDE.md** - Detailed setup instructions
- **DEPLOYMENT.md** - Deployment troubleshooting
- **FEATURES.md** - All features explained

---

## 🎉 You're Done!

Your Finance Tracker is now:
- ☁️ In the cloud
- 🔐 Secure
- 📱 Accessible from anywhere
- 👥 Shareable with family

**Enjoy tracking your finances!** 🚀

