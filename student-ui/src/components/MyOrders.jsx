import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function MyOrders({ onSelectOrder }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token')
      const resp = await axios.get('http://localhost:3002/orders', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setOrders(resp.data)
    } catch (e) {
      console.error('Failed to fetch my orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  if (loading) return <div style={{ color: 'var(--text-main)' }}>Loading orders...</div>

  return (
    <div className="my-orders card">
      <h3 style={{ marginBottom: '1.5rem' }}>📜 My Order History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {orders.map((order) => (
          <div 
            key={order.orderId} 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              backgroundColor: 'rgba(99, 102, 241, 0.03)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => onSelectOrder(order.orderId)}
            className="hover-card"
          >
            <div>
              <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '1.05rem' }}>{order.itemId}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {new Date(order.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className={`status-pill ${
                order.status === 'ready' || order.status === 'confirmed' || order.status === 'stock_verified' ? 'success' : 
                order.status.includes('failed') ? 'danger' : 
                'warning'
              }`}>
                {order.status.replace('_', ' ')}
              </span>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>→</span>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📦</div>
            You haven't placed any orders yet.
          </div>
        )}
      </div>
    </div>
  )
}
