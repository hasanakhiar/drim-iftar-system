import React, { useState, useEffect } from 'react'
import axios from 'axios'

const SERVICES = [
  { name: 'Identity Provider', key: 'identity-provider', url: import.meta.env.VITE_IDENTITY_PROVIDER_URL || 'http://localhost:3001' },
  { name: 'Order Gateway', key: 'order-gateway', url: import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3002' },
  { name: 'Stock Service', key: 'stock-service', url: import.meta.env.VITE_STOCK_SERVICE_URL || 'http://localhost:3003' },
  { name: 'Kitchen Queue', key: 'kitchen-queue', url: import.meta.env.VITE_KITCHEN_QUEUE_URL || 'http://localhost:3004' },
  { name: 'Notification Hub', key: 'notification-hub', url: import.meta.env.VITE_NOTIFICATION_HUB_URL || 'http://localhost:3005' },
]

export default function ChaosToggle() {
  const [killedServices, setKilledServices] = useState({})
  const [loading, setLoading] = useState({})
  const [modal, setModal] = useState({ show: false, message: '' })

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
      setModal({ show: true, message: `Failed to ${endpoint} ${service.name}. Service might be unreachable.` })
    } finally {
      setLoading(prev => ({ ...prev, [service.key]: false }))
    }
  }

  return (
    <div className="card">
      {/* Custom Modal */}
      {modal.show && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: '1rem', color: 'var(--danger)' }}>⚠️ Chaos Control Error</h2>
            <p style={{ color: 'var(--text-main)', marginBottom: '2rem' }}>{modal.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setModal({ show: false, message: '' })}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

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
