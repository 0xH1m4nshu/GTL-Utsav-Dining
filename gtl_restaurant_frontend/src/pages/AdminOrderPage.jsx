import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../config/api';

const statusOptions = ['placed', 'preparing', 'ready', 'out_for_delivery', 'completed'];

const AdminOrderPage = () => {
  const [orders, setOrders] = useState([]);
  const [orderType, setOrderType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notice, setNotice] = useState(null);

  const summary = useMemo(() => {
    const total = orders.length;
    const online = orders.filter((order) => order.order_type === 'online').length;
    const dineIn = orders.filter((order) => order.order_type === 'dine_in').length;
    const pending = orders.filter((order) => ['placed', 'preparing'].includes(order.status)).length;
    const revenue = orders.reduce((acc, order) => acc + Number(order.total || 0), 0);
    const unpaid = orders.filter((order) => order.payment_status === 'unpaid').length;
    return { total, online, dineIn, pending, revenue, unpaid };
  }, [orders]);

  const loadOrders = async () => {
    const params = new URLSearchParams();
    if (orderType !== 'all') params.append('type', orderType);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    try {
      const response = await apiFetch(`${API_BASE}/admin/orders?${params.toString()}`);
      const body = await response.json();
      setOrders(body?.data ?? []);
    } catch (err) {
      setOrders([]);
    }
  };

  useEffect(() => {
    loadOrders();
    const intervalId = window.setInterval(loadOrders, 10000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [orderType, statusFilter]);

  const updateStatus = async (orderId, status) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed');
      setNotice('Order status updated.');
      loadOrders();
    } catch (err) {
      setNotice('Unable to update order status.');
    }
  };

  const updatePayment = async (orderId, payment_status, payment_method) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/orders/${orderId}/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status, payment_method }),
      });
      if (!response.ok) throw new Error('Failed');
      setNotice('Payment updated.');
      loadOrders();
    } catch (err) {
      setNotice('Unable to update payment.');
    }
  };

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <div className="admin-hero-kicker">Operations</div>
          <h1 className="admin-hero-title">Order Management</h1>
          <p className="admin-hero-subtitle">Monitor live orders and keep kitchen status aligned.</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-chip">Live orders</span>
          <span className="admin-chip">Kitchen sync</span>
          <span className="admin-chip">Payment review</span>
        </div>
      </section>

      {notice && <div className="admin-banner">{notice}</div>}

      <div className="admin-grid admin-grid-2">
        <div className="admin-card">
          <h2 className="admin-card-title">Filters</h2>
          <p className="admin-card-subtitle">Refine the order feed in real time.</p>
          <div className="admin-form compact" style={{ marginTop: '16px' }}>
            <div className="admin-field">
              <label>Order Type</label>
              <select className="admin-select" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                <option value="all">All</option>
                <option value="online">Online</option>
                <option value="dine_in">Dine-In</option>
              </select>
            </div>
            <div className="admin-field">
              <label>Status</label>
              <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">Order Highlights</h3>
          <p className="admin-card-subtitle">Summary across live and queued orders.</p>
          <div className="admin-grid admin-grid-3" style={{ marginTop: '16px' }}>
            <div className="admin-kpi-card">
              <span>Total Orders</span>
              <h4>{summary.total}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Online</span>
              <h4>{summary.online}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Dine-In</span>
              <h4>{summary.dineIn}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Pending Kitchen</span>
              <h4>{summary.pending}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Revenue</span>
              <h4>Rs {summary.revenue.toLocaleString()}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Unpaid</span>
              <h4>{summary.unpaid}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-list" style={{ marginBottom: '12px' }}>
          <div className="admin-list-item">
            <strong>Live Orders</strong>
            <span>{orders.length} total</span>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{order.order_type === 'dine_in' ? 'Dine-In' : 'Online'}</td>
                  <td>
                    {(order.items ?? []).map((item) => (
                      <div key={`${order.id}-${item.name}`}>{item.name} x{item.qty}</div>
                    ))}
                  </td>
                  <td>₹{order.total}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="admin-select"
                      value={order.payment_status}
                      onChange={(e) => updatePayment(order.id, e.target.value, order.payment_method)}
                    >
                      <option value="unpaid">unpaid</option>
                      <option value="paid">paid</option>
                      <option value="refunded">refunded</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-action"
                      onClick={() => updatePayment(order.id, order.payment_status, 'cash')}
                    >
                      Mark Cash
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="admin-empty">No orders found.</div>
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

export default AdminOrderPage;
