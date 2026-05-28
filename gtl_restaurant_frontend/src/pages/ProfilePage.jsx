import { useState, useEffect } from 'react';
import { useUser, getUserDisplayName } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';

const ProfilePage = () => {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: 'Nagpur', state: 'Maharashtra', pincode: '', dob: '' });
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const saved = localStorage.getItem('gtl_profile');
    if (saved) {
      setForm(p => ({ ...p, ...JSON.parse(saved) }));
    } else {
      setForm(p => ({ ...p, name: getUserDisplayName(user), email: user.email || '' }));
    }
  }, [user]);

  const notify = (msg, type = 'success') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 3500);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Save locally always
      localStorage.setItem('gtl_profile', JSON.stringify(form));
      // Try backend
      try {
        await fetch(`${API_BASE}/profile`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } catch {}
      notify('Profile updated successfully!');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try { await fetch(`${API_BASE}/logout`, { credentials: 'include' }); } catch {}
    setUser(null);
    navigate('/login');
  };

  const displayName = getUserDisplayName(user) || 'User';
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      <div className="page-header">
        <div className="page-header-content">
          <h1><i className="fa fa-user me-2"></i>My Profile</h1>
          <p>Manage your personal information and preferences</p>
        </div>
      </div>

      <section style={{ padding: '60px 0', background: '#f9f5f0' }}>
        <div className="container">
          <div className="profile-grid">

            {/* LEFT — Avatar card */}
            <div>
              <div className="checkout-card profile-avatar-card">
                <div className="profile-avatar-circle">{initials}</div>
                <div className="profile-avatar-name">{displayName}</div>
                <div className="profile-avatar-email">{form.email || user?.email || '—'}</div>
                <div className="profile-avatar-divider" />
                <button className="btn-gold profile-logout-btn" onClick={handleLogout}>
                  <i className="fa fa-right-from-bracket me-2"></i>Logout
                </button>
                <div style={{ marginTop: 12, fontSize: '.8rem', color: '#999', textAlign: 'center' }}>
                  Member since {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </div>
              </div>

              <div className="checkout-card" style={{ marginTop: 16 }}>
                <h4 style={{ margin: '0 0 14px', fontFamily: "'Playfair Display',serif", color: 'var(--deep-brown)' }}>Quick Links</h4>
                {[
                  ['/order-online', 'fa-utensils', 'Order Food'],
                  ['/book-table',   'fa-calendar-check', 'Book a Table'],
                  ['/order-tracker','fa-map-location-dot','Track My Order'],
                ].map(([to, icon, label]) => (
                  <button key={to} onClick={() => navigate(to)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', borderBottom: '1px solid rgba(52,30,15,.06)', color: 'var(--deep-brown)', fontWeight: 600, fontSize: '.88rem' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gold-light, rgba(229,175,81,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fa ${icon}`} style={{ color: 'var(--accent-gold, #E5AF51)' }}></i>
                    </span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT — Edit form */}
            <div>
              {notice && (
                <div className={`flash ${notice.type}`} style={{ marginBottom: 20 }}>
                  <i className={`fa ${notice.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} me-2`}></i>
                  {notice.msg}
                </div>
              )}
              <div className="checkout-card">
                <h3 className="checkout-section-title"><i className="fa fa-pen"></i> Personal Information</h3>
                <form onSubmit={handleSave}>
                  <div className="checkout-form-row">
                    <div className="checkout-form-group">
                      <label>Full Name *</label>
                      <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" required />
                    </div>
                    <div className="checkout-form-group">
                      <label>Email Address *</label>
                      <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@email.com" required />
                    </div>
                  </div>
                  <div className="checkout-form-row">
                    <div className="checkout-form-group">
                      <label>Phone Number</label>
                      <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="10-digit mobile number" maxLength={10} />
                    </div>
                    <div className="checkout-form-group">
                      <label>Date of Birth</label>
                      <input type="date" value={form.dob} onChange={e => setForm(p => ({ ...p, dob: e.target.value }))} />
                    </div>
                  </div>

                  <h3 className="checkout-section-title" style={{ marginTop: 24 }}><i className="fa fa-location-dot"></i> Residence Address</h3>
                  <div className="checkout-form-group">
                    <label>Street Address</label>
                    <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                      placeholder="House/Flat No, Street, Landmark" rows={2} />
                  </div>
                  <div className="checkout-form-row">
                    <div className="checkout-form-group">
                      <label>City</label>
                      <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                    </div>
                    <div className="checkout-form-group">
                      <label>State</label>
                      <input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
                    </div>
                  </div>
                  <div className="checkout-form-row">
                    <div className="checkout-form-group">
                      <label>Pincode</label>
                      <input value={form.pincode} onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))} placeholder="440001" maxLength={6} />
                    </div>
                  </div>

                  <button type="submit" className="btn-gold checkout-submit-btn" disabled={saving} style={{ marginTop: 20 }}>
                    {saving
                      ? <><i className="fa fa-spinner fa-spin me-2"></i>Saving…</>
                      : <><i className="fa fa-floppy-disk me-2"></i>Save Profile</>}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ProfilePage;
