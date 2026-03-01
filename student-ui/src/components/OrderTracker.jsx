import React, { useEffect, useState, useRef } from 'react'
import { io } from 'socket.io-client'

const STATUS_STEPS = [
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'stock_verified', label: 'Stock Verified' },
  { key: 'in_kitchen', label: 'In Kitchen' },
  { key: 'ready', label: 'Ready' },
  { key: 'failed_insufficient_stock', label: 'Insufficient Stock', failed: true },
]

export default function OrderTracker({ orderId }) {
  const [currentStatus, setCurrentStatus] = useState('pending')
  const [connected, setConnected] = useState(false)
  const [hasAttempted, setHasAttempted] = useState(false)
  const socketRef = useRef(null)

  const connectSocket = () => {
    if (socketRef.current) socketRef.current.disconnect()

    const socket = io('http://localhost:3005', {
      reconnectionAttempts: 10,
      timeout: 5000,
      transports: ['websocket', 'polling']
    })

    socket.on('connect', () => {
      setConnected(true)
      setHasAttempted(true)
      socket.emit('subscribe', orderId)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', () => {
      setConnected(false)
      setHasAttempted(true)
    })

    socket.on('order-update', (data) => {
      if (data.orderId === orderId) {
        setCurrentStatus(data.status)
      }
    })

    socketRef.current = socket
  }

  useEffect(() => {
    connectSocket()
    const timer = setTimeout(() => setHasAttempted(true), 500)
    return () => {
      if (socketRef.current) socketRef.current.disconnect()
      clearTimeout(timer)
    }
  }, [orderId])

  const getStepIndex = (status) => {
    return STATUS_STEPS.findIndex((s) => s.key === status)
  }

  const currentIndex = getStepIndex(currentStatus)
  const isFailed = STATUS_STEPS[currentIndex]?.failed

  return (
    <div className="order-tracker card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3 style={{ margin: 0 }}>📦 Order Tracking</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
          <span style={{ 
            width: '10px', height: '10px', borderRadius: '50%', 
            backgroundColor: connected ? 'var(--success)' : 'var(--danger)',
            boxShadow: connected ? '0 0 10px var(--success)' : 'none'
          }}></span>
          <span style={{ fontWeight: '700', color: connected ? 'var(--success)' : 'var(--danger)' }}>
            {connected ? 'LIVE UPDATES ACTIVE' : 'NOTIFICATION HUB OFFLINE'}
          </span>
        </div>
      </div>

      {!connected && hasAttempted && !isFailed && currentStatus !== 'ready' && (
        <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '0.75rem', color: 'var(--danger)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          <div style={{ fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
            <span>⚠️ SYSTEM ALERT: NOTIFICATION SERVICE DOWN</span>
            <button 
              onClick={connectSocket}
              style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem', backgroundColor: 'var(--danger)', color: 'white', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
            >
              Retry Connection
            </button>
          </div>
          The real-time status service is currently offline. 
          <strong> Note:</strong> Your order is still being processed normally by the kitchen, but progress updates are currently paused on this screen.
        </div>
      )}
      
      <div className="steps-container" style={{ padding: '0 0.5rem' }}>
        {STATUS_STEPS.filter(s => !s.failed || s.key === currentStatus).map((step, index) => {
          const stepIdx = STATUS_STEPS.indexOf(step)
          const isCompleted = !isFailed && currentIndex >= stepIdx
          const isActive = currentIndex === stepIdx

          return (
            <div 
              key={step.key} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                marginBottom: '1.5rem',
                opacity: (isFailed && !isActive) ? 0.4 : 1,
                position: 'relative'
              }}
            >
              <div 
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: step.failed ? 'var(--danger)' : isCompleted ? 'var(--success)' : 'var(--bg-app)',
                  color: isCompleted || step.failed ? 'white' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  zIndex: 2,
                  border: isCompleted || step.failed ? 'none' : '2px solid var(--border)',
                  boxShadow: isActive ? `0 0 0 4px rgba(99, 102, 241, 0.2)` : 'none'
                }}
              >
                {step.failed ? '✕' : isCompleted ? '✓' : index + 1}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: isActive ? '800' : '600', 
                  color: step.failed ? 'var(--danger)' : isCompleted ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--text-main)',
                  fontSize: '1.1rem'
                }}>
                  {step.label}
                </div>
                {isActive && !isFailed && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    {step.key === 'ready' ? 'Your Iftar is ready for pickup!' : 'Order is currently at this stage.'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isFailed && (
        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '0.75rem', color: 'var(--danger)' }}>
          <strong>Order Blocked:</strong> The requested quantity exceeds available stock.
        </div>
      )}
    </div>
  )
}
