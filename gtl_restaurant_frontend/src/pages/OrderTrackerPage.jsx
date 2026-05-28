import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, apiFetch } from '../config/api';
import { useUser } from '../context/UserContext';

const STATUS_STEPS = [
  { key: 'placed', label: 'Order Placed', icon: 'fa-circle-check', desc: 'Your order has been received' },
  { key: 'preparing', label: 'Preparing', icon: 'fa-fire-burner', desc: 'Our chefs are cooking your food' },
  { key: 'ready', label: 'Ready', icon: 'fa-bell-concierge', desc: 'Food is packed and ready' },
  { key: 'out_for_delivery', label: 'On the Way', icon: 'fa-motorcycle', desc: 'Delivery partner heading to you' },
  { key: 'completed', label: 'Delivered', icon: 'fa-house-chimney', desc: 'Enjoy your meal!' },
];

const DINE_STEPS = [
  { key: 'placed', label: 'Order Placed', icon: 'fa-circle-check', desc: 'Your order has been received' },
  { key: 'preparing', label: 'Preparing', icon: 'fa-fire-burner', desc: 'Our chefs are cooking your food' },
  { key: 'ready', label: 'Ready to Serve', icon: 'fa-bell-concierge', desc: 'Food is ready at your table' },
  { key: 'completed', label: 'Served', icon: 'fa-utensils', desc: 'Enjoy your meal! Bon appetit!' },
];

const LAST_ORDER_KEY = 'gtl_last_order';
const LAST_TRACKED_ORDER_KEY = 'gtl_last_tracked_order_id';

const toDisplayOrder = (order) => {
  if (!order) {
    return null;
  }

  return {
    orderId: String(order.orderId ?? order.id ?? ''),
    items: Array.isArray(order.items) ? order.items : [],
    total: Number(order.total || 0),
    orderType: order.orderType ?? order.order_type ?? 'online',
    status: order.status ?? 'placed',
    placedAt: order.placedAt ?? order.created_at ?? new Date().toISOString(),
    address: order.address ?? '',
    paymentStatus: order.paymentStatus ?? order.payment_status ?? '',
  };
};

const formatOrderIdInput = (value) => value.replace(/[^\d]/g, '');

const buildStepMinutes = (orderType) => (orderType === 'dine_in' ? [0, 3, 10, 18] : [0, 3, 8, 14, 22]);

const buildStepFromElapsedTime = (placedAt, orderType) => {
  const placedTime = new Date(placedAt).getTime();
  if (Number.isNaN(placedTime)) {
    return 0;
  }

  const stepMinutes = buildStepMinutes(orderType);
  const elapsedMinutes = (Date.now() - placedTime) / 60000;
  let step = 0;
  for (let index = stepMinutes.length - 1; index >= 0; index -= 1) {
    if (elapsedMinutes >= stepMinutes[index]) {
      step = index;
      break;
    }
  }
  return Math.min(step, stepMinutes.length - 1);
};

const OrderTrackerPage = () => {
  const { user } = useUser();
  const [order, setOrder] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [lookupOrderId, setLookupOrderId] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);
  const [recentOrdersError, setRecentOrdersError] = useState('');
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  const clearIntervals = () => {
    clearInterval(timerRef.current);
    clearInterval(pollRef.current);
  };

  const startTracking = (nextOrder, statusOverride = null) => {
    const displayOrder = toDisplayOrder(nextOrder);
    if (!displayOrder?.orderId) {
      return;
    }

    clearIntervals();
    setOrder(displayOrder);
    setBackendStatus(statusOverride || displayOrder.status || null);
    setCurrentStep(buildStepFromElapsedTime(displayOrder.placedAt, displayOrder.orderType));
    setLookupOrderId(displayOrder.orderId);
    setLookupError('');

    try {
      sessionStorage.setItem(LAST_TRACKED_ORDER_KEY, displayOrder.orderId);
      const rawLastOrder = sessionStorage.getItem(LAST_ORDER_KEY);
      if (!rawLastOrder) {
        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(displayOrder));
      }
    } catch {
      // Ignore storage failures.
    }

    timerRef.current = setInterval(() => {
      setCurrentStep(buildStepFromElapsedTime(displayOrder.placedAt, displayOrder.orderType));
    }, 5000);

    if (displayOrder.orderId.startsWith('ORD-')) {
      return;
    }

    const poll = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/orders/${displayOrder.orderId}/tracking`);
        if (!res.ok) {
          return;
        }
        const body = await res.json();
        const nextStatus = body?.data?.status || null;
        if (nextStatus) {
          setBackendStatus(nextStatus);
          setOrder((current) => (current ? { ...current, status: nextStatus } : current));
        }
      } catch {
        // Keep the last known state visible.
      }
    };

    poll();
    pollRef.current = setInterval(poll, 10000);
  };

  const fetchAndTrackOrder = async (rawOrderId) => {
    const orderId = String(rawOrderId || '').trim();
    if (!orderId) {
      setLookupError('Enter an order ID to track.');
      return;
    }

    setIsLookingUp(true);
    setLookupError('');

    try {
      const detailRes = await apiFetch(`${API_BASE}/orders/${orderId}`);
      const detailBody = await detailRes.json();

      if (!detailRes.ok || !detailBody?.success || !detailBody?.data) {
        throw new Error(detailBody?.message || 'Order not found.');
      }

      let trackedStatus = detailBody.data.status || null;
      const trackingRes = await apiFetch(`${API_BASE}/orders/${orderId}/tracking`);
      if (trackingRes.ok) {
        const trackingBody = await trackingRes.json();
        trackedStatus = trackingBody?.data?.status || trackedStatus;
      }

      startTracking(detailBody.data, trackedStatus);
    } catch (error) {
      setLookupError(error.message || 'Unable to track this order right now.');
    } finally {
      setIsLookingUp(false);
    }
  };

  useEffect(() => {
    try {
      const rawLastOrder = sessionStorage.getItem(LAST_ORDER_KEY);
      const savedTrackedOrderId = sessionStorage.getItem(LAST_TRACKED_ORDER_KEY);

      if (rawLastOrder) {
        const lastOrder = JSON.parse(rawLastOrder);
        startTracking(lastOrder, lastOrder.status || null);
        if (savedTrackedOrderId && String(savedTrackedOrderId) !== String(lastOrder.orderId || '')) {
          fetchAndTrackOrder(savedTrackedOrderId);
        }
      } else if (savedTrackedOrderId) {
        setLookupOrderId(savedTrackedOrderId);
        fetchAndTrackOrder(savedTrackedOrderId);
      }
    } catch {
      // Ignore malformed storage data.
    }

    return () => {
      clearIntervals();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setRecentOrders([]);
      return;
    }

    let cancelled = false;

    const loadRecentOrders = async () => {
      setRecentOrdersLoading(true);
      setRecentOrdersError('');
      try {
        const res = await apiFetch(`${API_BASE}/orders`);
        const body = await res.json();
        if (!res.ok || !body?.success) {
          throw new Error(body?.message || 'Unable to load recent orders.');
        }

        if (!cancelled) {
          setRecentOrders(Array.isArray(body?.data) ? body.data.slice(0, 5) : []);
        }
      } catch (error) {
        if (!cancelled) {
          setRecentOrdersError(error.message || 'Unable to load recent orders.');
        }
      } finally {
        if (!cancelled) {
          setRecentOrdersLoading(false);
        }
      }
    };

    loadRecentOrders();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isDineIn = order?.orderType === 'dine_in';
  const steps = isDineIn ? DINE_STEPS : STATUS_STEPS;
  const activeIdx = backendStatus ? steps.findIndex((step) => step.key === backendStatus) : currentStep;
  const displayStep = activeIdx >= 0 ? activeIdx : currentStep;

  return (
    <>
      <div className="page-header">
        <div className="page-header-content">
          <h1><i className="fa fa-map-location-dot me-2"></i>Order Tracker</h1>
          <p>{order ? (isDineIn ? 'Tracking your dine-in order' : 'Real-time delivery tracking') : 'Track any order using your order ID'}</p>
        </div>
      </div>
      <section style={{ padding: '60px 0', background: '#f9f5f0', minHeight: '60vh' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,.07)', marginBottom: 24 }}>
            <h5 style={{ fontWeight: 700, marginBottom: 10 }}>Track by Order ID</h5>
            <p style={{ marginTop: 0, marginBottom: 16, color: '#777' }}>
              Enter the order ID from checkout to see the latest status from the backend.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                fetchAndTrackOrder(lookupOrderId);
              }}
              style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
            >
              <input
                value={lookupOrderId}
                onChange={(event) => setLookupOrderId(formatOrderIdInput(event.target.value))}
                placeholder="Enter order ID, e.g. 101"
                inputMode="numeric"
                style={{
                  flex: '1 1 240px',
                  minWidth: 220,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1px solid #ddd',
                  fontSize: '.95rem',
                }}
              />
              <button className="btn-gold" type="submit" disabled={isLookingUp}>
                {isLookingUp ? <><i className="fa fa-spinner fa-spin me-2"></i>Tracking...</> : <><i className="fa fa-magnifying-glass me-2"></i>Track Order</>}
              </button>
            </form>
            {lookupError && (
              <div style={{ marginTop: 12, color: '#b42318', fontWeight: 600 }}>
                {lookupError}
              </div>
            )}
          </div>

          {!!recentOrders.length && (
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,.07)', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <h5 style={{ fontWeight: 700, margin: 0 }}>Recent Orders</h5>
                {recentOrdersLoading && <span style={{ color: '#888', fontSize: '.9rem' }}>Loading...</span>}
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {recentOrders.map((recentOrder) => (
                  <button
                    key={recentOrder.id}
                    type="button"
                    onClick={() => fetchAndTrackOrder(recentOrder.id)}
                    style={{
                      border: '1px solid #eee',
                      borderRadius: 14,
                      background: '#fffaf4',
                      padding: '14px 16px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <strong>Order #{recentOrder.id}</strong>
                      <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>Rs.{Number(recentOrder.total || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ marginTop: 6, color: '#777', fontSize: '.9rem' }}>
                      {recentOrder.order_type === 'dine_in' ? 'Dine-In' : 'Delivery'} • Status: {recentOrder.status}
                    </div>
                  </button>
                ))}
              </div>
              {recentOrdersError && (
                <div style={{ marginTop: 12, color: '#b42318', fontWeight: 600 }}>
                  {recentOrdersError}
                </div>
              )}
            </div>
          )}

          {order ? (
            <>
              <div style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,.07)', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                  <div><div style={{ fontSize: '.82rem', color: '#aaa', fontWeight: 600 }}>ORDER ID</div><div style={{ fontWeight: 700 }}>{order.orderId}</div></div>
                  <div><div style={{ fontSize: '.82rem', color: '#aaa', fontWeight: 600 }}>TYPE</div><div style={{ fontWeight: 600 }}>{isDineIn ? 'Dine-In' : 'Delivery'}</div></div>
                  <div><div style={{ fontSize: '.82rem', color: '#aaa', fontWeight: 600 }}>TOTAL</div><div style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>Rs.{order.total.toFixed(2)}</div></div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  <div style={{ border: '1px solid #f0e6d8', borderRadius: 16, background: '#fffaf4', padding: 18 }}>
                    <div style={{ fontSize: '.8rem', color: '#a48a6a', fontWeight: 700, marginBottom: 6 }}>
                      {isDineIn ? 'SERVICE LOCATION' : 'DELIVERY ADDRESS'}
                    </div>
                    <div style={{ color: '#3c2b1f', fontWeight: 600, lineHeight: 1.5 }}>
                      {isDineIn ? 'Dine-in order at the restaurant' : (order.address || 'Address not available')}
                    </div>
                  </div>
                  <div style={{ border: '1px solid #f0e6d8', borderRadius: 16, background: '#fffaf4', padding: 18 }}>
                    <div style={{ fontSize: '.8rem', color: '#a48a6a', fontWeight: 700, marginBottom: 6 }}>PAYMENT STATUS</div>
                    <div style={{ color: '#3c2b1f', fontWeight: 600, textTransform: 'capitalize' }}>
                      {order.paymentStatus || 'Pending'}
                    </div>
                  </div>
                </div>
                <div style={{ position: 'relative', paddingLeft: 40 }}>
                  <div style={{ position: 'absolute', left: 16, top: 0, bottom: 0, width: 2, background: '#e9e9e9' }}></div>
                  {steps.map((step, idx) => {
                    const done = idx < displayStep;
                    const active = idx === displayStep;
                    return (
                      <div key={step.key} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: idx < steps.length - 1 ? 28 : 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: done ? 'var(--accent-gold)' : active ? 'var(--dark)' : '#e9e9e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: done || active ? '#fff' : '#bbb', position: 'relative', left: -40, border: active ? '3px solid var(--accent-gold)' : 'none' }}>
                          <i className={`fa ${step.icon}`} style={{ fontSize: '.75rem' }}></i>
                        </div>
                        <div style={{ paddingTop: 4 }}>
                          <div style={{ fontWeight: active ? 700 : 600, color: active ? 'var(--dark)' : done ? 'var(--accent-gold)' : '#bbb' }}>
                            {step.label}
                            {active && <span style={{ marginLeft: 8, fontSize: '.75rem', background: 'var(--accent-gold)', color: '#fff', padding: '2px 10px', borderRadius: 999 }}>Current</span>}
                          </div>
                          <div style={{ fontSize: '.82rem', color: '#999', marginTop: 2 }}>{step.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,.07)', marginBottom: 24 }}>
                <h5 style={{ fontWeight: 700, marginBottom: 16 }}>Your Items</h5>
                {(order.items || []).length ? (
                  (order.items || []).map((item, index) => {
                    const quantity = Number(item.qty || 1);
                    const price = Number(item.price || 0);
                    const itemKey = item.id ?? `${item.name || 'item'}-${index}`;
                    return (
                      <div key={itemKey} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <span>{item.name} <span style={{ color: '#aaa' }}>x{quantity}</span></span>
                        <span style={{ fontWeight: 600 }}>Rs.{(price * quantity).toFixed(2)}</span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#888' }}>Items are not available for this order.</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 12, paddingTop: 12, borderTop: '2px solid #f0f0f0', color: 'var(--accent-gold)' }}>
                  <span>Total</span><span>Rs.{order.total.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,.07)', marginBottom: 24, textAlign: 'center', color: '#777' }}>
              Enter an order ID above, or pick one of your recent orders to start tracking.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/order-online" className="btn-gold"><i className="fa fa-plus me-2"></i>Order More</Link>
            <Link to="/home" className="btn btn-outline-dark"><i className="fa fa-home me-2"></i>Back to Home</Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default OrderTrackerPage;
