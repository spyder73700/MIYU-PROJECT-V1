const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Inventory = require('../models/Inventory');
const Supplier = require('../models/Supplier');
const authMiddleware = require('../middleware/auth');

// Get dashboard statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    
    // Total purchases
    const totalPurchases = await Purchase.aggregate([
      { $match: { createdBy: userId } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    // Total sales
    const totalSales = await Sale.aggregate([
      { $match: { createdBy: userId } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    // Purchase count
    const purchaseCount = await Purchase.countDocuments({ createdBy: userId });
    
    // Sale count
    const saleCount = await Sale.countDocuments({ createdBy: userId });
    
    // Today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = await Sale.aggregate([
      { $match: { createdBy: userId, saleDate: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    // Recent purchases
    const recentPurchases = await Purchase.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Recent sales
    const recentSales = await Sale.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Monthly sales data for chart
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlySales = await Sale.aggregate([
      { $match: { createdBy: userId, saleDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$saleDate' },
            month: { $month: '$saleDate' }
          },
          total: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Inventory stats - REAL TIME
    const inventoryCount = await Inventory.countDocuments({ createdBy: userId });
    
    // Low stock items (quantity < 10) - REAL TIME
    const lowStockItems = await Inventory.find({ 
      createdBy: userId,
      quantity: { $lt: 10 }
    }).sort({ quantity: 1 }).limit(10);

    // Short items count (quantity < 10)
    const shortItemsCount = await Inventory.countDocuments({
      createdBy: userId,
      quantity: { $lt: 10 }
    });

    // Total profit - sum of (salePrice - purchasePrice) * quantity from all sales
    const totalProfit = await Sale.aggregate([
      { $match: { createdBy: userId } },
      { $group: { _id: null, total: { $sum: '$profit' } } }
    ]);
    
    // Active suppliers with pending amounts - REAL TIME
    const suppliers = await Supplier.find({ createdBy: userId })
      .sort({ pendingAmount: -1 })
      .limit(5);
    
    res.json({
      totalPurchases: totalPurchases[0]?.total || 0,
      totalSales: totalSales[0]?.total || 0,
      profit: totalProfit[0]?.total || 0,
      purchaseCount,
      saleCount,
      todaySales: todaySales[0]?.total || 0,
      recentPurchases,
      recentSales,
      monthlySales: monthlySales.map(item => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        amount: item.total
      })),
      // New real-time data
      inventoryCount,
      shortItemsCount,
      lowStockItems,
      suppliers
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get financial report with date filtering
router.get('/financial-report', authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = { createdBy: userId };
    if (startDate || endDate) {
      dateFilter.saleDate = {};
      if (startDate) dateFilter.saleDate.$gte = new Date(startDate);
      if (endDate) dateFilter.saleDate.$lte = new Date(endDate);
    }

    const purchaseDateFilter = { createdBy: userId };
    if (startDate || endDate) {
      purchaseDateFilter.purchaseDate = {};
      if (startDate) purchaseDateFilter.purchaseDate.$gte = new Date(startDate);
      if (endDate) purchaseDateFilter.purchaseDate.$lte = new Date(endDate);
    }
    
    // Total sales and profit for period
    const salesData = await Sale.aggregate([
      { $match: dateFilter },
      { 
        $group: { 
          _id: null, 
          totalSales: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profit' },
          totalQuantity: { $sum: '$quantity' },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    // Total purchases for period
    const purchaseData = await Purchase.aggregate([
      { $match: purchaseDateFilter },
      { 
        $group: { 
          _id: null, 
          totalPurchases: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' },
          count: { $sum: 1 }
        } 
      }
    ]);

    // Sales by category
    const salesByCategory = await Sale.aggregate([
      { $match: dateFilter },
      { 
        $group: { 
          _id: '$category', 
          totalAmount: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profit' },
          count: { $sum: 1 }
        } 
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Sales by medicine
    const salesByMedicine = await Sale.aggregate([
      { $match: dateFilter },
      { 
        $group: { 
          _id: '$medicineName', 
          totalAmount: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profit' },
          quantity: { $sum: '$quantity' },
          count: { $sum: 1 }
        } 
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 }
    ]);

    // Purchases by category
    const purchasesByCategory = await Purchase.aggregate([
      { $match: purchaseDateFilter },
      { 
        $group: { 
          _id: '$category', 
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        } 
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Monthly trend
    const monthlyTrend = await Sale.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$saleDate' },
            month: { $month: '$saleDate' }
          },
          sales: { $sum: '$totalAmount' },
          profit: { $sum: '$profit' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Payment status breakdown for purchases
    const purchasePaymentStatus = await Purchase.aggregate([
      { $match: purchaseDateFilter },
      {
        $group: {
          _id: '$paymentStatus',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Top selling medicines
    const topSellingMedicines = await Sale.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { medicineName: '$medicineName', category: '$category' },
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalAmount' },
          totalProfit: { $sum: '$profit' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);

    // Inventory valuation (current stock value)
    const inventoryValuation = await Inventory.aggregate([
      { $match: { createdBy: userId } },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$quantity' },
          itemCount: { $sum: 1 }
        }
      }
    ]);

    const salesResult = salesData[0] || { totalSales: 0, totalProfit: 0, totalQuantity: 0, count: 0 };
    const purchaseResult = purchaseData[0] || { totalPurchases: 0, totalQuantity: 0, count: 0 };
    
    res.json({
      summary: {
        totalSales: salesResult.totalSales,
        totalPurchases: purchaseResult.totalPurchases,
        totalProfit: salesResult.totalProfit,
        netProfit: salesResult.totalProfit,
        salesCount: salesResult.count,
        purchasesCount: purchaseResult.count,
        salesQuantity: salesResult.totalQuantity,
        purchasesQuantity: purchaseResult.totalQuantity
      },
      salesByCategory: salesByCategory.map(item => ({
        category: item._id || 'Uncategorized',
        amount: item.totalAmount,
        profit: item.totalProfit,
        count: item.count
      })),
      salesByMedicine: salesByMedicine.map(item => ({
        medicineName: item._id,
        amount: item.totalAmount,
        profit: item.totalProfit,
        quantity: item.quantity,
        count: item.count
      })),
      purchasesByCategory: purchasesByCategory.map(item => ({
        category: item._id || 'Uncategorized',
        amount: item.totalAmount,
        count: item.count
      })),
      monthlyTrend: monthlyTrend.map(item => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        sales: item.sales,
        profit: item.profit
      })),
      purchasePaymentStatus: purchasePaymentStatus.map(item => ({
        status: item._id,
        amount: item.total,
        count: item.count
      })),
      topSellingMedicines: topSellingMedicines.map(item => ({
        medicineName: item._id.medicineName,
        category: item._id.category,
        quantity: item.totalQuantity,
        revenue: item.totalRevenue,
        profit: item.totalProfit
      })),
      inventoryValuation: inventoryValuation[0] || { totalQuantity: 0, itemCount: 0 },
      dateRange: { startDate, endDate }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
