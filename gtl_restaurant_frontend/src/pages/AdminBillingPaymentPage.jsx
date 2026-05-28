import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../config/api';

const AdminBillingPaymentPage = () => {
  const [orders, setOrders] = useState([]);
  const [notice, setNotice] = useState(null);

  const loadOrders = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/orders`);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || 'Unable to load payments.');
      }
      setOrders(body?.data ?? []);
    } catch (err) {
      setNotice(err.message || 'Unable to load payments.');
      setOrders([]);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const updatePayment = async (orderId, payment_status, payment_method) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/orders/${orderId}/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status, payment_method }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || 'Unable to update payment.');
      }
      setNotice('Payment details updated.');
      loadOrders();
    } catch (err) {
      setNotice(err.message || 'Unable to update payment.');
    }
  };

  const totals = useMemo(() => {
    const totalRevenue = orders.reduce((acc, order) => acc + Number(order.total || 0), 0);
    const unpaid = orders.filter((order) => order.payment_status === 'unpaid').length;
    const paid = orders.filter((order) => order.payment_status === 'paid').length;
    const refunded = orders.filter((order) => order.payment_status === 'refunded').length;
    return { totalRevenue, unpaid, paid, refunded };
  }, [orders]);

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <div className="admin-hero-kicker">Finance</div>
          <h1 className="admin-hero-title">Billing & Payment</h1>
          <p className="admin-hero-subtitle">Monitor revenue, payment status, and settlement health.</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-chip">Revenue feed</span>
          <span className="admin-chip">Payment ledger</span>
        </div>
      </section>

      {notice && <div className="admin-banner">{notice}</div>}

      <div className="admin-card">
        <h2 className="admin-card-title">Revenue Summary</h2>
        <p className="admin-card-subtitle">Billing totals across all orders.</p>
        <div className="admin-grid admin-grid-4" style={{ marginTop: '16px' }}>
          <div className="admin-kpi-card">
            <span>Total Revenue</span>
            <h4>Rs {totals.totalRevenue.toLocaleString()}</h4>
          </div>
          <div className="admin-kpi-card">
            <span>Unpaid Orders</span>
            <h4>{totals.unpaid}</h4>
          </div>
          <div className="admin-kpi-card">
            <span>Paid</span>
            <h4>{totals.paid}</h4>
          </div>
          <div className="admin-kpi-card">
            <span>Refunded</span>
            <h4>{totals.refunded}</h4>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-list" style={{ marginBottom: '12px' }}>
          <div className="admin-list-item">
            <strong>Payment Ledger</strong>
            <span>{orders.length} orders</span>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Type</th>
                <th>Total</th>
                <th>Payment Status</th>
                <th>Method</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{order.order_type === 'dine_in' ? 'Dine-In' : 'Online'}</td>
                  <td>Rs {Number(order.total || 0).toLocaleString()}</td>
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
                    <select
                      className="admin-select"
                      value={order.payment_method || ''}
                      onChange={(e) => updatePayment(order.id, order.payment_status, e.target.value)}
                    >
                      <option value="">select</option>
                      <option value="cash">cash</option>
                      <option value="card">card</option>
                      <option value="upi">upi</option>
                      <option value="net_banking">net_banking</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-action"
                      onClick={() => updatePayment(order.id, 'paid', order.payment_method || 'cash')}
                    >
                      Mark Paid
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="admin-empty">No payment records yet.</div>
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

export default AdminBillingPaymentPage;
