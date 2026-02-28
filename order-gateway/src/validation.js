'use strict';

/**
 * Validates an incoming order request body.
 * Returns { valid: true } or { valid: false, error: string }
 */
function validateOrder(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }
  const { itemId, quantity } = body;
  if (!itemId || typeof itemId !== 'string' || itemId.trim() === '') {
    return { valid: false, error: 'itemId is required and must be a non-empty string' };
  }
  if (quantity === undefined || quantity === null) {
    return { valid: false, error: 'quantity is required' };
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
    return { valid: false, error: 'quantity must be an integer between 1 and 100' };
  }
  return { valid: true };
}

module.exports = { validateOrder };
