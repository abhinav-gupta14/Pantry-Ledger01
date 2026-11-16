import prisma from '../lib/prisma.js';
import { HttpError } from '../lib/http.js';

export const inventoryInclude = {
  category: true,
  supplier: true
};

export function serializeItem(item) {
  return {
    id: item.id,
    itemId: item.itemId,
    name: item.name,
    category: item.category?.name || 'Spices',
    description: item.description || '',
    quantity: Number(item.quantity),
    unit: item.unit,
    minimumStock: Number(item.minimumStock || 0),
    reorderQuantity: Number(item.reorderQuantity || 0),
    maxStockLevel: Number(item.maxStockLevel || 0),
    purchasePrice: Number(item.purchasePrice || 0),
    supplier: item.supplier?.name || 'N/A',
    storageLocation: item.storageLocation || 'Main storage',
    status: Number(item.quantity) <= 0
      ? 'Out of stock'
      : Number(item.quantity) <= Number(item.minimumStock || 0)
        ? 'Low stock'
        : 'In stock',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

export async function resolveCategoryId(name, restaurantId) {
  const category = await prisma.category.upsert({
    where: { restaurantId_name: { restaurantId, name } },
    create: { restaurantId, name },
    update: {}
  });
  return category.id;
}

export async function resolveSupplierId(name, restaurantId) {
  if (!name || name === 'N/A') return null;
  const supplier = await prisma.supplier.findFirst({
    where: { restaurantId, name }
  });
  return supplier?.id || null;
}

export async function findInventoryItem(identifier, restaurantId, client = prisma) {
  return client.inventoryItem.findFirst({
    where: {
      restaurantId,
      OR: [{ id: identifier }, { itemId: identifier }]
    },
    include: inventoryInclude
  });
}

export function serializeRecipe(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description || '',
    status: recipe.status,
    ingredients: recipe.ingredients.map((ingredient) => ({
      id: ingredient.id,
      itemId: ingredient.item.itemId,
      name: ingredient.item.name,
      quantity: Number(ingredient.quantity),
      unit: ingredient.unit
    })),
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt
  };
}

export async function getSummaryMetrics(restaurantId) {
  const items = await prisma.inventoryItem.findMany({
    where: { restaurantId },
    select: { quantity: true, minimumStock: true, purchasePrice: true }
  });

  const inStock = items.filter((item) => item.quantity > item.minimumStock).length;
  const lowStock = items.filter((item) => item.quantity > 0 && item.quantity <= item.minimumStock).length;
  const outOfStock = items.filter((item) => item.quantity <= 0).length;
  const totalInventoryValue = items.reduce(
    (total, item) => total + item.quantity * Number(item.purchasePrice || 0),
    0
  );

  return {
    totalItems: items.length,
    inStock,
    lowStock,
    outOfStock,
    totalInventoryValue: Number(totalInventoryValue.toFixed(2))
  };
}

export function requireRestaurantId(req) {
  const restaurantId = req.user?.restaurantId;
  if (!restaurantId) throw new HttpError(401, 'Authenticated user has no restaurant');
  return restaurantId;
}
