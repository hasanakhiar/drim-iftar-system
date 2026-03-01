import React, { useState, useEffect } from 'react'
import axios from 'axios'

const SERVICES = [
  { name: 'Identity Provider', key: 'identity-provider', url: 'http://localhost:3001' },
  { name: 'Order Gateway', key: 'order-gateway', url: 'http://localhost:3002' },
  { name: 'Stock Service', key: 'stock-service', url: 'http://localhost:3003' },
  { name: 'Kitchen Queue', key: 'kitchen-queue', url: 'http://localhost:3004' },
  { name: 'Notification Hub', key: 'notification-hub', url: 'http://localhost:3005' },
]

export default function ChaosToggle() {
  const [killedServices, setKilledServices] = useState({})
  const [loading, setLoading] = useState({})

  useEffect(() => {
    const fetchStatuses = async () => {
      const statuses = {}
      await Promise.all(
        SERVICES.map(async (service) => {
          try {
            const resp = await axios.get(`${service.url}/chaos/status`, { timeout: 2000 })
            statuses[service.key] = resp.data.chaosMode
          } catch (e) {
            console.error(`Failed to fetch status for ${service.key}`)
          }
        })
      )
      setKilledServices(statuses)
    }
    fetchStatuses()
  }, [])

  const toggleChaos = async (service) => {
    const isKilled = killedServices[service.key]
    const endpoint = isKilled ? 'revive' : 'kill'
    
    setLoading(prev => ({ ...prev, [service.key]: true }))
    try {
      await axios.post(`${service.url}/chaos/${endpoint}`, {}, { timeout: 3000 })
      setKilledServices(prev => ({ ...prev, [service.key]: !isKilled }))
    } catch (e) {
      alert(`Failed to ${endpoint} ${service.name}`)
    } finally {
      setLoading(prev => ({ ...prev, [service.key]: false }))
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: 'var(--warning)' }}>⚡</span> Chaos Controls
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {SERVICES.map((service) => {
          const isKilled = !!killedServices[service.key]
          return (
            <div
              key={service.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                backgroundColor: 'rgba(99, 102, 241, 0.04)',
                borderRadius: '0.75rem',
                border: `1px solid ${isKilled ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`,
              }}
            >
              <div>
                <div style={{ fontWeight: '700', marginBottom: '0.25rem', color: 'var(--text-main)' }}>{service.name}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: isKilled ? 'var(--danger)' : 'var(--success)' }}>
                  ● {isKilled ? 'SIMULATING OUTAGE' : 'RUNNING NORMALLY'}
                </div>
              </div>
              <button
                className={`btn ${isKilled ? 'btn-success' : 'btn-danger'}`}
                disabled={loading[service.key]}
                onClick={() => toggleChaos(service)}
                style={{ minWidth: '110px', fontSize: '0.85rem' }}
              >
                {loading[service.key] ? '...' : isKilled ? 'REVIVE' : 'TERMINATE'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
