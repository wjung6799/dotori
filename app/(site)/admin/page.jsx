'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LITERACY_SLOTS } from '@/lib/literacySlots';

const quarterLabel = {
  'fall-2025': 'Fall 2025',
  'winter-2026': 'Winter 2026',
  'spring-2026': 'Spring 2026',
  'summer-2026': 'Summer 2026',
};

const pageCss = `
    .tab-btn {
      background: none; border: none; padding: 0.75rem 1.3rem; font-size: 0.95rem;
      font-weight: 600; color: #aaa; cursor: pointer; border-bottom: 2px solid transparent;
      margin-bottom: -2px; transition: color 0.2s, border-color 0.2s; white-space: nowrap;
    }
    .tab-btn.active { color: #e8a87c; border-bottom-color: #e8a87c; }
    .tab-btn:hover { color: #6b5b47; }

    .admin-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 600px; }
    .admin-table th { text-align: left; padding: 0.6rem 0.8rem; background: #f7f5f2; color: #888; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #eee; }
    .admin-table td { padding: 0.75rem 0.8rem; border-bottom: 1px solid #f0ede8; vertical-align: top; }
    .admin-table tr:hover td { background: #fdfcfa; }

    .stat-card { border-radius: 8px; background: #fff; padding: 1rem 1.2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

    .flabel { display: block; font-weight: 600; color: #6b5b47; margin-bottom: 0.3rem; font-size: 0.85rem; }
    .finput { width: 100%; padding: 0.65rem 0.8rem; border: 1.5px solid #ddd; border-radius: 8px; font-size: 0.9rem; background: #fff; box-sizing: border-box; }

    @media (max-width: 768px) {
      .logo-img { display: none !important; }
      .logo-text { display: inline-block !important; }
      nav.container { display: flex; align-items: center; padding: 0 1rem; min-height: 56px; }
      body { padding-top: 0; }
    }
`;

// ── Small reusable stat card ──────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        borderLeft: `4px solid ${color}`,
        borderRadius: 8,
        background: '#fff',
        padding: '1rem 1.2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          color: '#aaa',
          fontSize: '0.78rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
      <div style={{ color: '#6b5b47', fontSize: '1.4rem', fontWeight: 800, marginTop: '0.2rem' }}>
        {value}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [adminName, setAdminName] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState('families');

  // Stats
  const [stats, setStats] = useState(null); // { families, enrollments, paid, pending, revenue }

  // Families
  const [allFamilies, setAllFamilies] = useState([]);
  const [familySearch, setFamilySearch] = useState('');

  // Enrollments
  const [enrollQuarter, setEnrollQuarter] = useState('');
  const [enrollStatus, setEnrollStatus] = useState('');
  const [enrollments, setEnrollments] = useState(null); // null = loading

  // Classes
  const [classes, setClasses] = useState(null);
  const [classForm, setClassForm] = useState({
    name: '',
    category: 'reading',
    quarter: 'fall-2025',
    price: '',
    capacity: '20',
    schedule: '',
    description: '',
    scheduleKey: '',
  });
  const [classFormMsg, setClassFormMsg] = useState(null); // { type, text }

  // Edit class modal
  const [editingClassId, setEditingClassId] = useState(null);
  const [editClassData, setEditClassData] = useState({
    name: '',
    schedule: '',
    description: '',
    price: '',
    capacity: '',
  });
  const [editClassMsg, setEditClassMsg] = useState(null);

  // Reports
  const [reports, setReports] = useState(null);
  const [rptFamily, setRptFamily] = useState('');
  const [rptStudent, setRptStudent] = useState('');
  const [rptQuarter, setRptQuarter] = useState('fall-2025');
  const [rptTitle, setRptTitle] = useState('');
  const [reportFormMsg, setReportFormMsg] = useState(null);
  const rptFileRef = useRef(null);

  // Products
  const [products, setProducts] = useState(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    fulfiller: 'printful',
  });
  const [variants, setVariants] = useState([]); // [{ id, label, price, printfulVariantId, luluProductId }]
  const variantIdRef = useRef(0);
  const [productFormMsg, setProductFormMsg] = useState(null);

  // Orders
  const [orders, setOrders] = useState(null);
  const [orderFilterPay, setOrderFilterPay] = useState('');
  const [orderFilterFulfill, setOrderFilterFulfill] = useState('');

  // Order edit modal
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [orderEdit, setOrderEdit] = useState({
    tracking: '',
    trackingUrl: '',
    carrier: '',
    status: '',
  });
  const [orderEditMsg, setOrderEditMsg] = useState(null);

  // ── Data loaders ────────────────────────────────────────────

  const loadFamilies = useCallback(async () => {
    const res = await fetch('/api/admin/families');
    const data = await res.json();
    setAllFamilies(data.families || []);
  }, []);

  const loadStats = useCallback(async () => {
    const [fRes, eRes] = await Promise.all([
      fetch('/api/admin/families'),
      fetch('/api/admin/enrollments'),
    ]);
    const { families } = await fRes.json();
    const { enrollments: enr } = await eRes.json();
    const paid = enr.filter((e) => e.paymentStatus === 'paid').length;
    const pending = enr.filter((e) => e.paymentStatus === 'pending').length;
    const revenue = enr
      .filter((e) => e.paymentStatus === 'paid')
      .reduce((s, e) => s + (e.amountPaid || 0), 0);
    setStats({
      families: families.length,
      enrollments: enr.length,
      paid,
      pending,
      revenue,
    });
  }, []);

  const loadEnrollments = useCallback(async () => {
    let url = '/api/admin/enrollments?';
    if (enrollQuarter) url += `quarter=${enrollQuarter}&`;
    if (enrollStatus) url += `status=${enrollStatus}`;
    const res = await fetch(url);
    const data = await res.json();
    setEnrollments(data.enrollments || []);
  }, [enrollQuarter, enrollStatus]);

  const loadAdminClasses = useCallback(async () => {
    const res = await fetch('/api/admin/classes');
    const data = await res.json();
    setClasses(data.classes || []);
  }, []);

  const loadReports = useCallback(async () => {
    const res = await fetch('/api/admin/reports');
    const data = await res.json();
    setReports(data.reports || []);
  }, []);

  const loadAdminProducts = useCallback(async () => {
    const res = await fetch('/api/admin/products');
    const data = await res.json();
    setProducts(data.products || []);
  }, []);

  const loadAdminOrders = useCallback(async () => {
    let url = '/api/admin/orders?';
    if (orderFilterPay) url += `status=${orderFilterPay}&`;
    if (orderFilterFulfill) url += `fulfillment=${orderFilterFulfill}`;
    const res = await fetch(url);
    const data = await res.json();
    setOrders(data.orders || []);
  }, [orderFilterPay, orderFilterFulfill]);

  // ── Init (auth check + initial load) ────────────────────────
  useEffect(() => {
    // Auth is handled by Auth.js (next-auth) + middleware (admin role gate).
    if (status === 'loading') return;
    if (status !== 'authenticated' || session?.user?.role !== 'admin') {
      router.push('/login');
      return;
    }
    setAdminName(`Logged in as ${session.user.name || session.user.email}`);
    setAuthChecked(true);
    loadFamilies();
    loadStats();
  }, [router, status, session, loadFamilies, loadStats]);

  // ── Tab switching: load data for selected tab ───────────────
  const switchTab = (t) => {
    setTab(t);
    if (t === 'families') loadFamilies();
    if (t === 'enrollments') loadEnrollments();
    if (t === 'classes') loadAdminClasses();
    if (t === 'reports') loadReports();
    if (t === 'products') loadAdminProducts();
    if (t === 'orders') loadAdminOrders();
  };

  // Reload enrollments when filters change (only when tab active)
  useEffect(() => {
    if (authChecked && tab === 'enrollments') loadEnrollments();
  }, [enrollQuarter, enrollStatus, authChecked, tab, loadEnrollments]);

  // Reload orders when filters change (only when tab active)
  useEffect(() => {
    if (authChecked && tab === 'orders') loadAdminOrders();
  }, [orderFilterPay, orderFilterFulfill, authChecked, tab, loadAdminOrders]);

  // ── Families filtering ──────────────────────────────────────
  const filteredFamilies = (() => {
    const q = familySearch.toLowerCase();
    if (!q) return allFamilies;
    return allFamilies.filter(
      (f) =>
        (f.firstName + ' ' + f.lastName).toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q)
    );
  })();

  // ── Enrollment actions ──────────────────────────────────────
  // Track local price edits so input reflects state
  const [priceEdits, setPriceEdits] = useState({});

  const setPrice = async (id, amount) => {
    await fetch(`/api/admin/enrollments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountPaid: amount }),
    });
  };

  const updateEnrollment = async (id, status) => {
    const amountPaid = priceEdits[id];
    const res = await fetch(`/api/admin/enrollments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: status, amountPaid }),
    });
    if (res.ok) {
      loadEnrollments();
      loadStats();
    }
  };

  // ── Class form ──────────────────────────────────────────────
  const handleClassSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: classForm.name,
        category: classForm.category,
        quarter: classForm.quarter,
        price: classForm.price,
        capacity: classForm.capacity,
        schedule: classForm.schedule,
        description: classForm.description,
        scheduleKey: classForm.scheduleKey,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setClassFormMsg({ type: 'success', text: `Class "${data.class.name}" created!` });
      setClassForm({
        name: '',
        category: 'reading',
        quarter: 'fall-2025',
        price: '',
        capacity: '20',
        schedule: '',
        description: '',
        scheduleKey: '',
      });
      loadAdminClasses();
      setTimeout(() => setClassFormMsg(null), 3000);
    } else {
      setClassFormMsg({ type: 'error', text: data.error || 'Failed to create class.' });
    }
  };

  const openEditClass = (id, name, schedule, description, price, capacity) => {
    setEditingClassId(id);
    setEditClassData({ name, schedule, description, price, capacity });
    setEditClassMsg(null);
  };
  const closeEditClass = () => {
    setEditingClassId(null);
  };
  const saveClassEdit = async () => {
    const res = await fetch(`/api/admin/classes/${editingClassId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editClassData.name,
        schedule: editClassData.schedule,
        description: editClassData.description,
        price: editClassData.price,
        capacity: editClassData.capacity,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      closeEditClass();
      loadAdminClasses();
    } else {
      setEditClassMsg(data.error || 'Failed to update class.');
    }
  };

  const toggleClass = async (id, active) => {
    await fetch(`/api/admin/classes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    loadAdminClasses();
  };

  const deleteClass = async (id) => {
    if (!confirm('Delete this class? This cannot be undone.')) return;
    await fetch(`/api/admin/classes/${id}`, { method: 'DELETE' });
    loadAdminClasses();
  };

  // ── Reports ─────────────────────────────────────────────────
  const selectedFamily = allFamilies.find((f) => f._id === rptFamily);
  const reportStudents = selectedFamily ? selectedFamily.students || [] : [];

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    const file = rptFileRef.current ? rptFileRef.current.files[0] : null;
    const formData = new FormData();
    formData.append('userId', rptFamily);
    formData.append('studentName', rptStudent);
    formData.append('quarter', rptQuarter);
    formData.append('title', rptTitle);
    formData.append('pdf', file);

    if (!formData.get('userId') || !formData.get('studentName') || !formData.get('title')) {
      setReportFormMsg({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }

    const res = await fetch('/api/admin/reports/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (res.ok) {
      setReportFormMsg({ type: 'success', text: 'Report uploaded successfully!' });
      // reset form
      setRptFamily('');
      setRptStudent('');
      setRptQuarter('fall-2025');
      setRptTitle('');
      if (rptFileRef.current) rptFileRef.current.value = '';
      loadReports();
      setTimeout(() => setReportFormMsg(null), 3000);
    } else {
      setReportFormMsg({ type: 'error', text: data.error || 'Upload failed.' });
    }
  };

  const deleteReport = async (id) => {
    if (!confirm('Delete this report? The PDF file will also be removed.')) return;
    await fetch(`/api/admin/reports/${id}`, { method: 'DELETE' });
    loadReports();
  };

  // ── Products ────────────────────────────────────────────────
  const addVariantRow = (v) => {
    const id = variantIdRef.current++;
    setVariants((prev) => [
      ...prev,
      {
        id,
        label: v?.label || '',
        price: v?.price || '',
        printfulVariantId: v?.printfulVariantId || '',
        luluProductId: v?.luluProductId || '',
      },
    ]);
  };

  const updateVariant = (id, field, value) => {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const removeVariant = (id) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const autoSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const collectVariants = () => {
    const out = [];
    variants.forEach((v) => {
      const label = (v.label || '').trim();
      if (!label) return;
      out.push({
        label,
        price: parseFloat(v.price) || 0,
        printfulVariantId: parseInt(v.printfulVariantId) || null,
        luluProductId: (v.luluProductId || '').trim() || '',
      });
    });
    return out;
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: prodForm.name,
        slug: prodForm.slug,
        description: prodForm.description,
        imageUrl: prodForm.imageUrl,
        fulfiller: prodForm.fulfiller,
        variants: collectVariants(),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setProductFormMsg({ type: 'success', text: 'Product added!' });
      setProdForm({ name: '', slug: '', description: '', imageUrl: '', fulfiller: 'printful' });
      setVariants([]);
      variantIdRef.current = 0;
      loadAdminProducts();
    } else {
      setProductFormMsg({ type: 'error', text: data.error || 'Failed to add product.' });
    }
  };

  const toggleProduct = async (id, active) => {
    await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    loadAdminProducts();
  };

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    loadAdminProducts();
  };

  // ── Orders ──────────────────────────────────────────────────
  const openOrderEdit = (id, tracking, trackingUrl, carrier) => {
    setEditingOrderId(id);
    setOrderEdit({ tracking, trackingUrl, carrier, status: '' });
    setOrderEditMsg(null);
  };
  const closeOrderEdit = () => {
    setEditingOrderId(null);
  };
  const saveOrderEdit = async () => {
    const res = await fetch(`/api/admin/orders/${editingOrderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingNumber: orderEdit.tracking,
        trackingUrl: orderEdit.trackingUrl,
        carrier: orderEdit.carrier,
        fulfillmentStatus: orderEdit.status || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      closeOrderEdit();
      loadAdminOrders();
    } else {
      setOrderEditMsg(data.error || 'Failed to update.');
    }
  };
  const refundOrder = async (id) => {
    if (!confirm('Issue a full refund for this order?')) return;
    const res = await fetch(`/api/admin/orders/${id}/refund`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      loadAdminOrders();
    } else {
      alert(data.error || 'Refund failed.');
    }
  };

  // ── Render helpers ──────────────────────────────────────────
  const formMsgStyle = (type) =>
    type === 'success'
      ? {
          display: 'block',
          background: '#e8f5ec',
          border: '1px solid #7cbf8e',
          color: '#1e7a40',
          borderRadius: 8,
          padding: '0.6rem 1rem',
          marginBottom: '0.8rem',
          fontSize: '0.85rem',
        }
      : {
          display: 'block',
          background: '#fdeaea',
          border: '1px solid #e88080',
          color: '#b00',
          borderRadius: 8,
          padding: '0.6rem 1rem',
          marginBottom: '0.8rem',
          fontSize: '0.85rem',
        };

  if (!authChecked) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: pageCss }} />
        <main>
          <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
            <p style={{ color: '#aaa' }}>Loading…</p>
          </div>
        </main>
      </>
    );
  }

  const fulfillerLabel = { printful: 'Printful', lulu: 'Lulu', manual: 'Manual' };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pageCss }} />

      <main>
        <div className="container" style={{ padding: '2rem 1rem 4rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '2rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <h1 style={{ color: '#6b5b47', margin: 0, fontSize: '1.8rem' }}>Admin Dashboard</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <a
                href="/admin/booking"
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  background: '#e8a87c',
                  color: '#fff',
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                }}
              >
                Booking Admin →
              </a>
              <span style={{ color: '#aaa', fontSize: '0.9rem' }}>{adminName}</span>
            </div>
          </div>

          {/* Stats bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))',
              gap: '1rem',
              marginBottom: '2rem',
            }}
          >
            {stats && (
              <>
                <StatCard label="Families" value={stats.families} color="#e8a87c" />
                <StatCard label="Enrollments" value={stats.enrollments} color="#7ab3d4" />
                <StatCard label="Paid" value={`${stats.paid} ($${stats.revenue})`} color="#7cbf8e" />
                <StatCard label="Pending" value={stats.pending} color="#f7c948" />
              </>
            )}
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              borderBottom: '2px solid #eee',
              marginBottom: '2rem',
              overflowX: 'auto',
            }}
          >
            {[
              ['families', 'Families'],
              ['enrollments', 'Enrollments'],
              ['seats', 'Seat Counts'],
              ['classes', 'Classes'],
              ['reports', 'Reports'],
              ['products', 'Products'],
              ['orders', 'Shop Orders'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`tab-btn${tab === key ? ' active' : ''}`}
                onClick={() => switchTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* FAMILIES */}
          <div className="tab-panel" style={{ display: tab === 'families' ? 'block' : 'none' }}>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Search by name or email…"
                value={familySearch}
                onChange={(e) => setFamilySearch(e.target.value)}
                style={{
                  padding: '0.65rem 1rem',
                  border: '1.5px solid #ddd',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  width: 260,
                  maxWidth: '100%',
                }}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              {!filteredFamilies.length ? (
                <p style={{ color: '#aaa' }}>
                  {allFamilies.length ? 'No families found.' : 'Loading…'}
                </p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Students</th>
                      <th>Enrollments</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFamilies.map((f) => (
                      <tr key={f._id}>
                        <td>
                          <strong>
                            {f.firstName} {f.lastName}
                          </strong>
                        </td>
                        <td>{f.email}</td>
                        <td>{f.phone || '–'}</td>
                        <td>
                          {(f.students || []).length
                            ? (f.students || []).map((s, i) => (
                                <span key={i}>
                                  {s.name}
                                  {s.grade ? ` (Gr. ${s.grade})` : ''}
                                  {i < (f.students || []).length - 1 ? <br /> : null}
                                </span>
                              ))
                            : '–'}
                        </td>
                        <td style={{ textAlign: 'center' }}>{f.enrollmentCount}</td>
                        <td>{new Date(f.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ENROLLMENTS */}
          {/* SEAT COUNTS (literacy schedule) */}
          <div className="tab-panel" style={{ display: tab === 'seats' ? 'block' : 'none' }}>
            {tab === 'seats' ? <SeatCountsTab /> : null}
          </div>

          <div className="tab-panel" style={{ display: tab === 'enrollments' ? 'block' : 'none' }}>
            <AddEnrollmentForm onAdded={loadEnrollments} />
            <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <select
                value={enrollQuarter}
                onChange={(e) => setEnrollQuarter(e.target.value)}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: '1.5px solid #ddd',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  background: '#fff',
                }}
              >
                <option value="">All Quarters</option>
                <option value="fall-2025">Fall 2025</option>
                <option value="winter-2026">Winter 2026</option>
                <option value="spring-2026">Spring 2026</option>
                <option value="summer-2026">Summer 2026</option>
                <option value="fall-2026">Fall 2026</option>
              </select>
              <select
                value={enrollStatus}
                onChange={(e) => setEnrollStatus(e.target.value)}
                style={{
                  padding: '0.6rem 0.8rem',
                  border: '1.5px solid #ddd',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  background: '#fff',
                }}
              >
                <option value="">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {enrollments === null ? (
                <p style={{ color: '#aaa' }}>Loading…</p>
              ) : !enrollments.length ? (
                <p style={{ color: '#aaa' }}>No enrollments found.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Family</th>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Quarter</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => {
                      const u = e.userId || {};
                      const c = e.classId || {};
                      const statusColor =
                        { paid: '#1e7a40', pending: '#b85e1a', refunded: '#888' }[
                          e.paymentStatus
                        ] || '#888';
                      const priceVal =
                        priceEdits[e._id] !== undefined ? priceEdits[e._id] : e.amountPaid || 0;
                      return (
                        <tr key={e._id}>
                          <td>
                            {u.firstName || ''} {u.lastName || ''}
                            <br />
                            <span style={{ color: '#aaa', fontSize: '0.78rem' }}>
                              {u.email || ''}
                            </span>
                          </td>
                          <td>{e.studentName}</td>
                          <td>
                            {c.name || '–'}
                            <br />
                            <span style={{ color: '#aaa', fontSize: '0.78rem' }}>
                              {c.schedule || ''}
                            </span>
                          </td>
                          <td>{quarterLabel[e.quarter] || e.quarter}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span style={{ color: '#aaa', fontSize: '0.85rem' }}>$</span>
                              <input
                                type="number"
                                value={priceVal}
                                min="0"
                                step="1"
                                style={{
                                  width: 70,
                                  padding: '0.25rem 0.4rem',
                                  border: '1.5px solid #ddd',
                                  borderRadius: 6,
                                  fontSize: '0.85rem',
                                  textAlign: 'right',
                                }}
                                onChange={(ev) =>
                                  setPriceEdits((p) => ({ ...p, [e._id]: ev.target.value }))
                                }
                                onBlur={(ev) => setPrice(e._id, ev.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                color: statusColor,
                                fontWeight: 700,
                                fontSize: '0.82rem',
                              }}
                            >
                              {e.paymentStatus}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {new Date(e.enrolledAt).toLocaleDateString()}
                          </td>
                          <td>
                            {e.paymentStatus !== 'paid' && (
                              <button
                                onClick={() => updateEnrollment(e._id, 'paid')}
                                style={{
                                  background: '#e8f5ec',
                                  color: '#1e7a40',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '0.3rem 0.6rem',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  marginRight: 4,
                                  fontWeight: 600,
                                }}
                              >
                                Mark Paid
                              </button>
                            )}
                            {e.paymentStatus !== 'refunded' && (
                              <button
                                onClick={() => updateEnrollment(e._id, 'refunded')}
                                style={{
                                  background: '#f5f0eb',
                                  color: '#888',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '0.3rem 0.6rem',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                }}
                              >
                                Refund
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* CLASSES */}
          <div className="tab-panel" style={{ display: tab === 'classes' ? 'block' : 'none' }}>
            {/* Add class form */}
            <div
              style={{
                border: '1px solid #eee',
                borderRadius: 12,
                padding: '1.5rem',
                marginBottom: '1.5rem',
                maxWidth: 600,
              }}
            >
              <h3 style={{ color: '#6b5b47', margin: '0 0 1rem', fontSize: '1rem' }}>
                Add New Class
              </h3>
              {classFormMsg && <div style={formMsgStyle(classFormMsg.type)}>{classFormMsg.text}</div>}
              <form
                onSubmit={handleClassSubmit}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}
              >
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="flabel">Class Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Korean Reading – Gr. 2-3"
                    className="finput"
                    value={classForm.name}
                    onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="flabel">Category</label>
                  <select
                    className="finput"
                    value={classForm.category}
                    onChange={(e) => setClassForm({ ...classForm, category: e.target.value })}
                  >
                    <option value="reading">Reading</option>
                    <option value="writing">Writing</option>
                    <option value="korean">Korean</option>
                    <option value="1on1">1:1</option>
                    <option value="summer">Summer Camp</option>
                  </select>
                </div>
                <div>
                  <label className="flabel">Quarter</label>
                  <select
                    className="finput"
                    value={classForm.quarter}
                    onChange={(e) => setClassForm({ ...classForm, quarter: e.target.value })}
                  >
                    <option value="fall-2025">Fall 2025</option>
                    <option value="winter-2026">Winter 2026</option>
                    <option value="spring-2026">Spring 2026</option>
                    <option value="summer-2026">Summer 2026</option>
                    <option value="fall-2026">Fall 2026</option>
                  </select>
                </div>
                <div>
                  <label className="flabel">Price ($)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="350"
                    className="finput"
                    value={classForm.price}
                    onChange={(e) => setClassForm({ ...classForm, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="flabel">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    className="finput"
                    value={classForm.capacity}
                    onChange={(e) => setClassForm({ ...classForm, capacity: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="flabel">Literacy schedule slot (shows live seats on the Programs page)</label>
                  <select
                    className="finput"
                    value={classForm.scheduleKey}
                    onChange={(e) => setClassForm({ ...classForm, scheduleKey: e.target.value })}
                  >
                    <option value="">Not on the literacy schedule</option>
                    {LITERACY_SLOTS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="flabel">Schedule</label>
                  <input
                    type="text"
                    placeholder="e.g. Saturdays 10–11am"
                    className="finput"
                    value={classForm.schedule}
                    onChange={(e) => setClassForm({ ...classForm, schedule: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="flabel">Description</label>
                  <input
                    type="text"
                    placeholder="Short description (optional)"
                    className="finput"
                    value={classForm.description}
                    onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                  />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <button
                    type="submit"
                    style={{
                      background: '#e8a87c',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '0.7rem 1.5rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                    }}
                  >
                    Add Class
                  </button>
                </div>
              </form>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {classes === null ? (
                <p style={{ color: '#aaa' }}>Loading…</p>
              ) : !classes.length ? (
                <p style={{ color: '#aaa' }}>No classes yet. Add one above.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Quarter</th>
                      <th>Schedule</th>
                      <th>Price</th>
                      <th>Enrolled</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => (
                      <tr key={c._id}>
                        <td>
                          <strong>{c.name}</strong>
                          <br />
                          <span style={{ color: '#aaa', fontSize: '0.78rem' }}>
                            {c.description || ''}
                          </span>
                        </td>
                        <td>{c.category}</td>
                        <td>{quarterLabel[c.quarter] || c.quarter}</td>
                        <td>{c.schedule || '–'}</td>
                        <td>${c.price}</td>
                        <td>
                          {c.enrolledCount}/{c.capacity}
                        </td>
                        <td>
                          <span
                            style={{
                              color: c.active ? '#1e7a40' : '#aaa',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                            }}
                          >
                            {c.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() =>
                              openEditClass(
                                c._id,
                                c.name,
                                c.schedule || '',
                                c.description || '',
                                c.price,
                                c.capacity
                              )
                            }
                            style={{
                              background: '#e8f0fb',
                              color: '#2a5db0',
                              border: 'none',
                              borderRadius: 6,
                              padding: '0.3rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              marginRight: 4,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleClass(c._id, !c.active)}
                            style={{
                              background: '#f5f0eb',
                              color: '#6b5b47',
                              border: 'none',
                              borderRadius: 6,
                              padding: '0.3rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              marginRight: 4,
                            }}
                          >
                            {c.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteClass(c._id)}
                            style={{
                              background: '#fdeaea',
                              color: '#e00',
                              border: 'none',
                              borderRadius: 6,
                              padding: '0.3rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* REPORTS */}
          <div className="tab-panel" style={{ display: tab === 'reports' ? 'block' : 'none' }}>
            {/* Upload form */}
            <div
              style={{
                border: '1px solid #eee',
                borderRadius: 12,
                padding: '1.5rem',
                marginBottom: '1.5rem',
                maxWidth: 560,
              }}
            >
              <h3 style={{ color: '#6b5b47', margin: '0 0 1rem', fontSize: '1rem' }}>
                Upload Report Card (PDF)
              </h3>
              {reportFormMsg && (
                <div style={formMsgStyle(reportFormMsg.type)}>{reportFormMsg.text}</div>
              )}
              <form
                onSubmit={handleReportSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
                encType="multipart/form-data"
              >
                <div>
                  <label className="flabel">Family</label>
                  <select
                    className="finput"
                    value={rptFamily}
                    onChange={(e) => {
                      setRptFamily(e.target.value);
                      setRptStudent('');
                    }}
                  >
                    <option value="">Select family…</option>
                    {allFamilies.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.firstName} {f.lastName} ({f.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flabel">Student</label>
                  <select
                    className="finput"
                    value={rptStudent}
                    onChange={(e) => setRptStudent(e.target.value)}
                  >
                    <option value="">Select student…</option>
                    {reportStudents.map((s, i) => (
                      <option key={i} value={s.name}>
                        {s.name}
                        {s.grade ? ` (Gr. ${s.grade})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <label className="flabel">Quarter</label>
                    <select
                      className="finput"
                      value={rptQuarter}
                      onChange={(e) => setRptQuarter(e.target.value)}
                    >
                      <option value="fall-2025">Fall 2025</option>
                      <option value="winter-2026">Winter 2026</option>
                      <option value="spring-2026">Spring 2026</option>
                      <option value="summer-2026">Summer 2026</option>
                    </select>
                  </div>
                  <div>
                    <label className="flabel">Title</label>
                    <input
                      type="text"
                      className="finput"
                      placeholder="e.g. Fall 2025 Progress Report"
                      value={rptTitle}
                      onChange={(e) => setRptTitle(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="flabel">PDF File</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    required
                    ref={rptFileRef}
                    style={{ fontSize: '0.9rem' }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    background: '#e8a87c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.7rem 1.5rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    alignSelf: 'flex-start',
                  }}
                >
                  Upload Report
                </button>
              </form>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {reports === null ? (
                <p style={{ color: '#aaa' }}>Loading…</p>
              ) : !reports.length ? (
                <p style={{ color: '#aaa' }}>No reports uploaded yet.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Family</th>
                      <th>Student</th>
                      <th>Quarter</th>
                      <th>Class</th>
                      <th>Uploaded</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => {
                      const u = r.userId || {};
                      return (
                        <tr key={r._id}>
                          <td>
                            <a
                              href={r.pdfPath?.startsWith('http') ? r.pdfPath : `/${r.pdfPath}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#e8a87c', fontWeight: 600 }}
                            >
                              📄 {r.title}
                            </a>
                          </td>
                          <td>
                            {u.firstName || ''} {u.lastName || ''}
                          </td>
                          <td>{r.studentName}</td>
                          <td>{quarterLabel[r.quarter] || r.quarter}</td>
                          <td>{r.classId ? r.classId.name : '–'}</td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {new Date(r.uploadedAt).toLocaleDateString()}
                          </td>
                          <td>
                            <button
                              onClick={() => deleteReport(r._id)}
                              style={{
                                background: '#fdeaea',
                                color: '#e00',
                                border: 'none',
                                borderRadius: 6,
                                padding: '0.3rem 0.6rem',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* PRODUCTS */}
          <div className="tab-panel" style={{ display: tab === 'products' ? 'block' : 'none' }}>
            <div
              style={{
                border: '1px solid #eee',
                borderRadius: 12,
                padding: '1.5rem',
                marginBottom: '1.5rem',
                maxWidth: 640,
              }}
            >
              <h3 style={{ color: '#6b5b47', margin: '0 0 1rem', fontSize: '1rem' }}>
                Add New Product
              </h3>
              {productFormMsg && (
                <div style={formMsgStyle(productFormMsg.type)}>{productFormMsg.text}</div>
              )}
              <form
                onSubmit={handleProductSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <label className="flabel">Product Name *</label>
                    <input
                      type="text"
                      required
                      className="finput"
                      value={prodForm.name}
                      onChange={(e) =>
                        setProdForm({
                          ...prodForm,
                          name: e.target.value,
                          slug: autoSlug(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="flabel">Slug (URL key) *</label>
                    <input
                      type="text"
                      required
                      className="finput"
                      placeholder="e.g. dotori-textbook-gr3"
                      value={prodForm.slug}
                      onChange={(e) => setProdForm({ ...prodForm, slug: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="flabel">Description</label>
                  <input
                    type="text"
                    className="finput"
                    value={prodForm.description}
                    onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="flabel">Image URL</label>
                  <input
                    type="text"
                    className="finput"
                    placeholder="https://... or /uploads/..."
                    value={prodForm.imageUrl}
                    onChange={(e) => setProdForm({ ...prodForm, imageUrl: e.target.value })}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <div>
                    <label className="flabel">Fulfiller *</label>
                    <select
                      className="finput"
                      value={prodForm.fulfiller}
                      onChange={(e) => setProdForm({ ...prodForm, fulfiller: e.target.value })}
                    >
                      <option value="printful">Printful (Merchandise)</option>
                      <option value="lulu">Lulu (Textbook)</option>
                      <option value="manual">Manual / Physical</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="flabel">Variants</label>
                  <div>
                    {variants.map((v) => (
                      <div
                        key={v.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                          gap: '0.5rem',
                          marginBottom: '0.4rem',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Label (e.g. S / Black)"
                          className="finput"
                          value={v.label}
                          onChange={(e) => updateVariant(v.id, 'label', e.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          className="finput"
                          step="0.01"
                          min="0"
                          value={v.price}
                          onChange={(e) => updateVariant(v.id, 'price', e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Printful Variant ID"
                          className="finput"
                          value={v.printfulVariantId}
                          onChange={(e) =>
                            updateVariant(v.id, 'printfulVariantId', e.target.value)
                          }
                        />
                        <input
                          type="text"
                          placeholder="Lulu Product ID"
                          className="finput"
                          value={v.luluProductId}
                          onChange={(e) => updateVariant(v.id, 'luluProductId', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeVariant(v.id)}
                          style={{
                            background: '#fdeaea',
                            color: '#e00',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0.3rem 0.5rem',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => addVariantRow()}
                    style={{
                      background: '#f5f0eb',
                      color: '#6b5b47',
                      border: 'none',
                      borderRadius: 6,
                      padding: '0.4rem 0.8rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      marginTop: '0.4rem',
                    }}
                  >
                    + Add Variant
                  </button>
                </div>
                <button
                  type="submit"
                  style={{
                    background: '#e8a87c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.7rem 1.5rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    alignSelf: 'flex-start',
                  }}
                >
                  Add Product
                </button>
              </form>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {products === null ? (
                <p style={{ color: '#aaa' }}>Loading…</p>
              ) : !products.length ? (
                <p style={{ color: '#aaa' }}>No products yet. Add one above.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Fulfiller</th>
                      <th>Variants</th>
                      <th>Active</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p._id}>
                        <td>
                          <strong>{p.name}</strong>
                          <br />
                          <span style={{ color: '#aaa', fontSize: '0.78rem' }}>{p.slug}</span>
                        </td>
                        <td>{fulfillerLabel[p.fulfiller] || p.fulfiller}</td>
                        <td>
                          {p.variants.map((v, i) => (
                            <span
                              key={i}
                              style={{
                                display: 'inline-block',
                                margin: '1px 3px',
                                background: '#f5f0eb',
                                borderRadius: 4,
                                padding: '1px 6px',
                                fontSize: '0.78rem',
                              }}
                            >
                              {v.label} – ${v.price.toFixed(2)}
                            </span>
                          ))}
                        </td>
                        <td>
                          <span
                            style={{
                              color: p.active ? '#1e7a40' : '#aaa',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                            }}
                          >
                            {p.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => toggleProduct(p._id, !p.active)}
                            style={{
                              background: '#f5f0eb',
                              color: '#6b5b47',
                              border: 'none',
                              borderRadius: 6,
                              padding: '0.3rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              marginRight: 4,
                            }}
                          >
                            {p.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteProduct(p._id)}
                            style={{
                              background: '#fdeaea',
                              color: '#e00',
                              border: 'none',
                              borderRadius: 6,
                              padding: '0.3rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* SHOP ORDERS */}
          <div className="tab-panel" style={{ display: tab === 'orders' ? 'block' : 'none' }}>
            <div
              style={{
                display: 'flex',
                gap: '0.8rem',
                marginBottom: '1.2rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <select
                value={orderFilterPay}
                onChange={(e) => setOrderFilterPay(e.target.value)}
                style={{
                  padding: '0.5rem 0.8rem',
                  border: '1.5px solid #ddd',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  background: '#fff',
                }}
              >
                <option value="">All Payments</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
              </select>
              <select
                value={orderFilterFulfill}
                onChange={(e) => setOrderFilterFulfill(e.target.value)}
                style={{
                  padding: '0.5rem 0.8rem',
                  border: '1.5px solid #ddd',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  background: '#fff',
                }}
              >
                <option value="">All Fulfillment</option>
                <option value="unfulfilled">Unfulfilled</option>
                <option value="partial">In Production</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div style={{ overflowX: 'auto' }}>
              {orders === null ? (
                <p style={{ color: '#aaa' }}>Loading…</p>
              ) : !orders.length ? (
                <p style={{ color: '#aaa' }}>No orders found.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Fulfillment</th>
                      <th>Tracking</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const payColors = {
                        paid: '#1e7a40',
                        pending: '#b45c00',
                        refunded: '#888',
                        failed: '#e00',
                      };
                      const fulfillColors = {
                        unfulfilled: '#b45c00',
                        partial: '#2a5db0',
                        fulfilled: '#1e7a40',
                        error: '#e00',
                      };
                      return (
                        <tr key={o._id}>
                          <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                            {o.lookupToken.slice(0, 8).toUpperCase()}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {new Date(o.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <strong style={{ fontSize: '0.88rem' }}>
                              {o.firstName} {o.lastName}
                            </strong>
                            <br />
                            <span style={{ color: '#aaa', fontSize: '0.78rem' }}>{o.email}</span>
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {o.items.map((i, idx) => (
                              <span key={idx}>
                                {i.productName}
                                {i.variantLabel ? ' – ' + i.variantLabel : ''} ×{i.quantity}
                                {idx < o.items.length - 1 ? <br /> : null}
                              </span>
                            ))}
                          </td>
                          <td style={{ fontWeight: 700 }}>${o.total.toFixed(2)}</td>
                          <td>
                            <span
                              style={{
                                color: payColors[o.paymentStatus] || '#888',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                              }}
                            >
                              {o.paymentStatus}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                color: fulfillColors[o.fulfillmentStatus] || '#888',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                              }}
                            >
                              {o.fulfillmentStatus}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            {o.trackingNumber ? (
                              <a
                                href={o.trackingUrl || '#'}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#2a5db0' }}
                              >
                                {o.trackingNumber}
                              </a>
                            ) : (
                              '–'
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() =>
                                openOrderEdit(
                                  o._id,
                                  o.trackingNumber || '',
                                  o.trackingUrl || '',
                                  o.carrier || ''
                                )
                              }
                              style={{
                                background: '#e8f0fb',
                                color: '#2a5db0',
                                border: 'none',
                                borderRadius: 6,
                                padding: '0.3rem 0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                marginRight: 3,
                              }}
                            >
                              Edit
                            </button>
                            {o.paymentStatus === 'paid' && (
                              <button
                                onClick={() => refundOrder(o._id)}
                                style={{
                                  background: '#fdeaea',
                                  color: '#e00',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '0.3rem 0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                }}
                              >
                                Refund
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Order Edit Modal */}
      {editingOrderId && (
        <div
          style={{
            display: 'flex',
            position: 'fixed',
            inset: 0,
            background: '#0006',
            zIndex: 1000,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '2rem',
              width: '100%',
              maxWidth: 440,
              margin: '1rem',
              boxShadow: '0 8px 40px #0003',
            }}
          >
            <h3 style={{ color: '#6b5b47', margin: '0 0 1.2rem', fontSize: '1.05rem' }}>
              Update Order
            </h3>
            {orderEditMsg && (
              <div
                style={{
                  display: 'block',
                  background: '#fdeaea',
                  color: '#c00',
                  borderRadius: 6,
                  padding: '0.5rem',
                  fontSize: '0.85rem',
                  marginBottom: '0.5rem',
                }}
              >
                {orderEditMsg}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label className="flabel">Tracking Number</label>
                <input
                  type="text"
                  className="finput"
                  value={orderEdit.tracking}
                  onChange={(e) => setOrderEdit({ ...orderEdit, tracking: e.target.value })}
                />
              </div>
              <div>
                <label className="flabel">Tracking URL</label>
                <input
                  type="text"
                  className="finput"
                  value={orderEdit.trackingUrl}
                  onChange={(e) => setOrderEdit({ ...orderEdit, trackingUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="flabel">Carrier</label>
                <input
                  type="text"
                  className="finput"
                  placeholder="USPS, UPS, FedEx…"
                  value={orderEdit.carrier}
                  onChange={(e) => setOrderEdit({ ...orderEdit, carrier: e.target.value })}
                />
              </div>
              <div>
                <label className="flabel">Fulfillment Status</label>
                <select
                  className="finput"
                  value={orderEdit.status}
                  onChange={(e) => setOrderEdit({ ...orderEdit, status: e.target.value })}
                >
                  <option value="">(no change)</option>
                  <option value="unfulfilled">Unfulfilled</option>
                  <option value="partial">In Production</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.4rem' }}>
                <button
                  onClick={saveOrderEdit}
                  style={{
                    flex: 1,
                    background: '#6b5b47',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={closeOrderEdit}
                  style={{
                    flex: 1,
                    background: '#f5f0eb',
                    color: '#6b5b47',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {editingClassId && (
        <div
          style={{
            display: 'flex',
            position: 'fixed',
            inset: 0,
            background: '#0006',
            zIndex: 1000,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '2rem',
              width: '100%',
              maxWidth: 480,
              margin: '1rem',
              boxShadow: '0 8px 40px #0003',
            }}
          >
            <h3 style={{ color: '#6b5b47', margin: '0 0 1.2rem', fontSize: '1.05rem' }}>
              Edit Class
            </h3>
            {editClassMsg && (
              <div style={{ display: 'block', background: '#fdeaea', color: '#c00' }}>
                {editClassMsg}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div>
                <label className="flabel">Class Name</label>
                <input
                  type="text"
                  className="finput"
                  value={editClassData.name}
                  onChange={(e) => setEditClassData({ ...editClassData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="flabel">Schedule</label>
                <input
                  type="text"
                  className="finput"
                  value={editClassData.schedule}
                  onChange={(e) =>
                    setEditClassData({ ...editClassData, schedule: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="flabel">Description</label>
                <input
                  type="text"
                  className="finput"
                  value={editClassData.description}
                  onChange={(e) =>
                    setEditClassData({ ...editClassData, description: e.target.value })
                  }
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                <div>
                  <label className="flabel">Price ($)</label>
                  <input
                    type="number"
                    className="finput"
                    min="0"
                    value={editClassData.price}
                    onChange={(e) =>
                      setEditClassData({ ...editClassData, price: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="flabel">Capacity</label>
                  <input
                    type="number"
                    className="finput"
                    min="1"
                    value={editClassData.capacity}
                    onChange={(e) =>
                      setEditClassData({ ...editClassData, capacity: e.target.value })
                    }
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.4rem' }}>
                <button
                  onClick={saveClassEdit}
                  style={{
                    flex: 1,
                    background: '#6b5b47',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Save Changes
                </button>
                <button
                  onClick={closeEditClass}
                  style={{
                    flex: 1,
                    background: '#f5f0eb',
                    color: '#6b5b47',
                    border: 'none',
                    borderRadius: 8,
                    padding: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Manual enrollment: admin registers a student into a class directly
      (offline/Zelle payments). Feeds the live seat counts on /programs. ── */
function AddEnrollmentForm({ onAdded }) {
  const [families, setFamilies] = useState([]);
  const [classes, setClasses] = useState([]);
  const [userId, setUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState('paid');
  const [msg, setMsg] = useState(null); // { ok, text }

  useEffect(() => {
    fetch('/api/admin/families').then((r) => r.json()).then((d) => setFamilies(d.families || []));
    fetch('/api/admin/classes').then((r) => r.json()).then((d) => setClasses((d.classes || []).filter((c) => c.active)));
  }, []);

  const family = families.find((f) => f._id === userId);
  const students = (family?.students || []).map((s) => s.name).filter(Boolean);

  function famLabel(f) {
    const base = [f.firstName, f.lastName].filter(Boolean).join(' ') || f.name || f.email;
    const kids = (f.students || []).map((s) => s.name).filter(Boolean).join(', ');
    return kids ? `${base} (${kids})` : base;
  }

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/admin/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, studentName, classId, paymentStatus: status }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ ok: false, text: d.error || 'Failed to enroll.' });
      return;
    }
    setMsg({ ok: true, text: 'Enrolled.' });
    setStudentName('');
    setClassId('');
    onAdded?.();
    // Refresh classes so the per-class counts in the picker stay current.
    fetch('/api/admin/classes').then((r) => r.json()).then((d2) => setClasses((d2.classes || []).filter((c) => c.active)));
  }

  return (
    <form
      onSubmit={submit}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.6rem',
        alignItems: 'flex-end',
        background: '#faf7f3',
        borderRadius: 10,
        padding: '0.9rem 1rem',
        marginBottom: '1.2rem',
      }}
    >
      <div style={{ minWidth: 220 }}>
        <label className="flabel">Family</label>
        <select
          className="finput"
          value={userId}
          onChange={(e) => { setUserId(e.target.value); setStudentName(''); }}
          required
        >
          <option value="">Select a family…</option>
          {families.map((f) => (
            <option key={f._id} value={f._id}>{famLabel(f)} ({f.email})</option>
          ))}
        </select>
      </div>
      <div style={{ minWidth: 150 }}>
        <label className="flabel">Student</label>
        {students.length > 0 ? (
          <select className="finput" value={studentName} onChange={(e) => setStudentName(e.target.value)} required>
            <option value="">Select…</option>
            {students.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input className="finput" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Student name" required />
        )}
      </div>
      <div style={{ minWidth: 240 }}>
        <label className="flabel">Class</label>
        <select className="finput" value={classId} onChange={(e) => setClassId(e.target.value)} required>
          <option value="">Select a class…</option>
          {classes.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name} · {c.quarter} · {c.enrolledCount ?? 0}/{c.capacity}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="flabel">Status</label>
        <select className="finput" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={!userId || !studentName || !classId}
        style={{
          background: '#e8a87c', color: '#fff', border: 'none', borderRadius: 8,
          padding: '0.65rem 1.4rem', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Enroll
      </button>
      {msg ? (
        <span style={{ color: msg.ok ? '#1e7a40' : '#a3261a', fontWeight: 600, fontSize: '0.88rem' }}>{msg.text}</span>
      ) : null}
    </form>
  );
}

/* ── Seat counts for the literacy weekly schedule. Pick a class, type the
      enrolled count, and the public /programs schedule updates live. A manual
      count overrides the automatic enrollment tally; clearing it goes back
      to automatic. ── */
function SeatCountsTab() {
  const [classes, setClasses] = useState(null);
  const [classId, setClassId] = useState('');
  const [count, setCount] = useState('');
  const [msg, setMsg] = useState(null);

  const slotLabel = (key) => LITERACY_SLOTS.find((s) => s.key === key)?.label || key;

  const load = () =>
    fetch('/api/admin/classes')
      .then((r) => r.json())
      .then((d) => setClasses((d.classes || []).filter((c) => c.active && c.scheduleKey)))
      .catch(() => setClasses([]));

  useEffect(() => { load(); }, []);

  const selected = (classes || []).find((c) => c._id === classId);
  const displayed = (c) => (c.manualEnrolled != null ? c.manualEnrolled : c.enrolledCount ?? 0);

  function pick(id) {
    setClassId(id);
    setMsg(null);
    const c = (classes || []).find((x) => x._id === id);
    setCount(c ? String(displayed(c)) : '');
  }

  async function save(value) {
    setMsg(null);
    const res = await fetch(`/api/admin/classes/${classId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualEnrolled: value }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: d.error || 'Failed to save.' });
      return;
    }
    setMsg({ ok: true, text: value === null ? 'Back to automatic count.' : 'Saved. The schedule shows it immediately.' });
    load();
  }

  return (
    <div>
      <p style={{ color: '#9b8b77', fontSize: '0.9rem', margin: '0 0 1rem' }}>
        Set the enrolled count shown on the Programs page schedule. A manual number overrides the
        automatic enrollment tally; &quot;Use automatic&quot; switches back.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'flex-end', background: '#faf7f3', borderRadius: 10, padding: '0.9rem 1rem', marginBottom: '1.2rem' }}>
        <div style={{ minWidth: 320 }}>
          <label className="flabel">Class</label>
          <select className="finput" value={classId} onChange={(e) => pick(e.target.value)}>
            <option value="">Select a class…</option>
            {(classes || []).map((c) => (
              <option key={c._id} value={c._id}>{slotLabel(c.scheduleKey)}</option>
            ))}
          </select>
        </div>
        <div style={{ width: 130 }}>
          <label className="flabel">Enrolled count</label>
          <input
            type="number"
            min="0"
            className="finput"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            disabled={!classId}
          />
        </div>
        <button
          type="button"
          disabled={!classId || count === ''}
          onClick={() => save(Math.max(0, Number(count) || 0))}
          style={{ background: '#e8a87c', color: '#fff', border: 'none', borderRadius: 8, padding: '0.65rem 1.4rem', fontWeight: 700, cursor: 'pointer' }}
        >
          Save
        </button>
        <button
          type="button"
          disabled={!classId || !selected || selected.manualEnrolled == null}
          onClick={() => save(null)}
          style={{ background: '#f5f0eb', color: '#8b7355', border: 'none', borderRadius: 8, padding: '0.65rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}
        >
          Use automatic
        </button>
        {selected ? (
          <span style={{ color: '#9b8b77', fontSize: '0.85rem' }}>
            Capacity {selected.capacity} · auto tally {selected.enrolledCount ?? 0}
          </span>
        ) : null}
        {msg ? (
          <span style={{ color: msg.ok ? '#1e7a40' : '#a3261a', fontWeight: 600, fontSize: '0.88rem' }}>{msg.text}</span>
        ) : null}
      </div>

      {classes === null ? (
        <p style={{ color: '#aaa' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                {['Class (schedule slot)', 'Shown on schedule', 'Capacity', 'Source'].map((h) => (
                  <th key={h} style={{ background: '#5d4a35', color: '#fff', textAlign: 'left', padding: '0.6rem 0.8rem', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const n = displayed(c);
                const full = n >= c.capacity;
                return (
                  <tr key={c._id}>
                    <td style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid #f0e9df', color: '#4a3c28', fontWeight: 600 }}>{slotLabel(c.scheduleKey)}</td>
                    <td style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid #f0e9df', color: full ? '#a3261a' : '#1e7a40', fontWeight: 700 }}>
                      {n}/{c.capacity}{full ? ' · Full' : ''}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid #f0e9df', color: '#6b5b47' }}>{c.capacity}</td>
                    <td style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid #f0e9df', color: '#9b8b77' }}>
                      {c.manualEnrolled != null ? 'Manual' : 'Automatic'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
