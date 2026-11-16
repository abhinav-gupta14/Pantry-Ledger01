import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler, HttpError } from '../lib/http.js';
import { findInventoryItem, requireRestaurantId, serializeRecipe } from '../services/prismaStore.js';

const router = Router();

const recipeSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  ingredients: z.array(z.object({
    itemId: z.string().trim().min(1),
    quantity: z.coerce.number().finite().positive(),
    unit: z.string().trim().min(1)
  })).optional()
});

const recipeInclude = {
  ingredients: { include: { item: true } }
};

router.get('/', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const recipes = await prisma.recipe.findMany({
    where: { restaurantId },
    include: recipeInclude,
    orderBy: { name: 'asc' }
  });
  return res.json({ recipes: recipes.map(serializeRecipe) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const restaurantId = requireRestaurantId(req);
  const result = recipeSchema.safeParse(req.body || {});
  if (!result.success) throw new HttpError(400, result.error.issues[0].message);
  const input = result.data;

  const ingredients = await Promise.all((input.ingredients || []).map(async (ingredient) => {
    const item = await findInventoryItem(ingredient.itemId, restaurantId);
    if (!item) throw new HttpError(400, `Inventory item not found: ${ingredient.itemId}`);
    return { ...ingredient, inventoryId: item.id };
  }));

  const recipe = await prisma.recipe.create({
    data: {
      name: input.name,
      description: input.description || null,
      status: input.status || 'ACTIVE',
      restaurantId,
      ingredients: {
        create: ingredients.map((ingredient) => ({
          itemId: ingredient.inventoryId,
          quantity: ingredient.quantity,
          unit: ingredient.unit
        }))
      }
    },
    include: recipeInclude
  });
  return res.status(201).json(serializeRecipe(recipe));
}));

export default router;
