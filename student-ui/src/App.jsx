import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Login from './components/Login.jsx'
import OrderPlacer from './components/OrderPlacer.jsx'
import OrderTracker from './components/OrderTracker.jsx'
import MyOrders from './components/MyOrders.jsx'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [orderId, setOrderId] = useState(null)
  const [view, setView] = useState('menu')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [hubOnline, setHubOnline] = useState(true)
  
  // Global Modal State
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info' })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const checkHub = async () => {
      try {
        await axios.get('http://localhost:3005/health', { timeout: 2000 })
        setHubOnline(true)
      } catch (e) {
        setHubOnline(false)
      }
    }
    checkHub()
    const interval = setInterval(checkHub, 5000)
    return () => clearInterval(interval)
  }, [])

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

  const showModal = (title, message, type = 'info') => {
    setModal({ show: true, title, message, type })
  }

  return (
    <div className="container">
      {/* Global Elegant Modal */}
      {modal.show && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1rem', color: modal.type === 'error' ? 'var(--danger)' : 'var(--accent)' }}>
              {modal.title}
            </h2>
            <p style={{ color: 'var(--text-main)', marginBottom: '2rem' }}>{modal.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setModal({ ...modal, show: false })}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {!hubOnline && (
        <div style={{ 
          backgroundColor: 'var(--danger)', 
          color: 'white', 
          textAlign: 'center', 
          padding: '0.5rem', 
          fontSize: '0.8rem', 
          fontWeight: 'bold',
          borderRadius: '0 0 0.5rem 0.5rem',
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          width: 'auto',
          minWidth: '300px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          ⚠️ NOTIFICATION SYSTEM OFFLINE - LIVE UPDATES PAUSED
        </div>
      )}

      <header className="nav-bar" style={{ marginTop: !hubOnline ? '2rem' : '0' }}>
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

      {!token && <Login setToken={handleSetToken} showModal={showModal} />}
      
      {token && !orderId && (
        <div className="fade-in">
          {view === 'menu' ? (
            <OrderPlacer onOrderPlaced={setOrderId} showModal={showModal} />
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
