import { useState } from 'react';

const recommendations = [
  {id:1,dish:'Chicken Biryani',pairings:['Raita','Gulab Jamun'],mood:'Comfort',tags:['non-veg','spicy'],score:94,purchases:142},
  {id:2,dish:'Paneer Tikka',pairings:['Garlic Naan','Lassi'],mood:'Light',tags:['veg'],score:88,purchases:115},
  {id:3,dish:'Dal Makhani',pairings:['Butter Naan','Jeera Rice'],mood:'Comfort',tags:['veg'],score:91,purchases:128},
  {id:4,dish:'Fish Curry',pairings:['Steamed Rice','Papad'],mood:'Spicy',tags:['non-veg','spicy'],score:76,purchases:68},
  {id:5,dish:'Gulab Jamun',pairings:['Kulfi','Chai'],mood:'Dessert',tags:['veg','sweet'],score:85,purchases:200},
];

const MOODS = ['All','Comfort','Light','Spicy','Dessert'];

const AdminAiRecommendationPage = () => {
  const [recs, setRecs] = useState(recommendations);
  const [moodFilter, setMoodFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const filtered = recs.filter(r=>{
    if(moodFilter!=='All' && r.mood!==moodFilter) return false;
    if(search && !r.dish.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleAiAnalyse = async () => {
    if(!prompt.trim()) return;
    setAiLoading(true); setAiResult('');
    setTimeout(()=>{
      setAiResult(`Based on current order data and customer preferences, here are AI-driven insights:\n\n• "${prompt.trim()}" aligns with high-demand Comfort mood items.\n• Pair with Raita and a dessert to increase average order value by ~18%.\n• Peak time for such orders: 7–9 PM — ensure prep time is optimised.\n• Consider a "Chef's Special" tag to boost visibility by 25%.`);
      setAiLoading(false);
    }, 1200);
  };

  return (
    <>
      <h1 className="admin-page-title">AI Recommendation</h1>

      <div className="admin-stats-grid" style={{marginBottom:28}}>
        {[['Total Pairings','fa-robot',recs.length],
          ['Avg Match Score','fa-star','88%'],
          ['Top Mood','fa-face-smile','Comfort'],
          ['Suggestion Conversions','fa-arrow-trend-up','74%']].map(([l,i,v])=>(
          <div key={l} className="admin-stat-card">
            <div className="admin-stat-icon"><i className={`fa-solid ${i}`}></i></div>
            <p className="admin-stat-label">{l}</p>
            <h3 className="admin-stat-value" style={{fontSize:'1.15rem'}}>{v}</h3>
          </div>
        ))}
      </div>

      <div className="admin-panel" style={{marginBottom:22}}>
        <h3 style={{marginTop:0,fontFamily:"'Playfair Display',serif"}}>AI Dish Analyser</h3>
        <p className="admin-section-subtitle" style={{marginBottom:14}}>Ask AI for pairing suggestions, cross-sell ideas, or mood tagging</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <input className="admin-search-input" style={{flex:2,minWidth:220}} placeholder="e.g. What should I pair with Butter Chicken?" value={prompt} onChange={e=>setPrompt(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleAiAnalyse()} />
          <button className="btn btn-primary" onClick={handleAiAnalyse} disabled={aiLoading}>
            {aiLoading ? <><i className="fa-solid fa-spinner fa-spin"></i>Analysing...</> : <><i className="fa-solid fa-robot"></i>Ask AI</>}
          </button>
        </div>
        {aiResult && (
          <div style={{marginTop:16,background:'var(--gold-light)',border:'1px solid var(--gold-border)',borderRadius:10,padding:'14px 18px',fontSize:'.9rem',whiteSpace:'pre-line',lineHeight:1.7}}>
            <strong style={{display:'block',marginBottom:6}}><i className="fa-solid fa-robot"></i> AI Insights</strong>
            {aiResult}
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div><h2 className="admin-panel-title">Pairing & Mood Map</h2>
          <p className="admin-section-subtitle">View and manage AI-generated pairing recommendations</p></div>
        </div>

        <div className="admin-filter-bar">
          <input className="admin-search-input" placeholder="Search dish..." value={search} onChange={e=>setSearch(e.target.value)} />
          <select className="admin-select" value={moodFilter} onChange={e=>setMoodFilter(e.target.value)}>
            {MOODS.map(m=><option key={m}>{m}</option>)}
          </select>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:18}}>
          {filtered.map(r=>(
            <div key={r.id} className="admin-feature-card" style={{cursor:'pointer'}} onClick={()=>setSelected(r)}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <span className="badge badge-gold">{r.mood}</span>
                <span style={{fontWeight:700,fontSize:'1.05rem',color:'var(--deep-brown)'}}>{r.score}<small style={{fontWeight:400,fontSize:'.75rem'}}>/100</small></span>
              </div>
              <h3 style={{margin:'0 0 6px'}}>{r.dish}</h3>
              <p style={{margin:'0 0 10px',fontSize:'.83rem'}}>Pairs with: {r.pairings.join(', ')}</p>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {r.tags.map(t=><span key={t} className={`badge ${t==='veg'?'badge-success':t==='spicy'?'badge-error':'badge-purple'}`}>{t}</span>)}
              </div>
              <div style={{marginTop:10,fontSize:'.8rem',color:'var(--text-muted)'}}>
                <i className="fa-solid fa-cart-shopping"></i> {r.purchases} orders linked
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="admin-modal-backdrop" onClick={()=>setSelected(null)}>
          <div className="admin-modal" onClick={e=>e.stopPropagation()}>
            <div className="admin-modal-header">
              <span className="admin-modal-title">{selected.dish}</span>
              <button className="admin-modal-close" onClick={()=>setSelected(null)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <p><strong>Mood Tag:</strong> {selected.mood}</p>
            <p><strong>Pairings:</strong> {selected.pairings.join(', ')}</p>
            <p><strong>Match Score:</strong> {selected.score}/100</p>
            <p><strong>Linked Orders:</strong> {selected.purchases}</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
              {selected.tags.map(t=><span key={t} className={`badge ${t==='veg'?'badge-success':t==='spicy'?'badge-error':'badge-purple'}`}>{t}</span>)}
            </div>
            <div style={{marginTop:16,background:'var(--gold-light)',padding:'10px 14px',borderRadius:8,fontSize:'.88rem'}}>
              <strong>AI Note:</strong> This pairing has a {selected.score}% match rate with customer preferences. Consider featuring it in the "Recommended" section on the order page.
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default AdminAiRecommendationPage;
