import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useUser, getUserDisplayName } from '../context/UserContext';
import { API_BASE } from '../config/api';
import logo from '../assets/images/logo.png';

const navLinks = [
  { to: '/home',         label: 'Home',       icon: 'fa fa-home' },
  { to: '/book-table',   label: 'Book Table',  icon: 'fa fa-calendar-check' },
  { to: '/order-online', label: 'Order Online',icon: 'fa fa-utensils' },
  { to: '/about',        label: 'About Us',    icon: 'fa fa-circle-info' },
  { to: '/contact',      label: 'Contact Us',  icon: 'fa fa-envelope' },
  { to: '/events',       label: 'Events',      icon: 'fa fa-star' },
];

const NavBar = () => {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const displayName = getUserDisplayName(user);
  const isLoggedIn = Boolean(user);
  const [dropOpen, setDropOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const dropRef = useRef(null);
  const quickMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target)) setQuickMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropOpen(false);
    try { await fetch(`${API_BASE}/logout`, { method: 'GET', credentials: 'include' }); } catch {}
    setUser(null);
    navigate('/login');
  };

  const initials = displayName
    ? displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <nav className="navbar navbar-expand-lg">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center" to="/" style={{ marginRight: '0' }}>
          <img src={logo} className="logo-circle me-2" alt="GTL Logo" />
        </Link>
        <Link className="navbar-brand d-flex align-items-center" to="/home" style={{ marginLeft: '0', marginRight: 'auto' }}>
          <span className="brand-text">GTL Utsav Dining</span>
        </Link>

        <div className="nav-quick-menu-wrapper" ref={quickMenuRef}>
          <button
            type="button"
            className="nav-hamburger-trigger"
            aria-label="Open quick navigation menu"
            aria-expanded={quickMenuOpen}
            onClick={() => setQuickMenuOpen((open) => !open)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          {quickMenuOpen && (
            <div className="nav-quick-dropdown">
              <button
                type="button"
                className="nav-quick-dropdown-item"
                onClick={() => {
                  setQuickMenuOpen(false);
                  navigate('/admin/kitchen-display');
                }}
              >
                <i className="fa-solid fa-kitchen-set"></i> Kitchen Panel
              </button>
              <button
                type="button"
                className="nav-quick-dropdown-item"
                onClick={() => {
                  setQuickMenuOpen(false);
                  navigate('/admin');
                }}
              >
                <i className="fa-solid fa-table-columns"></i> Admin Dashboard
              </button>
              <button
                type="button"
                className="nav-quick-dropdown-item"
                onClick={() => {
                  setQuickMenuOpen(false);
                  navigate('/order-online');
                }}
              >
                <i className="fa-solid fa-utensils"></i> Order Online
              </button>
            </div>
          )}
        </div>

        <button className="navbar-toggler" type="button"
          data-bs-toggle="collapse" data-bs-target="#mainNav"
          aria-controls="mainNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="mainNav">
          <ul className="navbar-nav ms-auto align-items-center gap-1">
            {navLinks.map((link) => (
              <li className="nav-item" key={link.to}>
                <NavLink to={link.to}
                  className={({ isActive }) => isActive ? 'nav-link active-page' : 'nav-link'}>
                  <i className={link.icon}></i> {link.label}
                </NavLink>
              </li>
            ))}

            {isLoggedIn ? (
              <li className="nav-item" ref={dropRef} style={{ position: 'relative' }}>
                <button className="user-badge" onClick={() => setDropOpen(o => !o)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <span className="user-avatar">{initials}</span>
                  <span className="user-name-text">{displayName.slice(0, 14)}</span>
                  <i className={`fa fa-chevron-${dropOpen ? 'up' : 'down'}`}
                    style={{ fontSize: '0.7rem', marginLeft: 4 }}></i>
                </button>

                {dropOpen && (
                  <div className="user-dropdown">
                    <div className="user-dropdown-header">
                      <span className="user-dropdown-avatar">{initials}</span>
                      <div>
                        <div className="user-dropdown-name">{displayName}</div>
                        <div className="user-dropdown-sub">Logged in</div>
                      </div>
                    </div>
                    <div className="user-dropdown-divider" />
                    <button className="user-dropdown-item"
                      onClick={() => { setDropOpen(false); navigate('/home'); setTimeout(() => document.getElementById('user-dashboard')?.scrollIntoView({ behavior:'smooth' }), 100); }}>
                      <i className="fa fa-table-columns"></i> My Dashboard
                    </button>
                    <button className="user-dropdown-item"
                      onClick={() => { setDropOpen(false); navigate('/profile'); }}>
                      <i className="fa fa-user"></i> View Profile
                    </button>
                    <button className="user-dropdown-item"
                      onClick={() => { setDropOpen(false); navigate('/order-tracker'); }}>
                      <i className="fa fa-map-location-dot"></i> My Orders
                    </button>
                    <div className="user-dropdown-divider" />
                    <button className="user-dropdown-item user-dropdown-logout" onClick={handleLogout}>
                      <i className="fa fa-right-from-bracket"></i> Logout
                    </button>
                  </div>
                )}
              </li>
            ) : (
              <li className="nav-item">
                <NavLink to="/login" className="nav-link">
                  <i className="fa fa-right-to-bracket"></i> Login
                </NavLink>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
