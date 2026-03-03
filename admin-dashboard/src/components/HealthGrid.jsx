import React, { useState, useEffect } from 'react'
import axios from 'axios'

const SERVICES = [
  { name: 'identity-provider', url: import.meta.env.VITE_IDENTITY_PROVIDER_URL || 'http://localhost:3001' },
  { name: 'order-gateway', url: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3002' },
  { name: 'stock-service', url: import.meta.env.VITE_STOCK_SERVICE_URL || 'http://localhost:3003' },
  { name: 'kitchen-queue', url: import.meta.env.VITE_KITCHEN_QUEUE_URL || 'http://localhost:3004' },
  { name: 'notification-hub', url: import.meta.env.VITE_NOTIFICATION_HUB_URL || 'http://localhost:3005' },
]

export default function HealthGrid() {
  const [health, setHealth] = useState({})

  useEffect(() => {
    const checkHealth = async () => {
      const statuses = {}
      await Promise.all(
        SERVICES.map(async (service) => {
          try {
            const resp = await axios.get(`${service.url}/health`, { timeout: 2000 })
            statuses[service.name] = { status: 'healthy', ...resp.data }
          } catch (e) {
            statuses[service.name] = { status: 'down' }
          }
        })
      )
      setHealth(statuses)
    }
    checkHealth()
    const interval = setInterval(checkHealth, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="card">
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: 'var(--accent)' }}>📡</span> Service Connectivity
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {SERVICES.map((service) => {
          const info = health[service.name] || { status: 'loading' }
          const isDown = info.status === 'down'
          return (
            <div
              key={service.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
                borderRadius: '0.75rem',
                borderLeft: `4px solid ${isDown ? 'var(--danger)' : 'var(--success)'}`,
                borderTop: '1px solid var(--border)',
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ textTransform: 'capitalize', fontWeight: '600', color: 'var(--text-main)' }}>
                {service.name.replace('-', ' ')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`status-pill ${isDown ? 'danger' : 'success'}`}>
                  {isDown ? 'OFFLINE' : 'ONLINE'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
