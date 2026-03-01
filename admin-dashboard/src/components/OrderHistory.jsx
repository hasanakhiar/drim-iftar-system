import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function OrderHistory() {
  const [orders, setOrders] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

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

  const totalPages = Math.ceil(orders.length / itemsPerPage)
  const currentOrders = orders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const pages = []
    const windowSize = 2
    
    // Always show first
    pages.push(1)

    if (currentPage > windowSize + 2) pages.push('...')

    for (let i = Math.max(2, currentPage - windowSize); i <= Math.min(totalPages - 1, currentPage + windowSize); i++) {
      pages.push(i)
    }

    if (currentPage < totalPages - windowSize - 1) pages.push('...')

    // Always show last
    if (totalPages > 1) pages.push(totalPages)

    return (
      <div className="pagination">
        <button className="page-btn jump" title="First" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>|&lt;</button>
        <button className="page-btn jump" title="-10" onClick={() => setCurrentPage(Math.max(1, currentPage - 10))} disabled={currentPage === 1}>&lt;&lt;</button>
        
        {pages.map((p, i) => (
          p === '...' ? (
            <span key={`sep-${i}`} style={{ color: 'var(--text-muted)', padding: '0 0.5rem' }}>...</span>
          ) : (
            <button 
              key={p} 
              className={`page-btn ${currentPage === p ? 'active' : ''}`}
              onClick={() => setCurrentPage(p)}
            >
              {p}
            </button>
          )
        ))}

        <button className="page-btn jump" title="+10" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 10))} disabled={currentPage === totalPages}>&gt;&gt;</button>
        <button className="page-btn jump" title="Last" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>&gt;|</button>
      </div>
    )
  }

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
          {currentOrders.map(order => (
            <tr key={order.orderId}>
              <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{order.orderId.slice(0, 8)}...</td>
              <td style={{ fontWeight: '600', color: 'var(--text-main)' }}>ID: {order.studentId}</td>
              <td style={{ color: 'var(--text-main)' }}>Item: {order.itemId}</td>
              <td style={{ color: 'var(--text-main)' }}>Qty: {order.quantity}</td>
              <td>
                <span className={`status-pill ${
                  order.status === 'ready' || order.status === 'confirmed' || order.status === 'stock_verified' ? 'success' : 
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
              <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No orders found in database.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {renderPagination()}
    </div>
  )
}
