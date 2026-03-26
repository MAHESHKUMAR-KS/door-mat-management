import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, isAdminSession } from '../utils/auth';
import { writeAllOrders } from '../utils/dataTools';
import { fetchAllOrders, updateOrderStatus } from '../utils/ordersApi';
import {
  hasNewEnquiriesAlert,
  hasNewOrdersAlert,
  markOrdersSeen
} from '../utils/adminAlerts';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';
import './Orders.css';

function AdminOrders() {
  const navigate = useNavigate();
  const isAdmin = isAdminSession();
  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [hasOrderDot, setHasOrderDot] = useState(false);
  const [hasEnquiryDot, setHasEnquiryDot] = useState(false);

  const syncNavAlerts = () => {
    setHasOrderDot(hasNewOrdersAlert());
    setHasEnquiryDot(hasNewEnquiriesAlert());
  };

  const loadOrders = async () => {
    const response = await fetchAllOrders();
    if (!response.success) {
      setOrders([]);
      return;
    }
    const nextOrders = Array.isArray(response.orders) ? response.orders : [];
    setOrders(nextOrders);
    writeAllOrders(nextOrders);
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/login');
    } else {
      loadOrders().then(() => {
        markOrdersSeen();
        syncNavAlerts();
      });
    }
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

  if (!isAdmin) return null;

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const handleUpdateStatus = async (orderIdentity, newStatus) => {
    const response = await updateOrderStatus(orderIdentity, newStatus);
    if (!response.success || !response.order) {
      return;
    }

    setOrders((prev) => prev.map((order) => {
      const currentId = order.orderId || order.id || order._id;
      if (currentId !== orderIdentity) return order;
      return response.order;
    }));
    window.dispatchEvent(new Event('dm:orders-updated'));
  };

  const formatOrderAddress = (order) => {
    if (order.address && order.address !== 'Not provided') return order.address;
    const delivery = order.delivery || {};
    const parts = [delivery.address, delivery.city, delivery.state, delivery.pincode]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return parts.length ? parts.join(', ') : 'Not provided';
  };


  const filteredOrders =
    filterStatus === 'All' ? orders : orders.filter((order) => order.status === filterStatus);

  const totalSales = orders.reduce((sum, order) => {
    return order.paymentStatus === 'Paid' ? sum + Number(order.totalAmount || 0) : sum;
  }, 0);

  const paidOrdersCount = orders.filter((order) => order.paymentStatus === 'Paid').length;

  const statusOptions = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

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
        <div className="adminDash__meta">
          <span className="adminDash__chip">Secure Session</span>
          <span className="adminDash__metaText">Last sync: Today</span>
        </div>
      </aside>

      <main className="adminDash__main">
        <header className="adminDash__header">
          <div>
            <h1 className="adminDash__heading">Customer Orders</h1>
            <p className="adminDash__lead">
              Manage and track all customer orders.
            </p>
          </div>
          <div className="adminDash__badge">Orders Management</div>
        </header>

        <section className="adminDash__stats" aria-label="Order statistics">
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Orders</div>
            <div className="adminDash__cardValue">{orders.length}</div>
            <div className="adminDash__cardHint">All customer orders</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Pending</div>
            <div className="adminDash__cardValue">{orders.filter((o) => o.status === 'Pending').length}</div>
            <div className="adminDash__cardHint">Awaiting confirmation</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Delivered</div>
            <div className="adminDash__cardValue">{orders.filter((o) => o.status === 'Delivered').length}</div>
            <div className="adminDash__cardHint">Completed orders</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Sales</div>
            <div className="adminDash__cardValue">Rs. {totalSales.toFixed(2)}</div>
            <div className="adminDash__cardHint">From {paidOrdersCount} paid orders</div>
          </article>
        </section>

        <section className="adminDash__tools">
          <div className="adminDash__panel adminDash__panel--wide">
            <h2 className="adminDash__panelTitle">Filter Orders</h2>
            <div className="adminOrders__filters">
              {['All', ...statusOptions].map((status) => (
                <button
                  key={status}
                  className={`adminOrders__filterBtn ${filterStatus === status ? 'adminOrders__filterBtn--active' : ''}`}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="orders__list">
          {filteredOrders.length === 0 ? (
            <div className="orders__empty">
              <p>No orders found with status "{filterStatus}"</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.orderId || order.id || order._id} className="adminOrders__card">
                <div className="adminOrders__header">
                  <div>
                    <h3>Order #{order.orderId || order.id || order._id}</h3>
                    <p className="adminOrders__customer">{order.name} ({order.email})</p>
                    {order.phone && order.phone !== 'Not provided' && (
                      <p className="adminOrders__customer">Phone: {order.phone}</p>
                    )}
                    <p className="adminOrders__address">Address: {formatOrderAddress(order)}</p>
                    <p className="adminOrders__date">
                      {new Date(order.createdAt || order.updatedAt).toLocaleDateString()} at{' '}
                      {new Date(order.createdAt || order.updatedAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="adminOrders__actions">
                    <select
                      className="adminOrders__statusSelect"
                      value={order.status}
                      onChange={(e) => handleUpdateStatus(order.orderId || order.id || order._id, e.target.value)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="adminOrders__items">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="adminOrders__item">
                      <span className="adminOrders__itemName">{item.name}</span>
                      <span className="adminOrders__itemQty">Qty: {item.quantity}</span>
                      <span className="adminOrders__itemPrice">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="adminOrders__footer">
                  <strong>Total: Rs. {Number(order.totalAmount || 0).toFixed(2)}</strong>
                  <div className="orders__paymentMeta">
                    <span>Payment: {order.paymentMethod || 'Cash on Delivery'}</span>
                    <span>Status: {order.paymentStatus || 'Pending'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminOrders;
