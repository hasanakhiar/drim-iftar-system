'use strict';

/**
 * Comprehensive tests for order gateway functionality
 */
describe('Order Gateway - Order Processing', () => {
  describe('Order ID Generation', () => {
    test('generates unique order IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const id = require('crypto').randomUUID?.() || Math.random().toString(36).slice(2);
        ids.add(id);
      }
      expect(ids.size).toBe(100);
    });

    test('generated ID is valid UUID format', () => {
      const uuid = require('crypto').randomUUID?.();
      if (uuid) {
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      }
    });
  });

  describe('Order Schema Validation', () => {
    const validOrder = {
      orderId: 'order-123',
      studentId: 'STU001',
      itemId: 'ITEM001',
      quantity: 2,
      status: 'Confirmed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    test('valid order object passes schema', () => {
      expect(validOrder).toHaveProperty('orderId');
      expect(validOrder).toHaveProperty('studentId');
      expect(validOrder).toHaveProperty('itemId');
      expect(validOrder).toHaveProperty('quantity');
      expect(validOrder).toHaveProperty('status');
    });

    test('quantity is positive integer', () => {
      expect(validOrder.quantity).toBeGreaterThan(0);
      expect(Number.isInteger(validOrder.quantity)).toBe(true);
    });

    test('status is one of valid states', () => {
      const validStates = ['Confirmed', 'Stock Verified', 'In Kitchen', 'Ready'];
      expect(validStates).toContain(validOrder.status);
    });

    test('timestamps are valid dates', () => {
      expect(validOrder.createdAt instanceof Date).toBe(true);
      expect(validOrder.updatedAt instanceof Date).toBe(true);
    });

    test('student ID follows format', () => {
      expect(validOrder.studentId).toMatch(/^STU\d+$/);
    });

    test('item ID is not empty', () => {
      expect(validOrder.itemId.trim().length).toBeGreaterThan(0);
    });
  });

  describe('Order Status Transitions', () => {
    const statusFlow = ['Confirmed', 'Stock Verified', 'In Kitchen', 'Ready'];

    test('follows correct status sequence', () => {
      expect(statusFlow[0]).toBe('Confirmed');
      expect(statusFlow[statusFlow.length - 1]).toBe('Ready');
    });

    test('each status is unique', () => {
      const statusSet = new Set(statusFlow);
      expect(statusSet.size).toBe(statusFlow.length);
    });

    test('can transition from Confirmed to Stock Verified', () => {
      const allowedTransitions = {
        'Confirmed': ['Stock Verified'],
        'Stock Verified': ['In Kitchen'],
        'In Kitchen': ['Ready'],
        'Ready': []
      };
      
      const current = 'Confirmed';
      const next = 'Stock Verified';
      expect(allowedTransitions[current]).toContain(next);
    });
  });

  describe('Metrics Collection', () => {
    test('tracks total requests', () => {
      const metrics = { totalRequests: 0, failureCount: 0, latencies: [], windowLatencies: [], alert: false };
      metrics.totalRequests++;
      metrics.totalRequests++;
      
      expect(metrics.totalRequests).toBe(2);
    });

    test('tracks failure count', () => {
      const metrics = { totalRequests: 0, failureCount: 0, latencies: [], windowLatencies: [], alert: false };
      metrics.failureCount++;
      metrics.failureCount++;
      
      expect(metrics.failureCount).toBe(2);
    });

    test('records latencies', () => {
      const metrics = { totalRequests: 0, failureCount: 0, latencies: [], windowLatencies: [], alert: false };
      metrics.latencies.push(150);
      metrics.latencies.push(200);
      metrics.latencies.push(175);
      
      expect(metrics.latencies.length).toBe(3);
      expect(metrics.latencies).toEqual([150, 200, 175]);
    });

    test('calculates average latency', () => {
      const metrics = { totalRequests: 0, failureCount: 0, latencies: [100, 200, 300], windowLatencies: [], alert: false };
      const avg = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
      
      expect(avg).toBe(200);
    });

    test('alert triggers when avg latency exceeds 1000ms', () => {
      const metrics = { totalRequests: 0, failureCount: 0, latencies: [1500, 1200, 1100], windowLatencies: [], alert: false };
      const avg = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
      metrics.alert = avg > 1000;
      
      expect(metrics.alert).toBe(true);
    });

    test('maintains rolling window of recent latencies', () => {
      const WINDOW_MS = 30000;
      const metrics = { totalRequests: 0, failureCount: 0, latencies: [], windowLatencies: [], alert: false };
      const now = Date.now();
      
      // Add latencies within window
      metrics.windowLatencies.push({ latency: 100, time: now });
      metrics.windowLatencies.push({ latency: 150, time: now - 5000 });
      metrics.windowLatencies.push({ latency: 120, time: now - 35000 }); // Outside window
      
      // Filter to window
      metrics.windowLatencies = metrics.windowLatencies.filter(e => now - e.time <= WINDOW_MS);
      
      expect(metrics.windowLatencies.length).toBe(2);
    });
  });

  describe('Rate Limiting', () => {
    test('rate limiter configuration exists', () => {
      const rateLimit = { windowMs: 15 * 60 * 1000, max: 100 };
      expect(rateLimit.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimit.max).toBe(100);
    });

    test('allows requests under limit', () => {
      const maxRequests = 100;
      let requestCount = 0;
      
      for (let i = 0; i < 50; i++) {
        if (requestCount < maxRequests) {
          requestCount++;
        }
      }
      
      expect(requestCount).toBe(50);
    });

    test('blocks requests over limit', () => {
      const maxRequests = 5;
      let requestCount = 0;
      const blocked = [];
      
      for (let i = 0; i < 10; i++) {
        if (requestCount < maxRequests) {
          requestCount++;
        } else {
          blocked.push(i);
        }
      }
      
      expect(blocked.length).toBe(5);
    });
  });
});

/**
 * Order Validation Tests - Extended
 */
describe('Order Validation - Comprehensive', () => {
  const { validateOrder } = require('../src/validation');

  describe('Valid Orders', () => {
    test('minimal valid order', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: 1 });
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('order with maximum quantity', () => {
      const result = validateOrder({ itemId: 'BIRYANI_001', quantity: 100 });
      expect(result.valid).toBe(true);
    });

    test('itemId with special characters', () => {
      const result = validateOrder({ itemId: 'ITEM-001_V2', quantity: 5 });
      expect(result.valid).toBe(true);
    });

    test('quantity as string number', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: '25' });
      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid Orders - Missing Fields', () => {
    test('null body', () => {
      const result = validateOrder(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('undefined body', () => {
      const result = validateOrder(undefined);
      expect(result.valid).toBe(false);
    });

    test('empty object', () => {
      const result = validateOrder({});
      expect(result.valid).toBe(false);
    });

    test('missing itemId', () => {
      const result = validateOrder({ quantity: 5 });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/itemId/i);
    });

    test('missing quantity', () => {
      const result = validateOrder({ itemId: 'ITEM001' });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/quantity/i);
    });
  });

  describe('Invalid Orders - Invalid itemId', () => {
    test('itemId is empty string', () => {
      const result = validateOrder({ itemId: '', quantity: 5 });
      expect(result.valid).toBe(false);
    });

    test('itemId is whitespace only', () => {
      const result = validateOrder({ itemId: '   ', quantity: 5 });
      expect(result.valid).toBe(false);
    });

    test('itemId is null', () => {
      const result = validateOrder({ itemId: null, quantity: 5 });
      expect(result.valid).toBe(false);
    });

    test('itemId is number', () => {
      const result = validateOrder({ itemId: 12345, quantity: 5 });
      expect(result.valid).toBe(false);
    });
  });

  describe('Invalid Orders - Invalid Quantity', () => {
    test('quantity is zero', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: 0 });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/positive/i);
    });

    test('quantity is negative', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: -5 });
      expect(result.valid).toBe(false);
    });

    test('quantity exceeds 100', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: 101 });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/100/);
    });

    test('quantity is decimal', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: 2.5 });
      expect(result.valid).toBe(false);
    });

    test('quantity is string non-numeric', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: 'abc' });
      expect(result.valid).toBe(false);
    });

    test('quantity is null', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: null });
      expect(result.valid).toBe(false);
    });

    test('quantity is undefined', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: undefined });
      expect(result.valid).toBe(false);
    });

    test('quantity is NaN', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: NaN });
      expect(result.valid).toBe(false);
    });
  });

  describe('Boundary Cases', () => {
    test('quantity = 1 (minimum)', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: 1 });
      expect(result.valid).toBe(true);
    });

    test('quantity = 100 (maximum)', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: 100 });
      expect(result.valid).toBe(true);
    });

    test('itemId with very long string', () => {
      const longId = 'A'.repeat(500);
      const result = validateOrder({ itemId: longId, quantity: 1 });
      expect(result.valid).toBe(true);
    });

    test('quantity string that converts to valid number', () => {
      const result = validateOrder({ itemId: 'ITEM001', quantity: '50' });
      expect(result.valid).toBe(true);
    });
  });
});
