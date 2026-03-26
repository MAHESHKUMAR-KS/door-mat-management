import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from './Navbar';
import './RoomFitPreview.css';

function RoomFitPreview() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fallbackProductId = products[0] ? String(products[0].id || products[0]._id) : '';
  const [selectedProductId, setSelectedProductId] = useState(String(id || fallbackProductId));
  
  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      const { fetchProducts } = await import('../utils/catalog');
      const res = await fetchProducts();
      if (res.success) {
        setProducts(res.products);
        if (!id && res.products[0]) {
          setSelectedProductId(String(res.products[0].id || res.products[0]._id));
        }
      }
      setIsLoading(false);
    };
    loadProducts();
  }, [id]);

  const product = products.find(
    (item) => String(item.id || item._id) === String(selectedProductId)
  ) || products[0];

  const [roomImage, setRoomImage] = useState('');
  const [position, setPosition] = useState({ x: 50, y: 60 });
  const [scale, setScale] = useState(35);
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(90);
  const [dragging, setDragging] = useState(false);

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRoomImage(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleStagePointerDown = () => {
    if (!roomImage) return;
    setDragging(true);
  };

  const handleStagePointerUp = () => {
    setDragging(false);
  };

  const handleStagePointerMove = (event) => {
    if (!dragging || !roomImage) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((event.clientY - rect.top) / rect.height) * 100;

    setPosition({
      x: Math.max(0, Math.min(100, xPercent)),
      y: Math.max(0, Math.min(100, yPercent))
    });
  };

  if (!product) {
    return (
      <div className="fitPreview">
        <Navbar />
        <main className="fitPreview__main">
          <div className="fitPreview__empty">
            Product not found.
            <button type="button" onClick={() => navigate('/products')}>
              Back to Products
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="fitPreview">
      <Navbar />
      <main className="fitPreview__main">
        <button className="fitPreview__back" type="button" onClick={() => navigate(`/products/${product.id}`)}>
          Back to Product
        </button>

        <section className="fitPreview__content">
          <div className="fitPreview__left">
            <h1>Check Doormat Fit in Your Room</h1>
            <p>Upload a room photo, then drag and adjust the doormat placement.</p>

            <label className="fitPreview__upload">
              <span>Choose Doormat</span>
              <select
                className="fitPreview__select"
                value={String(product.id)}
                onChange={(event) => setSelectedProductId(String(event.target.value))}
              >
                {products.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="fitPreview__upload">
              <span>Room Photo</span>
              <input type="file" accept="image/*" onChange={handleUpload} />
            </label>

            <div className="fitPreview__controls">
              <label>
                Size
                <input
                  type="range"
                  min="10"
                  max="80"
                  value={scale}
                  onChange={(event) => setScale(Number(event.target.value))}
                />
              </label>

              <label>
                Rotation
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={rotation}
                  onChange={(event) => setRotation(Number(event.target.value))}
                />
              </label>

              <label>
                Opacity
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={opacity}
                  onChange={(event) => setOpacity(Number(event.target.value))}
                />
              </label>
            </div>
          </div>

          <div
            className="fitPreview__stage"
            onPointerDown={handleStagePointerDown}
            onPointerUp={handleStagePointerUp}
            onPointerLeave={handleStagePointerUp}
            onPointerMove={handleStagePointerMove}
          >
            {!roomImage && <div className="fitPreview__placeholder">Upload a room image to start preview</div>}

            {roomImage && <img className="fitPreview__room" src={roomImage} alt="Room preview" />}

            {roomImage && (
              <img
                className="fitPreview__mat"
                src={product.image}
                alt={`${product.name} placement preview`}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: `${scale}%`,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  opacity: opacity / 100
                }}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default RoomFitPreview;