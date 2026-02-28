'use strict';

const { validateOrder } = require('../src/validation');

describe('validateOrder', () => {
  test('valid order passes validation', () => {
    expect(validateOrder({ itemId: 'ITEM001', quantity: 2 })).toEqual({ valid: true });
  });

  test('missing body fails validation', () => {
    const result = validateOrder(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('missing itemId fails validation', () => {
    const result = validateOrder({ quantity: 1 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/itemId/);
  });

  test('empty itemId fails validation', () => {
    const result = validateOrder({ itemId: '  ', quantity: 1 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/itemId/);
  });

  test('missing quantity fails validation', () => {
    const result = validateOrder({ itemId: 'ITEM001' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/quantity/);
  });

  test('zero quantity fails validation', () => {
    const result = validateOrder({ itemId: 'ITEM001', quantity: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/quantity/);
  });

  test('quantity over 100 fails validation', () => {
    const result = validateOrder({ itemId: 'ITEM001', quantity: 101 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/quantity/);
  });

  test('non-integer quantity fails validation', () => {
    const result = validateOrder({ itemId: 'ITEM001', quantity: 1.5 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/quantity/);
  });

  test('string quantity that is a valid integer passes', () => {
    expect(validateOrder({ itemId: 'ITEM001', quantity: '5' })).toEqual({ valid: true });
  });

  test('maximum valid quantity (100) passes', () => {
    expect(validateOrder({ itemId: 'ITEM001', quantity: 100 })).toEqual({ valid: true });
  });
});
