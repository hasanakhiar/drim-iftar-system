import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function OrderPlacer({ onOrderPlaced }) {
  const [items, setItems] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchStock = async () => {
    try {
      const token = localStorage.getItem('token')
      const resp = await axios.get('http://localhost:3002/stock', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setItems(resp.data)
    } catch (e) {
      console.error('Failed to fetch stock')
    }
  }

  useEffect(() => {
    fetchStock()
    const interval = setInterval(fetchStock, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleOrder = async (itemId) => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const resp = await axios.post(
        'http://localhost:3002/orders',
        { itemId, quantity },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      onOrderPlaced(resp.data.orderId)
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.reload();
      }
      setError(err.response?.data?.error || 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="order-placer card">
      <h3 style={{ marginBottom: '1.5rem' }}>🍱 Place Your Iftar Order</h3>
      {error && <div className="error-msg">{error}</div>}
      
      <div className="quantity-selector" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontWeight: '600' }}>Quantity:</span>
        <input 
          type="number" 
          min="1" 
          max="20"
          className="form-input"
          value={quantity} 
          onChange={(e) => setQuantity(parseInt(e.target.value))}
          style={{ width: '80px' }}
        />
      </div>

      <div className="items-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {items.map((item) => {
          const isOutOfStock = item.stock <= 0
          const insufficientForDesired = item.stock < quantity
          
          return (
            <div 
              key={item.itemId} 
              style={{ 
                padding: '1.25rem', 
                border: '1px solid var(--border)', 
                borderRadius: '0.75rem',
                opacity: isOutOfStock ? 0.6 : 1,
                backgroundColor: 'rgba(99, 102, 241, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                position: 'relative'
              }}
            >
              <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-main)' }}>{item.name}</div>
              <div style={{ fontSize: '0.9rem', color: isOutOfStock ? 'var(--danger)' : 'var(--text-muted)' }}>
                {isOutOfStock ? '● Sold Out' : `● ${item.stock} in stock`}
              </div>
              
              <button
                onClick={() => handleOrder(item.itemId)}
                disabled={loading || isOutOfStock || insufficientForDesired}
                className="btn btn-primary"
                style={{
                  marginTop: '0.5rem',
                  opacity: (isOutOfStock || insufficientForDesired) ? 0.5 : 1,
                  backgroundColor: (isOutOfStock || insufficientForDesired) ? 'var(--text-muted)' : 'var(--accent)'
                }}
              >
                {isOutOfStock ? 'Out of Stock' : insufficientForDesired ? 'Insufficient Stock' : 'Order Now'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
