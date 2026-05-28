import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../config/api';

const emptyForm = {
  name: '',
  description: '',
  price: '',
  category: 'mains',
  image_url: '',
  is_available: true,
  is_veg: true,
  is_spicy: false,
};

const AdminMenuPage = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const summary = useMemo(() => {
    const total = items.length;
    const available = items.filter((item) => item.is_available).length;
    const unavailable = total - available;
    const veg = items.filter((item) => item.is_veg).length;
    const spicy = items.filter((item) => item.is_spicy).length;
    return { total, available, unavailable, veg, spicy };
  }, [items]);

  const loadItems = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/menu-items`);
      const body = await response.json();
      setItems(body?.data ?? []);
    } catch (err) {
      setItems([]);
    }
  };

  useEffect(() => {
    loadItems();
    const intervalId = window.setInterval(loadItems, 10000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...form,
        price: Number(form.price || 0),
      };
      const response = await apiFetch(
        editingId ? `${API_BASE}/admin/menu-items/${editingId}` : `${API_BASE}/admin/menu-items`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || 'Save failed');
      const savedItem = {
        ...payload,
        id: editingId ?? body?.data?.id,
      };
      setItems((prev) =>
        editingId
          ? prev.map((item) => (item.id === editingId ? { ...item, ...savedItem } : item))
          : [...prev, savedItem]
      );
      setNotice(body?.message || (editingId ? 'Menu item updated.' : 'Menu item created.'));
      setForm(emptyForm);
      setEditingId(null);
      loadItems();
    } catch (err) {
      setNotice(err.message || 'Unable to save menu item.');
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      name: item.name ?? '',
      description: item.description ?? '',
      price: item.price ?? '',
      category: item.category ?? 'mains',
      image_url: item.image_url ?? '',
      is_available: Boolean(item.is_available),
      is_veg: Boolean(item.is_veg),
      is_spicy: Boolean(item.is_spicy),
    });
  };

  const handleDelete = async (id) => {
    try {
      const response = await apiFetch(`${API_BASE}/admin/menu-items/${id}`, {
        method: 'DELETE',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || 'Delete failed');
      setItems((prev) => prev.filter((item) => item.id !== id));
      setNotice(body?.message || 'Menu item deleted.');
      loadItems();
    } catch (err) {
      setNotice(err.message || 'Unable to delete menu item.');
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response = await apiFetch(`${API_BASE}/admin/menu-items/upload-image`, {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) throw new Error('Upload failed');
      setForm((prev) => ({ ...prev, image_url: body?.data?.image_url ?? '' }));
    } catch (err) {
      setNotice('Unable to upload image.');
    }
  };

  return (
    <div className="admin-page">
      <section className="admin-hero">
        <div>
          <div className="admin-hero-kicker">Catalog</div>
          <h1 className="admin-hero-title">Menu Management</h1>
          <p className="admin-hero-subtitle">Design dishes, control availability, and keep the live catalog fresh.</p>
        </div>
        <div className="admin-hero-actions">
          <span className="admin-chip">Live catalog</span>
          <span className="admin-chip">Draft safe</span>
          <span className="admin-chip">Image ready</span>
        </div>
      </section>

      {notice && <div className="admin-banner">{notice}</div>}

      <div className="admin-split">
        <div className="admin-grid">
          <div className="admin-card">
            <h2 className="admin-card-title">Menu Item Editor</h2>
            <p className="admin-card-subtitle">Create new dishes or update existing menu cards.</p>
            <form className="admin-form" onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
              <div className="admin-field">
                <label>Item Name</label>
                <input className="admin-input" name="name" value={form.name} onChange={handleChange} required />
              </div>
              <div className="admin-field">
                <label>Category</label>
                <select className="admin-select" name="category" value={form.category} onChange={handleChange}>
                  <option value="starters">Starters</option>
                  <option value="mains">Main Course</option>
                  <option value="breads">Breads</option>
                  <option value="desserts">Desserts</option>
                  <option value="drinks">Drinks</option>
                </select>
              </div>
              <div className="admin-field">
                <label>Price</label>
                <input className="admin-input" name="price" type="number" value={form.price} onChange={handleChange} />
              </div>
              <div className="admin-field">
                <label>Image URL</label>
                <input className="admin-input" name="image_url" value={form.image_url} onChange={handleChange} />
                <input className="admin-input" type="file" onChange={handleImageUpload} />
              </div>
              <div className="admin-field">
                <label>Description</label>
                <textarea
                  className="admin-textarea"
                  rows="3"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                />
              </div>
              <div className="admin-grid admin-grid-3">
                <label className="admin-field">
                  <span>Availability</span>
                  <input type="checkbox" name="is_available" checked={form.is_available} onChange={handleChange} />
                </label>
                <label className="admin-field">
                  <span>Vegetarian</span>
                  <input type="checkbox" name="is_veg" checked={form.is_veg} onChange={handleChange} />
                </label>
                <label className="admin-field">
                  <span>Spicy</span>
                  <input type="checkbox" name="is_spicy" checked={form.is_spicy} onChange={handleChange} />
                </label>
              </div>
              <div>
                <button type="submit" className="btn-primary">
                  {editingId ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>

          <div className="admin-card">
            <h3 className="admin-card-title">Menu Snapshot</h3>
            <p className="admin-card-subtitle">Live availability and category mix.</p>
            <div className="admin-grid admin-grid-3" style={{ marginTop: '16px' }}>
              <div className="admin-kpi-card">
                <span>Total Items</span>
                <h4>{summary.total}</h4>
              </div>
              <div className="admin-kpi-card">
                <span>Available</span>
                <h4>{summary.available}</h4>
              </div>
              <div className="admin-kpi-card">
                <span>Unavailable</span>
                <h4>{summary.unavailable}</h4>
              </div>
              <div className="admin-kpi-card">
                <span>Vegetarian</span>
                <h4>{summary.veg}</h4>
              </div>
              <div className="admin-kpi-card">
                <span>Spicy</span>
                <h4>{summary.spicy}</h4>
              </div>
            </div>
          </div>
        </div>

        <aside className="admin-rail">
          <div className="admin-card">
            <h3 className="admin-card-title">Publishing Tips</h3>
            <div className="admin-list">
              <div className="admin-list-item">
                <strong>Images</strong>
                <span>1200x900</span>
              </div>
              <div className="admin-list-item">
                <strong>Availability</strong>
                <span>Toggle to hide</span>
              </div>
              <div className="admin-list-item">
                <strong>Pricing</strong>
                <span>Round to ₹10</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="admin-card">
        <div className="admin-list" style={{ marginBottom: '12px' }}>
          <div className="admin-list-item">
            <strong>Menu Items</strong>
            <span>{items.length} total</span>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>₹{item.price}</td>
                  <td>
                    <span className={`admin-pill ${item.is_available ? 'success' : 'warning'}`}>
                      {item.is_available ? 'Available' : 'Unavailable'}
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
                    <div className="admin-empty">No menu items yet.</div>
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

export default AdminMenuPage;
