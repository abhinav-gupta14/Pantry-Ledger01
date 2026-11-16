import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/http.js';
import { getSummaryMetrics, requireRestaurantId } from '../services/prismaStore.js';

const router = Router();

router.get('/summary', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const [metrics, items] = await Promise.all([
    getSummaryMetrics(restaurantId),
    prisma.inventoryItem.findMany({
      where: { restaurantId },
      select: { quantity: true, minimumStock: true, category: { select: { name: true } } }
    })
  ]);

  return res.json({
    ...metrics,
    lowStockItems: items.filter((item) => item.quantity > 0 && item.quantity <= item.minimumStock).length,
    outOfStockItems: items.filter((item) => item.quantity <= 0).length,
    categories: [...new Set(items.map((item) => item.category?.name).filter(Boolean))],
    generatedAt: new Date().toISOString()
  });
}));

export default router;
