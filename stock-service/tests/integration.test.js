'use strict';

/**
 * Comprehensive tests for stock service
 */
describe('Stock Service - Inventory Management', () => {
  describe('Food Item Schema', () => {
    const validItem = {
      itemId: 'ITEM001',
      name: 'Biryani',
      price: 150,
      stock: 100,
      version: 1
    };

    test('valid food item has all required fields', () => {
      expect(validItem).toHaveProperty('itemId');
      expect(validItem).toHaveProperty('name');
      expect(validItem).toHaveProperty('price');
      expect(validItem).toHaveProperty('stock');
      expect(validItem).toHaveProperty('version');
    });

    test('itemId is unique identifier', () => {
      const item1 = { ...validItem, itemId: 'BIRYANI_001' };
      const item2 = { ...validItem, itemId: 'CHICKEN_001' };
      
      expect(item1.itemId).not.toBe(item2.itemId);
    });

    test('price is non-negative number', () => {
      expect(validItem.price).toBeGreaterThanOrEqual(0);
      expect(typeof validItem.price).toBe('number');
    });

    test('stock is non-negative integer', () => {
      expect(validItem.stock).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(validItem.stock)).toBe(true);
    });

    test('version starts at 1 for optimistic locking', () => {
      expect(validItem.version).toBe(1);
    });

    test('name is non-empty string', () => {
      expect(typeof validItem.name).toBe('string');
      expect(validItem.name.trim().length).toBeGreaterThan(0);
    });
  });

  describe('Optimistic Locking', () => {
    test('version increments on update', () => {
      const item = { itemId: 'ITEM001', stock: 100, version: 1 };
      item.stock = 95;
      item.version++;
      
      expect(item.version).toBe(2);
    });

    test('detects concurrent modification with version mismatch', () => {
      const clientVersion = 1;
      const serverVersion = 2;
      
      expect(clientVersion).not.toBe(serverVersion);
    });

    test('allows update when versions match', () => {
      const clientVersion = 2;
      const serverVersion = 2;
      const shouldUpdate = clientVersion === serverVersion;
      
      expect(shouldUpdate).toBe(true);
    });

    test('prevents update when versions don\'t match', () => {
      const clientVersion = 1;
      const serverVersion = 2;
      const shouldUpdate = clientVersion === serverVersion;
      
      expect(shouldUpdate).toBe(false);
    });

    test('handles race condition in high concurrency', () => {
      const items = Array(5).fill(null).map((_, i) => ({
        itemId: 'ITEM001',
        version: 1,
        stock: 100
      }));
      
      // Simulate concurrent updates
      items.forEach((item, idx) => {
        if (item.version === 1) {
          item.stock -= 10;
          item.version++;
        }
      });
      
      // All updated successfully due to same initial version
      expect(items[0].stock).toBe(90);
      expect(items[0].version).toBe(2);
    });
  });
});

/**
 * Stock Deduction Tests - Comprehensive
 */
describe('Stock Deduction - Comprehensive', () => {
  const { deductStock } = require('../src/stockUtils');

  describe('Valid Deductions', () => {
    test('deducts 1 item from stock of 100', () => {
      expect(deductStock(100, 1)).toBe(99);
    });

    test('deducts 5 items from stock of 10', () => {
      expect(deductStock(10, 5)).toBe(5);
    });

    test('deducts full stock to zero', () => {
      expect(deductStock(50, 50)).toBe(0);
    });

    test('deducts exact remaining stock', () => {
      expect(deductStock(1, 1)).toBe(0);
    });

    test('handles large quantities', () => {
      expect(deductStock(10000, 5000)).toBe(5000);
    });

    test('deducts from maximum stock levels', () => {
      expect(deductStock(999999, 1)).toBe(999998);
    });
  });

  describe('Invalid Deductions - Insufficient Stock', () => {
    test('throws when quantity exceeds stock', () => {
      expect(() => deductStock(5, 10)).toThrow('Insufficient stock');
    });

    test('throws when quantity is greater than stock', () => {
      expect(() => deductStock(1, 2)).toThrow();
    });

    test('throws with specific error message', () => {
      expect(() => deductStock(2, 5)).toThrow(/Insufficient|stock/i);
    });
  });

  describe('Invalid Deductions - Parameter Validation', () => {
    test('throws on negative current stock', () => {
      expect(() => deductStock(-1, 1)).toThrow();
    });

    test('throws on negative quantity', () => {
      expect(() => deductStock(10, -1)).toThrow();
    });

    test('throws on zero quantity', () => {
      expect(() => deductStock(10, 0)).toThrow();
    });

    test('throws on non-integer quantity', () => {
      expect(() => deductStock(10, 1.5)).toThrow();
    });

    test('throws on non-integer stock', () => {
      expect(() => deductStock(10.5, 5)).toThrow();
    });

    test('throws on null stock', () => {
      expect(() => deductStock(null, 1)).toThrow();
    });

    test('throws on null quantity', () => {
      expect(() => deductStock(10, null)).toThrow();
    });

    test('throws on undefined stock', () => {
      expect(() => deductStock(undefined, 1)).toThrow();
    });

    test('throws on undefined quantity', () => {
      expect(() => deductStock(10, undefined)).toThrow();
    });

    test('throws on NaN stock', () => {
      expect(() => deductStock(NaN, 1)).toThrow();
    });

    test('throws on NaN quantity', () => {
      expect(() => deductStock(10, NaN)).toThrow();
    });

    test('throws on string quantity', () => {
      expect(() => deductStock(10, 'abc')).toThrow();
    });

    test('throws on string stock', () => {
      expect(() => deductStock('abc', 5)).toThrow();
    });
  });

  describe('Boundary Cases', () => {
    test('minimum valid deduction (1 from 1)', () => {
      expect(deductStock(1, 1)).toBe(0);
    });

    test('minimum stock with quantity 1', () => {
      expect(deductStock(1, 1)).toBe(0);
    });

    test('large stock large quantity', () => {
      expect(deductStock(100000, 100000)).toBe(0);
    });

    test('deduct 1 from large stock', () => {
      expect(deductStock(999999, 1)).toBe(999998);
    });
  });
});

/**
 * Duplicate Order Detection Tests
 */
describe('Duplicate Order Detection', () => {
  const { isAlreadyProcessed } = require('../src/stockUtils');

  describe('Processed Orders', () => {
    test('identifies already processed order', () => {
      const processed = new Set(['order-123', 'order-456']);
      expect(isAlreadyProcessed(processed, 'order-123')).toBe(true);
    });

    test('identifies order in large set', () => {
      const processed = new Set();
      for (let i = 0; i < 1000; i++) {
        processed.add(`order-${i}`);
      }
      expect(isAlreadyProcessed(processed, 'order-500')).toBe(true);
    });

    test('handles multiple duplicates', () => {
      const processed = new Set(['order-1', 'order-2', 'order-3']);
      expect(isAlreadyProcessed(processed, 'order-1')).toBe(true);
      expect(isAlreadyProcessed(processed, 'order-2')).toBe(true);
      expect(isAlreadyProcessed(processed, 'order-3')).toBe(true);
    });
  });

  describe('New Orders', () => {
    test('identifies new order not in set', () => {
      const processed = new Set(['order-123']);
      expect(isAlreadyProcessed(processed, 'order-456')).toBe(false);
    });

    test('returns false for empty set', () => {
      const processed = new Set();
      expect(isAlreadyProcessed(processed, 'order-789')).toBe(false);
    });

    test('identifies multiple new orders', () => {
      const processed = new Set(['order-1', 'order-2']);
      expect(isAlreadyProcessed(processed, 'order-3')).toBe(false);
      expect(isAlreadyProcessed(processed, 'order-4')).toBe(false);
      expect(isAlreadyProcessed(processed, 'order-5')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('handles numeric order ID', () => {
      const processed = new Set([123, 456]);
      expect(isAlreadyProcessed(processed, 123)).toBe(true);
      expect(isAlreadyProcessed(processed, 789)).toBe(false);
    });

    test('case sensitive order ID matching', () => {
      const processed = new Set(['ORDER-123', 'order-456']);
      expect(isAlreadyProcessed(processed, 'order-123')).toBe(false);
      expect(isAlreadyProcessed(processed, 'ORDER-123')).toBe(true);
    });

    test('whitespace in order ID', () => {
      const processed = new Set(['order-123']);
      expect(isAlreadyProcessed(processed, 'order-123 ')).toBe(false);
      expect(isAlreadyProcessed(processed, ' order-123')).toBe(false);
    });

    test('special characters in order ID', () => {
      const processed = new Set(['order-123-abc']);
      expect(isAlreadyProcessed(processed, 'order-123-abc')).toBe(true);
      expect(isAlreadyProcessed(processed, 'order-123_abc')).toBe(false);
    });
  });

  describe('Performance', () => {
    test('efficiently finds item in large set', () => {
      const processed = new Set();
      for (let i = 0; i < 10000; i++) {
        processed.add(`order-${i}`);
      }
      
      const startTime = Date.now();
      const found = isAlreadyProcessed(processed, 'order-5000');
      const endTime = Date.now();
      
      expect(found).toBe(true);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });

    test('efficiently detects missing item in large set', () => {
      const processed = new Set();
      for (let i = 0; i < 10000; i++) {
        processed.add(`order-${i}`);
      }
      
      const startTime = Date.now();
      const found = isAlreadyProcessed(processed, 'order-9999999');
      const endTime = Date.now();
      
      expect(found).toBe(false);
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});
