import React, { useState } from 'react'
import axios from 'axios'

export default function Login({ setToken, showModal }) {
  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await axios.post('http://localhost:3001/auth/login', {
        studentId,
        password,
      })
      setToken(data.token)
    } catch (err) {
      showModal('❌ Login Failed', err.response?.data?.error || 'Invalid Student ID or password.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-card card" style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <h2>Student Login</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        <div className="form-group">
          <label>Student ID</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter your student ID"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>
        <button 
          className="btn btn-primary" 
          type="submit" 
          disabled={loading}
          style={{ padding: '0.75rem', fontWeight: 'bold' }}
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
      <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Try STU001 / password123
      </div>
    </div>
  )
}
