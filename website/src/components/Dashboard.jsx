import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Footer intentionally omitted on non-home pages.
import { clearSession, isAdminSession } from '../utils/auth';
import { readAllOrders } from '../utils/dataTools';
import { hasNewEnquiriesAlert, hasNewOrdersAlert } from '../utils/adminAlerts';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';

const getStoredCount = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (typeof parsed === 'number') return parsed;
    if (parsed && Array.isArray(parsed.items)) return parsed.items.length;
    return 0;
  } catch {
    return 0;
  }
};

function Dashboard() {
  const navigate = useNavigate();
  const isAdmin = isAdminSession();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/login');
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;

  const totalProducts = getStoredCount('dm_products');
  const totalEnquiries = getStoredCount('dm_enquiries');
  const totalOrders = readAllOrders().length;
  const showOrdersDot = hasNewOrdersAlert();
  const showEnquiriesDot = hasNewEnquiriesAlert();

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <div className="adminDash">
      <aside className="adminDash__sidebar">
        <div className="adminDash__brand">
          <div className="adminDash__logo">
            <img className="adminDash__logoImg" src={logo} alt="GS & Co logo" />
          </div>
          <div>
            <div className="adminDash__title">Admin Console</div>
            <div className="adminDash__subtitle">Govindasamy &amp; Co</div>
          </div>
        </div>
        <nav className="adminDash__nav" aria-label="Admin navigation">
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/products')}>
            Products
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/billing')}>
            Billing
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/orders')}>
            <span className="adminDash__navBtnLabel">
              Orders
              {showOrdersDot && <span className="adminDash__navDot" />}
            </span>
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/enquiries')}>
            <span className="adminDash__navBtnLabel">
              Enquiries
              {showEnquiriesDot && <span className="adminDash__navDot" />}
            </span>
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/analytics')}>
            Analytics
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/import-export')}>
            Import / Export
          </button>
          <button className="adminDash__navBtn adminDash__navBtn--danger" type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
        <div className="adminDash__meta">
          <span className="adminDash__chip">Administrator</span>
          <span className="adminDash__metaText">Dashboard & Management</span>
        </div>
      </aside>

      <main className="adminDash__main">
        <header className="adminDash__header">
          <div>
            <h1 className="adminDash__heading">Admin Dashboard</h1>
            <p className="adminDash__lead">
              Welcome back. Track products and enquiries at a glance.
            </p>
          </div>
          <div className="adminDash__badge">Administrator</div>
        </header>

        <section className="adminDash__stats" aria-label="Key statistics">
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Products</div>
            <div className="adminDash__cardValue">{totalProducts}</div>
            <div className="adminDash__cardHint">Catalog items listed</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Customer Orders</div>
            <div className="adminDash__cardValue">{totalOrders}</div>
            <div className="adminDash__cardHint">All placed orders</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Enquiries</div>
            <div className="adminDash__cardValue">{totalEnquiries}</div>
            <div className="adminDash__cardHint">Customer requests received</div>
          </article>
        </section>

        <section className="adminDash__actions" aria-label="Quick actions">
          <div className="adminDash__panel">
            <h2 className="adminDash__panelTitle">Manage Products</h2>
            <p className="adminDash__panelText">
              Add new designs, update pricing, and keep inventory in sync.
            </p>
            <button className="adminDash__panelBtn" type="button" onClick={() => navigate('/admin/products')}>
              Open Product Manager
            </button>
          </div>
          <div className="adminDash__panel">
            <h2 className="adminDash__panelTitle">Customer Orders</h2>
            <p className="adminDash__panelText">
              Track customer orders and update their status.
            </p>
            <button className="adminDash__panelBtn" type="button" onClick={() => navigate('/admin/orders')}>
              Manage Orders
            </button>
          </div>
          <div className="adminDash__panel">
            <h2 className="adminDash__panelTitle">Billing</h2>
            <p className="adminDash__panelText">
              Process orders, track inventory refill alerts, and manage billing status.
            </p>
            <button className="adminDash__panelBtn" type="button" onClick={() => navigate('/admin/billing')}>
              Open Billing
            </button>
          </div>
          <div className="adminDash__panel">
            <h2 className="adminDash__panelTitle">Customer Enquiries</h2>
            <p className="adminDash__panelText">
              Review new messages and follow up with customers quickly.
            </p>
            <button className="adminDash__panelBtn" type="button" onClick={() => navigate('/admin/enquiries')}>
              Review Enquiries
            </button>
          </div>
          <div className="adminDash__panel">
            <h2 className="adminDash__panelTitle">Sales Analytics</h2>
            <p className="adminDash__panelText">
              Visualize monthly sales and identify top ordering customers.
            </p>
            <button className="adminDash__panelBtn" type="button" onClick={() => navigate('/admin/analytics')}>
              Open Analytics
            </button>
          </div>
          <div className="adminDash__panel">
            <h2 className="adminDash__panelTitle">Data Management</h2>
            <p className="adminDash__panelText">
              Import or export products, categories, and enquiry reports.
            </p>
            <button className="adminDash__panelBtn" type="button" onClick={() => navigate('/admin/import-export')}>
              Open Import / Export
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;