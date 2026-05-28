import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../config/api';

const AdminTablePage = () => {
  const [tables, setTables] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState({ table_code: '', seats: 4 });
  const [notice, setNotice] = useState(null);
  const [qrLoadingFor, setQrLoadingFor] = useState(null);
  const [qrData, setQrData] = useState(null);

  const summary = useMemo(() => {
    const total = tables.length;
    const available = tables.filter((table) => table.status === 'available').length;
    const reserved = tables.filter((table) => table.status === 'reserved').length;
    const occupied = tables.filter((table) => table.status === 'occupied').length;
    return { total, available, reserved, occupied, bookings: bookings.length };
  }, [tables, bookings]);

  const loadTables = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/tables`);
      const body = await response.json();
      setTables(body?.data ?? []);
    } catch (err) {
      setTables([]);
    }
  };

  const loadBookings = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/bookings`);
      const body = await response.json();
      setBookings(body?.data ?? []);
    } catch (err) {
      setBookings([]);
    }
  };

  useEffect(() => {
    loadTables();
    loadBookings();
    const intervalId = window.setInterval(() => {
      loadTables();
      loadBookings();
    }, 10000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await apiFetch(`${API_BASE}/admin/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || 'Failed');
      setForm({ table_code: '', seats: 4 });
      setNotice(body?.message || 'Table added.');
      loadTables();
    } catch (err) {
      setNotice(err.message || 'Unable to add table.');
    }
  };

  const updateStatus = async (tableId, status) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/tables/${tableId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || 'Failed');
      setNotice(body?.message || 'Table status updated.');
      loadTables();
    } catch (err) {
      setNotice(err.message || 'Unable to update table status.');
    }
  };

  const updateBooking = async (bookingId, payload, successMessage) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || 'Failed');
      setNotice(successMessage);
      loadTables();
      loadBookings();
    } catch (err) {
      setNotice(err.message || 'Unable to update booking.');
    }
  };

  const deleteTable = async (tableId) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/tables/${tableId}`, {
        method: 'DELETE',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || 'Failed');
      setNotice(body?.message || 'Table deleted.');
      loadTables();
    } catch (err) {
      setNotice(err.message || 'Unable to delete table.');
    }
  };

  const openMenuQr = async (tableId) => {
    try {
      setQrLoadingFor(tableId);
      const response = await apiFetch(`${API_BASE}/admin/tables/${tableId}/menu-qr`);
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || 'Failed to generate QR code.');
      setQrData(body?.data ?? null);
    } catch (err) {
      setNotice(err.message || 'Unable to generate table QR.');
    } finally {
      setQrLoadingFor(null);
    }
  };

  const closeQrModal = () => {
    setQrData(null);
  };

  const copyQrLink = async (urlToCopy, label) => {
    if (!urlToCopy) return;
    try {
      await navigator.clipboard.writeText(urlToCopy);
      setNotice(`${label} copied for table ${qrData.table_code}.`);
    } catch {
      setNotice('Could not copy link. Please copy it manually from the popup.');
    }
  };

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <div className="admin-hero-kicker">Floor Plan</div>
          <h1 className="admin-hero-title">Table Management</h1>
          <p className="admin-hero-subtitle">Create tables, set status, and track reservations in real time.</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-chip">Reservation sync</span>
          <span className="admin-chip">Live seating</span>
        </div>
      </section>

      {notice && <div className="admin-banner">{notice}</div>}

      {qrData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={closeQrModal}
        >
          <div
            className="admin-card"
            style={{ width: '100%', maxWidth: '460px', margin: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="admin-card-title">Table {qrData.table_code} Menu QR</h3>
            <p className="admin-card-subtitle">Branded print card with logo, table code, and fallback short URL.</p>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 16px' }}>
              <img
                src={qrData.branded_card_image || qrData.qr_image}
                alt={`Branded menu QR card for table ${qrData.table_code}`}
                style={{
                  width: '100%',
                  maxWidth: '320px',
                  borderRadius: '10px',
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                }}
              />
            </div>
            <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Fallback Short URL</label>
            <input
              className="admin-input"
              value={qrData.short_url || ''}
              readOnly
              onFocus={(event) => event.target.select()}
              style={{ marginBottom: '10px' }}
            />
            <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', display: 'block' }}>Full Menu URL</label>
            <input
              className="admin-input"
              value={qrData.menu_url}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              <button type="button" className="btn-primary" onClick={() => copyQrLink(qrData.short_url, 'Short URL')}>
                Copy Short URL
              </button>
              <button type="button" className="admin-action" onClick={() => copyQrLink(qrData.menu_url, 'Full menu URL')}>
                Copy Full URL
              </button>
              <a className="admin-action" href={qrData.short_url || qrData.menu_url} target="_blank" rel="noreferrer">
                Open Link
              </a>
              <a
                className="admin-action"
                href={qrData.branded_card_image || qrData.qr_image}
                download={`table-${qrData.table_code}-qr-card.png`}
              >
                Download Card
              </a>
              <button type="button" className="admin-action" onClick={closeQrModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-grid admin-grid-2">
        <div className="admin-card">
          <h2 className="admin-card-title">Add Table</h2>
          <p className="admin-card-subtitle">Register a new table on the floor.</p>
          <form className="admin-form compact" onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
            <div className="admin-field">
              <label>Table Code</label>
              <input className="admin-input" name="table_code" value={form.table_code} onChange={handleChange} required />
            </div>
            <div className="admin-field">
              <label>Seats</label>
              <input className="admin-input" name="seats" type="number" value={form.seats} onChange={handleChange} />
            </div>
            <div>
              <button type="submit" className="btn-primary">Add Table</button>
            </div>
          </form>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">Table Snapshot</h3>
          <p className="admin-card-subtitle">Live occupancy and reservation totals.</p>
          <div className="admin-grid admin-grid-3" style={{ marginTop: '16px' }}>
            <div className="admin-kpi-card">
              <span>Total Tables</span>
              <h4>{summary.total}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Available</span>
              <h4>{summary.available}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Reserved</span>
              <h4>{summary.reserved}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Occupied</span>
              <h4>{summary.occupied}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Bookings</span>
              <h4>{summary.bookings}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-list" style={{ marginBottom: '12px' }}>
          <div className="admin-list-item">
            <strong>Tables</strong>
            <span>{tables.length} total</span>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Seats</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id}>
                  <td>{table.table_code}</td>
                  <td>{table.seats}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={table.status}
                      onChange={(e) => updateStatus(table.id, e.target.value)}
                    >
                      <option value="available">available</option>
                      <option value="reserved">reserved</option>
                      <option value="occupied">occupied</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" className="admin-action" onClick={() => openMenuQr(table.id)}>
                      {qrLoadingFor === table.id ? 'Generating...' : 'QR Menu'}
                    </button>
                    <button type="button" className="admin-action danger" onClick={() => deleteTable(table.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {tables.length === 0 && (
                <tr>
                  <td colSpan="4">
                    <div className="admin-empty">No tables yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-list" style={{ marginBottom: '12px' }}>
          <div className="admin-list-item">
            <strong>Bookings</strong>
            <span>{bookings.length} bookings</span>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Time</th>
                <th>Guests</th>
                <th>Table</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.name}</td>
                  <td>{booking.date}</td>
                  <td>{booking.time}</td>
                  <td>{booking.guests}</td>
                  <td>
                    <select
                      className="admin-select"
                      value={booking.table_id ?? ''}
                      onChange={(e) =>
                        updateBooking(
                          booking.id,
                          { table_id: e.target.value ? Number(e.target.value) : null },
                          'Booking table updated.'
                        )
                      }
                    >
                      <option value="">Unassigned</option>
                      {tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.table_code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="admin-select"
                      value={booking.status}
                      onChange={(e) =>
                        updateBooking(
                          booking.id,
                          { status: e.target.value },
                          'Booking status updated.'
                        )
                      }
                    >
                      <option value="pending">pending</option>
                      <option value="confirmed">confirmed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="admin-empty">No bookings yet.</div>
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

export default AdminTablePage;
