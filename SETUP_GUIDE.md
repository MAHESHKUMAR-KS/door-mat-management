# MongoDB Authentication Setup Guide

This guide explains how to set up the MongoDB authentication system for the DoorMats application.

## Architecture Overview

- **Frontend**: React app with Vite (port 5173)
- **Backend**: Express.js API (port 5000)
- **Database**: MongoDB (local or cloud)

## Prerequisites

1. **Node.js** (v18+) - [Download](https://nodejs.org/)
2. **MongoDB** - Choose one:
   - **Local MongoDB**: [Download Community Server](https://www.mongodb.com/try/download/community)
   - **MongoDB Atlas** (Cloud): [Sign up at atlas.mongodb.com](https://www.mongodb.com/cloud/atlas)

## Setup Instructions

### Step 1: Install MongoDB (if using local)

**Windows:**
1. Download MongoDB Community Server from https://www.mongodb.com/try/download/community
2. Run the installer and follow the setup wizard
3. MongoDB will run as a Windows Service by default
4. Verify installation: Open terminal and run `mongod --version`

**Mac:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu):**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 3: Configure Backend

Edit `backend/.env` if you're using MongoDB Atlas:

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/doormats
PORT=5000
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback
FRONTEND_URL=http://localhost:5173
JWT_SECRET=replace-with-a-long-random-secret
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxx
```

For local MongoDB, the default `mongodb://127.0.0.1:27017/doormats` works fine.

Create `website/.env.local` for the frontend API URL:

```env
VITE_API_URL=http://localhost:5000
```

### Step 4: Configure Google OAuth in Google Cloud Console

1. Open Google Cloud Console: https://console.cloud.google.com/
2. Create or select a project for the Door Mat Store Management app.
3. Go to APIs & Services → OAuth consent screen.
4. Configure the consent screen:
  - App name: `Door Mat Store Management`
  - User support email: your Google account email
  - Add your email under test users while developing
5. Go to APIs & Services → Credentials.
6. Click `Create Credentials` → `OAuth client ID`.
7. Choose `Web application`.
8. Add these Authorized redirect URIs:
  - `http://localhost:5000/api/google/callback`
9. Add these Authorized JavaScript origins:
  - `http://localhost:5173`
  - `http://localhost:5000`
10. Copy the generated Client ID and Client Secret into `backend/.env`.

### Step 5: Install Frontend Dependencies

```bash
cd website
npm install
```

### Step 6: Run the Application

**Option A: Run Both Frontend and Backend Together**
```bash
cd website
npm run dev:all
```

**Option B: Run Separately (in different terminals)**

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd website
npm run dev
```

## Admin Account

An admin account is automatically created on first backend startup:

- **Username**: `admin`
- **Password**: `gsco1234`

Login with these credentials to access the admin dashboard.

## Login Flow

1. User enters username and password
2. Frontend sends request to backend API (`POST /api/login`)
3. Backend validates credentials against MongoDB
4. If valid:
   - Backend returns user role (`admin` or `user`)
   - Frontend stores session with role
   - User is redirected to appropriate dashboard
5. If invalid: error message is displayed

## User Registration

- Users can register with a username and password
- User profile information (name, phone, address, etc.) is collected during registration
- Passwords are hashed using bcrypt before storage
- All data is stored in MongoDB

## API Endpoints

### Login
```
POST /api/login
{
  "username": "admin",
  "password": "gsco1234"
}
```

### Register
```
POST /api/register
{
  "username": "newuser",
  "password": "password123"
}
```

### Google OAuth Start
```
GET /api/google/authorize
```

- Redirects the browser to the Google sign-in page.

### Google OAuth Callback
```
GET /api/google/callback
```

- Google redirects here with an authorization code.
- Backend exchanges the code using Client ID and Client Secret.
- Backend verifies the Google identity, creates or updates the user, issues a JWT, and redirects back to the frontend callback route.

### Google Token Login (Fallback)
```
POST /api/google/login
{
  "idToken": "google-jwt-token"
}
```

- Verifies Google token and logs in or creates the user automatically.

### Payment Config
```
GET /api/payment/config
```

Returns Razorpay key config for frontend checkout.

### Create Payment Order
```
POST /api/payment/create-order
{
  "amount": 1499,
  "receipt": "dm_1710000000",
  "customer": {
    "email": "user@example.com",
    "name": "Customer Name",
    "phone": "9876543210"
  }
}
```

### Verify Payment
```
POST /api/payment/verify
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

## Troubleshooting

### "Network error. Ensure backend is running on http://localhost:5000"
- Make sure backend server is running: `npm run dev` in the `backend` folder
- Check that port 5000 is not blocked

### MongoDB Connection Error
- **Local**: Ensure `mongod` service is running
- **Atlas**: Check connection string in `.env` and whitelist your IP

### "Attempted to assign to readonly property" Error
- This is usually a Vite/Node compatibility issue. Try clearing cache:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

## Development Notes

- Admin user is automatically created if it doesn't exist
- Sessions are stored in browser localStorage/sessionStorage
- Backend validates all credentials - frontend-only validation is just for UX

## Security Notes

⚠️ **For Production:**
- Change default admin password immediately
- Use environment variables for sensitive config
- Enable HTTPS/TLS
- Use MongoDB Atlas with IP whitelist
- Implement rate limiting on login endpoint
- Add CORS restrictions
- Rotate `JWT_SECRET` and Google OAuth secrets regularly
- Restrict Google OAuth consent screen to verified domains/users before launch

