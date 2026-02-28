'use strict';

/**
 * Calculates new stock after a deduction.
 * Throws if stock would go negative.
 * @param {number} currentStock
 * @param {number} quantity
 * @returns {number} newStock
 */
function deductStock(currentStock, quantity) {
  if (typeof currentStock !== 'number' || currentStock < 0) {
    throw new Error('currentStock must be a non-negative number');
  }
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error('quantity must be a positive integer');
  }
  if (quantity > currentStock) {
    throw new Error('Insufficient stock');
  }
  return currentStock - quantity;
}

/**
 * Checks whether an order is idempotent (already processed).
 * @param {Set<string>} processedOrders
 * @param {string} orderId
 * @returns {boolean}
 */
function isAlreadyProcessed(processedOrders, orderId) {
  return processedOrders.has(orderId);
}

module.exports = { deductStock, isAlreadyProcessed };
