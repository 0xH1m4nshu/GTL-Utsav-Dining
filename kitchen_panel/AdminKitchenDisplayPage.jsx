import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../gtl_restaurant_frontend/src/config/api';
import './AdminKitchenDisplayPage.css';

const BOARD_COLUMNS = [
  { key: 'new', title: 'New Orders', emoji: '🟡', statuses: ['placed'], accentClass: 'kitchen-column-new' },
  { key: 'preparing', title: 'Preparing', emoji: '🔵', statuses: ['preparing'], accentClass: 'kitchen-column-preparing' },
  { key: 'ready', title: 'Ready', emoji: '🟢', statuses: ['ready', 'out_for_delivery'], accentClass: 'kitchen-column-ready' },
  { key: 'completed', title: 'Completed', emoji: '⚫', statuses: ['completed'], accentClass: 'kitchen-column-completed' },
];

const statusText = {
  placed: 'New',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Ready / Handoff',
  completed: 'Completed',
};

const orderTypeText = {
  dine_in: 'Dine-In',
  online: 'Online',
};

const formatElapsed = (createdAt, now) => {
  if (!createdAt) return '00:00';
  const seconds = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const getUrgencyClass = (createdAt, now, status) => {
  if (!createdAt || ['completed', 'out_for_delivery'].includes(status)) return '';
  const minutes = (now - new Date(createdAt).getTime()) / 60000;
  if (minutes >= 20) return 'critical';
  if (minutes >= 10) return 'warning';
  return '';
};

const normalizeItems = (items) =>
  (items || []).map((item, index) => {
    if (typeof item === 'string') {
      return { id: `${index}-${item}`, name: item, qty: 1 };
    }
    return {
      id: `${index}-${item.name || 'item'}`,
      name: item.name || 'Item',
      qty: item.qty || item.quantity || 1,
      notes: item.notes || item.special_instructions || '',
    };
  });

const getSpecialInstructions = (order) => {
  const itemNotes = normalizeItems(order.items)
    .map((item) => item.notes?.trim())
    .filter(Boolean);

  if (itemNotes.length) {
    return itemNotes.join(' | ');
  }

  const address = String(order.address || '').trim();
  if (!address || address === 'Dine-In' || address === 'Chat assistant order') {
    return '';
  }

  return address;
};

const getPrimaryAction = (order) => {
  if (order.status === 'preparing') {
    return { label: 'Mark Ready', nextStatus: 'ready', icon: 'fa-check' };
  }
  if (order.status === 'ready' || order.status === 'out_for_delivery') {
    return { label: 'Complete', nextStatus: 'completed', icon: 'fa-flag-checkered' };
  }
  return null;
};

const formatCreatedTime = (createdAt) => {
  if (!createdAt) return 'Unknown';
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(createdAt));
};

const getElapsedMinutes = (createdAt, now) => {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
};

const getTicketProgress = (createdAt, now, status) => {
  if (['completed', 'out_for_delivery'].includes(status)) return 100;
  return Math.min(100, Math.max(8, Math.round((getElapsedMinutes(createdAt, now) / 20) * 100)));
};

const getDisplayClock = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));

const AdminKitchenDisplayPage = () => {
  const [orders, setOrders] = useState([]);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [displayMode, setDisplayMode] = useState('board');
  const [focusMode, setFocusMode] = useState('all');

  const loadOrders = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/orders?page_size=200`);
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || 'Unable to load kitchen orders.');
      }
      setOrders((body?.data || []).filter((order) => order.status !== 'cancelled'));
    } catch (error) {
      setNotice(error.message || 'Unable to load kitchen orders.');
      setOrders([]);
    }
  };

  useEffect(() => {
    loadOrders();
    const pollId = window.setInterval(loadOrders, 10000);
    const clockId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(pollId);
      window.clearInterval(clockId);
    };
  }, []);

  const counts = useMemo(() => {
    const base = { new: 0, preparing: 0, ready: 0, completed: 0 };
    for (const column of BOARD_COLUMNS) {
      base[column.key] = orders.filter((order) => column.statuses.includes(order.status)).length;
    }
    return base;
  }, [orders]);

  const summary = useMemo(() => {
    const activeOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status));
    const attention = activeOrders.filter((order) => getUrgencyClass(order.created_at, now, order.status) === 'critical').length;
    const accepted = activeOrders.filter((order) => order.kitchen_accepted_by).length;
    const averageWait =
      activeOrders.length > 0
        ? Math.round(activeOrders.reduce((total, order) => total + getElapsedMinutes(order.created_at, now), 0) / activeOrders.length)
        : 0;
    const longestWait = activeOrders.reduce((max, order) => Math.max(max, getElapsedMinutes(order.created_at, now)), 0);
    return {
      total: orders.length,
      active: activeOrders.length,
      dineIn: orders.filter((order) => order.order_type === 'dine_in').length,
      attention,
      accepted,
      averageWait,
      longestWait,
    };
  }, [orders, now]);

  const updateStatus = async (orderId, nextStatus) => {
    setBusyOrderId(orderId);
    setNotice('');
    try {
      const response = await apiFetch(`${API_BASE}/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || 'Unable to update kitchen status.');
      }
      setNotice(body?.message || 'Kitchen status updated.');
      await loadOrders();
    } catch (error) {
      setNotice(error.message || 'Unable to update kitchen status.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const toggleAccepted = async (orderId, accepted) => {
    setBusyOrderId(orderId);
    setNotice('');
    try {
      const response = await apiFetch(`${API_BASE}/admin/orders/${orderId}/kitchen-acceptance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || 'Unable to update kitchen acceptance.');
      }
      setNotice(body?.message || 'Kitchen ticket updated.');
      await loadOrders();
    } catch (error) {
      setNotice(error.message || 'Unable to update kitchen acceptance.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const getOrdersForColumn = (column) =>
    visibleOrders
      .filter((order) => column.statuses.includes(order.status))
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

  const visibleOrders = useMemo(() => {
    if (focusMode === 'critical') {
      return orders.filter((order) => getUrgencyClass(order.created_at, now, order.status) === 'critical');
    }
    if (focusMode === 'claimed') {
      return orders.filter((order) => Boolean(order.kitchen_accepted_by));
    }
    return orders;
  }, [focusMode, orders, now]);

  const spotlightOrder = useMemo(() => {
    const candidates = orders
      .filter((order) => !['completed', 'cancelled'].includes(order.status))
      .sort((a, b) => {
        const urgencyWeight = { critical: 3, warning: 2, '': 1 };
        const urgencyA = urgencyWeight[getUrgencyClass(a.created_at, now, a.status)] || 1;
        const urgencyB = urgencyWeight[getUrgencyClass(b.created_at, now, b.status)] || 1;
        if (urgencyA !== urgencyB) {
          return urgencyB - urgencyA;
        }
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });
    return candidates[0] || null;
  }, [orders, now]);

  const spotlightItems = spotlightOrder ? normalizeItems(spotlightOrder.items) : [];

  const laneInsights = useMemo(
    () =>
      Object.fromEntries(
        BOARD_COLUMNS.map((column) => {
          const laneOrders = getOrdersForColumn(column);
          const oldestMinutes = laneOrders.length ? getElapsedMinutes(laneOrders[0].created_at, now) : 0;
          const acceptedCount = laneOrders.filter((order) => order.kitchen_accepted_by).length;
          return [column.key, { oldestMinutes, acceptedCount }];
        }),
      ),
    [visibleOrders, now],
  );

  return (
    <div className={`admin-page kitchen-page-shell kitchen-page-shell-${displayMode}`}>
      <section className="admin-hero kitchen-hero">
        <div>
          <div className="admin-hero-kicker">Kitchen Ops</div>
          <h1 className="admin-hero-title">Kitchen Panel</h1>
          <p className="admin-hero-subtitle">A live expediting deck for ticket triage, lane pressure, prep pacing, and handoff visibility.</p>
        </div>
        <div className="kitchen-hero-aside">
          <div className="kitchen-status-marquee">
            <span className="kitchen-status-dot"></span>
            Live kitchen sync
          </div>
          <div className="kitchen-hero-actions">
            <span className="admin-chip">Realtime order feed</span>
            <span className="admin-chip">Lane pressure map</span>
            <span className="admin-chip">Action-driven workflow</span>
          </div>
        </div>
      </section>

      {notice && <div className="admin-banner">{notice}</div>}

      <section className="kitchen-control-deck">
        <div className="kitchen-control-block">
          <span className="kitchen-control-label">Display Mode</span>
          <div className="kitchen-toggle-group">
            <button
              type="button"
              className={`kitchen-toggle-chip ${displayMode === 'board' ? 'active' : ''}`}
              onClick={() => setDisplayMode('board')}
            >
              Board View
            </button>
            <button
              type="button"
              className={`kitchen-toggle-chip ${displayMode === 'wallboard' ? 'active' : ''}`}
              onClick={() => setDisplayMode('wallboard')}
            >
              Wallboard
            </button>
          </div>
        </div>
        <div className="kitchen-control-block">
          <span className="kitchen-control-label">Focus Filter</span>
          <div className="kitchen-toggle-group">
            <button
              type="button"
              className={`kitchen-toggle-chip ${focusMode === 'all' ? 'active' : ''}`}
              onClick={() => setFocusMode('all')}
            >
              All Tickets
            </button>
            <button
              type="button"
              className={`kitchen-toggle-chip ${focusMode === 'critical' ? 'active' : ''}`}
              onClick={() => setFocusMode('critical')}
            >
              Critical Only
            </button>
            <button
              type="button"
              className={`kitchen-toggle-chip ${focusMode === 'claimed' ? 'active' : ''}`}
              onClick={() => setFocusMode('claimed')}
            >
              Claimed Only
            </button>
          </div>
        </div>
        <div className="kitchen-control-clock">
          <span className="kitchen-control-label">Service Clock</span>
          <strong>{getDisplayClock(now)}</strong>
          <span>{visibleOrders.length} tickets visible</span>
        </div>
      </section>

      {spotlightOrder ? (
        <section className="kitchen-spotlight">
          <div className="kitchen-spotlight-main">
            <div className="kitchen-spotlight-kicker">Priority Spotlight</div>
            <div className="kitchen-spotlight-id">Order #{spotlightOrder.id}</div>
            <div className="kitchen-spotlight-meta">
              <span>{orderTypeText[spotlightOrder.order_type] || 'Order'}</span>
              <span>{statusText[spotlightOrder.status] || spotlightOrder.status}</span>
              <span>{getElapsedMinutes(spotlightOrder.created_at, now)}m in queue</span>
            </div>
            <p className="kitchen-spotlight-copy">
              {getSpecialInstructions(spotlightOrder) || 'No special instructions on this ticket. Keep cadence tight and handoff clean.'}
            </p>
            <div className="kitchen-spotlight-actions">
              {spotlightOrder.status === 'placed' ? (
                <>
                  <button
                    type="button"
                    className="btn-ghost kitchen-action-secondary"
                    onClick={() => toggleAccepted(spotlightOrder.id, !spotlightOrder.kitchen_accepted_by)}
                    disabled={busyOrderId === spotlightOrder.id}
                  >
                    <i className="fa-solid fa-hand" />
                    {spotlightOrder.kitchen_accepted_by ? 'Release Ticket' : 'Claim Ticket'}
                  </button>
                  <button
                    type="button"
                    className="btn-primary kitchen-action-primary"
                    onClick={() => updateStatus(spotlightOrder.id, 'preparing')}
                    disabled={busyOrderId === spotlightOrder.id}
                  >
                    <i className="fa-solid fa-fire-burner" />
                    Fire This Ticket
                  </button>
                </>
              ) : null}
              {getPrimaryAction(spotlightOrder) ? (
                <button
                  type="button"
                  className="btn-primary kitchen-action-primary"
                  onClick={() => updateStatus(spotlightOrder.id, getPrimaryAction(spotlightOrder).nextStatus)}
                  disabled={busyOrderId === spotlightOrder.id}
                >
                  <i className={`fa-solid ${getPrimaryAction(spotlightOrder).icon}`} />
                  {getPrimaryAction(spotlightOrder).label}
                </button>
              ) : null}
            </div>
          </div>
          <div className="kitchen-spotlight-side">
            <div className="kitchen-spotlight-side-title">Ticket Breakdown</div>
            <div className="kitchen-spotlight-list">
              {spotlightItems.map((item) => (
                <div key={item.id} className="kitchen-spotlight-list-row">
                  <span>{item.name}</span>
                  <strong>x{item.qty}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="kitchen-command-grid">
        <article className="kitchen-command-card kitchen-command-card-primary">
          <div className="kitchen-command-label">Kitchen Pulse</div>
          <div className="kitchen-command-value">{summary.active}</div>
          <p>Tickets currently moving through prep, readying, and final handoff.</p>
          <div className="kitchen-command-meta">
            <span>{summary.accepted} accepted</span>
            <span>{summary.attention} critical</span>
          </div>
        </article>

        <article className="kitchen-command-card">
          <div className="kitchen-command-label">Average Wait</div>
          <div className="kitchen-command-value">{summary.averageWait}m</div>
          <p>Rolling average age across all active kitchen tickets.</p>
        </article>

        <article className="kitchen-command-card">
          <div className="kitchen-command-label">Longest Ticket</div>
          <div className="kitchen-command-value">{summary.longestWait}m</div>
          <p>Oldest in-flight order that may need an expedite decision.</p>
        </article>

        <article className="kitchen-command-card">
          <div className="kitchen-command-label">Floor Mix</div>
          <div className="kitchen-command-value">{summary.dineIn}</div>
          <p>Dine-in tickets live in the pass, alongside online and pickup work.</p>
        </article>
      </section>

      <section className={`kitchen-board-shell kitchen-board-shell-${displayMode}`}>
        <div className="kitchen-board-shell-head">
          <div>
            <div className="kitchen-board-kicker">Service Lanes</div>
            <h2>Kitchen Traffic Grid</h2>
          </div>
          <div className="kitchen-board-legend">
            <span><i className="fa-solid fa-circle"></i> Under 10m</span>
            <span><i className="fa-solid fa-triangle-exclamation"></i> 10m+ warning</span>
            <span><i className="fa-solid fa-fire-flame-curved"></i> 20m+ critical</span>
          </div>
        </div>

        <section className="kitchen-board">
        {BOARD_COLUMNS.map((column) => {
          const columnOrders = getOrdersForColumn(column);
          return (
            <article key={column.key} className={`kitchen-column ${column.accentClass}`}>
              <header className="kitchen-column-header">
                <div>
                  <span className="kitchen-column-kicker">{column.emoji} {column.title}</span>
                  <h3>{counts[column.key]}</h3>
                  <div className="kitchen-column-substats">
                    <span>{laneInsights[column.key]?.acceptedCount ?? 0} claimed</span>
                    <span>{laneInsights[column.key]?.oldestMinutes ?? 0}m oldest</span>
                  </div>
                </div>
                <span className="kitchen-column-badge">{column.title}</span>
              </header>

              <div className="kitchen-column-body">
                {columnOrders.map((order) => {
                  const urgencyClass = getUrgencyClass(order.created_at, now, order.status);
                  const items = normalizeItems(order.items);
                  const specialInstructions = getSpecialInstructions(order);
                  const primaryAction = getPrimaryAction(order);
                  const isAccepted = Boolean(order.kitchen_accepted_by);
                  const acceptedLabel = order.kitchen_accepted_by
                    ? `Accepted by ${order.kitchen_accepted_by}`
                    : 'Pending Action';
                  const elapsedMinutes = getElapsedMinutes(order.created_at, now);
                  const progress = getTicketProgress(order.created_at, now, order.status);

                  return (
                    <div key={order.id} className={`kitchen-ticket ${urgencyClass}`}>
                      <div className="kitchen-ticket-top">
                        <div>
                          <div className="kitchen-ticket-id">#{order.id}</div>
                          <div className="kitchen-ticket-meta">
                            <span>{orderTypeText[order.order_type] || 'Order'}</span>
                            <span>{statusText[order.status] || order.status}</span>
                          </div>
                        </div>
                        <div className={`kitchen-ticket-timer ${urgencyClass}`}>
                          ⏱ {formatElapsed(order.created_at, now)}
                        </div>
                      </div>

                      <div className="kitchen-ticket-tags">
                        <span className="kitchen-tag">{orderTypeText[order.order_type] || 'Order'}</span>
                        {order.table_id ? <span className="kitchen-tag">Table #{order.table_id}</span> : null}
                        <span className={`kitchen-tag ${isAccepted ? 'accepted' : ''}`}>
                          {acceptedLabel}
                        </span>
                      </div>

                      <div className="kitchen-ticket-telemetry">
                        <div className="kitchen-ticket-telemetry-row">
                          <span>Opened {formatCreatedTime(order.created_at)}</span>
                          <strong>{elapsedMinutes}m in lane</strong>
                        </div>
                        <div className="kitchen-ticket-progress-track">
                          <div className={`kitchen-ticket-progress-fill ${urgencyClass}`} style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>

                      <div className="kitchen-ticket-section">
                        <div className="kitchen-section-label">Items</div>
                        <ul className="kitchen-items-list">
                          {items.map((item) => (
                            <li key={item.id}>
                              <span>{item.name}</span>
                              <strong>x{item.qty}</strong>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {specialInstructions ? (
                        <div className="kitchen-ticket-instructions">
                          <div className="kitchen-section-label">⚠ Special Instructions</div>
                          <p>{specialInstructions}</p>
                        </div>
                      ) : null}

                      <div className="kitchen-ticket-actions">
                        {order.status === 'placed' ? (
                          <>
                            <button
                              type="button"
                              className={`btn-ghost kitchen-action-secondary ${isAccepted ? 'active' : ''}`}
                              onClick={() => toggleAccepted(order.id, !isAccepted)}
                              disabled={busyOrderId === order.id}
                            >
                              <i className="fa-solid fa-hand" />
                              {isAccepted ? 'Accepted' : 'Accept'}
                            </button>
                            <button
                              type="button"
                              className="btn-primary kitchen-action-primary"
                              onClick={() => updateStatus(order.id, 'preparing')}
                              disabled={busyOrderId === order.id}
                            >
                              <i className="fa-solid fa-fire-burner" />
                              Start Preparing
                            </button>
                          </>
                        ) : null}

                        {primaryAction ? (
                          <button
                            type="button"
                            className="btn-primary kitchen-action-primary"
                            onClick={() => updateStatus(order.id, primaryAction.nextStatus)}
                            disabled={busyOrderId === order.id}
                          >
                            <i className={`fa-solid ${primaryAction.icon}`} />
                            {primaryAction.label}
                          </button>
                        ) : null}

                        {order.status === 'completed' ? (
                          <div className="kitchen-complete-badge">
                            <i className="fa-solid fa-circle-check" />
                            Completed
                          </div>
                        ) : null}
                      </div>

                      <div className="kitchen-ticket-footer">
                        <span>Order #{order.id}</span>
                        <span>{items.length} items</span>
                      </div>
                    </div>
                  );
                })}

                {columnOrders.length === 0 ? (
                  <div className="kitchen-empty-state">No orders in this stage right now.</div>
                ) : null}
              </div>
            </article>
          );
        })}
        </section>
      </section>
    </div>
  );
};

export default AdminKitchenDisplayPage;
