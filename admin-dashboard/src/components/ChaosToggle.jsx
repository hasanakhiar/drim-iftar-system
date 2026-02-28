import React, { useState } from 'react'
import axios from 'axios'

const SERVICES = [
  { name: 'identity-provider', url: 'http://localhost:3001' },
  { name: 'order-gateway', url: 'http://localhost:3002' },
  { name: 'stock-service', url: 'http://localhost:3003' },
  { name: 'kitchen-queue', url: 'http://localhost:3004' },
  { name: 'notification-hub', url: 'http://localhost:3005' },
]

export default function ChaosToggle() {
  const [killedServices, setKilledServices] = useState({})
  const [messages, setMessages] = useState({})

  const setMessage = (name, msg) => {
    setMessages((prev) => ({ ...prev, [name]: msg }))
    setTimeout(() => setMessages((prev) => ({ ...prev, [name]: '' })), 3000)
  }

  const killService = async (service) => {
    setKilledServices((prev) => ({ ...prev, [service.name]: true }))
    try {
      await axios.post(`${service.url}/chaos/kill`, {}, { timeout: 3000 })
    } catch {
      // UI state update is intentional even if endpoint is unreachable
    }
    setMessage(service.name, `${service.name} marked as DOWN`)
  }

  const reviveService = async (service) => {
    setKilledServices((prev) => ({ ...prev, [service.name]: false }))
    try {
      await axios.post(`${service.url}/chaos/revive`, {}, { timeout: 3000 })
    } catch {
      // UI state update is intentional even if endpoint is unreachable
    }
    setMessage(service.name, `${service.name} marked as UP`)
  }

  return (
    <section className="chaos-section">
      <h2>⚡ Chaos Engineering</h2>
      <div className="alert-banner" style={{ marginBottom: '1rem' }}>
        ⚠️ Chaos Mode — Use with caution
      </div>
      {SERVICES.map((service) => {
        const isKilled = !!killedServices[service.name]
        return (
          <div
            key={service.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.5rem 0',
              borderBottom: '1px solid #4a5568',
            }}
          >
            <span style={{ flex: 1 }}>{service.name}</span>
            <span
              style={{
                fontSize: '0.85rem',
                color: isKilled ? '#fc8181' : '#68d391',
                minWidth: '4rem',
              }}
            >
              {isKilled ? 'Service is DOWN' : 'Running'}
            </span>
            {!isKilled ? (
              <button className="kill-btn" onClick={() => killService(service)}>
                Kill Service
              </button>
            ) : (
              <button className="revive-btn" onClick={() => reviveService(service)}>
                Revive
              </button>
            )}
            {messages[service.name] && (
              <span style={{ fontSize: '0.75rem', color: '#fbd38d' }}>
                {messages[service.name]}
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}
