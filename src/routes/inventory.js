import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import {
  findInventoryItem,
  getSummaryMetrics,
  inventoryInclude,
  resolveCategoryId,
  resolveSupplierId,
  requireRestaurantId,
  serializeItem
} from '../services/prismaStore.js';

const router = Router();

const itemSchema = z.object({
  name: z.string().trim().min(1).optional(),
  itemId: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  quantity: z.coerce.number().finite().nonnegative().optional(),
  unit: z.string().trim().min(1).optional(),
  minimumStock: z.coerce.number().finite().nonnegative().optional(),
  reorderQuantity: z.coerce.number().finite().nonnegative().optional(),
  maxStockLevel: z.coerce.number().finite().nonnegative().optional(),
  purchasePrice: z.coerce.number().finite().nonnegative().optional(),
  supplier: z.string().trim().optional(),
  storageLocation: z.string().nullable().optional()
});

function parseItemInput(body) {
  const input = {
    ...body,
    quantity: body.quantity ?? body.qty,
    minimumStock: body.minimumStock ?? body.min
  };
  delete input.qty;
  delete input.min;

  const result = itemSchema.safeParse(input);
  if (!result.success) throw new HttpError(400, result.error.issues[0].message);
  return result.data;
}

function emitInventoryUpdate(req, data) {
  req.app.locals.io?.emit('inventory:updated', {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

router.get('/', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const q = String(req.query.q || '').trim();
  const category = String(req.query.category || 'All items');
  const where = {
    restaurantId,
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    ...(category !== 'All items' ? { category: { is: { name: category } } } : {})
  };

  const [records, summary] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      include: inventoryInclude,
      orderBy: { name: 'asc' }
    }),
    getSummaryMetrics(restaurantId)
  ]);

  return res.json({ items: records.map(serializeItem), summary });
}));

router.post('/', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const input = parseItemInput(req.body || {});
  if (!input.name) throw new HttpError(400, 'Item name is required');

  const categoryId = await resolveCategoryId(input.category || 'Spices', restaurantId);
  const supplierId = await resolveSupplierId(input.supplier, restaurantId);
  const item = await prisma.inventoryItem.create({
    data: {
      itemId: input.itemId || `INV-${randomUUID()}`,
      name: input.name,
      description: input.description || null,
      categoryId,
      quantity: input.quantity ?? 0,
      unit: input.unit || 'kg',
      minimumStock: input.minimumStock ?? 0,
      reorderQuantity: input.reorderQuantity ?? 0,
      maxStockLevel: input.maxStockLevel ?? 0,
      purchasePrice: input.purchasePrice ?? null,
      supplierId,
      storageLocation: input.storageLocation || null,
      restaurantId
    },
    include: inventoryInclude
  });

  const serialized = serializeItem(item);
  emitInventoryUpdate(req, { action: 'created', item: serialized });
  return res.status(201).json(serialized);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const input = parseItemInput(req.body || {});
  const existing = await findInventoryItem(req.params.id, restaurantId);
  if (!existing) return res.status(404).json({ message: 'Item not found' });

  const data = {};
  for (const field of [
    'itemId', 'name', 'description', 'quantity', 'unit', 'minimumStock',
    'reorderQuantity', 'maxStockLevel', 'purchasePrice', 'storageLocation'
  ]) {
    if (input[field] !== undefined) data[field] = input[field];
  }
  if (input.category !== undefined) {
    data.categoryId = await resolveCategoryId(input.category, restaurantId);
  }
  if (input.supplier !== undefined) {
    data.supplierId = await resolveSupplierId(input.supplier, restaurantId);
  }

  const item = await prisma.inventoryItem.update({
    where: { id: existing.id },
    data,
    include: inventoryInclude
  });
  const serialized = serializeItem(item);
  emitInventoryUpdate(req, { action: 'updated', item: serialized });
  return res.json(serialized);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const item = await findInventoryItem(req.params.id, restaurantId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  await prisma.inventoryItem.delete({ where: { id: item.id } });
  emitInventoryUpdate(req, { action: 'deleted', itemId: item.id });
  return res.status(204).send();
}));

router.post('/:id/adjust', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const deltaResult = z.coerce.number().finite().safeParse(req.body?.delta ?? 0);
  if (!deltaResult.success) throw new HttpError(400, 'Stock adjustment must be a finite number');
  const delta = deltaResult.data;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Manual stock adjustment';

  const item = await prisma.$transaction(async (transaction) => {
    const current = await findInventoryItem(req.params.id, restaurantId, transaction);
    if (!current) return null;

    const previousStock = Number(current.quantity);
    const updatedStock = Math.max(0, previousStock + delta);
    const updated = await transaction.inventoryItem.update({
      where: { id: current.id },
      data: { quantity: updatedStock },
      include: inventoryInclude
    });

    await transaction.stockMovement.create({
      data: {
        itemId: current.id,
        restaurantId,
        movementType: delta > 0 ? 'RECEIVED' : delta < 0 ? 'CONSUMED' : 'ADJUSTED',
        quantity: Math.abs(updatedStock - previousStock),
        previousStock,
        updatedStock,
        reason,
        userId: req.user.sub
      }
    });

    return updated;
  });

  if (!item) return res.status(404).json({ message: 'Item not found' });
  const serialized = serializeItem(item);
  emitInventoryUpdate(req, { action: 'adjusted', item: serialized, reason });
  return res.json(serialized);
}));

export default router;
