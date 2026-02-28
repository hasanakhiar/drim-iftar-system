import React, { useState, useEffect } from 'react'
import axios from 'axios'

const SERVICES = [
  { name: 'identity-provider', url: 'http://localhost:3001' },
  { name: 'order-gateway', url: 'http://localhost:3002' },
  { name: 'stock-service', url: 'http://localhost:3003' },
  { name: 'kitchen-queue', url: 'http://localhost:3004' },
  { name: 'notification-hub', url: 'http://localhost:3005' },
]

export default function HealthGrid() {
  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(SERVICES.map((s) => [s.name, { up: null, lastChecked: null }]))
  )

  const checkHealth = async () => {
    const now = new Date().toLocaleTimeString()
    const results = await Promise.allSettled(
      SERVICES.map((s) => axios.get(`${s.url}/health`, { timeout: 3000 }))
    )
    setStatuses(
      Object.fromEntries(
        SERVICES.map((s, i) => [
          s.name,
          { up: results[i].status === 'fulfilled', lastChecked: now },
        ])
      )
    )
  }

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section>
      <h2>Service Health</h2>
      <div className="health-grid">
        {SERVICES.map((service) => {
          const info = statuses[service.name]
          const up = info.up
          return (
            <div key={service.name} className="health-card">
              <span className={`status-indicator ${up === null ? '' : up ? 'up' : 'down'}`}>
                ●
              </span>
              <strong>{service.name}</strong>
              <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {up === null ? 'Checking…' : up ? 'UP' : 'DOWN'}
              </div>
              {info.lastChecked && (
                <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.25rem' }}>
                  Last checked: {info.lastChecked}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
