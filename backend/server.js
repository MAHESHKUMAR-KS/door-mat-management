const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const Razorpay = require('razorpay');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;
const jwtSecret = process.env.JWT_SECRET || 'change-me-in-production';
const googleAuthConfigured = Boolean(googleClientId && googleClientSecret && googleRedirectUri);
const googleClient = googleClientId
  ? new OAuth2Client(googleClientId, googleClientSecret || undefined, googleRedirectUri)
  : null;
const razorpayKeyId = (process.env.RAZORPAY_KEY_ID || '').trim();
const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
const mockPaymentsEnabled = String(process.env.PAYMENT_MOCK_MODE || '').trim().toLowerCase() === 'true';

if (razorpayKeyId) {
  console.log(`🔑 Razorpay Key ID loaded: ${razorpayKeyId.slice(0, 8)}... (Length: ${razorpayKeyId.length})`);
}
if (razorpayKeySecret) {
  console.log(`🔑 Razorpay Key Secret loaded: ${razorpayKeySecret.slice(0, 4)}... (Length: ${razorpayKeySecret.length})`);
}

const hasRealGatewayConfig = Boolean(razorpayKeyId && razorpayKeySecret);
const razorpay = hasRealGatewayConfig
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("❌ ERROR: MONGODB_URI is not defined in environment variables!");
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String, default: '', trim: true },
  picture: { type: String, default: '', trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  size: { type: String, required: true, trim: true },
  material: { type: String, default: '', trim: true },
  quantity: { type: Number, default: 0, min: 0 },
  image: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  sizes: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: { createdAt: true, updatedAt: true } });

const Product = mongoose.model('Product', productSchema);

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    size: { type: String, default: '' }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  email: { type: String, default: '', lowercase: true, trim: true },
  name: { type: String, default: '', trim: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  delivery: {
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    phone: { type: String, default: '' }
  },
  items: { type: [orderItemSchema], required: true, default: [] },
  totalAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  paymentMethod: {
    type: String,
    enum: ['Credit/Debit Card', 'UPI', 'Net Banking', 'Cash on Delivery'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed'],
    default: 'Pending'
  },
  paymentId: { type: String, default: '' },
  paymentOrderId: { type: String, default: '' },
  paymentSignature: { type: String, default: '' },
  paymentFailureReason: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  paidAt: { type: Date, default: null }
}, { timestamps: { createdAt: true, updatedAt: true } });

const Order = mongoose.model('Order', orderSchema);

const buildFrontendAuthRedirect = (params = {}) => {
  const target = new URL('/auth/google/callback', frontendUrl);
  const fragment = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    fragment.set(key, String(value));
  });

  return `${target.toString()}#${fragment.toString()}`;
};

const buildUsernameSeed = ({ email, name }) => {
  const normalizedName = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  const normalizedEmail = String(email || '')
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');

  return normalizedName || normalizedEmail || `user${Date.now()}`;
};

const createAuthToken = (user) => jwt.sign(
  {
    sub: String(user._id),
    username: user.username,
    role: user.role,
    email: user.email || '',
    googleId: user.googleId || ''
  },
  jwtSecret,
  { expiresIn: '7d' }
);

const createGoogleOauthState = () => jwt.sign(
  { flow: 'google-oauth' },
  jwtSecret,
  { expiresIn: '10m' }
);

const isValidGoogleOauthState = (state) => {
  try {
    const payload = jwt.verify(String(state || ''), jwtSecret);
    return payload?.flow === 'google-oauth';
  } catch {
    return false;
  }
};

const serializeAuthUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email || '',
  name: user.name || '',
  picture: user.picture || '',
  googleId: user.googleId || '',
  role: user.role,
  token: createAuthToken(user)
});

const findOrCreateGoogleUser = async ({ email, googleId, name, picture }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  let existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    if (existingUser.googleId && existingUser.googleId !== googleId) {
      throw new Error('A different Google account is already linked to this email');
    }

    existingUser.googleId = googleId;
    existingUser.email = normalizedEmail;
    if (name) existingUser.name = name;
    if (picture) existingUser.picture = picture;
    await existingUser.save();
    return existingUser;
  }

  const usernameSeed = buildUsernameSeed({ email: normalizedEmail, name });
  let usernameCandidate = usernameSeed;
  let suffix = 1;

  while (await User.findOne({ username: usernameCandidate })) {
    usernameCandidate = `${usernameSeed}${suffix}`;
    suffix += 1;
  }

  const fallbackPassword = await bcrypt.hash(`google-${googleId}-${Date.now()}`, 10);
  existingUser = await User.create({
    username: usernameCandidate,
    email: normalizedEmail,
    googleId,
    name: String(name || '').trim(),
    picture: String(picture || '').trim(),
    password: fallbackPassword,
    role: 'user'
  });

  return existingUser;
};

const verifyGoogleToken = async (idToken) => {
  if (!googleClient || !googleClientId) {
    throw new Error('Google auth is not configured on server');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: googleClientId
  });

  const payload = ticket.getPayload();
  if (!payload?.email || !payload?.sub) {
    throw new Error('Invalid Google token payload');
  }

  return {
    email: String(payload.email).toLowerCase(),
    googleId: String(payload.sub),
    name: payload.name ? String(payload.name) : '',
    picture: payload.picture ? String(payload.picture) : ''
  };
};

const PAYMENT_METHODS = {
  card: 'Credit/Debit Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  cod: 'Cash on Delivery'
};

const normalizePaymentMethod = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (PAYMENT_METHODS[key]) return PAYMENT_METHODS[key];
  const validValue = Object.values(PAYMENT_METHODS).find((entry) => entry.toLowerCase() === key);
  return validValue || null;
};

const formatAddress = (delivery) => {
  const parts = [delivery?.address, delivery?.city, delivery?.state, delivery?.pincode]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return parts.join(', ');
};

const sanitizeOrderItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      productId: String(item?.productId || item?.id || ''),
      name: String(item?.name || '').trim(),
      quantity: Number(item?.quantity || 0),
      price: Number(item?.price || 0),
      size: String(item?.size || '').trim()
    }))
    .filter((item) => item.name && item.quantity > 0 && item.price >= 0);
};

const calculateOrderTotal = (items) => {
  return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
};

const generateOrderId = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `DM-${stamp}-${random}`;
};

const validateDelivery = (delivery) => {
  if (!delivery || typeof delivery !== 'object') {
    return { ok: false, message: 'Delivery details are required' };
  }

  const requiredAddress = String(delivery.address || '').trim();
  if (!requiredAddress) {
    return { ok: false, message: 'Delivery address is required' };
  }

  const phone = String(delivery.phone || '').trim();
  if (phone && !/^\d{10}$/.test(phone)) {
    return { ok: false, message: 'Phone number must be exactly 10 digits' };
  }

  return { ok: true };
};

const buildOrderPayload = (payload = {}) => {
  const userId = String(payload.userId || payload.email || '').trim();
  const items = sanitizeOrderItems(payload.items);
  const delivery = payload.delivery || {};
  const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
  const paymentStatus = String(payload.paymentStatus || 'Pending').trim();
  const totalAmount = calculateOrderTotal(items);

  if (!userId) {
    return { ok: false, message: 'User identity is required' };
  }
  if (!items.length) {
    return { ok: false, message: 'At least one order item is required' };
  }

  const deliveryCheck = validateDelivery(delivery);
  if (!deliveryCheck.ok) {
    return deliveryCheck;
  }

  if (!paymentMethod) {
    return { ok: false, message: 'Valid payment method is required' };
  }

  if (!['Paid', 'Pending', 'Failed'].includes(paymentStatus)) {
    return { ok: false, message: 'Invalid payment status' };
  }

  return {
    ok: true,
    order: {
      orderId: generateOrderId(),
      userId,
      email: String(payload.email || '').trim().toLowerCase(),
      name: String(payload.name || '').trim(),
      phone: String(delivery.phone || payload.phone || '').trim() || 'Not provided',
      address: formatAddress(delivery),
      delivery: {
        address: String(delivery.address || '').trim(),
        city: String(delivery.city || '').trim(),
        state: String(delivery.state || '').trim(),
        pincode: String(delivery.pincode || '').trim(),
        phone: String(delivery.phone || '').trim()
      },
      items,
      totalAmount,
      currency: 'INR',
      paymentMethod,
      paymentStatus,
      paymentId: String(payload.paymentId || '').trim(),
      paymentOrderId: String(payload.paymentOrderId || '').trim(),
      paymentSignature: String(payload.paymentSignature || '').trim(),
      paymentFailureReason: String(payload.paymentFailureReason || '').trim(),
      status: 'Pending',
      paidAt: paymentStatus === 'Paid' ? new Date() : null
    }
  };
};

const verifyRazorpaySignature = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  if (!razorpayKeySecret) {
    return { ok: false, message: 'Payment verification is not configured' };
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return { ok: false, message: 'Missing payment verification fields' };
  }

  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', razorpayKeySecret)
    .update(payload)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return { ok: false, message: 'Invalid payment signature' };
  }

  return { ok: true };
};

// Initialize admin user
const initializeAdminUser = async () => {
  try {
    const existingAdmin = await User.findOne({ username: 'admin' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('gsco1234', 10);
      await User.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('✅ Admin user created: admin / gsco1234');
    }
  } catch (error) {
    console.error('Error initializing admin user:', error.message);
  }
};

// Initialize admin on startup
setTimeout(initializeAdminUser, 2000);

// Login Endpoint
// Product Management Routes
// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ success: false, message: 'Unable to fetch products' });
  }
});

// Add new product (Admin only recommended)
app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ success: true, product, message: 'Product added successfully' });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ success: false, message: 'Unable to add product' });
  }
});

// Update product
app.patch('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, product, message: 'Product updated successfully' });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Unable to update product' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Unable to delete product' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Find user by username
    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Return success with user role
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: serializeAuthUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Register Endpoint (for new user accounts)
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await User.create({
      username: username.toLowerCase(),
      password: hashedPassword,
      role: 'user'
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Google login endpoint - only works if email already exists
app.post('/api/google/login', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google token is required' });
    }

    const googleUser = await verifyGoogleToken(idToken);
    const existingUser = await findOrCreateGoogleUser(googleUser);

    return res.status(200).json({
      success: true,
      message: 'Google login successful',
      user: serializeAuthUser(existingUser)
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({ success: false, message: 'Google login failed' });
  }
});

// Google register endpoint - blocks when email already exists
app.post('/api/google/register', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Google token is required' });
    }

    const googleUser = await verifyGoogleToken(idToken);
    const newUser = await findOrCreateGoogleUser(googleUser);

    return res.status(201).json({
      success: true,
      message: 'Google registration successful',
      user: serializeAuthUser(newUser)
    });
  } catch (error) {
    console.error('Google register error:', error);
    return res.status(500).json({ success: false, message: 'Google registration failed' });
  }
});

app.get('/api/google/authorize', (req, res) => {
  if (!googleAuthConfigured || !googleClient) {
    return res.redirect(buildFrontendAuthRedirect({
      error: 'Google sign-in is not configured on the server'
    }));
  }

  const authUrl = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state: createGoogleOauthState()
  });

  return res.redirect(authUrl);
});

app.get('/api/google/callback', async (req, res) => {
  try {
    const authCode = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    const providerError = String(req.query.error || '').trim();

    if (providerError) {
      return res.redirect(buildFrontendAuthRedirect({
        error: providerError === 'access_denied'
          ? 'Google sign-in was cancelled'
          : 'Google sign-in failed'
      }));
    }

    if (!authCode || !isValidGoogleOauthState(state)) {
      return res.redirect(buildFrontendAuthRedirect({ error: 'Invalid Google authorization response' }));
    }

    const { tokens } = await googleClient.getToken(authCode);
    if (!tokens?.id_token) {
      return res.redirect(buildFrontendAuthRedirect({ error: 'Google did not return an ID token' }));
    }

    const googleUser = await verifyGoogleToken(tokens.id_token);
    const user = await findOrCreateGoogleUser(googleUser);
    const authUser = serializeAuthUser(user);

    return res.redirect(buildFrontendAuthRedirect({
      id: authUser.id,
      username: authUser.username,
      email: authUser.email,
      name: authUser.name,
      picture: authUser.picture,
      googleId: authUser.googleId,
      role: authUser.role,
      token: authUser.token
    }));
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(buildFrontendAuthRedirect({ error: 'Unable to complete Google sign-in' }));
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend server is running' });
});

// Payment config endpoint
app.get('/api/payment/config', (req, res) => {
  if (mockPaymentsEnabled) {
    return res.status(200).json({
      success: true,
      keyId: 'rzp_mock_key',
      currency: 'INR',
      mockMode: true,
      message: 'Mock payment mode is enabled'
    });
  }

  if (!hasRealGatewayConfig) {
    return res.status(200).json({
      success: false,
      message: 'Payment gateway is not configured',
      mockMode: false
    });
  }

  return res.status(200).json({
    success: true,
    keyId: razorpayKeyId,
    currency: 'INR',
    mockMode: false
  });
});

// Create Razorpay order
app.post('/api/payment/create-order', async (req, res) => {
  try {
    const amount = Number(req.body?.amount || 0);
    const receipt = String(req.body?.receipt || `order_${Date.now()}`);
    const customer = req.body?.customer || {};
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    if (mockPaymentsEnabled) {
      const fakeOrder = {
        id: `order_mock_${Date.now()}`,
        entity: 'order',
        amount: Math.round(amount * 100),
        amount_paid: 0,
        amount_due: Math.round(amount * 100),
        currency: 'INR',
        receipt,
        status: 'created',
        notes: {
          email: String(customer.email || ''),
          name: String(customer.name || ''),
          phone: String(customer.phone || ''),
          paymentMethod: String(paymentMethod || '')
        },
        created_at: Math.floor(Date.now() / 1000)
      };

      return res.status(200).json({ success: true, order: fakeOrder, mockMode: true });
    }

    if (!razorpay) {
      return res.status(500).json({ success: false, message: 'Payment gateway is not configured' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt,
      notes: {
        email: String(customer.email || ''),
        name: String(customer.name || ''),
        phone: String(customer.phone || ''),
        paymentMethod: String(paymentMethod || '')
      }
    });

    return res.status(200).json({ success: true, order: razorpayOrder, mockMode: false });
  } catch (error) {
    console.error('Create payment order error:', error);
    const detail = error?.error?.description || error?.message || 'Unable to create payment order';
    return res.status(500).json({
      success: false,
      message: `Razorpay Error: ${detail}`,
      error: error?.error || null
    });
  }
});

// Verify Razorpay payment signature
app.post('/api/payment/verify', (req, res) => {
  try {
    if (!hasRealGatewayConfig && mockPaymentsEnabled) {
      return res.status(200).json({ success: true, message: 'Mock payment verified', mockMode: true });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    const verification = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });
    if (!verification.ok) {
      return res.status(400).json({ success: false, message: verification.message });
    }

    return res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const payloadCheck = buildOrderPayload(req.body || {});
    if (!payloadCheck.ok) {
      return res.status(400).json({ success: false, message: payloadCheck.message });
    }

    const orderData = payloadCheck.order;
    if (orderData.paymentStatus === 'Paid') {
      return res.status(400).json({ success: false, message: 'Use payment confirmation endpoint for paid orders' });
    }

    const order = await Order.create(orderData);
    return res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, message: 'Unable to create order' });
  }
});

app.post('/api/orders/confirm-online', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    const allowMockConfirmation = mockPaymentsEnabled;
    if (!allowMockConfirmation) {
      const verification = verifyRazorpaySignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });
      if (!verification.ok) {
        return res.status(400).json({ success: false, message: verification.message });
      }
    }

    const payloadCheck = buildOrderPayload({
      ...(req.body || {}),
      paymentStatus: 'Paid',
      paymentId: razorpay_payment_id || `pay_mock_${Date.now()}`,
      paymentOrderId: razorpay_order_id || `order_mock_${Date.now()}`,
      paymentSignature: razorpay_signature || 'mock_signature'
    });
    if (!payloadCheck.ok) {
      return res.status(400).json({ success: false, message: payloadCheck.message });
    }

    const order = await Order.create(payloadCheck.order);
    return res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Confirm online order error:', error);
    return res.status(500).json({ success: false, message: 'Unable to confirm order payment' });
  }
});

app.get('/api/orders', async (_req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('List orders error:', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch orders' });
  }
});

app.get('/api/orders/user/:userId', async (req, res) => {
  try {
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('List user orders error:', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch user orders' });
  }
});

app.patch('/api/orders/:orderId/status', async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim();
    const nextStatus = String(req.body?.status || '').trim();
    const allowedStatus = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }
    if (!allowedStatus.includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }

    const order = await Order.findOneAndUpdate(
      { orderId },
      { status: nextStatus },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ success: false, message: 'Unable to update order status' });
  }
});

// Google config endpoint for frontend fallback
app.get('/api/google/config', (req, res) => {
  if (!googleAuthConfigured) {
    return res.status(200).json({
      success: false,
      message: 'Google OAuth credentials are not configured'
    });
  }

  return res.status(200).json({
    success: true,
    clientId: googleClientId,
    authorizeUrl: `${req.protocol}://${req.get('host')}/api/google/authorize`
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});
