const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Helper function to get all user IDs accessible by the current user
async function getAccessibleUserIds(userId, userRole) {
  const accessibleIds = [new mongoose.Types.ObjectId(userId)];
  
  if (['admin', 'pharmacist', 'manager'].includes(userRole)) {
    // Get all writers created by this admin
    const writers = await User.find({ 
      parentAdmin: userId,
      role: 'writer'
    }).select('_id');
    
    const writerIds = writers.map(writer => writer._id);
    accessibleIds.push(...writerIds);
  }
  
  return accessibleIds;
}

// Get all inventory items
router.get('/', auth, async (req, res) => {
  try {
    // Restrict writers from accessing inventory
    if (req.user.role === 'writer') {
      return res.status(403).json({ message: 'Writers are not allowed to access inventory' });
    }
    
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const items = await Inventory.find({ createdBy: { $in: accessibleUserIds } }).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search inventory by medicineName, category, supplier, batchNumber
router.get('/search', auth, async (req, res) => {
  try {
    // Restrict writers from accessing inventory
    if (req.user.role === 'writer') {
      return res.status(403).json({ message: 'Writers are not allowed to access inventory' });
    }
    
    const { medicineName, category, supplier, batchNumber } = req.query;
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    
    // Build query dynamically
    const query = { createdBy: { $in: accessibleUserIds } };
    
    if (medicineName) {
      query.medicineName = { $regex: new RegExp(medicineName, 'i') };
    }
    if (category) {
      query.category = { $regex: new RegExp(category, 'i') };
    }
    if (supplier) {
      query.supplier = { $regex: new RegExp(supplier, 'i') };
    }
    if (batchNumber) {
      query.batchNumber = { $regex: new RegExp(batchNumber, 'i') };
    }
    
    const items = await Inventory.find(query).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get hierarchical categories with counts
router.get('/categories', auth, async (req, res) => {
  try {
    // Restrict writers from accessing inventory
    if (req.user.role === 'writer') {
      return res.status(403).json({ message: 'Writers are not allowed to access inventory' });
    }
    
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    
    const categories = await Inventory.aggregate([
      { $match: { createdBy: { $in: accessibleUserIds } } },
      {
        $group: {
          _id: '$category',
          medicineCount: { $addToSet: '$medicineName' },
          totalQuantity: { $sum: '$quantity' },
          batchCount: { $sum: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          medicineCount: { $size: '$medicineCount' },
          totalQuantity: 1,
          batchCount: 1,
          _id: 0
        }
      },
      { $sort: { category: 1 } }
    ]);
    
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get medicines by category
router.get('/by-category/:category', auth, async (req, res) => {
  try {
    // Restrict writers from accessing inventory
    if (req.user.role === 'writer') {
      return res.status(403).json({ message: 'Writers are not allowed to access inventory' });
    }
    
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const category = req.params.category;
    
    const medicines = await Inventory.aggregate([
      { $match: { createdBy: { $in: accessibleUserIds }, category: category } },
      {
        $group: {
          _id: '$medicineName',
          totalQuantity: { $sum: '$quantity' },
          batchCount: { $sum: 1 },
          suppliers: { $addToSet: '$purchaseId' }
        }
      },
      {
        $project: {
          medicineName: '$_id',
          totalQuantity: 1,
          batchCount: 1,
          _id: 0
        }
      },
      { $sort: { medicineName: 1 } }
    ]);
    
    res.json(medicines);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get suppliers for a specific medicine
router.get('/suppliers/:medicineName', auth, async (req, res) => {
  try {
    // Restrict writers from accessing inventory
    if (req.user.role === 'writer') {
      return res.status(403).json({ message: 'Writers are not allowed to access inventory' });
    }
    
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const medicineName = req.params.medicineName;
    
    // Find inventory items for this medicine with purchase info
    const inventoryItems = await Inventory.find({
      createdBy: { $in: accessibleUserIds },
      medicineName: { $regex: new RegExp('^' + medicineName + '$', 'i') }
    });
    
    // Get purchase IDs
    const purchaseIds = inventoryItems
      .filter(item => item.purchaseId)
      .map(item => item.purchaseId);
    
    // Find purchases to get supplier info
    const purchases = await Purchase.find({
      _id: { $in: purchaseIds },
      createdBy: { $in: accessibleUserIds }
    });
    
    // Group by supplier
    const supplierMap = new Map();
    
    purchases.forEach(purchase => {
      if (!supplierMap.has(purchase.supplier)) {
        supplierMap.set(purchase.supplier, {
          supplierName: purchase.supplier,
          batchCount: 0,
          totalQuantity: 0
        });
      }
      
      const supplier = supplierMap.get(purchase.supplier);
      const relatedItems = inventoryItems.filter(item => 
        item.purchaseId && item.purchaseId.toString() === purchase._id.toString()
      );
      
      relatedItems.forEach(item => {
        supplier.batchCount += 1;
        supplier.totalQuantity += item.quantity;
      });
    });
    
    // Handle items without purchase link
    const itemsWithoutPurchase = inventoryItems.filter(item => !item.purchaseId);
    if (itemsWithoutPurchase.length > 0) {
      const totalQty = itemsWithoutPurchase.reduce((sum, item) => sum + item.quantity, 0);
      supplierMap.set('Unknown', {
        supplierName: 'Unknown',
        batchCount: itemsWithoutPurchase.length,
        totalQuantity: totalQty
      });
    }
    
    res.json(Array.from(supplierMap.values()));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get batch details for medicine + supplier combination
router.get('/details/:medicineName', auth, async (req, res) => {
  try {
    // Restrict writers from accessing inventory
    if (req.user.role === 'writer') {
      return res.status(403).json({ message: 'Writers are not allowed to access inventory' });
    }
    
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const medicineName = req.params.medicineName;
    const supplierName = req.query.supplier;
    
    // Build query
    const query = {
      createdBy: { $in: accessibleUserIds },
      medicineName: { $regex: new RegExp('^' + medicineName + '$', 'i') }
    };
    
    // Find inventory items
    let inventoryItems = await Inventory.find(query).lean();
    
    // If supplier specified, filter by purchase
    if (supplierName && supplierName !== 'Unknown') {
      const purchases = await Purchase.find({
        createdBy: { $in: accessibleUserIds },
        supplier: supplierName,
        medicineName: { $regex: new RegExp('^' + medicineName + '$', 'i') }
      });
      
      const purchaseIds = purchases.map(p => p._id.toString());
      inventoryItems = inventoryItems.filter(item => 
        item.purchaseId && purchaseIds.includes(item.purchaseId.toString())
      );
    } else if (supplierName === 'Unknown') {
      inventoryItems = inventoryItems.filter(item => !item.purchaseId);
    }
    
    // Enrich with purchase data
    const enrichedItems = await Promise.all(
      inventoryItems.map(async (item) => {
        let purchaseData = null;
        if (item.purchaseId) {
          purchaseData = await Purchase.findById(item.purchaseId).lean();
        }
        
        return {
          ...item,
          supplier: purchaseData ? purchaseData.supplier : 'Unknown',
          purchaseDate: purchaseData ? purchaseData.purchaseDate : null,
          purchasePrice: purchaseData ? purchaseData.unitPrice : 0
        };
      })
    );
    
    res.json(enrichedItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add new inventory item
router.post('/', auth, async (req, res) => {
  try {
    // Restrict writers from accessing inventory
    if (req.user.role === 'writer') {
      return res.status(403).json({ message: 'Writers are not allowed to access inventory' });
    }
    
    const item = new Inventory({
      ...req.body,
      createdBy: req.user.userId
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
    // Restrict writers from accessing inventory
    if (req.user.role === 'writer') {
      return res.status(403).json({ message: 'Writers are not allowed to access inventory' });
    }
    
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const item = await Inventory.findOneAndUpdate(
      { _id: req.params.id, createdBy: { $in: accessibleUserIds } },
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
    // Restrict writers from accessing inventory
    if (req.user.role === 'writer') {
      return res.status(403).json({ message: 'Writers are not allowed to access inventory' });
    }
    
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const item = await Inventory.findOneAndDelete({ 
      _id: req.params.id, 
      createdBy: { $in: accessibleUserIds } 
    });
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
