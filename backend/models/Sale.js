const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  supplier: {
    type: String,
    trim: true
  },
  batchNumber: {
    type: String,
    trim: true
  },
  inventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: false
  },
  customerName: {
    type: String,
    trim: true,
    default: 'Walk-in Customer'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  purchasePrice: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  },
  profit: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  saleDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  prescriptionNumber: {
    type: String,
    trim: true
  },
  doctorName: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online'],
    default: 'cash'
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Sale', saleSchema);
