import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function InventoryManager() {
  const [items, setItems] = useState([])
  const [formData, setFormData] = useState({ itemId: '', name: '', stock: 0 })
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  
  // Modal state
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info', confirm: null })

  const fetchStock = async () => {
    try {
      const resp = await axios.get('http://localhost:3003/stock')
      setItems(resp.data)
    } catch (e) {
      console.error('Failed to fetch stock')
    }
  }

  useEffect(() => {
    fetchStock()
    const interval = setInterval(fetchStock, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isEditing) {
      setModal({ 
        show: true, 
        title: '📝 Confirm Update', 
        message: `Are you sure you want to update "${formData.name}"?`, 
        type: 'confirm',
        confirm: executeSubmit
      })
    } else {
      executeSubmit()
    }
  }

  const executeSubmit = async () => {
    setLoading(true)
    try {
      await axios.post('http://localhost:3003/stock', formData)
      setFormData({ itemId: '', name: '', stock: 0 })
      setIsEditing(false)
      setModal({ 
        show: true, 
        title: '✅ Success', 
        message: 'Item saved successfully.', 
        type: 'success' 
      })
      fetchStock()
    } catch (e) {
      setModal({ 
        show: true, 
        title: '❌ Error', 
        message: 'Operation failed. Please try again.', 
        type: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item) => {
    setFormData({ itemId: item.itemId, name: item.name, stock: item.stock })
    setIsEditing(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteClick = (item) => {
    setModal({ 
      show: true, 
      title: '⚠️ Confirm Deletion', 
      message: `Permanently delete "${item.name}"? This action cannot be undone.`, 
      type: 'delete',
      data: item,
      confirm: () => executeDelete(item)
    })
  }

  const executeDelete = async (item) => {
    setLoading(true)
    try {
      await axios.delete(`http://localhost:3003/stock/${item.itemId}`)
      setModal({ 
        show: true, 
        title: '🗑️ Deleted', 
        message: 'Item removed from inventory.', 
        type: 'success' 
      })
      fetchStock()
    } catch (e) {
      setModal({ 
        show: true, 
        title: '❌ Error', 
        message: 'Failed to delete item.', 
        type: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  const adjustStock = (amount) => {
    setFormData(prev => ({
      ...prev,
      stock: Math.max(0, prev.stock + amount)
    }))
  }

  return (
    <div>
      {/* Elegant Modal */}
      {modal.show && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ 
              marginBottom: '1rem', 
              color: modal.type === 'delete' || modal.type === 'error' ? 'var(--danger)' : 
                     modal.type === 'success' ? 'var(--success)' : 'var(--accent)' 
            }}>
              {modal.title}
            </h2>
            <p style={{ color: 'var(--text-main)', marginBottom: '2rem' }}>
              {modal.message}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                style={{ backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                onClick={() => setModal({ ...modal, show: false })}
              >
                {modal.confirm ? 'Cancel' : 'Close'}
              </button>
              {modal.confirm && (
                <button 
                  className={`btn ${modal.type === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => { modal.confirm(); if(!loading) setModal({...modal, show: false}); }}
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Confirm'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>{isEditing ? '📝 Edit Food Item' : '🍱 Add New Food Item'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
          <div className="form-group">
            <label>Item ID</label>
            <input 
              className="form-input" 
              required 
              disabled={isEditing}
              value={formData.itemId} 
              onChange={e => setFormData({...formData, itemId: e.target.value.toUpperCase()})}
            />
          </div>
          <div className="form-group">
            <label>Food Name</label>
            <input 
              className="form-input" 
              required 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Stock Count</label>
            <div className="qty-selector">
              <button type="button" className="qty-btn" onClick={() => adjustStock(-1)}>−</button>
              <input 
                type="number" 
                className="qty-input"
                value={formData.stock}
                onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
              />
              <button type="button" className="qty-btn" onClick={() => adjustStock(1)}>+</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? '...' : isEditing ? 'Update' : 'Create'}
            </button>
            {isEditing && (
              <button 
                type="button" 
                className="btn" 
                style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                onClick={() => { setIsEditing(false); setFormData({ itemId: '', name: '', stock: 0 }); }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1.5rem' }}>Current Inventory</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Available</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.itemId}>
                <td>{item.itemId}</td>
                <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{item.name}</td>
                <td>{item.stock} units</td>
                <td>
                  <span className={`status-pill ${item.stock > 20 ? 'success' : item.stock > 0 ? 'warning' : 'danger'}`}>
                    {item.stock > 20 ? 'Good' : item.stock > 0 ? 'Low' : 'Empty'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-success" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleEdit(item)}>Edit</button>
                    <button className="btn btn-danger" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleDeleteClick(item)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
