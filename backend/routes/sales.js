const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Inventory = require('../models/Inventory');
const Category = require('../models/Category');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

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

// Get all sales
router.get('/', authMiddleware, async (req, res) => {
  try {
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const sales = await Sale.find({ createdBy: { $in: accessibleUserIds } })
      .sort({ saleDate: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get categories for sales dropdown
router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const categories = await Inventory.aggregate([
      { $match: { createdBy: { $in: accessibleUserIds }, quantity: { $gt: 0 } } },
      {
        $group: {
          _id: '$category',
          medicineCount: { $addToSet: '$medicineName' },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      {
        $project: {
          category: '$_id',
          medicineCount: { $size: '$medicineCount' },
          totalQuantity: 1,
          _id: 0
        }
      },
      { $sort: { category: 1 } }
    ]);
    
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get medicines by category for sales dropdown
router.get('/medicines/:category', authMiddleware, async (req, res) => {
  try {
    const category = req.params.category;
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    
    const medicines = await Inventory.aggregate([
      { 
        $match: { 
          createdBy: { $in: accessibleUserIds }, 
          category: category,
          quantity: { $gt: 0 }
        } 
      },
      {
        $group: {
          _id: '$medicineName',
          totalQuantity: { $sum: '$quantity' },
          batchCount: { $sum: 1 }
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get suppliers for a specific medicine
router.get('/suppliers/:medicineName', authMiddleware, async (req, res) => {
  try {
    const medicineName = req.params.medicineName;
    const { category } = req.query;
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    
    const matchQuery = {
      createdBy: { $in: accessibleUserIds },
      medicineName: { $regex: new RegExp('^' + medicineName + '$', 'i') },
      quantity: { $gt: 0 }
    };
    
    if (category) {
      matchQuery.category = category;
    }
    
    const suppliers = await Inventory.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$supplier',
          totalQuantity: { $sum: '$quantity' },
          batchCount: { $sum: 1 }
        }
      },
      {
        $project: {
          supplier: '$_id',
          totalQuantity: 1,
          batchCount: 1,
          _id: 0
        }
      },
      { $sort: { supplier: 1 } }
    ]);
    
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get batches for medicine + supplier combination
router.get('/batches/:medicineName', authMiddleware, async (req, res) => {
  try {
    const medicineName = req.params.medicineName;
    const { supplier, category } = req.query;
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    
    const query = {
      createdBy: { $in: accessibleUserIds },
      medicineName: { $regex: new RegExp('^' + medicineName + '$', 'i') },
      quantity: { $gt: 0 }
    };
    
    if (supplier) {
      query.supplier = { $regex: new RegExp('^' + supplier + '$', 'i') };
    }
    if (category) {
      query.category = category;
    }
    
    const batches = await Inventory.find(query)
      .select('batchNumber quantity expiryDate supplier category _id')
      .sort({ expiryDate: 1 });
    
    res.json(batches);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new sale with batch-specific inventory deduction
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      medicineName, 
      category, 
      supplier, 
      batchNumber,
      inventoryId,
      customerName, 
      quantity, 
      unitPrice, 
      saleDate, 
      prescriptionNumber, 
      doctorName, 
      paymentMethod, 
      notes 
    } = req.body;
    
    if (!medicineName || !category || !supplier || !batchNumber || !inventoryId) {
      return res.status(400).json({ 
        message: 'Missing required fields: medicineName, category, supplier, batchNumber, inventoryId' 
      });
    }
    
    const totalAmount = quantity * unitPrice;
    
    // Find the purchase price for this medicine (most recent purchase matching batch)
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const purchase = await Purchase.findOne({ 
      createdBy: { $in: accessibleUserIds },
      medicineName: { $regex: new RegExp('^' + medicineName + '$', 'i') },
      supplier: { $regex: new RegExp('^' + supplier + '$', 'i') },
      batchNumber: { $regex: new RegExp('^' + batchNumber + '$', 'i') }
    }).sort({ purchaseDate: -1 });
    
    const purchasePrice = purchase ? purchase.unitPrice : 0;
    const profit = (unitPrice - purchasePrice) * quantity;
    
    // Find the specific inventory item by ID
    const inventoryItem = await Inventory.findOne({
      _id: inventoryId,
      createdBy: { $in: accessibleUserIds }
    });
    
    if (!inventoryItem) {
      return res.status(400).json({ message: 'Inventory item not found' });
    }
    
    // Verify all details match
    if (inventoryItem.medicineName.toLowerCase() !== medicineName.toLowerCase() ||
        inventoryItem.category.toLowerCase() !== category.toLowerCase() ||
        inventoryItem.supplier.toLowerCase() !== supplier.toLowerCase() ||
        inventoryItem.batchNumber.toLowerCase() !== batchNumber.toLowerCase()) {
      return res.status(400).json({ message: 'Inventory details do not match' });
    }
    
    if (inventoryItem.quantity < quantity) {
      return res.status(400).json({ 
        message: `Insufficient stock. Only ${inventoryItem.quantity} units available in this batch` 
      });
    }
    
    // Decrease inventory quantity from specific batch
    inventoryItem.quantity -= quantity;
    await inventoryItem.save();
    
    const sale = new Sale({
      medicineName,
      category,
      supplier,
      batchNumber,
      inventoryId,
      customerName,
      quantity,
      unitPrice,
      purchasePrice,
      profit,
      totalAmount,
      saleDate: saleDate || Date.now(),
      prescriptionNumber,
      doctorName,
      paymentMethod,
      notes,
      createdBy: req.user.userId
    });
    
    await sale.save();
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get sale by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const sale = await Sale.findOne({
      _id: req.params.id,
      createdBy: { $in: accessibleUserIds }
    });
    
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update sale
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const { medicineName, customerName, quantity, unitPrice, saleDate, prescriptionNumber, doctorName, paymentMethod, notes } = req.body;
    
    const updateData = {
      medicineName,
      customerName,
      quantity,
      unitPrice,
      saleDate,
      prescriptionNumber,
      doctorName,
      paymentMethod,
      notes
    };
    
    if (quantity && unitPrice) {
      updateData.totalAmount = quantity * unitPrice;
    }
    
    const sale = await Sale.findOneAndUpdate(
      { _id: req.params.id, createdBy: { $in: accessibleUserIds } },
      updateData,
      { new: true }
    );
    
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete sale
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const sale = await Sale.findOneAndDelete({
      _id: req.params.id,
      createdBy: { $in: accessibleUserIds }
    });
    
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
