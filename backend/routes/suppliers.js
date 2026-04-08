const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const auth = require('../middleware/auth');

// Get all suppliers
router.get('/', auth, async (req, res) => {
  try {
    const suppliers = await Supplier.find({ createdBy: req.user.userId }).sort({ createdAt: -1 });
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
      createdBy: req.user.userId
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
      { _id: req.params.id, createdBy: req.user.userId },
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
      createdBy: req.user.userId 
    });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ message: 'Supplier deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
