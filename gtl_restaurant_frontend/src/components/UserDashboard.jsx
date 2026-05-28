import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, getUserDisplayName } from '../context/UserContext';
import { API_BASE } from '../config/api';

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n) => `₹${Number(n).toFixed(0)}`;
const today = () => new Date().toISOString().split('T')[0];

const TIME_SLOTS = [
  '11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM',
  '2:00 PM','7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM',
];

const MENU_CATS = [
  { label:'All', value:'all', icon:'🍽️' },
  { label:'Starters', value:'starters', icon:'🥗' },
  { label:'Mains', value:'mains', icon:'🍛' },
  { label:'Breads', value:'breads', icon:'🫓' },
  { label:'Desserts', value:'desserts', icon:'🍮' },
  { label:'Drinks', value:'drinks', icon:'🥤' },
];

const STATUS_COLOR = {
  placed:'#f59e0b', confirmed:'#3b82f6', preparing:'#8b5cf6',
  ready:'#10b981', delivered:'#10b981', cancelled:'#ef4444',
};
const STATUS_ICON = {
  placed:'⏳', confirmed:'✅', preparing:'👨‍🍳', ready:'🚀', delivered:'🎉', cancelled:'❌',
};

/* ─── Cart helpers ─────────────────────────────────────────── */
const addItem = (cart, item) => {
  const ex = cart.find(c => c.id === item.id);
  if (ex) return cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
  return [...cart, { ...item, qty: 1 }];
};
const removeItem = (cart, id) => {
  const ex = cart.find(c => c.id === id);
  if (!ex) return cart;
  if (ex.qty === 1) return cart.filter(c => c.id !== id);
  return cart.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c);
};

/* ═══════════════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════════════════ */
const TABS = [
  { id:'dashboard', label:'Dashboard', icon:'🏠' },
  { id:'menu',      label:'Browse Menu', icon:'🍽️' },
  { id:'cart',      label:'Cart', icon:'🛒' },
  { id:'checkout',  label:'Checkout', icon:'💳' },
  { id:'orders',    label:'Order History', icon:'📋' },
  { id:'booking',   label:'Book Table', icon:'📅' },
  { id:'tracker',   label:'Track Order', icon:'📍' },
];

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function UserDashboard() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cart, setCart] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [flash, setFlash] = useState(null);

  // Load cart from session on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('gtl_dashboard_cart');
      if (raw) setCart(JSON.parse(raw));
      const lo = sessionStorage.getItem('gtl_last_order');
      if (lo) setLastOrder(JSON.parse(lo));
    } catch {}
  }, []);

  // Persist cart
  useEffect(() => {
    sessionStorage.setItem('gtl_dashboard_cart', JSON.stringify(cart));
  }, [cart]);

  const showFlash = (msg, type = 'success') => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 3500);
  };

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  const cartTotal = cart.reduce((a, i) => a + i.qty * i.price, 0);

  // Tab change
  const goTab = (id) => {
    setActiveTab(id);
    if (id === 'menu' && menuItems.length === 0) loadMenu();
    if (id === 'orders') loadOrders();
  };

  /* ── Load menu ── */
  const loadMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const res = await fetch(`${API_BASE}/menu`, { credentials: 'include' });
      const b = await res.json();
      setMenuItems(b?.data ?? []);
    } catch { showFlash('Could not load menu.', 'error'); }
    finally { setMenuLoading(false); }
  }, []);

  /* ── Load orders ── */
  const loadOrders = useCallback(async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const uid = user.id || user.user_id;
      const res = await fetch(`${API_BASE}/orders?user_id=${encodeURIComponent(uid)}`, { credentials: 'include' });
      const b = await res.json();
      setOrders(b?.data ?? []);
    } catch { showFlash('Could not load orders.', 'error'); }
    finally { setOrdersLoading(false); }
  }, [user]);

  if (!user) {
    return (
      <section style={panelStyle}>
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>🔐</div>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 12 }}>Please log in to access your dashboard</h3>
          <p style={{ color: '#888', marginBottom: 24 }}>Sign in to order food, book tables and track your orders.</p>
          <button className="btn-gold" onClick={() => navigate('/login')}>
            <i className="fa fa-right-to-bracket me-2" />Log In / Register
          </button>
        </div>
      </section>
    );
  }

  const displayName = getUserDisplayName(user);

  return (
    <section style={panelStyle}>
      {/* Flash */}
      {flash && (
        <div style={{
          position: 'fixed', top: 80, right: 20, zIndex: 9999,
          background: flash.type === 'error' ? '#fee2e2' : '#d1fae5',
          border: `1px solid ${flash.type === 'error' ? '#fca5a5' : '#6ee7b7'}`,
          color: flash.type === 'error' ? '#dc2626' : '#065f46',
          padding: '12px 20px', borderRadius: 12, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,.15)', maxWidth: 360
        }}>
          {flash.msg}
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--accent-gold)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: '#fff'
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>
              Welcome back, {displayName.split(' ')[0]}! 👋
            </h2>
            <p style={{ margin: 0, color: '#888', fontSize: '.85rem' }}>{user.email}</p>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 28, borderBottom: '2px solid #f0ebe3', paddingBottom: 8 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => goTab(t.id)}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 999, cursor: 'pointer',
                fontWeight: 600, fontSize: '.82rem', transition: 'all .2s',
                background: activeTab === t.id ? 'var(--accent-gold)' : '#f0ebe3',
                color: activeTab === t.id ? '#fff' : '#555',
                position: 'relative'
              }}>
              {t.icon} {t.label}
              {t.id === 'cart' && cartCount > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -4,
                  background: '#ef4444', color: '#fff', borderRadius: '50%',
                  width: 18, height: 18, fontSize: '.65rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
                }}>{cartCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 'dashboard' && <DashboardTab user={user} displayName={displayName} orders={orders} cart={cart} cartCount={cartCount} cartTotal={cartTotal} goTab={goTab} lastOrder={lastOrder} loadOrders={loadOrders} />}
        {activeTab === 'menu'      && <MenuTab menuItems={menuItems} menuLoading={menuLoading} loadMenu={loadMenu} cart={cart} setCart={setCart} addItem={addItem} removeItem={removeItem} goTab={goTab} showFlash={showFlash} />}
        {activeTab === 'cart'      && <CartTab cart={cart} setCart={setCart} removeItem={removeItem} goTab={goTab} cartTotal={cartTotal} fmt={fmt} />}
        {activeTab === 'checkout'  && <CheckoutTab cart={cart} setCart={setCart} user={user} displayName={displayName} goTab={goTab} showFlash={showFlash} setLastOrder={setLastOrder} fmt={fmt} />}
        {activeTab === 'orders'    && <OrdersTab orders={orders} ordersLoading={ordersLoading} loadOrders={loadOrders} fmt={fmt} goTab={goTab} />}
        {activeTab === 'booking'   && <BookingTab user={user} displayName={displayName} showFlash={showFlash} goTab={goTab} />}
        {activeTab === 'tracker'   && <TrackerTab lastOrder={lastOrder} goTab={goTab} fmt={fmt} />}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD TAB
══════════════════════════════════════════════════════════════ */
function DashboardTab({ user, displayName, orders, cart, cartCount, cartTotal, goTab, lastOrder, loadOrders }) {
  useEffect(() => { loadOrders(); }, []);
  const [menuQr, setMenuQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const recent = orders.slice(0, 3);
  const totalSpent = orders.reduce((a, o) => a + parseFloat(o.total || 0), 0);
  const isDesktopLayout = typeof window !== 'undefined' ? window.innerWidth >= 1200 : true;
  const qrGreetingName = (displayName || user?.full_name || user?.name || 'Guest').split(' ')[0];

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setQrLoading(true);
        const response = await fetch(`${API_BASE}/menu-qr`, { credentials: 'include' });
        const body = await response.json();
        if (!active) return;
        if (response.ok && body?.data?.qr_image) setMenuQr(body.data);
      } catch {}
      finally {
        if (active) setQrLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktopLayout ? '300px minmax(0, 1fr)' : '1fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.94)',
            color: 'var(--deep-brown)',
            borderRadius: '14px',
            border: '1px solid rgba(229,175,81,0.4)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            padding: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '10px', textAlign: 'center', padding: '0 6px' }}>
            <i className="fa fa-qrcode" style={{ fontSize: '1.15rem', lineHeight: 1, marginTop: '1px' }}></i>
            <span style={{ fontWeight: 700, fontSize: '1.2rem', lineHeight: 1.25, wordBreak: 'break-word' }}>
              {qrGreetingName} scan for menu
            </span>
          </div>

          {menuQr?.qr_image ? (
            <a href={menuQr.menu_url} target="_blank" rel="noreferrer" title="Open menu" style={{ width: '100%' }}>
              <img
                src={menuQr.qr_image}
                alt="Menu QR"
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: '10px',
                  border: '1px solid #eadfcb',
                  background: '#fff',
                }}
              />
            </a>
          ) : (
            <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: '10px', border: '1px solid #eadfcb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777', fontSize: '.9rem' }}>
              {qrLoading ? 'Generating QR...' : 'QR unavailable'}
            </div>
          )}

          <div style={{ marginTop: '12px', display: 'grid', gap: '8px', width: '100%' }}>
            <a href="/order-online?dine_in=1" className="btn btn-gold" style={{ width: '100%', textAlign: 'center', padding: '10px 16px' }}>
              <i className="fa fa-mobile-screen-button"></i> Open Menu
            </a>
            <button type="button" onClick={() => goTab('menu')} className="btn btn-outline-custom" style={{ width: '100%', textAlign: 'center', background: '#fff', padding: '10px 16px' }}>
              <i className="fa fa-utensils"></i> Order Online
            </button>
          </div>
        </div>
        <div>
          {/* Quick Action Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { icon:'🍽️', label:'Browse Menu', sub:'View all dishes', tab:'menu', bg:'#fff8ee', border:'var(--accent-gold)' },
              { icon:'🛒', label:'My Cart', sub:`${cartCount} item${cartCount !== 1 ? 's' : ''} · ₹${cartTotal.toFixed(0)}`, tab:'cart', bg:'#f0fdf4', border:'#6ee7b7' },
              { icon:'📅', label:'Book Table', sub:'Reserve your seat', tab:'booking', bg:'#eff6ff', border:'#93c5fd' },
              { icon:'📋', label:'Order History', sub:`${orders.length} orders`, tab:'orders', bg:'#fdf4ff', border:'#d8b4fe' },
            ].map(c => (
              <div key={c.tab} onClick={() => goTab(c.tab)}
                style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 16, padding: '20px 18px', cursor: 'pointer', transition: 'transform .15s' }}
                onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>{c.icon}</div>
                <div style={{ fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontSize: '.8rem', color: '#888' }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 32 }}>
            {[
              { label:'Total Orders', value: orders.length, icon:'🧾' },
              { label:'Total Spent', value: `₹${totalSpent.toFixed(0)}`, icon:'💰' },
              { label:'Cart Items', value: cartCount, icon:'🛒' },
              { label:'Last Status', value: lastOrder?.status || 'N/A', icon:'📍' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 12, padding: '16px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem' }}>{s.icon}</div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', marginTop: 4 }}>{s.value}</div>
                <div style={{ fontSize: '.75rem', color: '#888' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recent Orders */}
          {recent.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <h4 style={{ marginBottom: 16, fontFamily: 'var(--font-display)' }}>🕒 Recent Orders</h4>
              {recent.map(o => {
                const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
                return (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0ebe3' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Order #{o.id}</div>
                      <div style={{ fontSize: '.8rem', color: '#888' }}>{items.slice(0,2).map(i=>i.name||i.item_name).join(', ')}{items.length>2?` +${items.length-2} more`:''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>₹{parseFloat(o.total).toFixed(0)}</div>
                      <span style={{ fontSize: '.75rem', background: STATUS_COLOR[o.status]+'22', color: STATUS_COLOR[o.status], padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                        {STATUS_ICON[o.status]} {o.status}
                      </span>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => goTab('orders')} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--accent-gold)', fontWeight: 600, cursor: 'pointer', fontSize: '.85rem' }}>
                View all orders →
              </button>
            </div>
          )}

          {lastOrder && (
            <div style={{ background: '#fff8ee', border: '1.5px solid var(--accent-gold)', borderRadius: 16, padding: 20 }}>
              <h4 style={{ marginBottom: 8 }}>📍 Track Your Latest Order</h4>
              <p style={{ color: '#888', marginBottom: 12, fontSize: '.85rem' }}>Order #{lastOrder.orderId} is currently <strong>{lastOrder.status || 'placed'}</strong></p>
              <button className="btn-gold" onClick={() => goTab('tracker')} style={{ fontSize: '.85rem', padding: '8px 18px' }}>Track Order</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MENU TAB
══════════════════════════════════════════════════════════════ */
function MenuTab({ menuItems, menuLoading, loadMenu, cart, setCart, addItem, removeItem, goTab, showFlash }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { if (menuItems.length === 0) loadMenu(); }, []);

  const filtered = useMemo(() =>
    menuItems.filter(i => {
      const catOk = filter === 'all' || i.category === filter;
      const searchOk = !search || i.name.toLowerCase().includes(search.toLowerCase());
      return catOk && searchOk && i.is_available;
    }), [menuItems, filter, search]);

  const getQty = (id) => cart.find(c => c.id === id)?.qty || 0;

  const cartCount = cart.reduce((a, i) => a + i.qty, 0);

  return (
    <div>
      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search dishes…"
          style={{ flex: '1 1 200px', padding: '10px 14px', borderRadius: 999, border: '1.5px solid #e0d8ce', fontSize: '.9rem', outline: 'none' }} />
        {cartCount > 0 && (
          <button className="btn-gold" onClick={() => goTab('cart')} style={{ fontSize: '.85rem', padding: '10px 18px', whiteSpace: 'nowrap' }}>
            🛒 View Cart ({cartCount})
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {MENU_CATS.map(c => (
          <button key={c.value} onClick={() => setFilter(c.value)}
            style={{
              padding: '6px 14px', borderRadius: 999, border: '1.5px solid',
              borderColor: filter === c.value ? 'var(--accent-gold)' : '#ddd',
              background: filter === c.value ? 'var(--accent-gold)' : '#fff',
              color: filter === c.value ? '#fff' : '#555',
              cursor: 'pointer', fontWeight: 600, fontSize: '.82rem'
            }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {menuLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>Loading menu…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🍽️</div>No items found
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }}>
          {filtered.map(item => {
            const qty = getQty(item.id);
            const img = item.image_url
              ? (item.image_url.startsWith('http') ? item.image_url : `${API_BASE}/static/uploads/${item.image_url}`)
              : null;
            return (
              <div key={item.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e8e0d5', transition: 'box-shadow .2s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
                {img ? (
                  <img src={img} alt={item.name} style={{ width: '100%', height: 140, objectFit: 'cover' }} onError={e => { e.target.style.display='none'; }} />
                ) : (
                  <div style={{ height: 80, background: '#f9f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                    {item.is_veg ? '🥗' : '🍗'}
                  </div>
                )}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <h4 style={{ margin: 0, fontSize: '.95rem', fontWeight: 700 }}>{item.name}</h4>
                    <span style={{ fontSize: '.7rem', background: item.is_veg ? '#d1fae5' : '#fee2e2', color: item.is_veg ? '#065f46' : '#dc2626', padding: '2px 6px', borderRadius: 999, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 6 }}>
                      {item.is_veg ? '🟢 Veg' : '🔴 Non-veg'}
                    </span>
                  </div>
                  {item.description && <p style={{ fontSize: '.78rem', color: '#888', margin: '4px 0 10px', lineHeight: 1.4 }}>{item.description.slice(0, 60)}{item.description.length > 60 ? '…' : ''}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent-gold)', fontSize: '1.05rem' }}>₹{item.price}</span>
                    {qty === 0 ? (
                      <button onClick={() => { setCart(c => addItem(c, item)); showFlash(`${item.name} added to cart!`); }}
                        style={{ background: 'var(--accent-gold)', color: '#fff', border: 'none', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: '.82rem' }}>
                        + Add
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => setCart(c => removeItem(c, item.id))}
                          style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--accent-gold)', background: '#fff', cursor: 'pointer', fontWeight: 700, color: 'var(--accent-gold)' }}>−</button>
                        <span style={{ fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{qty}</span>
                        <button onClick={() => setCart(c => addItem(c, item))}
                          style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 700, color: '#fff' }}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CART TAB
══════════════════════════════════════════════════════════════ */
function CartTab({ cart, setCart, removeItem, goTab, cartTotal, fmt }) {
  if (cart.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>🛒</div>
      <h3>Your cart is empty</h3>
      <p style={{ color: '#888', marginBottom: 24 }}>Browse our menu and add some delicious items!</p>
      <button className="btn-gold" onClick={() => goTab('menu')}>Browse Menu</button>
    </div>
  );

  const gst = +(cartTotal * 0.18).toFixed(2);
  const delivery = cartTotal > 500 ? 0 : 40;
  const total = +(cartTotal + gst + delivery).toFixed(2);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
      {/* Items */}
      <div>
        <h3 style={{ marginBottom: 20, fontFamily: 'var(--font-display)' }}>🛒 Your Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})</h3>
        {cart.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e8e0d5', borderRadius: 14, padding: '14px 18px', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{item.name}</div>
              <div style={{ fontSize: '.82rem', color: '#888' }}>₹{item.price} each</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setCart(c => removeItem(c, item.id))}
                style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 700 }}>−</button>
              <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
              <button onClick={() => setCart(c => c.map(ci => ci.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci))}
                style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 700, color: '#fff' }}>+</button>
              <span style={{ fontWeight: 700, minWidth: 60, textAlign: 'right' }}>₹{(item.price * item.qty).toFixed(0)}</span>
              <button onClick={() => setCart(c => c.filter(ci => ci.id !== item.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.1rem' }}>✕</button>
            </div>
          </div>
        ))}
        <button onClick={() => setCart([])} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}>
          🗑️ Clear Cart
        </button>
      </div>

      {/* Summary */}
      <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 16, padding: 24, minWidth: 240 }}>
        <h4 style={{ marginBottom: 16 }}>Order Summary</h4>
        {[['Subtotal', fmt(cartTotal)], ['GST (18%)', fmt(gst)], ['Delivery', delivery === 0 ? 'FREE' : fmt(delivery)]].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: '.9rem' }}>
            <span style={{ color: '#666' }}>{k}</span><span>{v}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem' }}>
          <span>Total</span><span>₹{total}</span>
        </div>
        {delivery === 0 && <div style={{ fontSize: '.75rem', color: '#10b981', marginTop: 6 }}>🎉 Free delivery on orders above ₹500!</div>}
        <button className="btn-gold" onClick={() => goTab('checkout')} style={{ width: '100%', marginTop: 16, textAlign: 'center' }}>
          Proceed to Checkout →
        </button>
        <button onClick={() => goTab('menu')} style={{ width: '100%', marginTop: 8, background: 'none', border: '1.5px solid #ddd', borderRadius: 999, padding: '8px', cursor: 'pointer', fontSize: '.85rem' }}>
          + Add More Items
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHECKOUT TAB
══════════════════════════════════════════════════════════════ */
function CheckoutTab({ cart, setCart, user, displayName, goTab, showFlash, setLastOrder, fmt }) {
  const [form, setForm] = useState({ name: displayName, phone: '', address: '', city: 'Pune', pincode: '', method: 'Cash on Delivery', notes: '' });
  const [orderType, setOrderType] = useState('online');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [placed, setPlaced] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  // Pre-fill from profile
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('gtl_profile') || '{}');
      setForm(f => ({ ...f, name: p.name || displayName, phone: p.phone || '', address: p.address || '', city: p.city || 'Pune', pincode: p.pincode || '' }));
    } catch {}
  }, []);

  if (cart.length === 0 && !placed) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>🛒</div>
      <h3>Your cart is empty</h3>
      <button className="btn-gold" onClick={() => goTab('menu')} style={{ marginTop: 12 }}>Browse Menu</button>
    </div>
  );

  const subtotal = cart.reduce((a, i) => a + i.qty * i.price, 0);
  const gst = +(subtotal * 0.18).toFixed(2);
  const delivery = orderType === 'dine_in' ? 0 : subtotal > 500 ? 0 : 40;
  const total = +(subtotal + gst + delivery).toFixed(2);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name required';
    if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ''))) e.phone = 'Enter 10-digit phone';
    if (orderType === 'online') {
      if (!form.address.trim()) e.address = 'Address required';
      if (!/^\d{6}$/.test(form.pincode)) e.pincode = '6-digit pincode required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not supported in this browser.');
      return;
    }

    setLocationLoading(true);
    setLocationMessage('');

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = Number(coords.latitude).toFixed(6);
        const longitude = Number(coords.longitude).toFixed(6);
        const locationLabel = `Current location selected (Lat: ${latitude}, Lng: ${longitude})`;
        const locationNote = `GPS pin: https://www.google.com/maps?q=${latitude},${longitude}`;

        setForm((current) => ({
          ...current,
          address: current.address.trim() ? `${current.address} | ${locationLabel}` : locationLabel,
          notes: current.notes.includes('GPS pin:')
            ? current.notes
            : (current.notes.trim() ? `${current.notes}\n${locationNote}` : locationNote),
        }));
        setErrors((current) => ({ ...current, address: '', pincode: '' }));
        setLocationMessage('Current location added to the delivery details.');
        setLocationLoading(false);
      },
      (error) => {
        const nextMessage =
          error.code === 1
            ? 'Location permission was denied.'
            : 'Unable to fetch your current location.';
        setLocationMessage(nextMessage);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handlePlace = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const address = orderType === 'dine_in' ? 'Dine-In' : `${form.address}, ${form.city} - ${form.pincode}`;
      const payload = {
        user_id: user?.user_id ?? user?.id ?? '',
        items: cart,
        total,
        address,
        order_type: orderType,
        payment_method: form.method,
        payment_status: form.method === 'Cash on Delivery' ? 'unpaid' : 'paid',
        notes: form.notes,
      };
      const res = await fetch(`${API_BASE}/orders`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (res.ok) {
        const orderId = body?.data?.id || ('ORD-' + Date.now().toString().slice(-6));
        const orderData = { orderId, items: cart, subtotal, gst, delivery, total, form, orderType, placedAt: new Date().toISOString(), status: 'placed' };
        sessionStorage.setItem('gtl_last_order', JSON.stringify(orderData));
        setLastOrder(orderData);
        setPlaced(orderData);
        setCart([]);
        sessionStorage.removeItem('gtl_dashboard_cart');
      } else {
        setErrors({ submit: body?.message || 'Failed to place order. Please try again.' });
      }
    } catch {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally { setLoading(false); }
  };

  if (placed) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 500, margin: '0 auto' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)' }}>Order Placed!</h2>
      <p style={{ color: '#666', marginBottom: 8 }}>Order <strong>#{placed.orderId}</strong> has been received.</p>
      <p style={{ color: '#888', fontSize: '.9rem', marginBottom: 28 }}>
        {placed.form.method === 'Cash on Delivery' ? '💵 Pay cash when your order arrives.' : '✅ Payment confirmed.'}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-gold" onClick={() => goTab('tracker')}>📍 Track Order</button>
        <button onClick={() => goTab('menu')} style={{ padding: '10px 20px', borderRadius: 999, border: '1.5px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          🍽️ Order More
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
      <div>
        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>💳 Checkout</h3>

        {/* Order type */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {[['online','🛵','Delivery'],['dine_in','🪑','Dine-In']].map(([t, ic, lb]) => (
            <button key={t} onClick={() => setOrderType(t)}
              style={{ padding: '10px 20px', borderRadius: 999, border: `2px solid ${orderType===t?'var(--accent-gold)':'#ddd'}`, background: orderType===t?'#fff8ee':'#fff', fontWeight: 600, cursor: 'pointer' }}>
              {ic} {lb}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {[['name','Full Name *','text'],['phone','Phone *','tel']].map(([k, lb, tp]) => (
              <div key={k}>
                <label style={labelStyle}>{lb}</label>
                <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  type={tp} style={{ ...inputStyle, borderColor: errors[k] ? '#ef4444' : '#ddd' }} />
                {errors[k] && <span style={{ fontSize: '.75rem', color: '#ef4444' }}>{errors[k]}</span>}
              </div>
            ))}
          </div>

          {orderType === 'online' && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Delivery Address *</label>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#888', fontSize: '.82rem' }}>Auto-fill your current location if you do not want to type the address.</span>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={locationLoading}
                    style={{
                      border: '1px solid #e5c38a',
                      background: '#fff8ee',
                      color: 'var(--dark)',
                      borderRadius: 999,
                      padding: '8px 14px',
                      fontWeight: 600,
                      cursor: locationLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {locationLoading ? 'Locating…' : 'Use Current Location'}
                  </button>
                </div>
                <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  rows={2} style={{ ...inputStyle, resize: 'vertical', borderColor: errors.address ? '#ef4444' : '#ddd' }} placeholder="House/Flat, Street, Landmark" />
                {locationMessage && <div style={{ marginTop: 8, color: '#777', fontSize: '.82rem' }}>{locationMessage}</div>}
                {errors.address && <span style={{ fontSize: '.75rem', color: '#ef4444' }}>{errors.address}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Pincode *</label>
                  <input value={form.pincode} onChange={e => setForm(p => ({ ...p, pincode: e.target.value }))}
                    style={{ ...inputStyle, borderColor: errors.pincode ? '#ef4444' : '#ddd' }} maxLength={6} />
                  {errors.pincode && <span style={{ fontSize: '.75rem', color: '#ef4444' }}>{errors.pincode}</span>}
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Special Instructions</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Any special requests…" />
          </div>

          {/* Payment */}
          <h4 style={{ marginBottom: 12 }}>💳 Payment Method</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[['Cash on Delivery','💵'],['UPI','📱'],['Card','💳'],['Net Banking','🏦']].map(([m, ic]) => (
              <label key={m} onClick={() => setForm(p => ({ ...p, method: m }))}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, border: `2px solid ${form.method===m?'var(--accent-gold)':'#ddd'}`, background: form.method===m?'#fff8ee':'#fff', cursor: 'pointer', fontWeight: 600 }}>
                <span>{ic}</span><span>{m}</span>
              </label>
            ))}
          </div>

          {errors.submit && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: '.88rem' }}>{errors.submit}</div>}

          <button className="btn-gold" onClick={handlePlace} disabled={loading} style={{ width: '100%', textAlign: 'center', fontSize: '1rem' }}>
            {loading ? '⏳ Placing Order…' : `✅ Place Order · ₹${total}`}
          </button>
        </div>
      </div>

      {/* Summary sidebar */}
      <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 16, padding: 24 }}>
        <h4 style={{ marginBottom: 16 }}>🧾 Order Summary</h4>
        {cart.map(i => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: '.88rem' }}>
            <span>{i.name} ×{i.qty}</span>
            <span style={{ fontWeight: 600 }}>₹{(i.price*i.qty).toFixed(0)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #eee', marginTop: 12, paddingTop: 12 }}>
          {[['Subtotal', fmt(subtotal)], ['GST (18%)', fmt(gst)], ['Delivery', delivery===0?'FREE':fmt(delivery)]].map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '.88rem', color: '#666' }}>
              <span>{k}</span><span>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', marginTop: 8 }}>
            <span>Total</span><span>₹{total}</span>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: '10px 12px', background: '#f9f5f0', borderRadius: 10, fontSize: '.8rem', color: '#888' }}>
          🔒 Secure checkout · Your data is safe.<br />
          🕐 {orderType === 'dine_in' ? 'Food served at your table.' : 'Estimated: 30–45 mins'}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ORDER HISTORY TAB
══════════════════════════════════════════════════════════════ */
function OrdersTab({ orders, ordersLoading, loadOrders, fmt, goTab }) {
  useEffect(() => { loadOrders(); }, []);

  if (ordersLoading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>Loading orders…
    </div>
  );

  if (orders.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>📋</div>
      <h3>No orders yet</h3>
      <p style={{ color: '#888', marginBottom: 24 }}>Start ordering to see your history here!</p>
      <button className="btn-gold" onClick={() => goTab('menu')}>Browse Menu</button>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>📋 Order History</h3>
        <button onClick={loadOrders} style={{ background: 'none', border: '1.5px solid #ddd', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontSize: '.82rem' }}>
          🔄 Refresh
        </button>
      </div>
      {orders.map(o => {
        const items = (() => { try { return typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []); } catch { return []; } })();
        const color = STATUS_COLOR[o.status] || '#888';
        return (
          <div key={o.id} style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 16, padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Order #{o.id}</div>
                <div style={{ fontSize: '.78rem', color: '#aaa', marginTop: 2 }}>
                  {new Date(o.created_at).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>₹{parseFloat(o.total).toFixed(0)}</div>
                <span style={{ fontSize: '.75rem', background: color+'22', color, padding: '3px 10px', borderRadius: 999, fontWeight: 700 }}>
                  {STATUS_ICON[o.status] || '•'} {o.status}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '.83rem', color: '#666', marginBottom: 8 }}>
              {items.slice(0,4).map(i => `${i.name||i.item_name}${i.qty>1?` ×${i.qty}`:''}`).join(' · ')}
              {items.length > 4 && ` +${items.length-4} more`}
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: '.78rem', color: '#aaa' }}>
              <span>📦 {o.order_type === 'dine_in' ? 'Dine-In' : 'Delivery'}</span>
              <span>💳 {o.payment_method || 'N/A'}</span>
              <span>{o.payment_status === 'paid' ? '✅ Paid' : '⏳ Unpaid'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BOOK TABLE TAB
══════════════════════════════════════════════════════════════ */
function BookingTab({ user, displayName, showFlash, goTab }) {
  const [form, setForm] = useState({
    name: displayName, email: user.email || '', phone: '', date: today(),
    time: '', guests: '2', message: ''
  });
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState({});

  const loadTables = async () => {
    try {
      const res = await fetch(`${API_BASE}/tables`, { credentials: 'include' });
      const b = await res.json();
      setTables(b?.data ?? []);
    } catch {}
  };

  const validate1 = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name required';
    if (!form.email.trim()) e.email = 'Email required';
    if (!form.phone.trim()) e.phone = 'Phone required';
    if (!form.date) e.date = 'Date required';
    if (!form.time) e.time = 'Time required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validate1()) return;
    loadTables();
    setStep(2);
  };

  const handleBook = async () => {
    setLoading(true);
    try {
      const userId = user?.user_id ?? user?.id ?? '';
      const payload = new URLSearchParams({ ...form, user_id: userId, table_id: selectedTable });
      const res = await fetch(`${API_BASE}/book-table`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(userId ? { 'X-User-Id': userId } : {}) },
        body: payload,
      });
      const body = await res.json();
      if (res.ok) {
        setDone(true);
        showFlash('🎉 Table booked successfully!');
      } else {
        showFlash(body?.message || 'Booking failed.', 'error');
      }
    } catch {
      showFlash('Network error. Please try again.', 'error');
    } finally { setLoading(false); }
  };

  if (done) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)' }}>Reservation Confirmed!</h2>
      <p style={{ color: '#666', marginBottom: 28 }}>Your table is reserved for <strong>{form.guests} guest(s)</strong> on <strong>{form.date}</strong> at <strong>{form.time}</strong>.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn-gold" onClick={() => goTab('menu')}>🍽️ Order Food</button>
        <button onClick={() => { setDone(false); setStep(1); }} style={{ padding: '10px 20px', borderRadius: 999, border: '1.5px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          Book Another
        </button>
      </div>
    </div>
  );

  const availTables = tables.filter(t => t.status === 'available' && t.seats >= parseInt(form.guests));

  return (
    <div style={{ maxWidth: 640 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 24 }}>📅 Book a Table</h3>

      {/* Steps */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        {['Details','Select Table','Confirm'].map((s, i) => (
          <div key={s} style={{ padding: '6px 16px', borderRadius: 999, fontWeight: 600, fontSize: '.8rem', background: step > i+1 ? 'var(--accent-gold)' : step === i+1 ? '#1c1c1c' : '#eee', color: step >= i+1 ? '#fff' : '#888' }}>
            {i+1}. {s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[['name','Full Name *'],['email','Email *'],['phone','Phone *'],['date','Date *'],['time','','select'],['guests','Guests','select']].map(([k, lb, tp]) => {
              if (k === 'time') return (
                <div key={k}>
                  <label style={labelStyle}>Time *</label>
                  <select value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} style={inputStyle}>
                    <option value="">Select time</option>
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.time && <span style={{ fontSize: '.75rem', color: '#ef4444' }}>{errors.time}</span>}
                </div>
              );
              if (k === 'guests') return (
                <div key={k}>
                  <label style={labelStyle}>Guests</label>
                  <select value={form.guests} onChange={e => setForm(p => ({ ...p, guests: e.target.value }))} style={inputStyle}>
                    {['1','2','3','4','5','6','8','10'].map(g => <option key={g} value={g}>{g} Guest{parseInt(g)>1?'s':''}</option>)}
                  </select>
                </div>
              );
              return (
                <div key={k}>
                  <label style={labelStyle}>{lb}</label>
                  <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                    type={k === 'date' ? 'date' : 'text'} min={k === 'date' ? today() : undefined}
                    style={{ ...inputStyle, borderColor: errors[k] ? '#ef4444' : '#ddd' }} />
                  {errors[k] && <span style={{ fontSize: '.75rem', color: '#ef4444' }}>{errors[k]}</span>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Special Requests</label>
            <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Dietary needs, occasion…" />
          </div>
          <button className="btn-gold" onClick={handleNext} style={{ marginTop: 20 }}>Next → Select Table</button>
        </div>
      )}

      {step === 2 && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 16, padding: 24 }}>
          <h4 style={{ marginBottom: 16 }}>🪑 Available Tables for {form.guests} guest(s)</h4>
          {availTables.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>🪑</div>
              No tables available for {form.guests} guests at this time.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
              {availTables.map(t => (
                <div key={t.id} onClick={() => setSelectedTable(st => st === t.id ? '' : t.id)}
                  style={{ border: `2px solid ${selectedTable===t.id?'var(--accent-gold)':'#ddd'}`, borderRadius: 12, padding: 16, cursor: 'pointer', textAlign: 'center', background: selectedTable===t.id?'#fff8ee':'#fff' }}>
                  <div style={{ fontSize: '1.5rem' }}>🪑</div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>Table {t.table_code}</div>
                  <div style={{ fontSize: '.78rem', color: '#888' }}>{t.seats} seats</div>
                  <div style={{ fontSize: '.75rem', color: '#10b981', fontWeight: 600, marginTop: 4 }}>Available</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-gold" onClick={() => setStep(3)}>
              {selectedTable ? 'Continue with Table' : 'Continue without Table'} →
            </button>
            <button onClick={() => setStep(1)} style={{ padding: '10px 18px', borderRadius: 999, border: '1.5px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              ← Back
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 16, padding: 24 }}>
          <h4 style={{ marginBottom: 20 }}>✅ Confirm Your Reservation</h4>
          <div style={{ background: '#f9f5f0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['Name', form.name], ['Email', form.email], ['Phone', form.phone], ['Date', form.date], ['Time', form.time], ['Guests', form.guests], ['Table', selectedTable ? `Table ${tables.find(t=>t.id===selectedTable)?.table_code||selectedTable}` : 'No specific table'], ['Special Requests', form.message || 'None']].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: '.75rem', color: '#888', fontWeight: 600 }}>{l}</div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-gold" onClick={handleBook} disabled={loading}>
              {loading ? '⏳ Booking…' : '📅 Confirm Booking'}
            </button>
            <button onClick={() => setStep(2)} style={{ padding: '10px 18px', borderRadius: 999, border: '1.5px solid #ddd', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              ← Back
            </button>
            <button onClick={() => { handleBook(); goTab('menu'); }}
              style={{ padding: '10px 18px', borderRadius: 999, border: 'none', background: '#1c6b5f', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              📅 Book & Order Food
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ORDER TRACKER TAB
══════════════════════════════════════════════════════════════ */
function TrackerTab({ lastOrder, goTab, fmt }) {
  const [currentStatus, setCurrentStatus] = useState('placed');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!lastOrder) return;
    setCurrentStatus(lastOrder.status || 'placed');
    // Simulate order progression
    const stages = ['placed', 'confirmed', 'preparing', 'ready', 'delivered'];
    let idx = stages.indexOf(lastOrder.status || 'placed');
    const interval = setInterval(() => {
      setElapsed(e => e + 1);
      if (idx < stages.length - 1) {
        idx++;
        setCurrentStatus(stages[idx]);
      } else {
        clearInterval(interval);
      }
    }, 15000); // advance every 15s for demo
    return () => clearInterval(interval);
  }, [lastOrder]);

  if (!lastOrder) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>📍</div>
      <h3>No active order</h3>
      <p style={{ color: '#888', marginBottom: 24 }}>Place an order to track it here!</p>
      <button className="btn-gold" onClick={() => goTab('menu')}>Browse Menu</button>
    </div>
  );

  const stages = [
    { key:'placed',    label:'Order Placed',    icon:'📝', desc:'Your order has been received' },
    { key:'confirmed', label:'Confirmed',        icon:'✅', desc:'Restaurant confirmed your order' },
    { key:'preparing', label:'Preparing',        icon:'👨‍🍳', desc:'Your food is being prepared' },
    { key:'ready',     label:'Out for Delivery', icon:'🛵', desc:'Your order is on its way!' },
    { key:'delivered', label:'Delivered',        icon:'🎉', desc:'Enjoy your meal!' },
  ];
  const stageIdx = stages.findIndex(s => s.key === currentStatus);

  return (
    <div style={{ maxWidth: 580 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>📍 Track Order #{lastOrder.orderId}</h3>
      <p style={{ color: '#888', marginBottom: 28, fontSize: '.88rem' }}>
        Placed at {new Date(lastOrder.placedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {lastOrder.orderType === 'dine_in' ? '🪑 Dine-In' : '🛵 Delivery'}
      </p>

      {/* Progress bar */}
      <div style={{ position: 'relative', marginBottom: 40 }}>
        <div style={{ position: 'absolute', top: 20, left: '10%', right: '10%', height: 4, background: '#e0d8ce', borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: 20, left: '10%', width: `${Math.min(stageIdx / (stages.length - 1) * 80, 80)}%`, height: 4, background: 'var(--accent-gold)', borderRadius: 2, transition: 'width 1s ease' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 0 }}>
          {stages.map((s, i) => {
            const done = i <= stageIdx;
            const active = i === stageIdx;
            return (
              <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: `${100/stages.length}%` }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', border: `3px solid ${done ? 'var(--accent-gold)' : '#ddd'}`, background: done ? (active ? 'var(--accent-gold)' : '#fff8ee') : '#fff', transition: 'all .5s', boxShadow: active ? '0 0 0 4px #f59e0b33' : 'none' }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: '.7rem', marginTop: 8, textAlign: 'center', fontWeight: done ? 700 : 400, color: done ? '#333' : '#aaa' }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status card */}
      <div style={{ background: '#fff8ee', border: '2px solid var(--accent-gold)', borderRadius: 16, padding: 24, marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>{stages[stageIdx]?.icon}</div>
        <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>{stages[stageIdx]?.label}</h3>
        <p style={{ color: '#888', margin: 0 }}>{stages[stageIdx]?.desc}</p>
        {lastOrder.orderType === 'online' && currentStatus !== 'delivered' && (
          <div style={{ marginTop: 12, fontSize: '.85rem', color: '#888' }}>
            🕐 Estimated delivery: 30–45 minutes
          </div>
        )}
      </div>

      {/* Order details */}
      <div style={{ background: '#fff', border: '1px solid #e8e0d5', borderRadius: 16, padding: 20 }}>
        <h4 style={{ marginBottom: 14 }}>🧾 Order Details</h4>
        {(lastOrder.items || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem', marginBottom: 8 }}>
            <span>{item.name} ×{item.qty}</span>
            <span style={{ fontWeight: 600 }}>₹{(item.price*item.qty).toFixed(0)}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #eee', marginTop: 12, paddingTop: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
          <span>Total</span><span>₹{parseFloat(lastOrder.total).toFixed(0)}</span>
        </div>
        <div style={{ marginTop: 10, fontSize: '.8rem', color: '#888' }}>
          💳 {lastOrder.form?.method || 'Cash on Delivery'} · {lastOrder.form?.method === 'Cash on Delivery' ? '⏳ Pay on delivery' : '✅ Paid'}
        </div>
      </div>

      {currentStatus === 'delivered' && (
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <p style={{ color: '#10b981', fontWeight: 700, marginBottom: 12 }}>🎉 Enjoy your meal!</p>
          <button className="btn-gold" onClick={() => goTab('menu')}>Order Again</button>
        </div>
      )}
    </div>
  );
}

/* ─── shared styles ─── */
const panelStyle = {
  padding: '60px 20px',
  background: '#f9f5f0',
  borderTop: '1px solid #e8e0d5',
};

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1.5px solid #ddd', fontSize: '.9rem', outline: 'none',
  fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '.85rem', color: '#555',
};
