import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { findInventoryItem, requireRestaurantId } from '../services/prismaStore.js';

const router = Router();

const purchaseOrderSchema = z.object({
  supplierId: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  items: z.array(z.object({
    itemId: z.string().trim().min(1),
    quantity: z.coerce.number().finite().positive(),
    unitPrice: z.coerce.number().finite().nonnegative()
  })).min(1)
});

function serializeOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    remarks: order.remarks || '',
    totalAmount: Number(order.totalAmount),
    supplier: order.supplier,
    items: order.items.map((line) => ({
      id: line.id,
      itemId: line.item.itemId,
      inventoryItemId: line.item.id,
      name: line.item.name,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      receivedQuantity: Number(line.receivedQuantity)
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

const orderInclude = {
  supplier: true,
  items: { include: { item: true } }
};

router.get('/', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const orders = await prisma.purchaseOrder.findMany({
    where: { restaurantId },
    include: orderInclude,
    orderBy: { createdAt: 'desc' }
  });
  return res.json({ purchaseOrders: orders.map(serializeOrder) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const result = purchaseOrderSchema.safeParse(req.body || {});
  if (!result.success) throw new HttpError(400, result.error.issues[0].message);
  const input = result.data;

  let supplierId = null;
  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, restaurantId },
      select: { id: true }
    });
    if (!supplier) throw new HttpError(400, 'Supplier not found');
    supplierId = supplier.id;
  }

  const lines = await Promise.all(input.items.map(async (line) => {
    const item = await findInventoryItem(line.itemId, restaurantId);
    if (!item) throw new HttpError(400, `Inventory item not found: ${line.itemId}`);
    return { ...line, inventoryId: item.id };
  }));
  const totalAmount = lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0);

  const order = await prisma.purchaseOrder.create({
    data: {
      orderNumber: `PO-${Date.now()}-${randomUUID().slice(0, 8)}`,
      restaurantId,
      supplierId,
      remarks: input.remarks || null,
      totalAmount,
      createdById: req.user.sub,
      items: {
        create: lines.map((line) => ({
          itemId: line.inventoryId,
          quantity: line.quantity,
          unitPrice: line.unitPrice
        }))
      }
    },
    include: orderInclude
  });
  return res.status(201).json(serializeOrder(order));
}));

export default router;
