import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Footer intentionally omitted on non-home pages.
import { clearSession, isAdminSession } from '../utils/auth';
import { readEnquiries } from '../utils/dataTools';
import {
  hasNewEnquiriesAlert,
  hasNewOrdersAlert,
  markEnquiriesSeen
} from '../utils/adminAlerts';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';
import './Enquiries.css';

function Enquiries() {
  const navigate = useNavigate();
  const isAdmin = isAdminSession();
  const [enquiries, setEnquiries] = useState([]);
  const [hasOrderDot, setHasOrderDot] = useState(false);
  const [hasEnquiryDot, setHasEnquiryDot] = useState(false);

  const syncNavAlerts = () => {
    setHasOrderDot(hasNewOrdersAlert());
    setHasEnquiryDot(hasNewEnquiriesAlert());
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/login');
      return;
    }

    const syncEnquiries = () => {
      setEnquiries(readEnquiries());
      markEnquiriesSeen();
      syncNavAlerts();
    };

    syncEnquiries();
    window.addEventListener('dm:enquiries-updated', syncEnquiries);
    window.addEventListener('storage', syncEnquiries);

    return () => {
      window.removeEventListener('dm:enquiries-updated', syncEnquiries);
      window.removeEventListener('storage', syncEnquiries);
    };
  }, [isAdmin, navigate]);

  useEffect(() => {
    const handleSync = () => syncNavAlerts();
    window.addEventListener('storage', handleSync);
    window.addEventListener('dm:orders-updated', handleSync);
    window.addEventListener('dm:enquiries-updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('dm:orders-updated', handleSync);
      window.removeEventListener('dm:enquiries-updated', handleSync);
    };
  }, []);

  const total = useMemo(() => enquiries.length, [enquiries]);

  if (!isAdmin) return null;

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
            Manage Products
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/billing')}>
            Billing
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/orders')}>
            <span className="adminDash__navBtnLabel">
              Customer Orders
              {hasOrderDot && <span className="adminDash__navDot" />}
            </span>
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/enquiries')}>
            <span className="adminDash__navBtnLabel">
              Customer Enquiries
              {hasEnquiryDot && <span className="adminDash__navDot" />}
            </span>
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/analytics')}>
            Sales Analytics
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/import-export')}>
            Import / Export
          </button>
          <button className="adminDash__navBtn adminDash__navBtn--danger" type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </aside>

      <main className="adminDash__main">
        <div className="enquiryAdmin enquiryAdmin--embedded">
          <header className="enquiryAdmin__header">
            <div>
              <p className="enquiryAdmin__eyebrow">Admin</p>
              <h1 className="enquiryAdmin__title">Customer Enquiries</h1>
              <p className="enquiryAdmin__subtitle">
                Review product requests and respond quickly.
              </p>
            </div>
            <div className="enquiryAdmin__summary">
              <div className="enquiryAdmin__summaryLabel">Total Enquiries</div>
              <div className="enquiryAdmin__summaryValue">{total}</div>
              <button type="button" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </button>
            </div>
          </header>

          <section className="enquiryAdmin__table">
            <div className="enquiryAdmin__tableHeader">
              <h2>Enquiry List</h2>
              <span>{enquiries.length} records</span>
            </div>
            <div className="enquiryAdmin__tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Product</th>
                    <th>Message</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="enquiryAdmin__empty">
                        No enquiries yet.
                      </td>
                    </tr>
                  ) : (
                    enquiries.map((enquiry) => (
                      <tr key={enquiry.id}>
                        <td>{enquiry.name}</td>
                        <td>{enquiry.email}</td>
                        <td>{enquiry.phone}</td>
                        <td>{enquiry.product}</td>
                        <td className="enquiryAdmin__message">{enquiry.message}</td>
                        <td>{new Date(enquiry.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Enquiries;
