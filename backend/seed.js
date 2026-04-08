const mongoose = require('mongoose');
const Inventory = require('./models/Inventory');
const Purchase = require('./models/Purchase');
const Supplier = require('./models/Supplier');
const Sale = require('./models/Sale');
const User = require('./models/User');
require('dotenv').config();

// Test user credentials
const TEST_USER = {
  username: 'testpharmacist',
  email: 'test@pharmacy.com',
  password: 'password123',
  name: 'Test Pharmacist'
};

// Admin user credentials (matching UI)
const ADMIN_USER = {
  username: 'owner',
  email: 'admin@pharmacy.com',
  password: 'admin123',
  role: 'admin'
};

// Categories from enum
const CATEGORIES = [
  'Antibiotic', 'Antihistamine', 'Antiviral', 'Painkiller', 
  'Vitamin', 'Supplement', 'Syrup', 'Cream', 'Injection', 'Other'
];

// Medicines by category
const MEDICINES = {
  'Antibiotic': ['Amoxicillin 500mg', 'Azithromycin 250mg', 'Ciprofloxacin 500mg', 'Doxycycline 100mg'],
  'Painkiller': ['Paracetamol 500mg', 'Ibuprofen 400mg', 'Diclofenac 50mg', 'Tramadol 50mg'],
  'Antihistamine': ['Cetirizine 10mg', 'Loratadine 10mg', 'Benadryl', 'Allegra 120mg'],
  'Vitamin': ['Vitamin C 500mg', 'Vitamin D3', 'B-Complex', 'Multivitamin'],
  'Syrup': ['Cough Syrup', 'Digestive Syrup', 'Liver Tonic', 'Appetizer Syrup'],
  'Cream': ['Antifungal Cream', 'Burn Cream', 'Moisturizing Cream', 'Anti-itch Cream'],
  'Supplement': ['Calcium + D3', 'Iron Folic', 'Protein Powder', 'Omega-3'],
  'Antiviral': ['Acyclovir 400mg', 'Oseltamivir', 'Valacyclovir'],
  'Injection': ['Insulin', 'Vitamin B12', 'Diclofenac Injection', 'Ceftriaxone'],
  'Other': ['ORS', 'Glucon-D', 'Bandages', 'Cotton Rolls']
};

// Suppliers
const SUPPLIERS = [
  { name: 'MediPlus Pharma', contact: '+91 98765 43210', email: 'contact@mediplus.com' },
  { name: 'Global Health Ltd', contact: '+91 98765 43211', email: 'sales@globalhealth.com' },
  { name: 'BioCare Systems', contact: '+91 98765 43212', email: 'orders@biocare.com' },
  { name: 'HealthFirst Distributors', contact: '+91 98765 43213', email: 'info@healthfirst.com' },
  { name: 'PharmaCare Solutions', contact: '+91 98765 43214', email: 'support@pharmacare.com' }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy');
    console.log('Connected to MongoDB');

    // Find or create test user
    let user = await User.findOne({ email: TEST_USER.email });
    if (!user) {
      user = new User(TEST_USER);
      await user.save();
      console.log('Created test user:', TEST_USER.email);
    } else {
      console.log('Using existing user:', user._id);
    }

    // Find or create admin user
    let adminUser = await User.findOne({ email: ADMIN_USER.email });
    if (!adminUser) {
      adminUser = new User(ADMIN_USER);
      await adminUser.save();
      console.log('Created admin user:', ADMIN_USER.email);
    } else {
      console.log('Using existing admin user:', adminUser._id);
    }

    const userId = user._id;

    // Clear existing data
    console.log('Clearing existing data...');
    await Inventory.deleteMany({ createdBy: userId });
    await Purchase.deleteMany({ createdBy: userId });
    await Supplier.deleteMany({ createdBy: userId });
    await Sale.deleteMany({ createdBy: userId });
    console.log('Cleared existing data');

    // Create suppliers
    console.log('Creating suppliers...');
    const createdSuppliers = [];
    for (const sup of SUPPLIERS) {
      const supplier = new Supplier({
        supplierName: sup.name,
        contactNumber: sup.contact,
        email: sup.email,
        paidAmount: Math.floor(Math.random() * 50000),
        pendingAmount: Math.floor(Math.random() * 30000),
        createdBy: userId
      });
      await supplier.save();
      createdSuppliers.push(supplier);
    }
    console.log(`Created ${createdSuppliers.length} suppliers`);

    // Create purchases and inventory
    console.log('Creating purchases and inventory...');
    let purchaseCount = 0;
    let inventoryCount = 0;

    const today = new Date();
    
    for (const [category, medicines] of Object.entries(MEDICINES)) {
      for (const medicine of medicines) {
        // Create 1-3 purchases per medicine
        const numPurchases = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < numPurchases; i++) {
          const supplier = createdSuppliers[Math.floor(Math.random() * createdSuppliers.length)];
          const quantity = Math.floor(Math.random() * 100) + 20;
          const unitPrice = Math.floor(Math.random() * 50) + 10;
          const mrp = unitPrice + Math.floor(Math.random() * 30) + 5;
          
          // Random purchase date (last 6 months)
          const purchaseDate = new Date(today);
          purchaseDate.setMonth(purchaseDate.getMonth() - Math.floor(Math.random() * 6));
          purchaseDate.setDate(purchaseDate.getDate() - Math.floor(Math.random() * 30));
          
          // Random expiry date (next 6-24 months)
          const expiryDate = new Date(today);
          expiryDate.setMonth(expiryDate.getMonth() + Math.floor(Math.random() * 18) + 6);
          
          // Create purchase
          const purchase = new Purchase({
            medicineName: medicine,
            category: category,
            supplier: supplier.supplierName,
            quantity: quantity,
            unitPrice: unitPrice,
            mrp: mrp,
            totalAmount: quantity * unitPrice,
            purchaseDate: purchaseDate,
            expiryDate: expiryDate,
            batchNumber: `BN${Date.now()}${i}`,
            paymentStatus: ['paid', 'pending', 'partial'][Math.floor(Math.random() * 3)],
            createdBy: userId
          });
          await purchase.save();
          purchaseCount++;
          
          // Create inventory linked to purchase
          // Reduce quantity to simulate some sales
          const remainingQty = Math.floor(quantity * (0.3 + Math.random() * 0.7));
          
          const inventory = new Inventory({
            medicineName: medicine,
            category: category,
            batchNumber: purchase.batchNumber,
            quantity: remainingQty,
            expiryDate: expiryDate,
            purchaseId: purchase._id,
            createdBy: userId
          });
          await inventory.save();
          inventoryCount++;
        }
      }
    }
    
    console.log(`Created ${purchaseCount} purchases`);
    console.log(`Created ${inventoryCount} inventory items`);

    // Create some sales
    console.log('Creating sales...');
    const inventoryItems = await Inventory.find({ createdBy: userId }).populate('purchaseId');
    let saleCount = 0;
    
    for (let i = 0; i < 20; i++) {
      const item = inventoryItems[Math.floor(Math.random() * inventoryItems.length)];
      if (!item || item.quantity < 5) continue;
      
      const saleQty = Math.floor(Math.random() * 5) + 1;
      const salePrice = item.purchaseId ? item.purchaseId.mrp || item.purchaseId.unitPrice * 1.5 : 50;
      
      const sale = new Sale({
        medicineName: item.medicineName,
        customerName: `Customer ${i + 1}`,
        quantity: saleQty,
        unitPrice: salePrice,
        purchasePrice: item.purchaseId ? item.purchaseId.unitPrice : 0,
        profit: (salePrice - (item.purchaseId ? item.purchaseId.unitPrice : 0)) * saleQty,
        totalAmount: saleQty * salePrice,
        saleDate: new Date(today.setDate(today.getDate() - Math.floor(Math.random() * 30))),
        paymentMethod: ['cash', 'card', 'online'][Math.floor(Math.random() * 3)],
        createdBy: userId
      });
      await sale.save();
      saleCount++;
    }
    
    console.log(`Created ${saleCount} sales`);

    // Create some expired items for testing low stock
    console.log('Creating some low stock and expiring items...');
    
    // Low stock items
    for (let i = 0; i < 3; i++) {
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      const medicines = MEDICINES[category];
      const medicine = medicines[Math.floor(Math.random() * medicines.length)];
      const supplier = createdSuppliers[Math.floor(Math.random() * createdSuppliers.length)];
      
      const purchase = new Purchase({
        medicineName: medicine,
        category: category,
        supplier: supplier.supplierName,
        quantity: 15,
        unitPrice: 25,
        mrp: 40,
        totalAmount: 375,
        purchaseDate: new Date(),
        expiryDate: new Date(today.setMonth(today.getMonth() + 12)),
        batchNumber: `BN-LOW-${Date.now()}-${i}`,
        createdBy: userId
      });
      await purchase.save();
      
      const inventory = new Inventory({
        medicineName: medicine,
        category: category,
        batchNumber: purchase.batchNumber,
        quantity: 5, // Low stock (< 10)
        expiryDate: purchase.expiryDate,
        purchaseId: purchase._id,
        createdBy: userId
      });
      await inventory.save();
    }
    
    // Expiring soon items (next 25 days)
    for (let i = 0; i < 2; i++) {
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      const medicines = MEDICINES[category];
      const medicine = medicines[Math.floor(Math.random() * medicines.length)];
      const supplier = createdSuppliers[Math.floor(Math.random() * createdSuppliers.length)];
      
      const purchase = new Purchase({
        medicineName: medicine,
        category: category,
        supplier: supplier.supplierName,
        quantity: 50,
        unitPrice: 30,
        mrp: 50,
        totalAmount: 1500,
        purchaseDate: new Date(),
        expiryDate: new Date(today.setDate(today.getDate() + 20)), // Expiring in 20 days
        batchNumber: `BN-EXP-${Date.now()}-${i}`,
        createdBy: userId
      });
      await purchase.save();
      
      const inventory = new Inventory({
        medicineName: medicine,
        category: category,
        batchNumber: purchase.batchNumber,
        quantity: 30,
        expiryDate: purchase.expiryDate,
        purchaseId: purchase._id,
        createdBy: userId
      });
      await inventory.save();
    }

    // Expired items
    for (let i = 0; i < 2; i++) {
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      const medicines = MEDICINES[category];
      const medicine = medicines[Math.floor(Math.random() * medicines.length)];
      const supplier = createdSuppliers[Math.floor(Math.random() * createdSuppliers.length)];
      
      const purchase = new Purchase({
        medicineName: medicine,
        category: category,
        supplier: supplier.supplierName,
        quantity: 30,
        unitPrice: 20,
        mrp: 35,
        totalAmount: 600,
        purchaseDate: new Date(today.setMonth(today.getMonth() - 6)),
        expiryDate: new Date(today.setDate(today.getDate() - 10)), // Already expired
        batchNumber: `BN-EXD-${Date.now()}-${i}`,
        createdBy: userId
      });
      await purchase.save();
      
      const inventory = new Inventory({
        medicineName: medicine,
        category: category,
        batchNumber: purchase.batchNumber,
        quantity: 15,
        expiryDate: purchase.expiryDate,
        purchaseId: purchase._id,
        createdBy: userId
      });
      await inventory.save();
    }

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('\n--- Admin User ---');
    console.log(`Username: ${ADMIN_USER.username}`);
    console.log(`Password: ${ADMIN_USER.password}`);
    console.log(`Role: ${ADMIN_USER.role}`);
    console.log('\n--- Pharmacist User ---');
    console.log(`Username: ${TEST_USER.username}`);
    console.log(`Password: ${TEST_USER.password}`);
    console.log(`Role: pharmacist (default)`);
    console.log(`\nCreated:`);
    console.log(`- ${CATEGORIES.length} categories`);
    console.log(`- ${Object.values(MEDICINES).flat().length} unique medicines`);
    console.log(`- ${SUPPLIERS.length} suppliers`);
    console.log(`- ${purchaseCount + 7} purchases`);
    console.log(`- ${inventoryCount + 7} inventory items`);
    console.log(`- ${saleCount} sales`);
    console.log(`\nIncludes:`);
    console.log(`- 3 low stock items (quantity < 10)`);
    console.log(`- 2 expiring soon items (within 30 days)`);
    console.log(`- 2 expired items`);

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

seedDatabase();
