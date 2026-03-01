import React, { useState, useEffect } from 'react'
import HealthGrid from './components/HealthGrid'
import LiveMetrics from './components/LiveMetrics'
import ChaosToggle from './components/ChaosToggle'
import InventoryManager from './components/InventoryManager'
import OrderHistory from './components/OrderHistory'

function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [theme, setTheme] = useState(localStorage.getItem('admin-theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('admin-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  return (
    <div className="admin-container">
      <aside className="sidebar">
        <h1>🌙 Iftar Admin</h1>
        <nav style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem' }}>
          <button 
            className={`nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 System Overview
          </button>
          <button 
            className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            🍱 Inventory
          </button>
          <button 
            className={`nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            🧾 Order Records
          </button>
        </nav>
        
        <button onClick={toggleTheme} className="theme-toggle">
          {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </button>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', marginTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Microservices V2.5
          </div>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === 'overview' && (
          <>
            <header className="section-header" style={{ marginBottom: '2rem' }}>
              <h2>System Dashboard</h2>
              <p style={{ color: 'var(--text-muted)' }}>Real-time health and performance monitoring</p>
            </header>
            
            <div style={{ marginBottom: '2rem' }}>
              <LiveMetrics />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }}>
              <HealthGrid />
              <ChaosToggle />
            </div>
          </>
        )}

        {activeTab === 'inventory' && (
          <>
            <header className="section-header" style={{ marginBottom: '2rem' }}>
              <h2>Inventory Management</h2>
              <p style={{ color: 'var(--text-muted)' }}>Control food items and stock levels</p>
            </header>
            <InventoryManager />
          </>
        )}

        {activeTab === 'orders' && (
          <>
            <header className="section-header" style={{ marginBottom: '2rem' }}>
              <h2>Order History</h2>
              <p style={{ color: 'var(--text-muted)' }}>Review all student orders fetched from DB</p>
            </header>
            <OrderHistory />
          </>
        )}
      </main>
    </div>
  )
}

export default App
