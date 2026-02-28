import React, { useState, useEffect } from 'react'
import axios from 'axios'

const SERVICES = [
  { name: 'identity-provider', url: 'http://localhost:3001' },
  { name: 'order-gateway', url: 'http://localhost:3002' },
  { name: 'stock-service', url: 'http://localhost:3003' },
  { name: 'kitchen-queue', url: 'http://localhost:3004' },
  { name: 'notification-hub', url: 'http://localhost:3005' },
]

export default function LiveMetrics() {
  const [metrics, setMetrics] = useState(() =>
    Object.fromEntries(SERVICES.map((s) => [s.name, null]))
  )

  const fetchMetrics = async () => {
    const results = await Promise.allSettled(
      SERVICES.map((s) => axios.get(`${s.url}/metrics`, { timeout: 3000 }))
    )
    setMetrics(
      Object.fromEntries(
        SERVICES.map((s, i) => [
          s.name,
          results[i].status === 'fulfilled' ? results[i].value.data : null,
        ])
      )
    )
  }

  useEffect(() => {
    fetchMetrics()
    const interval = setInterval(fetchMetrics, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section style={{ marginTop: '2rem' }}>
      <h2>Live Metrics</h2>
      <div className="metrics-grid">
        {SERVICES.map((service) => {
          const data = metrics[service.name]
          return (
            <div key={service.name} className="metric-card">
              <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                {service.name}
              </strong>
              {data === null ? (
                <span style={{ color: '#718096', fontSize: '0.85rem' }}>Unavailable</span>
              ) : (
                <>
                  <div>Requests: {data.totalRequests ?? data.totalProcessed ?? '—'}</div>
                  <div>Failures: {data.failureCount ?? '—'}</div>
                  <div>Avg Latency: {data.avgLatency != null ? `${data.avgLatency} ms` : '—'}</div>
                  {service.name === 'order-gateway' && data.alert && (
                    <div className="alert-banner" style={{ marginTop: '0.5rem' }}>
                      ⚠️ High Latency Alert!
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
