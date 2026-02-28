'use strict';

const { deductStock, isAlreadyProcessed } = require('../src/stockUtils');

describe('deductStock', () => {
  test('deducts stock correctly', () => {
    expect(deductStock(100, 3)).toBe(97);
  });

  test('deducts full stock to zero', () => {
    expect(deductStock(5, 5)).toBe(0);
  });

  test('throws on insufficient stock', () => {
    expect(() => deductStock(2, 5)).toThrow('Insufficient stock');
  });

  test('throws on negative current stock', () => {
    expect(() => deductStock(-1, 1)).toThrow();
  });

  test('throws on zero quantity', () => {
    expect(() => deductStock(10, 0)).toThrow();
  });

  test('throws on non-integer quantity', () => {
    expect(() => deductStock(10, 1.5)).toThrow();
  });

  test('throws on negative quantity', () => {
    expect(() => deductStock(10, -1)).toThrow();
  });

  test('deducts quantity of 1 from stock of 1', () => {
    expect(deductStock(1, 1)).toBe(0);
  });
});

describe('isAlreadyProcessed', () => {
  test('returns true for already processed order', () => {
    const processed = new Set(['order-123']);
    expect(isAlreadyProcessed(processed, 'order-123')).toBe(true);
  });

  test('returns false for new order', () => {
    const processed = new Set(['order-123']);
    expect(isAlreadyProcessed(processed, 'order-456')).toBe(false);
  });

  test('returns false for empty set', () => {
    const processed = new Set();
    expect(isAlreadyProcessed(processed, 'order-789')).toBe(false);
  });
});
