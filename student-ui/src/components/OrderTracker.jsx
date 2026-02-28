import React, { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const STATUS_STEPS = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'stock_verified', label: 'Stock Verified' },
  { key: 'in_kitchen', label: 'In Kitchen' },
  { key: 'ready', label: 'Ready' },
]

export default function OrderTracker({ orderId, token }) {
  const [statusHistory, setStatusHistory] = useState(['pending'])
  const [currentStatus, setCurrentStatus] = useState('pending')

  useEffect(() => {
    const socket = io('http://localhost:3005', {
      auth: { token },
    })

    socket.emit('subscribe', orderId)

    socket.on('order-update', (data) => {
      const status = data.status || data
      setCurrentStatus(status)
      setStatusHistory((prev) =>
        prev.includes(status) ? prev : [...prev, status]
      )
    })

    return () => {
      socket.disconnect()
    }
  }, [orderId, token])

  const getStepClass = (stepKey) => {
    const stepIndex = STATUS_STEPS.findIndex((s) => s.key === stepKey)
    const currentIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus)
    if (stepIndex === currentIndex) return 'active'
    if (stepIndex < currentIndex) return 'completed'
    return 'pending'
  }

  return (
    <div>
      <h2>Order Tracker</h2>
      <p style={{ color: '#718096' }}>
        Order ID: <strong>{orderId}</strong>
      </p>

      {currentStatus === 'ready' && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#48bb78',
            padding: '1.5rem',
            background: '#f0fff4',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}
        >
          Your order is Ready! 🎉
        </div>
      )}

      <div>
        {STATUS_STEPS.map((step) => {
          const cls = getStepClass(step.key)
          return (
            <div key={step.key} className={`status-step ${cls}`}>
              <span style={{ fontSize: '1.25rem' }}>
                {cls === 'completed' ? '✅' : cls === 'active' ? '🔄' : '⏳'}
              </span>
              <span>{step.label}</span>
              {cls === 'active' && (
                <span style={{ fontSize: '0.75rem', marginLeft: 'auto' }}>
                  Current
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
