import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../config/api';

const AdminUserPage = () => {
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [notice, setNotice] = useState(null);

  const summary = useMemo(() => {
    const total = users.length;
    const customers = users.filter((user) => user.role === 'customer').length;
    const staff = users.filter((user) => user.role === 'staff').length;
    const admins = users.filter((user) => user.role === 'admin').length;
    const active = users.filter((user) => user.is_active).length;
    const blocked = total - active;
    return { total, customers, staff, admins, active, blocked };
  }, [users]);

  const loadUsers = async () => {
    const params = new URLSearchParams();
    if (roleFilter !== 'all') params.append('role', roleFilter);
    try {
      const response = await apiFetch(`${API_BASE}/admin/users?${params.toString()}`);
      const body = await response.json();
      setUsers(body?.data ?? []);
    } catch (err) {
      setUsers([]);
    }
  };

  const loadActivity = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/users/login-activity`);
      const body = await response.json();
      setActivity(body?.data ?? []);
    } catch (err) {
      setActivity([]);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  useEffect(() => {
    loadActivity();
  }, []);

  const toggleStatus = async (userId, isActive) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!response.ok) throw new Error('Failed');
      loadUsers();
    } catch (err) {
      setNotice('Unable to update user status.');
    }
  };

  const updateRole = async (userId, role) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Failed');
      loadUsers();
    } catch (err) {
      setNotice('Unable to update role.');
    }
  };

  const exportUsersCSV = async (role = null) => {
    try {
      const params = new URLSearchParams();
      if (role && role !== 'all') params.append('role', role);
      const url = `${API_BASE}/admin/reports/export/users.csv?${params.toString()}`;
      const response = await apiFetch(url);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `users_export_${role || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      setNotice(`✅ CSV exported successfully!`);
    } catch (err) {
      setNotice('❌ Unable to export CSV.');
    }
  };

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <div className="admin-hero-kicker">Identity</div>
          <h1 className="admin-hero-title">Staff & User Management</h1>
          <p className="admin-hero-subtitle">Assign roles, activate accounts, and track logins.</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-chip">Role control</span>
          <span className="admin-chip">Access health</span>
        </div>
      </section>

      {notice && <div className="admin-banner">{notice}</div>}

      <div className="admin-card">
        <h2 className="admin-card-title">User Directory</h2>
        <p className="admin-card-subtitle">Manage access levels and active status.</p>
        <div className="admin-grid admin-grid-3" style={{ marginTop: '16px' }}>
          <div className="admin-kpi-card">
            <span>Total</span>
            <h4>{summary.total}</h4>
          </div>
          <div className="admin-kpi-card">
            <span>Customers</span>
            <h4>{summary.customers}</h4>
          </div>
          <div className="admin-kpi-card">
            <span>Staff</span>
            <h4>{summary.staff}</h4>
          </div>
          <div className="admin-kpi-card">
            <span>Admins</span>
            <h4>{summary.admins}</h4>
          </div>
          <div className="admin-kpi-card">
            <span>Active</span>
            <h4>{summary.active}</h4>
          </div>
          <div className="admin-kpi-card">
            <span>Blocked</span>
            <h4>{summary.blocked}</h4>
          </div>
        </div>

        <div className="admin-form compact" style={{ marginTop: '16px' }}>
          <div className="admin-field">
            <label>Role Filter</label>
            <select className="admin-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="customer">Customers</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="admin-btn"
            onClick={() => exportUsersCSV('all')}
            style={{ backgroundColor: '#4CAF50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
          >
            📥 Export All Users
          </button>
          <button 
            type="button" 
            className="admin-btn"
            onClick={() => exportUsersCSV('admin')}
            style={{ backgroundColor: '#FF9800', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
          >
            📥 Export Admins
          </button>
          <button 
            type="button" 
            className="admin-btn"
            onClick={() => exportUsersCSV('staff')}
            style={{ backgroundColor: '#2196F3', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
          >
            📥 Export Staff
          </button>
          <button 
            type="button" 
            className="admin-btn"
            onClick={() => exportUsersCSV('customer')}
            style={{ backgroundColor: '#9C27B0', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
          >
            📥 Export Customers
          </button>
        </div>

        <div className="admin-table-wrap" style={{ marginTop: '16px' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name || user.user_id}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                    >
                      <option value="customer">customer</option>
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    <span className={`admin-pill ${user.is_active ? 'success' : 'danger'}`}>
                      {user.is_active ? 'Active' : 'Blocked'}
                    </span>
                  </td>
                  <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="admin-action"
                      onClick={() => toggleStatus(user.id, user.is_active)}
                    >
                      {user.is_active ? 'Block' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="admin-empty">No users found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-list" style={{ marginBottom: '12px' }}>
          <div className="admin-list-item">
            <strong>Login Activity</strong>
            <span>{activity.length} records</span>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Action</th>
                <th>IP</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((log) => (
                <tr key={log.id}>
                  <td>{log.user_id}</td>
                  <td>{log.action}</td>
                  <td>{log.ip_address || '-'}</td>
                  <td>{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {activity.length === 0 && (
                <tr>
                  <td colSpan="4">
                    <div className="admin-empty">No activity recorded.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUserPage;
