import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { isWishlisted, readWishlist, toggleWishlist, writeWishlist } from '../utils/catalog';
import { clearSession, getSessionUserId, isUserSession } from '../utils/auth';
import { downloadPdfLike, readCart, writeCart } from '../utils/dataTools';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';
import './ProductDisplay.css';

function ProductDisplay() {
  const navigate = useNavigate();
  const userId = getSessionUserId();
  const isLoggedIn = isUserSession();
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('low');
  const [wishlist, setWishlist] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      const { fetchProducts } = await import('../utils/catalog');
      const res = await fetchProducts();
      if (res.success) {
        setProducts(res.products);
      }
      setIsLoading(false);
    };

    loadProducts();

    if (isLoggedIn) {
      setWishlist(readWishlist(userId));
    } else {
      setWishlist([]);
    }
  }, [isLoggedIn, userId]);

  const categories = useMemo(() => {
    const unique = new Set(products.map((product) => product.category).filter(Boolean));
    return ['All', ...Array.from(unique)];
  }, [products]);

  const visibleProducts = useMemo(() => {
    let filtered = products;
    if (activeCategory !== 'All') {
      filtered = filtered.filter((product) => product.category === activeCategory);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter((product) =>
        [product.name, product.category, product.material]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      const priceA = Number(a.price) || 0;
      const priceB = Number(b.price) || 0;
      return sortOrder === 'high' ? priceB - priceA : priceA - priceB;
    });
    return sorted;
  }, [products, activeCategory, searchTerm, sortOrder]);

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const handleOrderNow = (product) => {
    if (!isUserSession()) {
      navigate('/login');
      return;
    }
    const maxQty = Number(product.quantity) || 0;
    if (maxQty <= 0) return;
    const current = readCart(userId);
    const existing = current.find((item) => item.id === product.id);
    const nextQty = Math.min((existing?.quantity || 0) + 1, maxQty);
    const updated = existing
      ? current.map((item) => (item.id === product.id ? { ...item, quantity: nextQty } : item))
      : [
          {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
          },
          ...current
        ];
    writeCart(userId, updated);
    navigate('/orders');
  };

  const handleToggleWishlist = (productId) => {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }
    const updated = toggleWishlist(productId, wishlist);
    setWishlist(updated);
    writeWishlist(userId, updated);
  };

  const handleViewDetails = (productId) => {
    navigate(`/products/${productId}`);
  };

  const handleDownloadCatalog = () => {
    if (!products || products.length === 0) {
      alert('No products available to download');
      return;
    }

    const lines = [
      '═══════════════════════════════════════════════════════',
      'DOOR MAT CATALOG',
      '═══════════════════════════════════════════════════════',
      `Generated on: ${new Date().toLocaleDateString()}`,
      '',
      `Total Products: ${products.length}`,
      '',
      '───────────────────────────────────────────────────────'
    ];

    products.forEach((product, index) => {
      lines.push(`\n${index + 1}. ${product.name}`);
      lines.push(`   Category: ${product.category || 'N/A'}`);
      lines.push(`   Price: Rs. ${product.price || 'N/A'}`);
      if (product.size) lines.push(`   Size: ${product.size}`);
      if (product.description) lines.push(`   Description: ${product.description}`);
      lines.push(`   Stock: ${product.stock || 0} units`);
    });

    lines.push('\n───────────────────────────────────────────────────────');
    lines.push(`For more information, visit our website or contact us.`);
    lines.push('═══════════════════════════════════════════════════════');

    downloadPdfLike('door-mat-catalog.pdf', lines);
  };

  const productContent = (
    <>
      <header className={isLoggedIn ? 'adminDash__header' : 'productShowcase__header'}>
        <div>
          <p className="productShowcase__eyebrow">Catalog</p>
          <h1 className="productShowcase__title">Door Mat Collection</h1>
          <p className="productShowcase__subtitle">
            Explore durable mats crafted for everyday elegance.
          </p>
          <button className="productShowcase__download" type="button" onClick={handleDownloadCatalog}>
            Download Catalog
          </button>
        </div>
      </header>

      <div className="productShowcase__controls">
        <label className="productShowcase__search">
          Search
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search products"
          />
        </label>
        <label className="productShowcase__filter">
          Category
          <select
            value={activeCategory}
            onChange={(event) => setActiveCategory(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="productShowcase__filter">
          Sort by price
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          >
            <option value="low">Low to High</option>
            <option value="high">High to Low</option>
          </select>
        </label>
      </div>

      <section className="productShowcase__grid">
        {visibleProducts.length === 0 ? (
          <div className="productShowcase__empty">
            No products found for this category.
          </div>
        ) : (
          visibleProducts.map((product) => (
            <article className="productShowcase__card" key={product.id || product._id}>
              <div className="productShowcase__imageWrap">
                <img src={product.image} alt={product.name} />
              </div>
              <div className="productShowcase__cardBody">
                <h2>{product.name}</h2>
                <p className="productShowcase__meta">Size: {product.size || 'Standard'}</p>
                <p className="productShowcase__meta">
                  Material: {product.material || 'Natural fiber'}
                </p>
                <p className="productShowcase__price">Rs. {Number(product.price).toFixed(2)}</p>
                <span
                  className={`productShowcase__stock ${
                    Number(product.quantity) > 0 ? 'productShowcase__stock--in' : 'productShowcase__stock--out'
                  }`}
                >
                  {Number(product.quantity) > 0 ? 'In stock' : 'Out of stock'}
                </span>
                <div className="productShowcase__actions">
                  <button type="button" onClick={() => handleViewDetails(product.id || product._id)}>
                    View Details
                  </button>
                  <button
                    type="button"
                    disabled={Number(product.quantity) <= 0}
                    onClick={() => handleOrderNow(product)}
                  >
                    Order Now
                  </button>
                  <button
                    type="button"
                    className={
                      isWishlisted(product.id || product._id, wishlist)
                        ? 'productShowcase__wish productShowcase__wish--active'
                        : 'productShowcase__wish'
                    }
                    onClick={() => handleToggleWishlist(product.id || product._id)}
                  >
                    {isWishlisted(product.id || product._id, wishlist) ? 'Wishlisted' : 'Add to Wishlist'}
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );

  if (!isLoggedIn) {
    return (
      <div className="productShowcase">
        <Navbar />
        <main className="productShowcase__main">
          {productContent}
        </main>
      </div>
    );
  }

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
          <button
            className="adminDash__navBtn adminDash__navBtn--danger"
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </nav>
        <div className="adminDash__meta">
          <span className="adminDash__chip">Member</span>
          <span className="adminDash__metaText">Last login: Today</span>
        </div>
      </aside>

      <main className="adminDash__main">
        {productContent}
      </main>
    </div>
  );
}

export default ProductDisplay;
