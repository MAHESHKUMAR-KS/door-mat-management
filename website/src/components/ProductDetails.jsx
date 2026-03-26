import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from './Navbar';
// Footer intentionally omitted on non-home pages.
import { getSessionUserId, isUserSession } from '../utils/auth';
import { readCart, writeCart } from '../utils/dataTools';
import './ProductDetails.css';

function ProductDetails() {
  const navigate = useNavigate();
  const userId = getSessionUserId();
  const { id } = useParams();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const product = products.find(
    (item) => String(item.id || item._id) === String(id)
  );

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
  }, [id]);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState('');
  const [message, setMessage] = useState('');

  if (!product) {
    return (
      <div className="productDetails">
        <Navbar />
        <main className="productDetails__main">
          <div className="productDetails__empty">
            Product not found.
            <button type="button" onClick={() => navigate('/products')}>
              Back to Products
            </button>
          </div>
        </main>
      </div>
    );
  }

  let sizesList = [];
  if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    sizesList = product.sizes;
  } else if (product.size) {
    sizesList = [product.size];
  }
  
  // Flatten any comma-separated size strings
  const sizes = sizesList.flatMap((size) => {
    const sizeStr = String(size).trim();
    if (sizeStr.includes(',')) {
      return sizeStr.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [sizeStr];
  }).filter(Boolean);

  const handleOrderNow = () => {
    if (!isUserSession()) {
      navigate('/login');
      return;
    }
    if (sizes.length > 0 && !selectedSize) {
      setMessage('Please select a size before ordering.');
      return;
    }
    const maxQty = Number(product.quantity) || 0;
    if (maxQty <= 0) return;
    const desiredQty = Math.max(1, Number(quantity) || 1);
    const current = readCart(userId);
    const existing = current.find((item) => item.id === product.id);
    const nextQty = Math.min((existing?.quantity || 0) + desiredQty, maxQty);
    const updated = existing
      ? current.map((item) => (item.id === product.id ? { ...item, quantity: nextQty, size: selectedSize || item.size } : item))
      : [
          {
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: Math.min(desiredQty, maxQty),
            size: selectedSize
          },
          ...current
        ];
    writeCart(userId, updated);
    navigate('/orders');
  };

  return (
    <div className="productDetails">
      <Navbar />
      <main className="productDetails__main">
        <button className="productDetails__back" type="button" onClick={() => navigate('/products')}>
          Back to Products
        </button>

        <section className="productDetails__content">
          <div className="productDetails__imageWrap">
            <img src={product.image} alt={product.name} />
          </div>
          <div className="productDetails__info">
            <h1>{product.name}</h1>
            <p className="productDetails__price">Rs. {Number(product.price).toFixed(2)}</p>
            <p className="productDetails__description">
              {product.description || 'Premium craftsmanship with durable materials.'}
            </p>

            <div className="productDetails__meta">
              <div>
                <span>Material</span>
                <strong>{product.material || 'Natural fiber'}</strong>
              </div>
              <div>
                <span>Stock</span>
                <strong>{Number(product.quantity) > 0 ? 'In stock' : 'Out of stock'}</strong>
              </div>
            </div>

            {message && (
              <div className="productDetails__message">
                {message}
              </div>
            )}

            <div className="productDetails__sizes">
              <span>Available Sizes</span>
              <div>
                {sizes.filter(Boolean).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`productDetails__size ${selectedSize === size ? 'productDetails__size--active' : ''}`}
                    onClick={() => {
                      setSelectedSize(size);
                      setMessage('');
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="productDetails__qty">
              <label htmlFor="qty">Quantity</label>
              <input
                id="qty"
                type="number"
                min="1"
                max={product.quantity || 1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>

            <div className="productDetails__actions">
              <button type="button" disabled={Number(product.quantity) <= 0} onClick={handleOrderNow}>
                Order Now
              </button>
              <button type="button" className="productDetails__fitBtn" onClick={() => navigate(`/fit-check/${product.id}`)}>
                Check Fit in Room
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ProductDetails;
