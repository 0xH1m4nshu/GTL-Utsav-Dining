import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../config/api';

const emptyForm = { name: '', unit: 'pcs', stock_qty: '', reorder_level: '' };

const AdminInventoryPage = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const summary = useMemo(() => {
    const total = items.length;
    const lowStock = items.filter((item) => Number(item.stock_qty || 0) <= Number(item.reorder_level || 0)).length;
    const ok = total - lowStock;
    const stockTotal = items.reduce((acc, item) => acc + Number(item.stock_qty || 0), 0);
    return { total, lowStock, ok, stockTotal };
  }, [items]);

  const loadItems = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/inventory`);
      const body = await response.json();
      setItems(body?.data ?? []);
    } catch (err) {
      setItems([]);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...form,
        stock_qty: Number(form.stock_qty || 0),
        reorder_level: Number(form.reorder_level || 0),
      };
      const response = await apiFetch(
        editingId ? `${API_BASE}/admin/inventory/${editingId}` : `${API_BASE}/admin/inventory`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) throw new Error('Failed');
      setForm(emptyForm);
      setEditingId(null);
      loadItems();
    } catch (err) {
      setNotice('Unable to save inventory item.');
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      unit: item.unit,
      stock_qty: item.stock_qty,
      reorder_level: item.reorder_level,
    });
  };

  const handleDelete = async (id) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/inventory/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed');
      loadItems();
    } catch (err) {
      setNotice('Unable to delete inventory item.');
    }
  };

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <div className="admin-hero-kicker">Supply Chain</div>
          <h1 className="admin-hero-title">Inventory Management</h1>
          <p className="admin-hero-subtitle">Track stock levels, reorder points, and kitchen readiness.</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-chip">Stock alerts</span>
          <span className="admin-chip">Kitchen readiness</span>
        </div>
      </section>

      {notice && <div className="admin-banner">{notice}</div>}

      <div className="admin-grid admin-grid-2">
        <div className="admin-card">
          <h2 className="admin-card-title">Inventory Item</h2>
          <p className="admin-card-subtitle">Add new ingredients or update quantities.</p>
          <form className="admin-form compact" onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
            <div className="admin-field">
              <label>Item Name</label>
              <input className="admin-input" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="admin-field">
              <label>Unit</label>
              <input className="admin-input" name="unit" value={form.unit} onChange={handleChange} />
            </div>
            <div className="admin-field">
              <label>Stock Qty</label>
              <input className="admin-input" name="stock_qty" type="number" value={form.stock_qty} onChange={handleChange} />
            </div>
            <div className="admin-field">
              <label>Reorder Level</label>
              <input className="admin-input" name="reorder_level" type="number" value={form.reorder_level} onChange={handleChange} />
            </div>
            <div>
              <button type="submit" className="btn-primary">{editingId ? 'Update' : 'Add Item'}</button>
            </div>
          </form>
        </div>

        <div className="admin-card">
          <h3 className="admin-card-title">Inventory Health</h3>
          <p className="admin-card-subtitle">Stock readiness across all categories.</p>
          <div className="admin-grid admin-grid-2" style={{ marginTop: '16px' }}>
            <div className="admin-kpi-card">
              <span>Total Items</span>
              <h4>{summary.total}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Low Stock</span>
              <h4>{summary.lowStock}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Healthy</span>
              <h4>{summary.ok}</h4>
            </div>
            <div className="admin-kpi-card">
              <span>Units on Hand</span>
              <h4>{summary.stockTotal.toLocaleString()}</h4>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-list" style={{ marginBottom: '12px' }}>
          <div className="admin-list-item">
            <strong>Inventory Ledger</strong>
            <span>{items.length} items</span>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Stock</th>
                <th>Reorder Level</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.stock_qty} {item.unit}</td>
                  <td>{item.reorder_level}</td>
                  <td>
                    <span className={`admin-pill ${item.stock_qty <= item.reorder_level ? 'danger' : 'success'}`}>
                      {item.stock_qty <= item.reorder_level ? 'Low Stock' : 'OK'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="admin-action" onClick={() => handleEdit(item)}>
                      Edit
                    </button>
                    <button type="button" className="admin-action danger" onClick={() => handleDelete(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <div className="admin-empty">No inventory items yet.</div>
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

export default AdminInventoryPage;
