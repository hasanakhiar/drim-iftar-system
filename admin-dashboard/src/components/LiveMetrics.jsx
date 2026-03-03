import React, { useState, useEffect } from 'react'
import axios from 'axios'

const SERVICES = [
  { name: 'Identity Provider', url: import.meta.env.VITE_IDENTITY_PROVIDER_URL || 'http://localhost:3001' },
  { name: 'Order Gateway', url: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3002' },
  { name: 'Stock Service', url: import.meta.env.VITE_STOCK_SERVICE_URL || 'http://localhost:3003' },
  { name: 'Kitchen Queue', url: import.meta.env.VITE_KITCHEN_QUEUE_URL || 'http://localhost:3004' },
  { name: 'Notification Hub', url: import.meta.env.VITE_NOTIFICATION_HUB_URL || 'http://localhost:3005' },
]

export default function LiveMetrics() {
  const [metrics, setMetrics] = useState({})

  useEffect(() => {
    const fetchMetrics = async () => {
      const data = {}
      await Promise.all(
        SERVICES.map(async (s) => {
          try {
            const resp = await axios.get(`${s.url}/metrics`)
            data[s.name] = resp.data
          } catch (e) {}
        })
      )
      setMetrics(data)
    }
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', width: '100%' }}>
      {SERVICES.map((s) => {
        const m = metrics[s.name] || {}
        const totalValue = m.totalRequests ?? m.totalProcessed ?? m.totalNotifications ?? 0
        const label = s.name === 'Notification Hub' ? 'Notifications Sent' : 
                      s.name === 'Kitchen Queue' ? 'Orders Prepared' : 'Total Requests'

        return (
          <div key={s.name} className="card" style={{ marginBottom: 0, padding: '1.25rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              {s.name}
            </div>
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '700' }}>{totalValue}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Avg Latency:</span>
              <span style={{ color: (m.avgLatency > 1000 || m.alert) ? 'var(--danger)' : 'var(--success)', fontWeight: '600' }}>
                {Math.round(m.avgLatency || 0)}ms
              </span>
            </div>
            {m.failureCount > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                ⚠️ {m.failureCount} errors detected
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
