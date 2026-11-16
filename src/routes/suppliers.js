import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { requireRestaurantId } from '../services/prismaStore.js';

const router = Router();

const supplierSchema = z.object({
  name: z.string().trim().min(1),
  contactPerson: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  productsSupplied: z.string().trim().nullable().optional(),
  paymentTerms: z.string().trim().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional()
});

router.get('/', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const suppliers = await prisma.supplier.findMany({
    where: { restaurantId },
    orderBy: { name: 'asc' }
  });
  return res.json({ suppliers });
}));

router.post('/', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const result = supplierSchema.safeParse(req.body || {});
  if (!result.success) throw new HttpError(400, result.error.issues[0].message);

  const supplier = await prisma.supplier.create({
    data: { ...result.data, restaurantId }
  });
  return res.status(201).json(supplier);
}));

export default router;
