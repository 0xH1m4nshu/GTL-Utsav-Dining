import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';
import { useUser, getUserDisplayName } from '../context/UserContext';

const guestOptions = ['1','2','3','4','5','6','8','10','15'];
const timeSlots = ['11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM',
  '2:00 PM','7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM'];

const BookTablePage = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', email:'', phone:'', date:'', time:'', guests:'2', message:'' });
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [flash, setFlash] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=details, 2=table, 3=confirm
  const [wantDineIn, setWantDineIn] = useState(false);
  const minDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const name = getUserDisplayName(user);
    setForm(f => ({ ...f, name: f.name || name, email: f.email || user.email || '' }));
  }, [user]);

  const loadTables = async () => {
    try {
      const res = await fetch(`${API_BASE}/tables`, { credentials:'include' });
      const body = await res.json();
      setTables(body?.data ?? []);
    } catch {}
  };

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleStep1 = e => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || !form.date || !form.time) {
      setFlash({ type:'error', message:'Please fill all required fields.' }); return;
    }
    setFlash(null);
    if (wantDineIn) { loadTables(); setStep(2); }
    else setStep(3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const userId = user?.user_id ?? user?.id ?? '';
      const payload = new URLSearchParams({ ...form, user_id: userId, table_id: selectedTable });
      const res = await fetch(`${API_BASE}/book-table`, {
        method:'POST', credentials:'include',
        headers:{ 'Content-Type':'application/x-www-form-urlencoded', ...(userId ? { 'X-User-Id': userId } : {}) },
        body: payload,
      });
      const body = await res.json();
      if (res.ok) {
        setFlash({ type:'success', message:'🎉 Table booked successfully! We\'ll confirm via email.' });
        setStep(4);
      } else {
        setFlash({ type:'error', message: body?.message || 'Booking failed. Please try again.' });
      }
    } catch {
      setFlash({ type:'error', message:'Network error. Please try again.' });
    } finally { setLoading(false); }
  };

  const availableTables = tables.filter(t => t.status === 'available' && t.seats >= parseInt(form.guests));

  return (
    <>
      <div className="page-header">
        <div className="page-header-content">
          <h1><i className="fa fa-calendar-check me-2"></i>Book a Table</h1>
          <p>Reserve your seat for an unforgettable dining experience</p>
        </div>
      </div>

      <section className="booking-section">
        <div className="container">
          {flash && <div className={`flash ${flash.type} mb-4`}>{flash.message}</div>}

          {/* Step indicators */}
          <div style={{ display:'flex', gap:12, marginBottom:32, flexWrap:'wrap' }}>
            {['Details','Table Selection','Confirm'].map((s,i) => (
              <div key={s} style={{
                padding:'8px 20px', borderRadius:999,
                background: step > i+1 ? 'var(--accent-gold)' : step === i+1 ? 'var(--dark)' : '#e9e9e9',
                color: step >= i+1 ? '#fff' : '#888', fontWeight:600, fontSize:'.85rem'
              }}>{i+1}. {s}</div>
            ))}
          </div>

          {step === 1 && (
            <div className="row g-4">
              <div className="col-lg-8">
                <div className="booking-form-card">
                  <h2><i className="fa fa-calendar-check me-2" style={{color:'var(--accent-gold)'}}></i>Reservation Details</h2>
                  <form onSubmit={handleStep1}>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="form-group">
                          <label><i className="fa fa-user me-1"></i> Full Name *</label>
                          <input className="form-control" name="name" value={form.name} onChange={handleChange} placeholder="Your full name" required />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-group">
                          <label><i className="fa fa-envelope me-1"></i> Email *</label>
                          <input className="form-control" name="email" type="email" value={form.email} onChange={handleChange} placeholder="your@email.com" required />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-group">
                          <label><i className="fa fa-phone me-1"></i> Phone *</label>
                          <input className="form-control" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 XXXXX XXXXX" required />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-group">
                          <label><i className="fa fa-users me-1"></i> Guests *</label>
                          <select className="form-control" name="guests" value={form.guests} onChange={handleChange} required>
                            {guestOptions.map(g => <option key={g} value={g}>{g} Guest{g>1?'s':''}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-group">
                          <label><i className="fa fa-calendar me-1"></i> Date *</label>
                          <input className="form-control" type="date" name="date" value={form.date} onChange={handleChange} min={minDate} required />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-group">
                          <label><i className="fa fa-clock me-1"></i> Time *</label>
                          <select className="form-control" name="time" value={form.time} onChange={handleChange} required>
                            <option value="">Select time</option>
                            {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="form-group">
                          <label><i className="fa fa-comment me-1"></i> Special Requests</label>
                          <textarea className="form-control" name="message" value={form.message} onChange={handleChange} rows="3" placeholder="Dietary requirements, allergies, special occasions…"></textarea>
                        </div>
                      </div>

                      {/* Dine-in option */}
                      <div className="col-12">
                        <div style={{ padding:'16px', background:'#fff8ee', borderRadius:12, border:'1px solid var(--accent-gold)' }}>
                          <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontWeight:600 }}>
                            <input type="checkbox" checked={wantDineIn} onChange={e => setWantDineIn(e.target.checked)} style={{ width:18, height:18 }} />
                            <i className="fa fa-utensils" style={{ color:'var(--accent-gold)' }}></i>
                            I also want to pre-select a table &amp; order food for dine-in
                          </label>
                          <p style={{ margin:'8px 0 0 28px', fontSize:'.85rem', color:'#888' }}>Choose a specific table and optionally pre-order from the menu.</p>
                        </div>
                      </div>

                      <div className="col-12">
                        <button type="submit" className="btn-gold">Next <i className="fa fa-arrow-right ms-2"></i></button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
              <div className="col-lg-4">
                <div className="booking-info">
                  <h4><i className="fa fa-circle-info me-2"></i>Booking Info</h4>
                  {[
                    {icon:'fa-clock',title:'Opening Hours',text:'Mon–Fri: 11 AM – 11 PM\nSat–Sun: 9 AM – 12 AM'},
                    {icon:'fa-location-dot',title:'Location',text:'MG Road, Koregaon Park,\nPune – 411001'},
                    {icon:'fa-phone',title:'Reservations',text:'+91 9876543210'},
                    {icon:'fa-circle-exclamation',title:'Cancellation',text:'Free cancellation up to 2 hours before reservation.'},
                  ].map(item => (
                    <div className="booking-info-item" key={item.title}>
                      <i className={`fa ${item.icon}`}></i>
                      <div><strong>{item.title}</strong><br/>
                        {item.text.split('\n').map((l,i) => <span key={i}>{l}<br/></span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="booking-form-card">
              <h2><i className="fa fa-chair me-2" style={{color:'var(--accent-gold)'}}></i>Select a Table</h2>
              <p style={{ color:'#888', marginBottom:24 }}>Choose an available table for {form.guests} guest(s) on {form.date} at {form.time}</p>

              {availableTables.length === 0 ? (
                <div style={{ textAlign:'center', padding:'40px', color:'#888' }}>
                  <i className="fa fa-chair fa-3x mb-3" style={{ color:'#ddd' }}></i>
                  <p>No tables available for {form.guests} guests. Try a different time or proceed without table selection.</p>
                  <button className="btn-gold" onClick={() => setStep(3)}>Continue without table selection</button>
                </div>
              ) : (
                <>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
                    {availableTables.map(table => (
                      <div key={table.id}
                        onClick={() => setSelectedTable(t => t === table.id ? '' : table.id)}
                        style={{
                          border: selectedTable === table.id ? '2px solid var(--accent-gold)' : '1px solid #ddd',
                          borderRadius:12, padding:20, cursor:'pointer', textAlign:'center',
                          background: selectedTable === table.id ? '#fff8ee' : '#fff',
                          transition:'all .2s'
                        }}>
                        <i className="fa fa-chair fa-2x" style={{ color: selectedTable === table.id ? 'var(--accent-gold)' : '#ccc', marginBottom:8, display:'block' }}></i>
                        <div style={{ fontWeight:700 }}>Table {table.table_code}</div>
                        <div style={{ fontSize:'.85rem', color:'#888' }}>{table.seats} seats</div>
                        <div style={{ marginTop:6, fontSize:'.8rem', color:'green', fontWeight:600 }}>Available</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                    <button className="btn-gold" onClick={() => setStep(3)}>
                      {selectedTable ? 'Continue with Table' : 'Continue without Table'}
                      <i className="fa fa-arrow-right ms-2"></i>
                    </button>
                    <button className="btn-outline-dark btn" onClick={() => setStep(1)}>
                      <i className="fa fa-arrow-left me-2"></i>Back
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="booking-form-card">
              <h2><i className="fa fa-check-circle me-2" style={{color:'var(--accent-gold)'}}></i>Confirm Reservation</h2>
              <div style={{ background:'#f9f5f0', borderRadius:12, padding:24, marginBottom:24 }}>
                <div className="row g-3">
                  {[
                    ['Name', form.name], ['Email', form.email], ['Phone', form.phone],
                    ['Date', form.date], ['Time', form.time], ['Guests', form.guests],
                    ['Table', selectedTable ? `Table ${tables.find(t=>t.id===selectedTable)?.table_code || selectedTable}` : 'No specific table'],
                    ['Special Requests', form.message || 'None'],
                  ].map(([label, val]) => (
                    <div className="col-md-6" key={label}>
                      <div style={{ fontSize:'.82rem', color:'#888', fontWeight:600 }}>{label}</div>
                      <div style={{ fontWeight:600 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                <button className="btn-gold" onClick={handleSubmit} disabled={loading}>
                  {loading ? <><i className="fa fa-spinner fa-spin me-2"></i>Booking…</> : <><i className="fa fa-calendar-check me-2"></i>Confirm Booking</>}
                </button>
                <button className="btn btn-outline-dark" onClick={() => setStep(wantDineIn ? 2 : 1)}>
                  <i className="fa fa-arrow-left me-2"></i>Back
                </button>
                {wantDineIn && (
                  <button className="btn-gold" style={{ background:'#1c6b5f' }} onClick={() => {
                    handleSubmit().then?.();
                    sessionStorage.setItem('gtl_dine_in', 'true');
                    sessionStorage.setItem('gtl_dine_table', selectedTable || '');
                    navigate('/order-online');
                  }}>
                    <i className="fa fa-utensils me-2"></i>Book &amp; Order Food
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="booking-form-card" style={{ textAlign:'center', padding:60 }}>
              <i className="fa fa-circle-check fa-4x" style={{ color:'var(--accent-gold)', marginBottom:20 }}></i>
              <h2>Reservation Confirmed!</h2>
              <p style={{ color:'#888', maxWidth:500, margin:'12px auto 32px' }}>
                Your table is booked for <strong>{form.guests} guest(s)</strong> on <strong>{form.date}</strong> at <strong>{form.time}</strong>. A confirmation will be sent to <strong>{form.email}</strong>.
              </p>
              <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
                <button className="btn-gold" onClick={() => navigate('/order-online')}>
                  <i className="fa fa-utensils me-2"></i>Order Food Online
                </button>
                <button className="btn btn-outline-dark" onClick={() => navigate('/home')}>
                  <i className="fa fa-home me-2"></i>Back to Home
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default BookTablePage;
