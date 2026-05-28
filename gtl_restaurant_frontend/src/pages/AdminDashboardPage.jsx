import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../config/api';

const formatCurrency = (value) => `Rs ${Number(value ?? 0).toLocaleString()}`;

const AdminDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    let active = true;
    const loadMetrics = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await apiFetch(`${API_BASE}/admin/metrics/dashboard`);
        if (!response.ok) {
          throw new Error('Failed to load dashboard metrics.');
        }
        const body = await response.json();
        if (!active) return;
        setMetrics(body?.data ?? null);
      } catch (err) {
        if (!active) return;
        setError('Unable to load dashboard metrics. Please check the API.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadMetrics();
    const intervalId = window.setInterval(loadMetrics, 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const peakMax = useMemo(() => {
    const data = metrics?.peak_hours?.data ?? [];
    return data.reduce((max, item) => (item.count > max ? item.count : max), 0);
  }, [metrics]);

  const monthlyMax = useMemo(() => {
    const data = metrics?.monthly_revenue ?? [];
    return data.reduce((max, item) => (item.total > max ? item.total : max), 0);
  }, [metrics]);

  const monthlyPoints = useMemo(() => {
    const data = metrics?.monthly_revenue ?? [];
    if (!data.length || !monthlyMax) return '';
    const width = 560;
    const height = 180;
    const padding = 16;
    const step = (width - padding * 2) / Math.max(data.length - 1, 1);
    return data
      .map((item, index) => {
        const x = padding + index * step;
        const y = height - padding - (item.total / monthlyMax) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }, [metrics, monthlyMax]);

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <div className="admin-hero-kicker">Overview</div>
          <h1 className="admin-hero-title">Dashboard</h1>
          <p className="admin-hero-subtitle">Live pulse on orders, revenue, and floor activity.</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-chip">Live metrics</span>
          <span className="admin-chip">Auto refresh</span>
          <span className="admin-chip">Last 7 days</span>
        </div>
      </section>

      {loading && <div className="admin-banner">Loading dashboard signals...</div>}
      {!loading && error && <div className="admin-banner">{error}</div>}

      <div className="admin-split">
        <div className="admin-grid">
          <div className="admin-card">
            <h2 className="admin-card-title">Today at a Glance</h2>
            <p className="admin-card-subtitle">Primary operations counters for this shift.</p>
            <div className="admin-grid admin-grid-4" style={{ marginTop: '16px' }}>
              <div className="admin-kpi-card">
                <span>Total Orders</span>
                <h4>{metrics?.today?.total_orders ?? metrics?.orders?.total ?? 0}</h4>
              </div>
              <div className="admin-kpi-card">
                <span>Revenue</span>
                <h4>{formatCurrency(metrics?.today?.revenue)}</h4>
              </div>
              <div className="admin-kpi-card">
                <span>Pending Kitchen</span>
                <h4>{metrics?.today?.pending_kitchen ?? 0}</h4>
              </div>
              <div className="admin-kpi-card">
                <span>Table Occupancy</span>
                <h4>
                  {metrics?.tables?.occupied ?? 0}/{metrics?.tables?.total ?? 0}
                </h4>
              </div>
            </div>
          </div>

          <div className="admin-grid admin-grid-2">
            <div className="admin-card">
              <h3 className="admin-card-title">Peak Hours</h3>
              <p className="admin-card-subtitle">Orders per hour (last 7 days).</p>
              <div className="admin-list" style={{ marginTop: '16px' }}>
                {(metrics?.peak_hours?.data ?? []).map((item) => (
                  <div key={item.hour} className="admin-list-item">
                    <strong>{String(item.hour).padStart(2, '0')}:00</strong>
                    <span>{item.count}</span>
                  </div>
                ))}
                {(metrics?.peak_hours?.data ?? []).map((item) => (
                  <div
                    key={`bar-${item.hour}`}
                    style={{
                      height: '6px',
                      borderRadius: '999px',
                      background: 'rgba(28, 107, 95, 0.12)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: peakMax ? `${(item.count / peakMax) * 100}%` : '0%',
                        height: '100%',
                        background: 'var(--admin-accent)',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title">Monthly Revenue</h3>
              <p className="admin-card-subtitle">Six month curve for revenue pacing.</p>
              <div style={{ marginTop: '16px' }}>
                <svg viewBox="0 0 560 180" width="100%" height="180" role="img" aria-label="Revenue line chart">
                  <defs>
                    <linearGradient id="revenueLine" x1="0" x2="1">
                      <stop offset="0%" stopColor="#1c6b5f" />
                      <stop offset="100%" stopColor="#c58d2f" />
                    </linearGradient>
                  </defs>
                  <rect x="0" y="0" width="560" height="180" fill="#f5efe4" rx="14" />
                  {monthlyPoints && (
                    <>
                      <polyline points={monthlyPoints} fill="none" stroke="url(#revenueLine)" strokeWidth="4" />
                      {(metrics?.monthly_revenue ?? []).map((item, index) => {
                        const width = 560;
                        const height = 180;
                        const padding = 16;
                        const step = (width - padding * 2) / Math.max((metrics?.monthly_revenue ?? []).length - 1, 1);
                        const x = padding + index * step;
                        const y = height - padding - (item.total / monthlyMax) * (height - padding * 2);
                        return <circle key={item.month} cx={x} cy={y} r="4" fill="#0f4d43" />;
                      })}
                    </>
                  )}
                </svg>
                <div className="admin-list" style={{ marginTop: '12px' }}>
                  {(metrics?.monthly_revenue ?? []).map((item) => (
                    <div key={item.month} className="admin-list-item">
                      <strong>{item.month}</strong>
                      <span>{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="admin-rail">
          <div className="admin-card">
            <h3 className="admin-card-title">Today Focus</h3>
            <div className="admin-list">
              <div className="admin-list-item">
                <strong>Pending Kitchen</strong>
                <span>{metrics?.today?.pending_kitchen ?? 0}</span>
              </div>
              <div className="admin-list-item">
                <strong>Online vs Dine-In</strong>
                <span>
                  {metrics?.today?.online ?? 0} / {metrics?.today?.dine_in ?? 0}
                </span>
              </div>
              <div className="admin-list-item">
                <strong>Available Tables</strong>
                <span>{metrics?.tables?.available ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <h3 className="admin-card-title">Revenue Pulse</h3>
            <div className="admin-list">
              <div className="admin-list-item">
                <strong>Today</strong>
                <span>{formatCurrency(metrics?.today?.revenue)}</span>
              </div>
              <div className="admin-list-item">
                <strong>Last 7 Days</strong>
                <span>{formatCurrency(metrics?.revenue?.week_total)}</span>
              </div>
              <div className="admin-list-item">
                <strong>This Month</strong>
                <span>{formatCurrency(metrics?.revenue?.month_total)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
