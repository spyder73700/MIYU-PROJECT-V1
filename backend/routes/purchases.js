const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
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

// Helper function to get the correct owner ID for inventory creation
async function getInventoryOwnerId(userId, userRole) {
  if (userRole === 'writer') {
    // For writers, get their parent admin's ID
    const writer = await User.findById(userId);
    return writer.parentAdmin || userId; // Fallback to writer's own ID if no parent admin
  }
  return userId; // For admins and others, use their own ID
}

// Get all purchases
router.get('/', authMiddleware, async (req, res) => {
  try {
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const purchases = await Purchase.find({ createdBy: { $in: accessibleUserIds } })
      .sort({ purchaseDate: -1 });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new purchase
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('Backend received purchase data:', req.body);
    const { medicineName, category, supplier, quantity, unitPrice, mrp, paymentStatus, purchaseDate, expiryDate, batchNumber, notes } = req.body;
    
    console.log('Extracted medicineName:', medicineName, 'category:', category, 'supplier:', supplier);
    
    if (!medicineName || !supplier || !quantity || !unitPrice || !category || !expiryDate || !batchNumber) {
      return res.status(400).json({ message: 'Missing required fields: medicineName, supplier, quantity, unitPrice, category, expiryDate, batchNumber' });
    }
    
    const totalAmount = quantity * unitPrice;
    
    const purchase = new Purchase({
      medicineName,
      category,
      supplier,
      quantity,
      unitPrice,
      mrp: mrp || 0,
      paymentStatus: paymentStatus || 'pending',
      totalAmount,
      purchaseDate: purchaseDate || Date.now(),
      expiryDate,
      batchNumber,
      notes,
      createdBy: req.user.userId
    });
    
    console.log('Purchase object created:', purchase);
    
    await purchase.save();
    console.log('Purchase saved successfully');

    // Auto-update inventory using hierarchical structure
    try {
      console.log('=== INVENTORY UPDATE START ===');
      console.log('Input:', { category, medicineName, supplier, batchNumber, quantity, expiryDate });
      
      // Get the correct owner ID for inventory creation
      const inventoryOwnerId = await getInventoryOwnerId(req.user.userId, req.user.role);
      console.log('Inventory owner ID:', inventoryOwnerId, 'User role:', req.user.role);
      
      // Step 1: Find or create Category (case-insensitive)
      console.log('Step 1: Looking for category:', category);
      let categoryDoc = await Category.findOne({
        createdBy: inventoryOwnerId,
        name: { $regex: new RegExp('^' + category + '$', 'i') }
      });

      if (!categoryDoc) {
        console.log('Category NOT found, creating new:', category);
        categoryDoc = new Category({
          name: category,
          createdBy: inventoryOwnerId,
          medicines: []
        });
      } else {
        console.log('Category FOUND:', categoryDoc.name);
        console.log('Current medicines in category:', categoryDoc.medicines.map(m => m.name));
      }

      // Step 2: Find or create Medicine within Category (case-insensitive)
      console.log('Step 2: Looking for medicine:', medicineName);
      let medicine = categoryDoc.medicines.find(m => 
        m.name.toLowerCase() === medicineName.toLowerCase()
      );

      if (!medicine) {
        console.log('Medicine NOT found in category, creating new:', medicineName);
        medicine = { name: medicineName, suppliers: [] };
        categoryDoc.medicines.push(medicine);
        console.log('Medicines after push:', categoryDoc.medicines.map(m => m.name));
      } else {
        console.log('Medicine FOUND:', medicine.name);
      }

      // Step 3: Find or create Supplier within Medicine (case-insensitive)
      console.log('Step 3: Looking for supplier:', supplier);
      let supplierEntry = medicine.suppliers.find(s => 
        s.name.toLowerCase() === supplier.toLowerCase()
      );

      if (!supplierEntry) {
        console.log('Supplier NOT found, creating new:', supplier);
        supplierEntry = { name: supplier, batches: [] };
        medicine.suppliers.push(supplierEntry);
      } else {
        console.log('Supplier FOUND:', supplierEntry.name);
      }

      // Step 4: Find or create Batch within Supplier
      console.log('Step 4: Looking for batch:', batchNumber, 'with expiry:', expiryDate);
      const expiryDateObj = new Date(expiryDate);
      let batch = supplierEntry.batches.find(b => 
        b.batchNumber.toLowerCase() === batchNumber.toLowerCase() &&
        new Date(b.expiryDate).getTime() === expiryDateObj.getTime()
      );

      if (batch) {
        console.log('Batch FOUND, updating quantity from', batch.quantity, 'to', batch.quantity + Number(quantity));
        batch.quantity += Number(quantity);
      } else {
        console.log('Batch NOT found, creating new batch entry');
        supplierEntry.batches.push({
          batchNumber,
          expiryDate: expiryDateObj,
          quantity: Number(quantity),
          purchaseId: purchase._id,
          purchaseDate: purchaseDate || Date.now()
        });
      }

      console.log('Saving category document...');
      await categoryDoc.save();
      console.log('Category document SAVED successfully');

      // Also update flat Inventory model for backward compatibility
      console.log('=== FLAT INVENTORY UPDATE ===');
      console.log('Search criteria:', { medicineName, supplier, batchNumber, expiryDate: expiryDateObj });
      
      const existingInventory = await Inventory.findOne({
        createdBy: inventoryOwnerId,
        medicineName: { $regex: new RegExp('^' + medicineName + '$', 'i') },
        supplier: { $regex: new RegExp('^' + supplier + '$', 'i') },
        batchNumber: { $regex: new RegExp('^' + batchNumber + '$', 'i') },
        expiryDate: expiryDateObj
      });

      console.log('Existing flat inventory found:', existingInventory ? 'YES' : 'NO');

      if (existingInventory) {
        existingInventory.quantity += Number(quantity);
        await existingInventory.save();
        console.log('Flat inventory quantity updated to:', existingInventory.quantity);
      } else {
        console.log('Creating NEW flat inventory item with category:', category);
        const newInventory = new Inventory({
          medicineName,
          category,
          supplier,
          batchNumber,
          quantity: Number(quantity),
          expiryDate: expiryDateObj,
          purchaseId: purchase._id,
          createdBy: inventoryOwnerId
        });
        
        try {
          const saved = await newInventory.save();
          console.log('NEW flat inventory saved with ID:', saved._id);
        } catch (saveError) {
          console.error('FAILED to save flat inventory:', saveError.message);
          throw saveError;
        }
      }
      console.log('=== INVENTORY UPDATE COMPLETE ===');
    } catch (inventoryError) {
      console.error('=== INVENTORY UPDATE FAILED ===');
      console.error('Error:', inventoryError.message);
      console.error('Stack:', inventoryError.stack);
    }
    
    res.status(201).json(purchase);
  } catch (error) {
    console.error('Backend error creating purchase:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get purchase by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      createdBy: { $in: accessibleUserIds }
    });
    
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update purchase
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const { medicineName, supplier, quantity, unitPrice, mrp, paymentStatus, purchaseDate, expiryDate, batchNumber, notes } = req.body;
    
    const updateData = {
      medicineName,
      supplier,
      quantity,
      unitPrice,
      mrp,
      paymentStatus,
      purchaseDate,
      expiryDate,
      batchNumber,
      notes
    };
    
    if (quantity && unitPrice) {
      updateData.totalAmount = quantity * unitPrice;
    }
    
    const purchase = await Purchase.findOneAndUpdate(
      { _id: req.params.id, createdBy: { $in: accessibleUserIds } },
      updateData,
      { new: true }
    );
    
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    
    res.json(purchase);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete purchase
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const accessibleUserIds = await getAccessibleUserIds(req.user.userId, req.user.role);
    const purchase = await Purchase.findOneAndDelete({
      _id: req.params.id,
      createdBy: { $in: accessibleUserIds }
    });
    
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    
    res.json({ message: 'Purchase deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
