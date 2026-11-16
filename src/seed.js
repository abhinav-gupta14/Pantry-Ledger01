import bcrypt from 'bcryptjs';
import './config.js';
import prisma from './lib/prisma.js';

const demoItems = [
  { itemId: 'INV-001', name: 'Turmeric powder', category: 'Spices', quantity: 4, unit: 'kg', minimumStock: 2, reorderQuantity: 5, maxStockLevel: 20, purchasePrice: 160, supplier: 'Aroma Supply', storageLocation: 'Rack A1', description: 'Kitchen staple spice' },
  { itemId: 'INV-002', name: 'Cumin seeds', category: 'Spices', quantity: 1, unit: 'kg', minimumStock: 3, reorderQuantity: 6, maxStockLevel: 18, purchasePrice: 220, supplier: 'Aroma Supply', storageLocation: 'Rack A1', description: 'Ground cumin seed' },
  { itemId: 'INV-003', name: 'Red chilli powder', category: 'Spices', quantity: 0, unit: 'kg', minimumStock: 2, reorderQuantity: 4, maxStockLevel: 15, purchasePrice: 180, supplier: 'Aroma Supply', storageLocation: 'Rack A1', description: 'Hot spice powder' },
  { itemId: 'INV-004', name: 'Onions', category: 'Vegetables and fruit', quantity: 25, unit: 'kg', minimumStock: 15, reorderQuantity: 20, maxStockLevel: 60, purchasePrice: 60, supplier: 'Urban Harvest', storageLocation: 'Cold room B2', description: 'Fresh red onions' },
  { itemId: 'INV-005', name: 'Tomatoes', category: 'Vegetables and fruit', quantity: 8, unit: 'kg', minimumStock: 10, reorderQuantity: 15, maxStockLevel: 40, purchasePrice: 90, supplier: 'Urban Harvest', storageLocation: 'Cold room B2', description: 'Fresh tomatoes' },
  { itemId: 'INV-006', name: 'Paneer', category: 'Dairy and eggs', quantity: 6, unit: 'kg', minimumStock: 4, reorderQuantity: 8, maxStockLevel: 20, purchasePrice: 280, supplier: 'Milk Valley', storageLocation: 'Fridge C1', description: 'Fresh paneer cubes' },
  { itemId: 'INV-007', name: 'Chicken', category: 'Meat and seafood', quantity: 12, unit: 'kg', minimumStock: 8, reorderQuantity: 12, maxStockLevel: 30, purchasePrice: 300, supplier: 'Ocean Fresh', storageLocation: 'Freezer D4', description: 'Chicken breast' },
  { itemId: 'INV-008', name: 'Basmati rice', category: 'Grains and dry goods', quantity: 40, unit: 'kg', minimumStock: 20, reorderQuantity: 25, maxStockLevel: 80, purchasePrice: 120, supplier: 'Bharat Foods', storageLocation: 'Dry storage S1', description: 'Premium basmati rice' },
  { itemId: 'INV-009', name: 'Butter masala gravy', category: 'Prepared sauces and dishes', quantity: 5, unit: 'L', minimumStock: 3, reorderQuantity: 6, maxStockLevel: 18, purchasePrice: 140, supplier: 'Chef Line', storageLocation: 'Walk-in cooler E2', description: 'House butter masala base' },
  { itemId: 'INV-010', name: 'Mineral water', category: 'Beverages', quantity: 48, unit: 'bottles', minimumStock: 24, reorderQuantity: 30, maxStockLevel: 100, purchasePrice: 18, supplier: 'Purewell Co.', storageLocation: 'Beverage rack', description: 'Packaged mineral water' },
  { itemId: 'INV-011', name: 'Dinner forks', category: 'Cutlery', quantity: 60, unit: 'pcs', minimumStock: 40, reorderQuantity: 40, maxStockLevel: 200, purchasePrice: 40, supplier: 'Tableware Pro', storageLocation: 'Storage room T1', description: 'Dinner forks set' },
  { itemId: 'INV-012', name: 'Soup spoons', category: 'Cutlery', quantity: 22, unit: 'pcs', minimumStock: 30, reorderQuantity: 30, maxStockLevel: 200, purchasePrice: 35, supplier: 'Tableware Pro', storageLocation: 'Storage room T1', description: 'Soup spoon inventory' },
  { itemId: 'INV-013', name: 'Dinner plates', category: 'Crockery and glassware', quantity: 80, unit: 'pcs', minimumStock: 50, reorderQuantity: 50, maxStockLevel: 220, purchasePrice: 55, supplier: 'Tableware Pro', storageLocation: 'Storage room T1', description: 'Dinner plates' },
  { itemId: 'INV-014', name: 'Pressure cooker (10 L)', category: 'Kitchen equipment', quantity: 3, unit: 'pcs', minimumStock: 2, reorderQuantity: 2, maxStockLevel: 12, purchasePrice: 2200, supplier: 'Chef Tools Ltd.', storageLocation: 'Kitchen equipment rack', description: 'Commercial pressure cooker' },
  { itemId: 'INV-015', name: 'Dish soap', category: 'Cleaning supplies', quantity: 2, unit: 'L', minimumStock: 5, reorderQuantity: 6, maxStockLevel: 18, purchasePrice: 120, supplier: 'Cleanline', storageLocation: 'Cleaning store', description: 'Dishwasher soap' },
  { itemId: 'INV-016', name: 'Takeaway boxes', category: 'Packaging and takeaway', quantity: 300, unit: 'pcs', minimumStock: 150, reorderQuantity: 200, maxStockLevel: 600, purchasePrice: 12, supplier: 'EcoWrap', storageLocation: 'Packaging shelf', description: 'Disposable takeaway boxes' }
];

async function seed() {
  const demoPassword = process.env.DEMO_OWNER_PASSWORD;
  if (!demoPassword) {
    throw new Error('DEMO_OWNER_PASSWORD is required to seed the demo owner');
  }

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: 'pantry-ledger-restaurant' },
    create: {
      name: 'Pantry Ledger Restaurant',
      slug: 'pantry-ledger-restaurant',
      address: '12 Market Street'
    },
    update: {}
  });

  const password = await bcrypt.hash(demoPassword, 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@restaurant.com' },
    create: {
      name: 'Restaurant Owner',
      email: 'owner@restaurant.com',
      password,
      role: 'OWNER',
      restaurantId: restaurant.id
    },
    update: { restaurantId: restaurant.id, password }
  });

  for (const item of demoItems) {
    const category = await prisma.category.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: item.category } },
      create: { restaurantId: restaurant.id, name: item.category },
      update: {}
    });

    let supplier = await prisma.supplier.findFirst({
      where: { restaurantId: restaurant.id, name: item.supplier }
    });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: { name: item.supplier, restaurantId: restaurant.id }
      });
    }

    await prisma.inventoryItem.upsert({
      where: { itemId: item.itemId },
      create: {
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        minimumStock: item.minimumStock,
        reorderQuantity: item.reorderQuantity,
        maxStockLevel: item.maxStockLevel,
        purchasePrice: item.purchasePrice,
        storageLocation: item.storageLocation,
        restaurantId: restaurant.id,
        categoryId: category.id,
        supplierId: supplier.id
      },
      update: {}
    });
  }

  const recipe = await prisma.recipe.findUnique({
    where: { restaurantId_name: { restaurantId: restaurant.id, name: 'Paneer Butter Masala' } }
  });
  if (!recipe) {
    const ingredients = await prisma.inventoryItem.findMany({
      where: { restaurantId: restaurant.id, itemId: { in: ['INV-006', 'INV-005', 'INV-009'] } },
      select: { id: true, itemId: true }
    });
    const ingredientQuantities = new Map([
      ['INV-006', { quantity: 200, unit: 'g' }],
      ['INV-005', { quantity: 100, unit: 'g' }],
      ['INV-009', { quantity: 50, unit: 'mL' }]
    ]);

    await prisma.recipe.create({
      data: {
        name: 'Paneer Butter Masala',
        description: 'Classic paneer curry',
        restaurantId: restaurant.id,
        ingredients: {
          create: ingredients.map((item) => ({
            itemId: item.id,
            ...ingredientQuantities.get(item.itemId)
          }))
        }
      }
    });
  }

  console.log(`Seeded demo restaurant and owner ${owner.email}`);
}

seed()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
