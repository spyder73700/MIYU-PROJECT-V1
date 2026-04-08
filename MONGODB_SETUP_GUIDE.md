# MongoDB Connection Guide for Miyu Pharma Trekker

## ✅ What's Already Done
- Mongoose installed ✓
- MongoDB connection in server.js ✓
- .env file with MONGODB_URI ✓
- User, Purchase, Sale models ✓
- Backend routes ✓

## Step-by-Step Setup

---

### STEP 1: Install MongoDB (if not installed)

**Option A: Install MongoDB Locally**

**Windows:**
1. Download MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Install with default settings
3. MongoDB will run as a Windows service automatically

**Verify Installation:**
```bash
mongod --version
```

**Option B: Use MongoDB Atlas (Cloud - Recommended for Production)**
1. Go to https://www.mongodb.com/atlas
2. Create a free account
3. Create a new cluster (free tier available)
4. Get your connection string (looks like):
   ```
   mongodb+srv://username:password@cluster.mongodb.net/mio-pharma-trekker?retryWrites=true&w=majority
   ```
5. Replace the MONGODB_URI in your `.env` file

---

### STEP 2: Start MongoDB (if using local)

**Windows (if not running as service):**
```bash
# Create data directory first
mkdir C:\data\db

# Start MongoDB
mongod
```

**Or use MongoDB Compass (GUI):**
- Download and install MongoDB Compass
- Connect to `mongodb://localhost:27017`

---

### STEP 3: Verify Backend Dependencies

Your `backend/package.json` already has:
- mongoose ✓
- dotenv ✓

Install dependencies:
```bash
cd backend
npm install
```

---

### STEP 4: Start the Backend Server

```bash
cd backend
npm run dev
```

**You should see:**
```
MongoDB Connected
Server running on port 5000
```

If you see "MongoDB connection error", check:
1. Is MongoDB running? (step 2)
2. Is the MONGODB_URI correct in .env?

---

### STEP 5: Update Frontend to Use Real Database (NOT Demo Mode)

Currently, your frontend uses demo mode. To connect to real database:

**File: `frontend/src/contexts/AuthContext.js`**

Replace the `login` function:

```javascript
const login = async (username, password) => {
  try {
    const response = await api.post('/auth/login', { username, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      message: error.response?.data?.message || 'Login failed' 
    };
  }
};
```

Replace the `register` function:

```javascript
const register = async (username, email, password) => {
  try {
    const response = await api.post('/auth/register', { 
      username, 
      email, 
      password 
    });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setUser(user);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      message: error.response?.data?.message || 'Registration failed' 
    };
  }
};
```

Update `fetchUser` to always use API:

```javascript
const fetchUser = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    setLoading(false);
    return;
  }
  
  try {
    const response = await api.get('/auth/me');
    setUser(response.data);
  } catch (error) {
    localStorage.removeItem('token');
  }
  setLoading(false);
};
```

---

### STEP 6: Create Additional Models

Your backend needs models for Inventory and Suppliers. Create these files:

**File: `backend/models/Inventory.js`**
```javascript
const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Antibiotic', 'Antihistamine', 'Antiviral', 'Painkiller', 'Vitamin', 'Supplement', 'Syrup', 'Cream', 'Injection', 'Other']
  },
  batchNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  expiryDate: {
    type: Date,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Inventory', inventorySchema);
```

**File: `backend/models/Supplier.js`**
```javascript
const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  supplierName: {
    type: String,
    required: true,
    trim: true
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  contactNumber: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Supplier', supplierSchema);
```

---

### STEP 7: Create Backend Routes

**File: `backend/routes/inventory.js`**
```javascript
const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const auth = require('../middleware/auth');

// Get all inventory items
router.get('/', auth, async (req, res) => {
  try {
    const items = await Inventory.find({ createdBy: req.userId }).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add new inventory item
router.post('/', auth, async (req, res) => {
  try {
    const item = new Inventory({
      ...req.body,
      createdBy: req.userId
    });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update inventory item
router.put('/:id', auth, async (req, res) => {
  try {
    const item = await Inventory.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.userId },
      req.body,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete inventory item
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Inventory.findOneAndDelete({ 
      _id: req.params.id, 
      createdBy: req.userId 
    });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

**File: `backend/routes/suppliers.js`**
```javascript
const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const auth = require('../middleware/auth');

// Get all suppliers
router.get('/', auth, async (req, res) => {
  try {
    const suppliers = await Supplier.find({ createdBy: req.userId }).sort({ createdAt: -1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add new supplier
router.post('/', auth, async (req, res) => {
  try {
    const supplier = new Supplier({
      ...req.body,
      createdBy: req.userId
    });
    await supplier.save();
    res.status(201).json(supplier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update supplier
router.put('/:id', auth, async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.userId },
      req.body,
      { new: true }
    );
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete supplier
router.delete('/:id', auth, async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndDelete({ 
      _id: req.params.id, 
      createdBy: req.userId 
    });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ message: 'Supplier deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
```

---

### STEP 8: Add Routes to Server

Update `backend/server.js` to include new routes:

```javascript
// Add these lines after existing routes
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/suppliers', require('./routes/suppliers'));
```

---

### STEP 9: Check Middleware

Verify `backend/middleware/auth.js` exists:

```javascript
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token, access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is invalid' });
  }
};
```

---

### STEP 10: Update Frontend API Calls

**File: `frontend/src/utils/api.js`**

Make sure it includes the token in headers:

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

---

### STEP 11: Update Frontend Components

**For Inventory page:**
Replace localStorage calls with API calls:

```javascript
// Instead of localStorage.getItem
const response = await api.get('/inventory');
setInventory(response.data);

// Instead of localStorage.setItem
await api.post('/inventory', newItem);
```

**For Suppliers page:**
```javascript
// Instead of localStorage.getItem
const response = await api.get('/suppliers');
setSuppliers(response.data);

// Instead of localStorage.setItem
await api.post('/suppliers', newSupplier);
```

---

### STEP 12: Test Everything

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm start
   ```

3. **Test Flow:**
   - Register a new user
   - Login
   - Add a purchase
   - Add a sale
   - Check Inventory
   - Check Suppliers
   - Verify data persists after refresh

---

## 🔧 Troubleshooting

**Error: "MongoDB connection error"**
- MongoDB is not running → Start with `mongod`
- Wrong connection string → Check .env file

**Error: "Cannot POST /api/auth/login"**
- Backend not running → Start backend server
- Wrong URL → Check baseURL in api.js

**Error: "No authentication token"**
- Not logged in → Login first
- Token expired → Logout and login again

---

## 📁 Final Backend Structure

```
backend/
├── .env
├── server.js
├── middleware/
│   └── auth.js
├── models/
│   ├── User.js
│   ├── Purchase.js
│   ├── Sale.js
│   ├── Inventory.js  ← NEW
│   └── Supplier.js   ← NEW
└── routes/
    ├── auth.js
    ├── purchases.js
    ├── sales.js
    ├── dashboard.js
    ├── inventory.js  ← NEW
    └── suppliers.js  ← NEW
```

---

Would you like me to implement any of these steps now?
