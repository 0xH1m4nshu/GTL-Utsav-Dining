import { useEffect, useState } from 'react';
import { API_BASE, apiFetch } from '../config/api';

const AdminReportsAnalyticsPage = () => {
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const [summaryResponse, analyticsResponse] = await Promise.all([
          apiFetch(`${API_BASE}/admin/reports/summary`),
          apiFetch(`${API_BASE}/admin/reports/analytics?days=14`),
        ]);

        const [summaryBody, analyticsBody] = await Promise.all([
          summaryResponse.json(),
          analyticsResponse.json(),
        ]);

        if (!summaryResponse.ok) {
          throw new Error(summaryBody?.message || 'Unable to load reports.');
        }
        if (!analyticsResponse.ok) {
          throw new Error(analyticsBody?.message || 'Unable to load analytics.');
        }

        setSummary(summaryBody?.data ?? null);
        setAnalytics(analyticsBody?.data ?? null);
        setNotice(null);
      } catch (err) {
        setNotice(err.message || 'Unable to load reports.');
      }
    };
    loadReports();
  }, []);

  const avgOrdersPerDay = summary ? Math.round((summary.total_orders ?? 0) / 7) : 0;
  const dailySales = Number(summary?.daily_sales ?? 0);
  const weeklySales = Number(summary?.weekly_sales ?? 0);
  const topItemName = summary?.top_item?.name || 'N/A';
  const topItemQty = summary?.top_item?.qty ?? 0;
  const weeklyMomentum = weeklySales ? 'Rising' : 'Stable';

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <div className="admin-hero-kicker">Insights</div>
          <h1 className="admin-hero-title">Reports & Analytics</h1>
          <p className="admin-hero-subtitle">A focused view of revenue momentum and operational health.</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-chip">Rolling 14 days</span>
          <span className="admin-chip">Status mix</span>
          <span className="admin-chip">Sales trend</span>
        </div>
      </section>

      {notice && <div className="admin-banner">{notice}</div>}

      <div className="admin-grid admin-grid-2">
        <div className="admin-card">
          <h2 className="admin-card-title">Key Metrics</h2>
          <p className="admin-card-subtitle">Revenue and demand signals across the week.</p>
          <div className="admin-grid admin-grid-2" style={{ marginTop: '16px' }}>
            <div className="admin-kpi-card">
              <span>Daily Sales</span>
              <h4>Rs {dailySales.toLocaleString()}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Weekly Sales</span>
              <h4>Rs {weeklySales.toLocaleString()}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Total Orders</span>
              <h4>{summary?.total_orders ?? 0}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Avg Order Value</span>
              <h4>Rs {Number(analytics?.avg_order_value ?? 0).toLocaleString()}</h4>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">Momentum Signals</h3>
          <p className="admin-card-subtitle">Trend highlights based on live orders.</p>
          <div className="admin-list" style={{ marginTop: '16px' }}>
            <div className="admin-list-item">
              <strong>Daily Trend</strong>
              <span>{dailySales ? 'Up' : 'Stable'}</span>
            </div>
            <div className="admin-list-item">
              <strong>Weekly Momentum</strong>
              <span>{weeklyMomentum}</span>
            </div>
            <div className="admin-list-item">
              <strong>Top Item</strong>
              <span>{topItemName}</span>
            </div>
            <div className="admin-list-item">
              <strong>Top Item Qty</strong>
              <span>{topItemQty}</span>
            </div>
          </div>
          <div className="admin-banner" style={{ marginTop: '16px' }}>
            Avg orders per day: {avgOrdersPerDay} | Top seller qty: {topItemQty}
          </div>
        </div>
      </div>

      <div className="admin-grid admin-grid-2">
        <div className="admin-card">
          <h3 className="admin-card-title">Status Breakdown</h3>
          <div className="admin-list" style={{ marginTop: '16px' }}>
            {(analytics?.status_breakdown ?? []).map((item) => (
              <div key={item.status} className="admin-list-item">
                <strong>{item.status}</strong>
                <span>{item.count}</span>
              </div>
            ))}
            {!(analytics?.status_breakdown ?? []).length && (
              <div className="admin-empty">No order status data yet.</div>
            )}
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">Order Type Share</h3>
          <div className="admin-list" style={{ marginTop: '16px' }}>
            {(analytics?.order_type_share ?? []).map((item) => (
              <div key={item.order_type} className="admin-list-item">
                <strong>{item.order_type}</strong>
                <span>{item.count}</span>
              </div>
            ))}
            {!(analytics?.order_type_share ?? []).length && (
              <div className="admin-empty">No order type data yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="admin-card">
        <h3 className="admin-card-title">Top Items</h3>
        <div className="admin-table-wrap" style={{ marginTop: '16px' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.top_items ?? []).map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.qty}</td>
                </tr>
              ))}
              {!(analytics?.top_items ?? []).length && (
                <tr>
                  <td colSpan="2">
                    <div className="admin-empty">No analytics data yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReportsAnalyticsPage;
