import { useState } from 'react';

const PERMS_ALL = ['Dashboard','Menu','Tables','Orders','Billing','Users','AI Rec','Inventory','Kitchen Display','Reports','Roles','Settings'];

const initRoles = [
  {id:1,name:'Super Admin',color:'badge-error',perms:PERMS_ALL,users:1,desc:'Full system control — all modules accessible'},
  {id:2,name:'Manager',color:'badge-warning',perms:['Dashboard','Menu','Tables','Orders','Billing','Users','Inventory','Kitchen Display','Reports'],users:2,desc:'Manages day-to-day restaurant operations'},
  {id:3,name:'Cashier',color:'badge-blue',perms:['Orders','Billing'],users:3,desc:'Handles billing and payment processing'},
  {id:4,name:'Kitchen Staff',color:'badge-success',perms:['Kitchen Display','Orders'],users:5,desc:'Views and updates order preparation status'},
];

const AdminRolesPermissionsPage = () => {
  const [roles, setRoles] = useState(initRoles);
  const [selected, setSelected] = useState(null);
  const [editPerms, setEditPerms] = useState([]);
  const [notice, setNotice] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRole, setNewRole] = useState({name:'',desc:'',perms:[]});

  const notify = (msg,type='success') => { setNotice({msg,type}); setTimeout(()=>setNotice(null),3000); };

  const openEdit = (role) => { setSelected(role); setEditPerms([...role.perms]); };
  const togglePerm = (p) => setEditPerms(prev=>prev.includes(p)?prev.filter(x=>x!==p):[...prev,p]);
  const savePerms = () => {
    setRoles(prev=>prev.map(r=>r.id===selected.id?{...r,perms:editPerms}:r));
    setSelected(null); notify('Permissions updated!');
  };

  const addRole = (e) => {
    e.preventDefault();
    setRoles(prev=>[...prev,{id:Date.now(),color:'badge-purple',users:0,...newRole}]);
    setNewRole({name:'',desc:'',perms:[]}); setShowAdd(false); notify('Role created!');
  };

  return (
    <>
      <h1 className="admin-page-title">Roles & Permissions</h1>
      {notice && <div className={`flash ${notice.type}`}><i className="fa-solid fa-shield-halved"></i>{notice.msg}</div>}

      <div className="admin-stats-grid" style={{marginBottom:28}}>
        {[['Total Roles','fa-shield-halved',roles.length],
          ['Total Staff','fa-users',roles.reduce((a,r)=>a+r.users,0)],
          ['Permissions','fa-key',PERMS_ALL.length],
          ['Modules Protected','fa-lock',PERMS_ALL.length]].map(([l,i,v])=>(
          <div key={l} className="admin-stat-card">
            <div className="admin-stat-icon"><i className={`fa-solid ${i}`}></i></div>
            <p className="admin-stat-label">{l}</p>
            <h3 className="admin-stat-value">{v}</h3>
          </div>
        ))}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div><h2 className="admin-panel-title">Role Definitions</h2>
          <p className="admin-section-subtitle">Define access levels and module permissions per role</p></div>
          <button className="btn btn-primary" onClick={()=>setShowAdd(s=>!s)}><i className="fa-solid fa-plus"></i>{showAdd?'Cancel':'Add Role'}</button>
        </div>

        {showAdd && (
          <div className="admin-panel" style={{marginBottom:22,border:'2px solid var(--accent-gold)'}}>
            <h3 style={{marginTop:0}}>New Role</h3>
            <form className="admin-form" onSubmit={addRole}>
              <div className="admin-form-row">
                <div className="admin-form-group"><label>Role Name *</label><input value={newRole.name} onChange={e=>setNewRole(p=>({...p,name:e.target.value}))} required/></div>
                <div className="admin-form-group"><label>Description</label><input value={newRole.desc} onChange={e=>setNewRole(p=>({...p,desc:e.target.value}))}/></div>
              </div>
              <div className="admin-form-group">
                <label>Permissions</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:4}}>
                  {PERMS_ALL.map(p=>(
                    <label key={p} style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:'.85rem'}}>
                      <input type="checkbox" checked={newRole.perms.includes(p)} onChange={()=>setNewRole(prev=>({...prev,perms:prev.perms.includes(p)?prev.perms.filter(x=>x!==p):[...prev.perms,p]}))}/>
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button type="submit" className="btn btn-primary"><i className="fa-solid fa-plus"></i>Create Role</button>
                <button type="button" className="btn btn-outline" onClick={()=>setShowAdd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:18}}>
          {roles.map(role=>(
            <div key={role.id} className="admin-feature-card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <span className={`badge ${role.color}`}>{role.name}</span>
                <span style={{fontSize:'.82rem',color:'var(--text-muted)'}}>{role.users} staff</span>
              </div>
              <p style={{margin:'0 0 12px',fontSize:'.86rem'}}>{role.desc}</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:14}}>
                {role.perms.map(p=><span key={p} style={{background:'rgba(52,30,15,0.06)',padding:'2px 8px',borderRadius:6,fontSize:'.74rem',fontWeight:600}}>{p}</span>)}
              </div>
              <button className="btn btn-outline btn-sm" onClick={()=>openEdit(role)}>
                <i className="fa-solid fa-pen"></i>Edit Permissions
              </button>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="admin-modal-backdrop" onClick={()=>setSelected(null)}>
          <div className="admin-modal" onClick={e=>e.stopPropagation()}>
            <div className="admin-modal-header">
              <span className="admin-modal-title">Edit: {selected.name}</span>
              <button className="admin-modal-close" onClick={()=>setSelected(null)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <p style={{fontSize:'.88rem',color:'var(--text-muted)',marginBottom:16}}>Toggle module access for this role</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {PERMS_ALL.map(p=>(
                <label key={p} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'rgba(52,30,15,0.03)',borderRadius:8,cursor:'pointer'}}>
                  <span style={{fontWeight:600,fontSize:'.88rem'}}>{p}</span>
                  <input type="checkbox" checked={editPerms.includes(p)} onChange={()=>togglePerm(p)} style={{width:16,height:16,accentColor:'var(--accent-gold)'}}/>
                </label>
              ))}
            </div>
            <div style={{display:'flex',gap:10,marginTop:20}}>
              <button className="btn btn-primary" onClick={savePerms}><i className="fa-solid fa-floppy-disk"></i>Save Changes</button>
              <button className="btn btn-outline" onClick={()=>setSelected(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default AdminRolesPermissionsPage;
