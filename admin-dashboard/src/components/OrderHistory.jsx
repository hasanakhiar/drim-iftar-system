import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function OrderHistory() {
  const [orders, setOrders] = useState([])

  const fetchOrders = async () => {
    try {
      const resp = await axios.get('http://localhost:3002/admin/orders')
      setOrders(resp.data)
    } catch (e) {
      console.error('Failed to fetch orders')
    }
  }

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="card">
      <h3 style={{ marginBottom: '1.5rem' }}>Full Order Records (Database)</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Student ID</th>
            <th>Item ID</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.orderId}>
              <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{order.orderId.slice(0, 8)}...</td>
              <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>ID: {order.studentId}</td>
              <td style={{ color: 'var(--text-main)' }}>Item: {order.itemId}</td>
              <td style={{ color: 'var(--text-main)' }}>Qty: {order.quantity}</td>
              <td>
                <span className={`status-pill ${
                  order.status === 'ready' ? 'success' : 
                  order.status === 'confirmed' ? 'warning' : 
                  'danger'
                }`}>
                  {order.status}
                </span>
              </td>
              <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {new Date(order.createdAt).toLocaleTimeString()}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No orders found in database.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
