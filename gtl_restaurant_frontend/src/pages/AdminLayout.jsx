import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { API_BASE, apiFetch } from '../config/api';
import { useUser } from '../context/UserContext';
import '../assets/css/admin.css';
import logo from '../assets/images/logo.png';

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/menu', label: 'Menu Management' },
  { to: '/admin/order', label: 'Order Management' },
  { to: '/admin/kitchen-display', label: 'Kitchen Panel' },
  { to: '/admin/table', label: 'Table Management' },
  { to: '/admin/billing-payment', label: 'Billing & Payment' },
  { to: '/admin/inventory', label: 'Inventory' },
  { to: '/admin/reports-analytics', label: 'Reports & Analytics' },
  { to: '/admin/user', label: 'Staff / Users' },
];

const AdminLayout = () => {
  const { user } = useUser();
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const profileMenuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.toggle('drawer-open', isDrawerOpen);
    return () => { document.body.classList.remove('drawer-open'); };
  }, [isDrawerOpen]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) setIsProfileMenuOpen(false);
    };
    const handleEscape = (event) => { if (event.key === 'Escape') setIsProfileMenuOpen(false); };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('mousedown', handleOutsideClick); document.removeEventListener('keydown', handleEscape); };
  }, []);

  useEffect(() => {
    let active = true;
    const localRole = user?.role;
    const localIsAdmin = localRole === 'admin' || localRole === 'staff';
    const hasAdminFlag = localStorage.getItem('gtl_admin_auth') === 'true';

    const loadSession = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/admin/session`);
        const body = await response.json();
        if (!active) return;
        if (response.ok && body?.data) {
          setAdminUser(body.data);
        } else if (localIsAdmin && user) {
          setAdminUser(user);
        } else if (hasAdminFlag && user) {
          setAdminUser({ ...user, role: user.role || 'admin' });
        } else {
          setAdminUser(null);
        }
      } catch {
        if (!active) return;
        if (localIsAdmin && user) {
          setAdminUser(user);
        } else if (hasAdminFlag && user) {
          setAdminUser({ ...user, role: user.role || 'admin' });
        } else {
          setAdminUser(null);
        }
      } finally {
        if (active) setAuthChecked(true);
      }
    };
    loadSession();
    return () => { active = false; };
  }, [user]);

  const handleAdminLogout = async () => {
    try { await apiFetch(`${API_BASE}/logout`); } catch {}
    localStorage.removeItem('gtl_admin_auth');
    localStorage.removeItem('gtl_user');
    setAdminUser(null);
    setIsProfileMenuOpen(false);
    navigate('/login', { replace: true });
  };

  if (!authChecked) return <div className="admin-banner">Checking admin session...</div>;
  if (!adminUser) return <Navigate to="/login" replace />;

  const displayName = adminUser.full_name || adminUser.user_id || adminUser.displayName || 'Admin';
  const avatar = displayName.charAt(0).toUpperCase();

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <button className="admin-drawer-toggle" type="button" aria-label="Toggle navigation" onClick={() => setIsDrawerOpen((prev) => !prev)}>
            <span></span><span></span><span></span>
          </button>
          <img src={logo} alt="GTL Logo" className="admin-topbar-logo" />
          <div>
            <div className="admin-topbar-title">GTL Utsav Admin</div>
            <div className="admin-topbar-subtitle">Command Center</div>
          </div>
        </div>
        <div className="admin-topbar-right">
          <div className="admin-profile-menu" ref={profileMenuRef}>
            <button className="admin-profile admin-profile-trigger" type="button" aria-haspopup="menu" aria-expanded={isProfileMenuOpen} onClick={() => setIsProfileMenuOpen((prev) => !prev)}>
              <span className="admin-profile-avatar">{avatar}</span>
              <div className="admin-profile-text">
                <span className="admin-profile-name">{displayName}</span>
                <span className="admin-profile-role">{adminUser.role || 'admin'}</span>
              </div>
            </button>
            {isProfileMenuOpen && (
              <div className="admin-profile-dropdown" role="menu">
                <button className="admin-profile-action" type="button" role="menuitem" onClick={handleAdminLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="admin-drawer-overlay" aria-hidden={!isDrawerOpen} onClick={() => setIsDrawerOpen(false)}></div>
      <div className="admin-body">
        <aside className="admin-sidebar" aria-label="Admin navigation">
          <nav className="admin-sidebar-nav">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `admin-sidebar-item${isActive ? ' active' : ''}`}>
                <span className="admin-sidebar-dot"></span>{item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  );
};

export default AdminLayout;
