import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeItem } from '../src/services/prismaStore.js';

function itemRecord(quantity, minimumStock) {
  return {
    id: 'item-1',
    itemId: 'INV-001',
    name: 'Turmeric',
    category: { name: 'Spices' },
    supplier: { name: 'Aroma Supply' },
    description: null,
    quantity,
    unit: 'kg',
    minimumStock,
    reorderQuantity: 2,
    maxStockLevel: 10,
    purchasePrice: 3.5,
    storageLocation: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z')
  };
}

test('serializes Prisma inventory relations to the API item shape', () => {
  const serialized = serializeItem(itemRecord(4, 2));

  assert.equal(serialized.category, 'Spices');
  assert.equal(serialized.supplier, 'Aroma Supply');
  assert.equal(serialized.quantity, 4);
  assert.equal(serialized.status, 'In stock');
  assert.equal(serialized.storageLocation, 'Main storage');
});

test('maps zero and below-minimum inventory to the expected statuses', () => {
  assert.equal(serializeItem(itemRecord(0, 2)).status, 'Out of stock');
  assert.equal(serializeItem(itemRecord(1, 2)).status, 'Low stock');
});
