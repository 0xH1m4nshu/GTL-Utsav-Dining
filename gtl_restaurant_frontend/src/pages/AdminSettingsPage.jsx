import { useState } from 'react';

const AdminSettingsPage = () => {
  const [tab, setTab] = useState('restaurant');
  const [notice, setNotice] = useState(null);
  const [restaurant, setRestaurant] = useState({name:'GTL Utsav Dining',address:'123, MG Road, Nagpur, Maharashtra 440001',phone:'+91 98765 43210',email:'contact@gtlutsav.com',gst:'27AABCG1234A1Z5',cuisine:'Multi-Cuisine',capacity:80});
  const [payment, setPayment] = useState({razorpayKey:'rzp_test_xxxxxxxxxxxx',currency:'INR',gstPercent:18,enableCod:true,enableOnline:true});
  const [smtp, setSmtp] = useState({host:'smtp.gmail.com',port:587,user:'',pass:'',from:'noreply@gtlutsav.com'});
  const [theme, setTheme] = useState({primaryBg:'#AAB7C1',accentGold:'#E5AF51',deepBrown:'#341E0F'});

  const notify = (msg) => { setNotice({msg,type:'success'}); setTimeout(()=>setNotice(null),3000); };

  const tabs = [
    {id:'restaurant',label:'Restaurant',icon:'fa-store'},
    {id:'payment',label:'Payment & GST',icon:'fa-credit-card'},
    {id:'smtp',label:'Email / SMTP',icon:'fa-envelope'},
    {id:'theme',label:'Theme',icon:'fa-palette'},
    {id:'security',label:'Security',icon:'fa-shield-halved'},
  ];

  return (
    <>
      <h1 className="admin-page-title">Settings</h1>
      {notice && <div className={`flash ${notice.type}`}><i className="fa-solid fa-circle-check"></i>{notice.msg}</div>}

      <div style={{display:'flex',gap:22,flexWrap:'wrap',alignItems:'flex-start'}}>
        <div className="admin-panel" style={{width:200,flexShrink:0,padding:12}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`admin-sidebar-item ${tab===t.id?'active':''}`}
              style={{width:'100%',marginBottom:3,border:'none',cursor:'pointer'}}>
              <i className={`fa-solid ${t.icon}`}></i>{t.label}
            </button>
          ))}
        </div>

        <div style={{flex:1,minWidth:280}}>
          {tab==='restaurant' && (
            <div className="admin-panel">
              <h3 style={{marginTop:0,fontFamily:"'Playfair Display',serif"}}>Restaurant Details</h3>
              <div className="admin-form">
                <div className="admin-form-row">
                  <div className="admin-form-group"><label>Restaurant Name</label><input value={restaurant.name} onChange={e=>setRestaurant(p=>({...p,name:e.target.value}))}/></div>
                  <div className="admin-form-group"><label>Cuisine Type</label><input value={restaurant.cuisine} onChange={e=>setRestaurant(p=>({...p,cuisine:e.target.value}))}/></div>
                </div>
                <div className="admin-form-group"><label>Address</label><textarea value={restaurant.address} onChange={e=>setRestaurant(p=>({...p,address:e.target.value}))} rows={2}/></div>
                <div className="admin-form-row">
                  <div className="admin-form-group"><label>Phone</label><input value={restaurant.phone} onChange={e=>setRestaurant(p=>({...p,phone:e.target.value}))}/></div>
                  <div className="admin-form-group"><label>Email</label><input type="email" value={restaurant.email} onChange={e=>setRestaurant(p=>({...p,email:e.target.value}))}/></div>
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group"><label>GST Number</label><input value={restaurant.gst} onChange={e=>setRestaurant(p=>({...p,gst:e.target.value}))}/></div>
                  <div className="admin-form-group"><label>Seating Capacity</label><input type="number" value={restaurant.capacity} onChange={e=>setRestaurant(p=>({...p,capacity:+e.target.value}))}/></div>
                </div>
                <button className="btn btn-primary" onClick={()=>notify('Restaurant details saved!')}><i className="fa-solid fa-floppy-disk"></i>Save Details</button>
              </div>
            </div>
          )}

          {tab==='payment' && (
            <div className="admin-panel">
              <h3 style={{marginTop:0,fontFamily:"'Playfair Display',serif"}}>Payment & GST</h3>
              <div className="admin-form">
                <div className="admin-form-group"><label>Razorpay API Key</label><input value={payment.razorpayKey} onChange={e=>setPayment(p=>({...p,razorpayKey:e.target.value}))} type="password"/></div>
                <div className="admin-form-row">
                  <div className="admin-form-group"><label>Currency</label>
                    <select value={payment.currency} onChange={e=>setPayment(p=>({...p,currency:e.target.value}))}>
                      <option>INR</option><option>USD</option><option>EUR</option>
                    </select>
                  </div>
                  <div className="admin-form-group"><label>GST %</label><input type="number" min="0" max="28" value={payment.gstPercent} onChange={e=>setPayment(p=>({...p,gstPercent:+e.target.value}))}/></div>
                </div>
                <div style={{display:'flex',gap:20}}>
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontWeight:600,fontSize:'.88rem'}}>
                    <input type="checkbox" checked={payment.enableCod} onChange={e=>setPayment(p=>({...p,enableCod:e.target.checked}))} style={{accentColor:'var(--accent-gold)'}}/>Enable COD
                  </label>
                  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontWeight:600,fontSize:'.88rem'}}>
                    <input type="checkbox" checked={payment.enableOnline} onChange={e=>setPayment(p=>({...p,enableOnline:e.target.checked}))} style={{accentColor:'var(--accent-gold)'}}/>Enable Online Payment
                  </label>
                </div>
                <button className="btn btn-primary" onClick={()=>notify('Payment settings saved!')}><i className="fa-solid fa-floppy-disk"></i>Save Settings</button>
              </div>
            </div>
          )}

          {tab==='smtp' && (
            <div className="admin-panel">
              <h3 style={{marginTop:0,fontFamily:"'Playfair Display',serif"}}>Email / SMTP Configuration</h3>
              <div className="admin-form">
                <div className="admin-form-row">
                  <div className="admin-form-group"><label>SMTP Host</label><input value={smtp.host} onChange={e=>setSmtp(p=>({...p,host:e.target.value}))}/></div>
                  <div className="admin-form-group"><label>Port</label><input type="number" value={smtp.port} onChange={e=>setSmtp(p=>({...p,port:+e.target.value}))}/></div>
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-group"><label>Username</label><input value={smtp.user} onChange={e=>setSmtp(p=>({...p,user:e.target.value}))}/></div>
                  <div className="admin-form-group"><label>Password</label><input type="password" value={smtp.pass} onChange={e=>setSmtp(p=>({...p,pass:e.target.value}))}/></div>
                </div>
                <div className="admin-form-group"><label>From Address</label><input type="email" value={smtp.from} onChange={e=>setSmtp(p=>({...p,from:e.target.value}))}/></div>
                <div style={{display:'flex',gap:10}}>
                  <button className="btn btn-primary" onClick={()=>notify('SMTP config saved!')}><i className="fa-solid fa-floppy-disk"></i>Save</button>
                  <button className="btn btn-outline" onClick={()=>notify('Test email sent! Check inbox.','success')}><i className="fa-solid fa-paper-plane"></i>Send Test Email</button>
                </div>
              </div>
            </div>
          )}

          {tab==='theme' && (
            <div className="admin-panel">
              <h3 style={{marginTop:0,fontFamily:"'Playfair Display',serif"}}>Theme Customization</h3>
              <div className="admin-form">
                {[['Primary Background (Navbar)','primaryBg'],['Accent Gold','accentGold'],['Deep Brown (Sidebar)','deepBrown']].map(([label,key])=>(
                  <div key={key} className="admin-form-group">
                    <label>{label}</label>
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      <input type="color" value={theme[key]} onChange={e=>setTheme(p=>({...p,[key]:e.target.value}))} style={{width:44,height:36,borderRadius:6,border:'1.5px solid #ddd',cursor:'pointer',padding:2}}/>
                      <input value={theme[key]} onChange={e=>setTheme(p=>({...p,[key]:e.target.value}))} style={{flex:1}} className="admin-search-input"/>
                    </div>
                  </div>
                ))}
                <div style={{background:'var(--gold-light)',padding:'10px 14px',borderRadius:8,fontSize:'.85rem'}}>
                  <i className="fa-solid fa-info-circle"></i> Theme changes will apply after saving and refreshing.
                </div>
                <button className="btn btn-primary" onClick={()=>notify('Theme preferences saved!')}><i className="fa-solid fa-palette"></i>Apply Theme</button>
              </div>
            </div>
          )}

          {tab==='security' && (
            <div className="admin-panel">
              <h3 style={{marginTop:0,fontFamily:"'Playfair Display',serif"}}>Security Settings</h3>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {[['Two-Factor Authentication (MFA)','Require TOTP for admin logins','fa-mobile-screen',true],
                  ['Session Timeout','Auto-logout after 30 minutes of inactivity','fa-clock',true],
                  ['Login Attempt Limit','Lock account after 5 failed attempts','fa-lock',true],
                  ['Audit Log','Track all admin actions','fa-file-lines',false]].map(([title,desc,icon,enabled])=>(
                  <div key={title} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:'rgba(52,30,15,0.03)',borderRadius:10}}>
                    <div style={{display:'flex',gap:12,alignItems:'center'}}>
                      <div className="admin-stat-icon" style={{width:36,height:36,flexShrink:0}}><i className={`fa-solid ${icon}`}></i></div>
                      <div>
                        <div style={{fontWeight:700,fontSize:'.9rem'}}>{title}</div>
                        <div style={{fontSize:'.8rem',color:'var(--text-muted)'}}>{desc}</div>
                      </div>
                    </div>
                    <div style={{width:44,height:24,borderRadius:999,background:enabled?'var(--accent-gold)':'#ccc',cursor:'pointer',position:'relative',flexShrink:0}}>
                      <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:enabled?22:4,transition:'left .2s'}}/>
                    </div>
                  </div>
                ))}
                <button className="btn btn-primary" style={{alignSelf:'flex-start',marginTop:4}} onClick={()=>notify('Security settings saved!')}><i className="fa-solid fa-floppy-disk"></i>Save Security Settings</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
export default AdminSettingsPage;
