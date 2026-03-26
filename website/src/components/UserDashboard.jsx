import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Footer intentionally omitted on non-home pages.
import { clearSession, getSession, getSessionUserId, isUserSession } from '../utils/auth';
import { readWishlist } from '../utils/catalog';
import {
  writeUserOrders,
  readProfile
} from '../utils/dataTools';
import { fetchUserOrders } from '../utils/ordersApi';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';

function UserDashboard() {
  const navigate = useNavigate();
  const session = getSession();
  const userId = getSessionUserId();
  const [products, setProducts] = useState([]);
  const profile = useMemo(() => readProfile(userId) || {}, [userId]);
  const wishlist = useMemo(() => readWishlist(userId), [userId]);
  const [userOrders, setUserOrders] = useState([]);

  useEffect(() => {
    if (!isUserSession()) {
      navigate('/login');
      return;
    }

    const loadData = async () => {
      // Load Products
      const { fetchProducts } = await import('../utils/catalog');
      const prodRes = await fetchProducts();
      if (prodRes.success) setProducts(prodRes.products);

      // Load Orders
      const orderRes = await fetchUserOrders(userId);
      if (orderRes.success) {
        const nextOrders = Array.isArray(orderRes.orders) ? orderRes.orders : [];
        setUserOrders(nextOrders);
        writeUserOrders(userId, nextOrders);
      } else {
        setUserOrders([]);
      }
    };

    if (userId) {
      loadData();
    }
  }, [navigate]);

  if (!isUserSession()) return null;

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
            <div className="adminDash__title">User Console</div>
            <div className="adminDash__subtitle">Govindasamy &amp; Co</div>
          </div>
        </div>
        <nav className="adminDash__nav" aria-label="User navigation">
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/user')}>
            Dashboard
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/products')}>
            View Products
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/orders')}>
            My Orders
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/wishlist')}>
            Wishlist
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/profile')}>
            Profile
          </button>
          <button className="adminDash__navBtn adminDash__navBtn--danger" type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
        <div className="adminDash__meta">
          <span className="adminDash__chip">Member</span>
          <span className="adminDash__metaText">Last login: Today</span>
        </div>
      </aside>

      <main className="adminDash__main">
        <header className="adminDash__header">
          <div>
            <h1 className="adminDash__heading">
              Welcome back, {profile.name || session?.username || 'there'}
            </h1>
            <p className="adminDash__lead">
              Explore the catalog and manage your profile in one place.
            </p>
          </div>
          <div className="adminDash__badge">Customer</div>
        </header>

        <section className="adminDash__stats" aria-label="User overview">
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Your Orders</div>
            <div className="adminDash__cardValue">{userOrders.length}</div>
            <div className="adminDash__cardHint">Placed orders</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Available Products</div>
            <div className="adminDash__cardValue">{products.length}</div>
            <div className="adminDash__cardHint">Live catalog items</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Wishlist Items</div>
            <div className="adminDash__cardValue">{wishlist.length}</div>
            <div className="adminDash__cardHint">Saved for later</div>
          </article>
        </section>

        <section className="adminDash__actions" aria-label="Quick actions">
          <div className="adminDash__panel">
            <h2 className="adminDash__panelTitle">Place an Order</h2>
            <p className="adminDash__panelText">
              Browse our collection and add items to your cart to place an order.
            </p>
            <button className="adminDash__panelBtn" type="button" onClick={() => navigate('/orders')}>
              Manage Orders
            </button>
          </div>
          <div className="adminDash__panel">
            <h2 className="adminDash__panelTitle">Browse Products</h2>
            <p className="adminDash__panelText">
              Discover new mats, compare materials, and find your perfect fit.
            </p>
            <button className="adminDash__panelBtn" type="button" onClick={() => navigate('/products')}>
              Explore Catalog
            </button>
          </div>
          <div className="adminDash__panel">
            <h2 className="adminDash__panelTitle">Manage Profile</h2>
            <p className="adminDash__panelText">
              Update your contact info and preferences anytime.
            </p>
            <button className="adminDash__panelBtn" type="button" onClick={() => navigate('/profile')}>
              Edit Profile
            </button>
          </div>
        </section>

        <section className="adminDash__actions" aria-label="Recent order history">
          <div className="adminDash__panel adminDash__panel--wide">
            <h2 className="adminDash__panelTitle">Recent Order History</h2>
            {userOrders.length === 0 ? (
              <p className="adminDash__panelText">No orders yet. Place your first order from Checkout.</p>
            ) : (
              <div className="orders__orderItems">
                {userOrders.slice(0, 5).map((order) => (
                  <div key={order.orderId || order.id || order._id} className="orders__orderItem">
                    <span>Order ID: {order.orderId || order.id || order._id}</span>
                    <span>Products: {(order.items || []).map((item) => item.name).join(', ') || '-'}</span>
                    <span>Payment: {order.paymentStatus || 'Pending'}</span>
                    <span>Date: {new Date(order.createdAt || order.updatedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default UserDashboard;
