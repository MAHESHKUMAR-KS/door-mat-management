import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, getSessionUserId, isUserSession } from '../utils/auth';
import { readWishlist, toggleWishlist, writeWishlist } from '../utils/catalog';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';
import './Wishlist.css';

function Wishlist() {
  const navigate = useNavigate();
  const userId = getSessionUserId();
  const [products, setProducts] = useState([]);
  const [wishlist, setWishlist] = useState(readWishlist(userId));

  useEffect(() => {
    if (!isUserSession()) {
      navigate('/login');
      return;
    }
    const loadProducts = async () => {
      const { fetchProducts } = await import('../utils/catalog');
      const res = await fetchProducts();
      if (res.success) setProducts(res.products);
    };
    loadProducts();
  }, [navigate]);

  const items = useMemo(
    () => products.filter((product) => wishlist.includes(product.id || product._id)),
    [products, wishlist]
  );

  if (!isUserSession()) return null;

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const handleRemove = (productId) => {
    const updated = toggleWishlist(productId, wishlist);
    setWishlist(updated);
    writeWishlist(userId, updated);
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
            <p className="wishlistPage__eyebrow">Favorites</p>
            <h1 className="wishlistPage__title">Your Wishlist</h1>
          </div>
          <button type="button" onClick={() => navigate('/products')}>
            Browse Products
          </button>
        </header>

        {items.length === 0 ? (
          <div className="wishlistPage__empty">
            Your wishlist is empty. Start adding products you love.
          </div>
        ) : (
          <section className="wishlistPage__grid">
            {items.map((product) => (
              <article className="wishlistPage__card" key={product.id}>
                <img src={product.image} alt={product.name} />
                <div>
                  <h2>{product.name}</h2>
                  <p>Rs. {Number(product.price).toFixed(2)}</p>
                </div>
                <div className="wishlistPage__actions">
                  <button type="button" onClick={() => navigate(`/products/${product.id}`)}>
                    View Details
                  </button>
                  <button type="button" onClick={() => handleRemove(product.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default Wishlist;
