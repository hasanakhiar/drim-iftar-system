import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function OrderPlacer({ onOrderPlaced, showModal }) {
  const [items, setItems] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)

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
        return
      }
      showModal('❌ Order Failed', err.response?.data?.error || 'Failed to place order. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const adjustQty = (amount) => {
    setQuantity(prev => {
      const newVal = prev + amount
      return newVal >= 1 && newVal <= 20 ? newVal : prev
    })
  }

  return (
    <div className="order-placer card">
      <h3 style={{ marginBottom: '1.5rem' }}>🍱 Place Your Iftar Order</h3>
      
      <div className="quantity-selector" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>Select Quantity:</span>
        <div className="qty-selector">
          <button 
            type="button" 
            className="qty-btn" 
            onClick={() => adjustQty(-1)}
            disabled={quantity <= 1}
          >
            −
          </button>
          <input 
            type="number" 
            className="qty-input"
            value={quantity} 
            readOnly
          />
          <button 
            type="button" 
            className="qty-btn" 
            onClick={() => adjustQty(1)}
            disabled={quantity >= 20}
          >
            +
          </button>
        </div>
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
