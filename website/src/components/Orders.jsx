import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, getSession, getSessionUserId, isUserSession } from '../utils/auth';
import {
  readCart,
  readProfile,
  writeAllOrders,
  writeCart,
  writeUserOrders,
  reduceProductQuantity
} from '../utils/dataTools';
import {
  confirmOnlineOrder,
  createOfflineOrder,
  createPaymentOrder,
  fetchUserOrders,
  getPaymentConfig,
  updateOrderStatus,
  verifyPayment
} from '../utils/ordersApi';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';
import './Orders.css';

const loadRazorpayScript = () => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  const scriptSrc = 'https://checkout.razorpay.com/v1/checkout.js';
  const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);

  if (existingScript) {
    return new Promise((resolve) => {
      existingScript.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true });
      setTimeout(() => resolve(Boolean(window.Razorpay)), 1500);
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PAYMENT_OPTIONS = [
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'netbanking', label: 'Net Banking' },
  { value: 'cod', label: 'Cash on Delivery (COD)' }
];

const PAYMENT_METHOD_LABEL = {
  card: 'Credit/Debit Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  cod: 'Cash on Delivery'
};

function Orders() {
  const navigate = useNavigate();
  const session = useMemo(() => getSession(), []);
  const userId = useMemo(() => getSessionUserId(), []);
  const [orders, setOrders] = useState([]);
  const [isPlacing, setIsPlacing] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState('card');
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(true);
  const [onlinePaymentMockMode, setOnlinePaymentMockMode] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [cancellingOrderId, setCancellingOrderId] = useState('');
  const [cart, setCart] = useState([]);
  const [delivery, setDelivery] = useState({
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: ''
  });
  const profile = useMemo(() => readProfile(userId), [userId]);
  const [products, setProducts] = useState([]);

  const syncOrders = async () => {
    if (!userId) return;
    const response = await fetchUserOrders(userId);
    if (!response.success) {
      setMessageType('error');
      setMessage(response.message || 'Unable to load order history.');
      return;
    }
    const serverOrders = Array.isArray(response.orders) ? response.orders : [];
    setOrders(serverOrders);
    writeUserOrders(userId, serverOrders);
    writeAllOrders(serverOrders);
  };

  useEffect(() => {
    if (!isUserSession()) {
      navigate('/login');
      return;
    }
    syncOrders();

    const loadProducts = async () => {
      const { fetchProducts } = await import('../utils/catalog');
      const res = await fetchProducts();
      if (res.success) setProducts(res.products);
    };
    loadProducts();
  }, [navigate]);

  useEffect(() => {
    const checkGatewayConfig = async () => {
      const configData = await getPaymentConfig();
      const isMock = Boolean(configData?.mockMode);
      const enabled = Boolean(configData?.success && (configData?.keyId || isMock));
      setOnlinePaymentEnabled(enabled);
      setOnlinePaymentMockMode(isMock);
      if (!enabled) {
        setSelectedPaymentOption('cod');
      }
    };

    checkGatewayConfig();
  }, []);

  useEffect(() => {
    if (!userId || products.length === 0) return;
    const current = readCart(userId);
    const normalized = current.map((item) => {
      const product = products.find((entry) => String(entry.id || entry._id) === String(item.id));
      const sizeOptions = Array.isArray(product?.sizes) && product.sizes.length > 0
        ? product.sizes
        : [product?.size].filter(Boolean);
      if (!item.size && sizeOptions.length === 1) {
        return { ...item, size: sizeOptions[0] };
      }
      return item;
    });
    setCart(normalized);
    writeCart(userId, normalized);
  }, [products, userId]);

  useEffect(() => {
    if (!profile) return;
    setDelivery((prev) => ({
      address: prev.address || profile.address || '',
      city: prev.city || profile.city || '',
      state: prev.state || profile.state || '',
      pincode: prev.pincode || profile.pincode || '',
      phone: prev.phone || profile.phone || ''
    }));
  }, [profile]);

  if (!isUserSession()) return null;

  const cartItemCount = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const latestOrder = orders[0];

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const getSizeOptions = (itemId) => {
    const product = products.find((entry) => String(entry.id) === String(itemId));
    if (!product) return [];

    let sizes = [];
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      sizes = product.sizes;
    } else if (product.size) {
      sizes = [product.size];
    }

    return sizes
      .flatMap((size) => {
        const sizeStr = String(size).trim();
        if (sizeStr.includes(',')) {
          return sizeStr.split(',').map((s) => s.trim()).filter(Boolean);
        }
        return [sizeStr];
      })
      .filter(Boolean);
  };

  const handleSizeChange = (itemId, size) => {
    setCart((prev) => {
      const updated = prev.map((item) =>
        item.id === itemId ? { ...item, size } : item
      );
      writeCart(userId, updated);
      return updated;
    });
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    const product = products.find((entry) => String(entry.id || entry._id) === String(itemId));
    const maxQty = Number(product?.quantity) || 1;
    const qty = Math.max(1, Math.min(newQuantity, maxQty));
    setCart((prev) => {
      const updated = prev.map((item) =>
        item.id === itemId ? { ...item, quantity: qty } : item
      );
      writeCart(userId, updated);
      return updated;
    });
  };

  const handleRemoveItem = (itemId) => {
    setCart((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      writeCart(userId, updated);
      return updated;
    });
  };

  const handleDeliveryChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value;
    setDelivery((prev) => ({ ...prev, [name]: nextValue }));
  };

  const getOrderIdentity = (order) => order.orderId || order.id || order._id;

  const canCancelOrder = (order) => {
    const status = String(order.status || '').toLowerCase();
    return status === 'pending' || status === 'confirmed';
  };

  const summarizeProducts = (order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) return 'No products';
    return items
      .slice(0, 3)
      .map((item) => `${item.name}${item.quantity ? ` x${item.quantity}` : ''}`)
      .join(', ');
  };

  const handleCancelOrder = async (order) => {
    const orderIdentity = getOrderIdentity(order);
    if (!orderIdentity || !canCancelOrder(order)) return;

    const confirmed = window.confirm(`Cancel order ${orderIdentity}?`);
    if (!confirmed) return;

    setCancellingOrderId(String(orderIdentity));
    setMessage('');

    try {
      const response = await updateOrderStatus(orderIdentity, 'Cancelled');
      if (!response.success || !response.order) {
        throw new Error(response.message || 'Unable to cancel this order');
      }

      await syncOrders();
      setMessageType('success');
      setMessage(`Order ${orderIdentity} cancelled successfully.`);
    } catch (error) {
      setMessageType('error');
      setMessage(String(error?.message || 'Unable to cancel order'));
    } finally {
      setCancellingOrderId('');
    }
  };

  const validateCheckout = () => {
    if (!cart.length) {
      return 'Your cart is empty. Add items before checkout.';
    }

    if (!delivery.address.trim()) {
      return 'Please add your delivery address before checkout.';
    }

    if (delivery.phone.trim() && !/^\d{10}$/.test(delivery.phone.trim())) {
      return 'Phone number must be exactly 10 digits.';
    }

    const missingSize = cart.some((item) => {
      const options = getSizeOptions(item.id);
      return options.length > 0 && !item.size;
    });
    if (missingSize) {
      return 'Please select a size for each item before payment.';
    }

    return null;
  };

  const buildOrderPayload = (overrides = {}) => {
    const customerEmail = session?.username || profile?.email || '';
    const customerName = profile?.name || session?.username?.split('@')[0] || 'Customer';
    return {
      userId,
      email: customerEmail,
      name: customerName,
      phone: delivery.phone || profile?.phone || '',
      delivery,
      items: cart.map((item) => ({
        productId: String(item.id),
        name: item.name,
        quantity: Number(item.quantity || 0),
        price: Number(item.price || 0),
        size: item.size || ''
      })),
      paymentMethod: PAYMENT_METHOD_LABEL[selectedPaymentOption],
      ...overrides
    };
  };

  const finalizeClientStateAfterOrder = async () => {
    cart.forEach((item) => {
      reduceProductQuantity(item.id, Number(item.quantity || 0));
    });
    writeCart(userId, []);
    setCart([]);
    await syncOrders();
    window.dispatchEvent(new Event('dm:orders-updated'));
  };

  const handleProceedToPayment = async () => {
    const validationError = validateCheckout();
    if (validationError) {
      setMessageType('error');
      setMessage(validationError);
      return;
    }

    setIsPlacing(true);
    setMessage('');

    try {
      const isOnlineMethod = selectedPaymentOption !== 'cod';
      if (isOnlineMethod && !onlinePaymentEnabled) {
        throw new Error('Online payment is not configured. Please use COD or configure Razorpay keys in backend .env.');
      }

      if (selectedPaymentOption === 'cod') {
        const codResponse = await createOfflineOrder(
          buildOrderPayload({
            paymentStatus: 'Pending',
            paymentMethod: PAYMENT_METHOD_LABEL.cod
          })
        );

        if (!codResponse.success) {
          throw new Error(codResponse.message || 'Unable to place COD order');
        }

        await finalizeClientStateAfterOrder();
        setMessageType('success');
        setMessage(`Payment Pending: COD order placed. Order ID: ${getOrderIdentity(codResponse.order)}`);
        return;
      }

      setIsPaying(true);

      const configData = await getPaymentConfig();
      const isMockMode = Boolean(configData?.mockMode);
      if (!configData.success || (!configData.keyId && !isMockMode)) {
        throw new Error('Online payment is not configured on server.');
      }

      if (isMockMode) {
        const confirmResponse = await confirmOnlineOrder(
          buildOrderPayload({
            razorpay_order_id: `order_mock_${Date.now()}`,
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_signature: 'mock_signature'
          })
        );

        if (!confirmResponse.success) {
          throw new Error(confirmResponse.message || 'Mock order confirmation failed.');
        }

        await finalizeClientStateAfterOrder();
        setMessageType('success');
        setMessage(`Payment Successful: Order confirmed. Order ID: ${getOrderIdentity(confirmResponse.order)}`);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error('Unable to load payment gateway. Please try again.');
      }

      const createOrderData = await createPaymentOrder({
        amount: cartTotal,
        receipt: `dm_${Date.now()}`,
        paymentMethod: PAYMENT_METHOD_LABEL[selectedPaymentOption],
        customer: {
          email: session?.username || profile?.email || '',
          name: profile?.name || session?.username || 'Customer',
          phone: delivery.phone || profile?.phone || ''
        }
      });

      if (!createOrderData.success || !createOrderData.order) {
        throw new Error(createOrderData.message || 'Unable to initialize payment.');
      }

      const paymentResult = await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: configData.keyId,
          amount: createOrderData.order.amount,
          currency: createOrderData.order.currency,
          name: 'Govindasamy & Co',
          description: `Order payment (${cart.length} item${cart.length > 1 ? 's' : ''})`,
          order_id: createOrderData.order.id,
          method: {
            card: selectedPaymentOption === 'card',
            upi: selectedPaymentOption === 'upi',
            netbanking: selectedPaymentOption === 'netbanking',
            wallet: false,
            paylater: false,
            emi: false
          },
          prefill: {
            name: profile?.name || session?.username || 'Customer',
            email: session?.username || profile?.email || '',
            contact: delivery.phone || profile?.phone || ''
          },
          theme: { color: '#1f7a68' },
          handler: async (response) => {
            try {
              const verifyResponse = await verifyPayment(response);
              if (!verifyResponse.success) {
                reject(new Error(verifyResponse.message || 'Payment verification failed.'));
                return;
              }
              resolve(response);
            } catch {
              reject(new Error('Payment verification failed.'));
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment Pending: checkout was closed before completion.'))
          }
        });

        checkout.on('payment.failed', (failure) => {
          const reason = failure?.error?.description || 'Payment Failed: transaction was declined.';
          reject(new Error(reason));
        });

        checkout.open();
      });

      const confirmResponse = await confirmOnlineOrder(
        buildOrderPayload({
          razorpay_order_id: paymentResult.razorpay_order_id,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature
        })
      );

      if (!confirmResponse.success) {
        throw new Error(confirmResponse.message || 'Order confirmation failed after payment.');
      }

      await finalizeClientStateAfterOrder();
      setMessageType('success');
      setMessage(`Payment Successful: Order confirmed. Order ID: ${getOrderIdentity(confirmResponse.order)}`);
    } catch (error) {
      const text = String(error?.message || 'Payment Failed');
      const isPending = text.toLowerCase().includes('pending');

      if (!isPending && cart.length) {
        await createOfflineOrder(
          buildOrderPayload({
            paymentStatus: 'Failed',
            paymentFailureReason: text
          })
        );
        await syncOrders();
      }

      setMessageType(isPending ? 'pending' : 'error');
      setMessage(isPending ? 'Payment Pending: You can retry from checkout.' : `Payment Failed: ${text}`);
    } finally {
      setIsPaying(false);
      setIsPlacing(false);
    }
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
            <h1 className="adminDash__heading">My Orders</h1>
            <p className="adminDash__lead">
              Checkout and track all your orders in one place.
            </p>
            <div className="orders__kpiRow" aria-label="Order summary">
              <div className="orders__kpiCard">
                <span className="orders__kpiLabel">Cart Items</span>
                <strong className="orders__kpiValue">{cartItemCount}</strong>
              </div>
              <div className="orders__kpiCard">
                <span className="orders__kpiLabel">Cart Total</span>
                <strong className="orders__kpiValue">Rs. {cartTotal.toFixed(2)}</strong>
              </div>
              <div className="orders__kpiCard">
                <span className="orders__kpiLabel">Total Orders</span>
                <strong className="orders__kpiValue">{orders.length}</strong>
              </div>
              <div className="orders__kpiCard">
                <span className="orders__kpiLabel">Latest Status</span>
                <strong className="orders__kpiValue">{latestOrder?.status || 'No orders'}</strong>
              </div>
            </div>
          </div>
          <div className="adminDash__badge">Customer Orders</div>
        </header>

        <section className="orders__section">
          <div className="orders__placeOrder">
            <h2 className="orders__title">Checkout</h2>
            <p className="orders__subtitle">Review cart, choose payment method, and confirm your order</p>

            {message && (
              <div className={messageType === 'error' ? 'orders__message orders__message--error' : 'orders__message orders__message--success'}>
                {message}
              </div>
            )}

            <div className="orders__delivery">
              <h3>Delivery Address</h3>
              <div className="orders__deliveryGrid">
                <label className="orders__deliveryField orders__deliveryField--full">
                  Address
                  <input
                    name="address"
                    value={delivery.address}
                    onChange={handleDeliveryChange}
                    placeholder="Street address"
                  />
                </label>
                <label className="orders__deliveryField">
                  City
                  <input
                    name="city"
                    value={delivery.city}
                    onChange={handleDeliveryChange}
                    placeholder="Erode"
                  />
                </label>
                <label className="orders__deliveryField">
                  State
                  <input
                    name="state"
                    value={delivery.state}
                    onChange={handleDeliveryChange}
                    placeholder="Tamil Nadu"
                  />
                </label>
                <label className="orders__deliveryField">
                  Pincode
                  <input
                    name="pincode"
                    value={delivery.pincode}
                    onChange={handleDeliveryChange}
                    placeholder="638001"
                  />
                </label>
                <label className="orders__deliveryField">
                  Phone
                  <input
                    type="tel"
                    name="phone"
                    value={delivery.phone}
                    onChange={handleDeliveryChange}
                    placeholder="9876543210"
                    inputMode="numeric"
                    pattern="\d{10}"
                    maxLength={10}
                  />
                </label>
              </div>
            </div>

            <div className="orders__paymentMethod">
              <h3>Payment Methods</h3>
              {!onlinePaymentEnabled && (
                <p className="orders__subtitle">Online methods are temporarily unavailable. Configure Razorpay keys to enable Card, UPI, and Net Banking.</p>
              )}
              {onlinePaymentEnabled && onlinePaymentMockMode && (
                <p className="orders__subtitle">Mock payment mode is active for local testing. Add Razorpay keys for live gateway checkout.</p>
              )}
              <div className="orders__paymentOptions">
                {PAYMENT_OPTIONS.map((option) => (
                  <label key={option.value} className="orders__paymentOption">
                    <input
                      type="radio"
                      name="paymentOption"
                      value={option.value}
                      checked={selectedPaymentOption === option.value}
                      disabled={!onlinePaymentEnabled && option.value !== 'cod'}
                      onChange={(event) => setSelectedPaymentOption(event.target.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="orders__cartPreview">
                <h3>Cart Summary</h3>
                <div className="orders__items">
                  {cart.map((item, idx) => {
                    const total = Number(item.price || 0) * Number(item.quantity || 0);
                    const sizeOptions = getSizeOptions(item.id);
                    const selectedSize = item.size || '';
                    const nameLabel = item.size ? `${item.name} (${item.size})` : item.name;
                    return (
                      <div key={idx} className="orders__item">
                        <div className="orders__itemInfo">
                          <span className="orders__itemName">{nameLabel}</span>
                          {sizeOptions.length > 0 && (
                            <label className="orders__itemSize">
                              <span>Size</span>
                              <select
                                value={selectedSize}
                                onChange={(event) => handleSizeChange(item.id, event.target.value)}
                              >
                                <option value="">Select size</option>
                                {sizeOptions.map((size) => (
                                  <option key={size} value={size}>
                                    {size}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                        <div className="orders__itemQty">
                          <input
                            type="number"
                            className="orders__qtyInput"
                            value={item.quantity}
                            onChange={(event) => handleQuantityChange(item.id, Number(event.target.value) || 1)}
                            min="1"
                            placeholder="Qty"
                          />
                        </div>
                        <div className="orders__itemActions">
                          <span className="orders__itemPrice">Rs. {total.toFixed(2)}</span>
                          <button
                            type="button"
                            className="orders__removeBtn"
                            onClick={() => handleRemoveItem(item.id)}
                            title="Remove item"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="orders__total">
                  Total: Rs. {cartTotal.toFixed(2)}
                </div>
              </div>
            )}

            <button
              className="orders__btn"
              type="button"
              onClick={handleProceedToPayment}
              disabled={isPlacing || isPaying || !cart.length}
            >
              {isPaying
                ? 'Processing Payment...'
                : isPlacing
                  ? 'Creating Order...'
                  : cart.length > 0
                    ? 'Proceed to Payment'
                    : 'Cart Empty'}
            </button>
          </div>
        </section>

        <section className="orders__section">
          <h2 className="orders__title">Order History</h2>

          {orders.length === 0 ? (
            <div className="orders__empty">
              <p>No orders yet. Add items to your cart and place your first order!</p>
            </div>
          ) : (
            <div className="orders__list">
              {orders.map((order) => (
                <div key={getOrderIdentity(order)} className="orders__orderCard">
                  <div className="orders__orderMain">
                    <h3>Order #{getOrderIdentity(order)}</h3>
                    <p className="orders__orderDate">
                      {new Date(order.createdAt || order.updatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="orders__orderMeta">
                    <span className={`orders__status orders__status--${String(order.status || 'pending').toLowerCase()}`}>
                      {order.status}
                    </span>
                    <span className="orders__metaChip">Payment: {order.paymentStatus || 'Pending'}</span>
                  </div>

                  <div className="orders__orderProducts" title={summarizeProducts(order)}>
                    {summarizeProducts(order)}
                  </div>

                  <div className="orders__orderTotal">
                    Rs. {Number(order.totalAmount || 0).toFixed(2)}
                  </div>

                  <div className="orders__orderActions">
                    {canCancelOrder(order) ? (
                      <button
                        type="button"
                        className="orders__cancelBtn"
                        onClick={() => handleCancelOrder(order)}
                        disabled={cancellingOrderId === String(getOrderIdentity(order))}
                      >
                        {cancellingOrderId === String(getOrderIdentity(order)) ? 'Cancelling...' : 'Cancel Order'}
                      </button>
                    ) : (
                      <span className="orders__metaChip">No actions</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Orders;
