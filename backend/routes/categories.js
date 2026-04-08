const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const authMiddleware = require('../middleware/auth');

// Get all categories with full hierarchy
router.get('/', authMiddleware, async (req, res) => {
  try {
    const categories = await Category.find({ createdBy: req.user.userId })
      .sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single category with full hierarchy
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      createdBy: req.user.userId
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get medicines by category name
router.get('/by-name/:name', authMiddleware, async (req, res) => {
  try {
    const category = await Category.findOne({
      createdBy: req.user.userId,
      name: { $regex: new RegExp('^' + req.params.name + '$', 'i') }
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all medicines across all categories (flattened)
router.get('/all/medicines', authMiddleware, async (req, res) => {
  try {
    const categories = await Category.find({ createdBy: req.user.userId });
    
    const medicines = [];
    categories.forEach(category => {
      category.medicines.forEach(medicine => {
        medicines.push({
          category: category.name,
          medicineName: medicine.name,
          suppliers: medicine.suppliers.map(s => s.name)
        });
      });
    });
    
    res.json(medicines);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all suppliers for a specific medicine
router.get('/medicine/:medicineName/suppliers', authMiddleware, async (req, res) => {
  try {
    const { medicineName } = req.params;
    
    const categories = await Category.find({
      createdBy: req.user.userId,
      'medicines.name': { $regex: new RegExp('^' + medicineName + '$', 'i') }
    });
    
    const suppliers = [];
    categories.forEach(category => {
      const medicine = category.medicines.find(m => 
        m.name.toLowerCase() === medicineName.toLowerCase()
      );
      if (medicine) {
        medicine.suppliers.forEach(supplier => {
          suppliers.push({
            category: category.name,
            medicineName: medicine.name,
            supplierName: supplier.name,
            batches: supplier.batches
          });
        });
      }
    });
    
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get total quantity for a medicine across all batches
router.get('/medicine/:medicineName/stock', authMiddleware, async (req, res) => {
  try {
    const { medicineName } = req.params;
    
    const categories = await Category.find({
      createdBy: req.user.userId,
      'medicines.name': { $regex: new RegExp('^' + medicineName + '$', 'i') }
    });
    
    let totalStock = 0;
    const stockDetails = [];
    
    categories.forEach(category => {
      const medicine = category.medicines.find(m => 
        m.name.toLowerCase() === medicineName.toLowerCase()
      );
      if (medicine) {
        medicine.suppliers.forEach(supplier => {
          supplier.batches.forEach(batch => {
            totalStock += batch.quantity;
            stockDetails.push({
              category: category.name,
              supplier: supplier.name,
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate,
              quantity: batch.quantity
            });
          });
        });
      }
    });
    
    res.json({ medicineName, totalStock, stockDetails });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a category (admin only - optional)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.userId
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
