import React, { useState, useEffect } from 'react'
import Login from './components/Login.jsx'
import OrderPlacer from './components/OrderPlacer.jsx'
import OrderTracker from './components/OrderTracker.jsx'
import MyOrders from './components/MyOrders.jsx'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [orderId, setOrderId] = useState(null)
  const [view, setView] = useState('menu')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const handleSetToken = (newToken) => {
    if (newToken) {
      localStorage.setItem('token', newToken)
    } else {
      localStorage.removeItem('token')
    }
    setToken(newToken)
  }

  const handleLogout = () => {
    handleSetToken(null)
    setOrderId(null)
    setView('menu')
  }

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light')

  return (
    <div className="container">
      <header className="nav-bar">
        <h1>🍽️ IUT Cafeteria</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={toggleTheme} className="theme-toggle" title="Toggle Theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          
          {token && (
            <>
              <button 
                className={`btn ${view === 'menu' ? 'btn-primary' : ''}`}
                onClick={() => { setView('menu'); setOrderId(null); }}
                style={{ background: view === 'menu' ? 'var(--accent)' : 'var(--bg-card)', color: view === 'menu' ? 'white' : 'var(--text-main)', border: `1px solid var(--border)` }}
              >
                Menu
              </button>
              <button 
                className={`btn ${view === 'history' ? 'btn-primary' : ''}`}
                onClick={() => { setView('history'); setOrderId(null); }}
                style={{ background: view === 'history' ? 'var(--accent)' : 'var(--bg-card)', color: view === 'history' ? 'white' : 'var(--text-main)', border: `1px solid var(--border)` }}
              >
                My Orders
              </button>
              <button onClick={handleLogout} className="btn btn-danger">Logout</button>
            </>
          )}
        </div>
      </header>

      {!token && <Login setToken={handleSetToken} />}
      
      {token && !orderId && (
        <div className="fade-in">
          {view === 'menu' ? (
            <OrderPlacer onOrderPlaced={setOrderId} />
          ) : (
            <MyOrders onSelectOrder={setOrderId} />
          )}
        </div>
      )}
      
      {token && orderId && (
        <div className="fade-in">
          <button 
            onClick={() => setOrderId(null)}
            style={{ marginBottom: '1.5rem', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>←</span> Back to {view === 'menu' ? 'Menu' : 'History'}
          </button>
          <OrderTracker orderId={orderId} />
        </div>
      )}
    </div>
  )
}
