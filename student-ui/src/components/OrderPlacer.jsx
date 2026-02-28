import React, { useState } from 'react'
import axios from 'axios'

const ITEMS = [
  { id: 'ITEM001', name: 'Biryani' },
  { id: 'ITEM002', name: 'Rice' },
  { id: 'ITEM003', name: 'Kebab' },
]

export default function OrderPlacer({ token, setOrderId }) {
  const [itemId, setItemId] = useState('ITEM001')
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post(
        'http://localhost:3002/orders',
        { itemId, quantity: Number(quantity) },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setOrderId(data.orderId)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to place order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>Place Your Order</h2>
      <form onSubmit={handleSubmit}>
        <label>Select Item</label>
        <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {ITEMS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <label>Quantity</label>
        <input
          type="number"
          min="1"
          max="10"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Placing Order…' : 'Place Order'}
        </button>
      </form>
    </div>
  )
}
