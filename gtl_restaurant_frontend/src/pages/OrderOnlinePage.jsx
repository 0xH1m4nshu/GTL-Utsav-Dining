import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { API_BASE } from '../config/api';

const CATEGORIES = [
  { label:'All', value:'all', icon:'fa-list' },
  { label:'Starters', value:'starters', icon:'fa-leaf' },
  { label:'Mains', value:'mains', icon:'fa-bowl-food' },
  { label:'Breads', value:'breads', icon:'fa-bread-slice' },
  { label:'Desserts', value:'desserts', icon:'fa-cake-candles' },
  { label:'Drinks', value:'drinks', icon:'fa-glass-water' },
];

const OrderOnlinePage = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [filter, setFilter] = useState('all');
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDineIn, setIsDineIn] = useState(false);
  const [dineInTable, setDineInTable] = useState('');
  const [loginPrompt, setLoginPrompt] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrDineIn = params.get('dine_in') === '1';
    const qrTableCode = (params.get('table') || '').trim();
    const qrTableId = (params.get('table_id') || '').trim();
    if (qrDineIn) {
      sessionStorage.setItem('gtl_dine_in', 'true');
      sessionStorage.setItem('gtl_dine_table', qrTableCode || qrTableId);
    }

    // Check if user came from BookTablePage dine-in flow
    const dineIn = sessionStorage.getItem('gtl_dine_in') === 'true';
    const table = sessionStorage.getItem('gtl_dine_table') || '';
    setIsDineIn(dineIn);
    setDineInTable(table);

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/menu-items`, { credentials:'include' });
        if (res.ok) {
          const b = await res.json();
          setMenuItems(b?.data ?? []);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const filteredItems = useMemo(() =>
    filter === 'all' ? menuItems : menuItems.filter(i => i.category === filter),
  [filter, menuItems]);

  const cartCount = cart.reduce((a,i) => a + i.qty, 0);
  const cartTotal = cart.reduce((a,i) => a + i.qty * i.price, 0);

  const addToCart = item => setCart(prev => {
    const ex = prev.find(e => e.id === item.id);
    if (ex) return prev.map(e => e.id === item.id ? {...e, qty:e.qty+1} : e);
    return [...prev, {...item, qty:1}];
  });

  const removeFromCart = id => setCart(prev => {
    const ex = prev.find(e => e.id === id);
    if (!ex) return prev;
    if (ex.qty === 1) return prev.filter(e => e.id !== id);
    return prev.map(e => e.id === id ? {...e, qty:e.qty-1} : e);
  });

  const goCheckout = () => {
    if (!cartCount) return;
    if (!user) { setLoginPrompt(true); return; }
    sessionStorage.setItem('gtl_cart', JSON.stringify(cart));
    sessionStorage.setItem('gtl_order_type', isDineIn ? 'dine_in' : 'online');
    sessionStorage.setItem('gtl_dine_table', dineInTable);
    navigate('/checkout');
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-content">
          <h1><i className="fa fa-utensils me-2"></i>Order Online</h1>
          <p>{isDineIn ? '🪑 Ordering for dine-in — your table is reserved' : 'Authentic Indian flavours delivered to your door'}</p>
        </div>
      </div>

      {loginPrompt && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:16, padding:40, maxWidth:380, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <i className="fa fa-lock fa-3x" style={{ color:'var(--accent-gold)', marginBottom:16 }}></i>
            <h4>Login Required</h4>
            <p style={{ color:'#888', margin:'12px 0 24px' }}>Please log in to place your order.</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <button className="btn-gold" onClick={() => { sessionStorage.setItem('gtl_cart', JSON.stringify(cart)); navigate('/login'); }}>Login</button>
              <button className="btn btn-outline-dark" onClick={() => setLoginPrompt(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <section className="menu-section">
        <div className="container">

          {isDineIn && (
            <div style={{ background:'#fff8ee', border:'1px solid var(--accent-gold)', borderRadius:12, padding:'14px 20px', marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
              <i className="fa fa-chair" style={{ color:'var(--accent-gold)', fontSize:'1.3rem' }}></i>
              <div>
                <strong>Dine-In Mode</strong>{dineInTable ? ` — Table ${dineInTable}` : ''}
                <span style={{ color:'#888', fontSize:'.85rem', marginLeft:8 }}>Your order will be prepared at the restaurant.</span>
              </div>
              <button style={{ marginLeft:'auto', background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:'.85rem' }}
                onClick={() => { setIsDineIn(false); sessionStorage.removeItem('gtl_dine_in'); }}>
                Switch to Delivery
              </button>
            </div>
          )}

          {cartCount > 0 && (
            <div className="cart-bar">
              <div className="cart-bar-left">
                <i className="fa fa-cart-shopping" style={{ color:'var(--accent-gold)' }}></i>
                <span><strong>{cartCount}</strong> item{cartCount>1?'s':''}</span>
                <span className="cart-bar-total">₹{cartTotal.toFixed(0)}</span>
              </div>
              <div className="cart-bar-right">
                {cart.map(item => (
                  <div key={item.id} className="cart-chip">
                    <span>{item.name.split(' ')[0]} ×{item.qty}</span>
                    <button onClick={() => removeFromCart(item.id)} className="cart-chip-remove">
                      <i className="fa fa-minus"></i>
                    </button>
                  </div>
                ))}
                <button onClick={goCheckout} className="btn-gold cart-checkout-btn">
                  <i className="fa fa-bag-shopping me-1"></i>Checkout
                </button>
              </div>
            </div>
          )}

          <div className="menu-filter">
            {CATEGORIES.map(btn => (
              <button key={btn.value}
                className={`filter-btn${filter===btn.value?' active':''}`}
                onClick={() => setFilter(btn.value)} type="button">
                <i className={`fa ${btn.icon}`}></i> {btn.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'60px', color:'#999' }}>
              <i className="fa fa-spinner fa-spin fa-2x"></i>
              <p style={{ marginTop:12 }}>Loading menu…</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px', color:'#999' }}>No items in this category.</div>
          ) : (
            <div className="menu-grid-horizontal">
              {filteredItems.map(item => {
                const inCart = cart.find(e => e.id === item.id);
                const available = item.is_available !== false && item.available !== false;
                return (
                  <div key={item.id || item.name} className="menu-card-h">
                    <div className="menu-card-h-img-wrap">
                      {item.image_url || item.image ? (
                        <img src={item.image_url || item.image} alt={item.name} className="menu-card-h-img" />
                      ) : (
                        <div style={{ width:'100%', height:'100%', background:'#f0e7d8', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <i className="fa fa-utensils fa-2x" style={{ color:'#ccc' }}></i>
                        </div>
                      )}
                      {!available && <span className="menu-oos-badge">Out of Stock</span>}
                      {item.is_veg && <span style={{ position:'absolute', top:8, left:8, background:'green', color:'#fff', fontSize:'.7rem', padding:'2px 7px', borderRadius:999 }}>VEG</span>}
                    </div>
                    <div className="menu-card-h-body">
                      <div className="menu-card-h-top">
                        <h6 className="menu-card-h-name">{item.name}</h6>
                        {item.category && <span style={{ fontSize:'.75rem', color:'var(--accent-gold)', fontWeight:600, textTransform:'uppercase' }}>{item.category}</span>}
                        <p className="menu-card-h-desc">{item.description}</p>
                      </div>
                      <div className="menu-card-h-footer">
                        <span className="price">₹{item.price}</span>
                        {available ? (
                          inCart ? (
                            <div className="qty-control">
                              <button onClick={() => removeFromCart(item.id)} className="qty-btn"><i className="fa fa-minus"></i></button>
                              <span className="qty-val">{inCart.qty}</span>
                              <button onClick={() => addToCart(item)} className="qty-btn"><i className="fa fa-plus"></i></button>
                            </div>
                          ) : (
                            <button className="add-btn" onClick={() => addToCart(item)} type="button">
                              <i className="fa fa-plus"></i> Add
                            </button>
                          )
                        ) : (
                          <button className="add-btn" disabled style={{ opacity:.5, cursor:'not-allowed' }}>Unavailable</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default OrderOnlinePage;
