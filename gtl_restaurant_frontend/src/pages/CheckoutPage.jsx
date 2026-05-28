import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, getUserDisplayName } from '../context/UserContext';
import { API_BASE } from '../config/api';

const CheckoutPage = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [orderType, setOrderType] = useState('online'); // 'online' | 'dine_in'
  const [dineTable, setDineTable] = useState('');
  const [form, setForm] = useState({ name:'', phone:'', address:'', city:'Pune', pincode:'', method:'UPI', notes:'' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const raw = sessionStorage.getItem('gtl_cart');
    if (!raw) { navigate('/order-online'); return; }
    setCart(JSON.parse(raw));
    const type = sessionStorage.getItem('gtl_order_type') || 'online';
    const table = sessionStorage.getItem('gtl_dine_table') || '';
    setOrderType(type);
    setDineTable(table);

    const saved = localStorage.getItem('gtl_profile');
    if (saved) {
      const p = JSON.parse(saved);
      setForm(f => ({ ...f, name:p.name||'', phone:p.phone||'', address:p.address||'', city:p.city||'Pune', pincode:p.pincode||'' }));
    } else {
      setForm(f => ({ ...f, name: getUserDisplayName(user) }));
    }
  }, []);

  const subtotal = cart.reduce((a,i) => a + i.qty*i.price, 0);
  const gst = +(subtotal * 0.18).toFixed(2);
  const delivery = orderType === 'dine_in' ? 0 : subtotal > 500 ? 0 : 40;
  const total = +(subtotal + gst + delivery).toFixed(2);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.phone.trim() || !/^\d{10}$/.test(form.phone.replace(/\s/g,''))) e.phone = 'Enter valid 10-digit phone';
    if (orderType === 'online') {
      if (!form.address.trim()) e.address = 'Delivery address is required';
      if (!form.pincode.trim() || !/^\d{6}$/.test(form.pincode)) e.pincode = 'Enter valid 6-digit pincode';
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

  const handlePlace = async e => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const address = orderType === 'dine_in'
        ? `Dine-In${dineTable ? ` — Table ${dineTable}` : ''}`
        : `${form.address}, ${form.city} - ${form.pincode}`;

      const payload = {
        user_id: user?.user_id ?? user?.id ?? '',
        items: cart,
        total,
        address,
        order_type: orderType,
        table_id: dineTable || null,
        payment_method: form.method,
        payment_status: form.method === 'Cash on Delivery' ? 'unpaid' : 'paid',
        notes: form.notes,
      };

      const res = await fetch(`${API_BASE}/orders`, {
        method:'POST', credentials:'include',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (res.ok) {
        const orderId = body?.data?.id || ('ORD-' + Date.now().toString().slice(-6));
        const orderData = { orderId, items:cart, subtotal, gst, delivery, total, form, orderType, dineTable, placedAt:new Date().toISOString(), status:'placed' };
        sessionStorage.setItem('gtl_last_order', JSON.stringify(orderData));
        sessionStorage.removeItem('gtl_cart');
        sessionStorage.removeItem('gtl_order_type');
        sessionStorage.removeItem('gtl_dine_in');
        sessionStorage.removeItem('gtl_dine_table');
        navigate('/order-tracker');
      } else {
        setErrors({ submit: body?.message || 'Failed to place order. Please try again.' });
      }
    } catch {
      setErrors({ submit:'Network error. Please try again.' });
    } finally { setLoading(false); }
  };

  if (!cart.length) return null;

  return (
    <>
      <div className="page-header">
        <div className="page-header-content">
          <h1><i className="fa fa-bag-shopping me-2"></i>Checkout</h1>
          <p>{orderType === 'dine_in' ? '🪑 Dine-In Order' : 'Review and complete your delivery details'}</p>
        </div>
      </div>

      <section style={{ padding:'60px 0', background:'#f9f5f0' }}>
        <div className="container">

          {/* Order type toggle */}
          <div style={{ display:'flex', gap:12, marginBottom:28 }}>
            {[['online','fa-motorcycle','Delivery'],['dine_in','fa-chair','Dine-In']].map(([type,icon,label]) => (
              <button key={type}
                onClick={() => setOrderType(type)}
                style={{
                  padding:'10px 24px', borderRadius:999, border:'2px solid',
                  borderColor: orderType===type ? 'var(--accent-gold)' : '#ddd',
                  background: orderType===type ? '#fff8ee' : '#fff',
                  fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:8
                }}>
                <i className={`fa ${icon}`} style={{ color: orderType===type ? 'var(--accent-gold)' : '#aaa' }}></i>
                {label}
              </button>
            ))}
          </div>

          <div className="checkout-grid">
            <div className="checkout-form-col">
              <div className="checkout-card">
                <h3 className="checkout-section-title">
                  <i className={`fa ${orderType==='dine_in'?'fa-chair':'fa-location-dot'}`}></i>
                  {orderType === 'dine_in' ? ' Dine-In Details' : ' Delivery Details'}
                </h3>
                <form onSubmit={handlePlace}>
                  <div className="checkout-form-row">
                    <div className="checkout-form-group">
                      <label>Full Name *</label>
                      <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="Your name" />
                      {errors.name && <span className="checkout-error">{errors.name}</span>}
                    </div>
                    <div className="checkout-form-group">
                      <label>Phone Number *</label>
                      <input value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))} placeholder="9876543210" maxLength={10} />
                      {errors.phone && <span className="checkout-error">{errors.phone}</span>}
                    </div>
                  </div>

                  {orderType === 'online' ? (
                    <>
                      <div className="checkout-form-group">
                        <label>Delivery Address *</label>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:8, flexWrap:'wrap' }}>
                          <span style={{ color:'#888', fontSize:'.85rem' }}>Use your typed address or auto-fill your current location.</span>
                          <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            disabled={locationLoading}
                            style={{
                              border:'1px solid #e5c38a',
                              background:'#fff8ee',
                              color:'var(--dark)',
                              borderRadius:999,
                              padding:'8px 14px',
                              fontWeight:600,
                              cursor: locationLoading ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {locationLoading ? <><i className="fa fa-spinner fa-spin me-2"></i>Locating...</> : <><i className="fa fa-location-crosshairs me-2"></i>Use Current Location</>}
                          </button>
                        </div>
                        <textarea value={form.address} onChange={e => setForm(p=>({...p,address:e.target.value}))} placeholder="House/Flat No, Street, Landmark" rows={2} />
                        {locationMessage && <div style={{ marginTop:8, color:'#777', fontSize:'.85rem' }}>{locationMessage}</div>}
                        {errors.address && <span className="checkout-error">{errors.address}</span>}
                      </div>
                      <div className="checkout-form-row">
                        <div className="checkout-form-group">
                          <label>City</label>
                          <input value={form.city} onChange={e => setForm(p=>({...p,city:e.target.value}))} />
                        </div>
                        <div className="checkout-form-group">
                          <label>Pincode *</label>
                          <input value={form.pincode} onChange={e => setForm(p=>({...p,pincode:e.target.value}))} placeholder="411001" maxLength={6} />
                          {errors.pincode && <span className="checkout-error">{errors.pincode}</span>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="checkout-form-group">
                      <label>Table Number (optional)</label>
                      <input value={dineTable} onChange={e => setDineTable(e.target.value)} placeholder="e.g. T-01 (leave blank if not reserved)" />
                    </div>
                  )}

                  <div className="checkout-form-group">
                    <label>Special Instructions</label>
                    <textarea value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} placeholder="Any special requests…" rows={2} />
                  </div>

                  <h3 className="checkout-section-title" style={{ marginTop:24 }}><i className="fa fa-credit-card"></i> Payment Method</h3>
                  <div className="payment-methods">
                    {[['UPI','fa-mobile-screen-button'],['Card','fa-credit-card'],['Cash on Delivery','fa-money-bill-wave'],['Net Banking','fa-building-columns']].map(([m,icon]) => (
                      <label key={m} className={`payment-option${form.method===m?' selected':''}`}>
                        <input type="radio" name="method" value={m} checked={form.method===m} onChange={() => setForm(p=>({...p,method:m}))} style={{ display:'none' }} />
                        <i className={`fa ${icon}`}></i><span>{m}</span>
                      </label>
                    ))}
                  </div>

                  {errors.submit && <div className="flash error">{errors.submit}</div>}

                  <button type="submit" className="btn-gold checkout-submit-btn" disabled={loading}>
                    {loading ? <><i className="fa fa-spinner fa-spin me-2"></i>Placing Order…</> : <><i className="fa fa-check-circle me-2"></i>Place Order · ₹{total}</>}
                  </button>
                </form>
              </div>
            </div>

            <div className="checkout-summary-col">
              <div className="checkout-card">
                <h3 className="checkout-section-title"><i className="fa fa-receipt"></i> Order Summary</h3>
                <div className="checkout-items-list">
                  {cart.map(item => (
                    <div key={item.id} className="checkout-item">
                      <div className="checkout-item-info">
                        <span className="checkout-item-name">{item.name}</span>
                        <span className="checkout-item-qty">×{item.qty}</span>
                      </div>
                      <span className="checkout-item-price">₹{(item.price*item.qty).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div className="checkout-divider" />
                <div className="checkout-totals">
                  <div className="checkout-total-row"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
                  <div className="checkout-total-row"><span>GST (18%)</span><span>₹{gst}</span></div>
                  <div className="checkout-total-row">
                    <span>Delivery</span>
                    <span>{delivery===0 ? <span style={{ color:'var(--success)' }}>FREE</span> : `₹${delivery}`}</span>
                  </div>
                  {orderType==='dine_in' && <div className="checkout-free-delivery">🪑 Dine-in — no delivery charge!</div>}
                  {orderType==='online' && delivery===0 && <div className="checkout-free-delivery">🎉 Free delivery on orders above ₹500!</div>}
                  <div className="checkout-divider" />
                  <div className="checkout-total-row checkout-grand-total"><span>Total</span><span>₹{total}</span></div>
                </div>
              </div>
              <div className="checkout-card" style={{ marginTop:16 }}>
                <div style={{ display:'flex', gap:10, alignItems:'center', fontSize:'.88rem', color:'#666' }}>
                  <i className="fa fa-shield-halved" style={{ color:'var(--accent-gold)', fontSize:'1.2rem' }}></i>
                  <span>Secure checkout · Your data is safe with us.</span>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center', fontSize:'.88rem', color:'#666', marginTop:10 }}>
                  <i className="fa fa-clock" style={{ color:'var(--accent-gold)', fontSize:'1.2rem' }}></i>
                  <span>{orderType==='dine_in' ? 'Food will be served at your table.' : 'Estimated delivery: 30–45 minutes'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default CheckoutPage;
