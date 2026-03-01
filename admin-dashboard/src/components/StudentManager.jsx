import React, { useState, useEffect } from 'react'
import axios from 'axios'

export default function StudentManager() {
  const [students, setStudents] = useState([])
  const [stats, setStats] = useState({})
  const [formData, setFormData] = useState({ studentId: '', name: '', password: '' })
  const [loading, setLoading] = useState(false)
  
  // Modal & Pagination state
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info' })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const fetchData = async () => {
    try {
      const [studentResp, statsResp] = await Promise.all([
        axios.get('http://localhost:3001/students'),
        axios.get('http://localhost:3002/admin/student-stats')
      ])
      setStudents(studentResp.data)
      const statsMap = {}
      statsResp.data.forEach(s => statsMap[s._id] = s.orderCount)
      setStats(statsMap)
    } catch (e) {
      console.error('Failed to fetch student data')
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.post('http://localhost:3001/students', formData)
      setModal({
        show: true,
        title: '✅ Success',
        message: `Student "${formData.name}" has been registered successfully.`,
        type: 'success'
      })
      setFormData({ studentId: '', name: '', password: '' })
      fetchData()
    } catch (err) {
      setModal({
        show: true,
        title: '❌ Registration Failed',
        message: err.response?.data?.error || 'Failed to create student',
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(students.length / itemsPerPage)
  const currentStudents = students.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const renderPagination = () => {
    if (totalPages <= 1) return null
    const pages = []
    const windowSize = 2
    pages.push(1)
    if (currentPage > windowSize + 2) pages.push('...')
    for (let i = Math.max(2, currentPage - windowSize); i <= Math.min(totalPages - 1, currentPage + windowSize); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - windowSize - 1) pages.push('...')
    if (totalPages > 1) pages.push(totalPages)

    return (
      <div className="pagination">
        <button className="page-btn jump" title="First" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>|&lt;</button>
        <button className="page-btn jump" title="-10" onClick={() => setCurrentPage(Math.max(1, currentPage - 10))} disabled={currentPage === 1}>&lt;&lt;</button>
        {pages.map((p, i) => (
          p === '...' ? (
            <span key={`sep-${i}`} style={{ color: 'var(--text-muted)', padding: '0 0.5rem' }}>...</span>
          ) : (
            <button key={p} className={`page-btn ${currentPage === p ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
          )
        ))}
        <button className="page-btn jump" title="+10" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 10))} disabled={currentPage === totalPages}>&gt;&gt;</button>
        <button className="page-btn jump" title="Last" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>&gt;|</button>
      </div>
    )
  }

  return (
    <div>
      {/* Elegant Modal */}
      {modal.show && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ marginBottom: '1rem', color: modal.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
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

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>🎓 Register New Student</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group">
            <label>Student ID</label>
            <input 
              className="form-input" 
              required 
              value={formData.studentId} 
              onChange={e => setFormData({...formData, studentId: e.target.value.toUpperCase()})}
            />
          </div>
          <div className="form-group">
            <label>Full Name</label>
            <input 
              className="form-input" 
              required 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password"
              className="form-input" 
              required 
              value={formData.password} 
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>
          <button className="btn btn-primary" style={{ height: '42px', marginBottom: '1rem' }} disabled={loading}>
            {loading ? 'Processing...' : 'Register Student'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1.5rem' }}>Student Directory & Activity</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Name</th>
              <th>Total Orders</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {currentStudents.map(student => (
              <tr key={student.studentId}>
                <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{student.studentId}</td>
                <td style={{ color: 'var(--text-main)' }}>{student.name}</td>
                <td>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                    {stats[student.studentId] || 0}
                  </span>
                </td>
                <td>
                  <span className={`status-pill ${(stats[student.studentId] || 0) > 0 ? 'success' : 'warning'}`}>
                    {(stats[student.studentId] || 0) > 0 ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {renderPagination()}
      </div>
    </div>
  )
}
