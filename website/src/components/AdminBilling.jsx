import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, isAdminSession } from '../utils/auth';
import {
  readAllOrders,
  writeAllOrders,
  readNotifications,
  dismissNotification,
  getLowStockProducts,
  reduceProductQuantity
} from '../utils/dataTools';
import { hasNewEnquiriesAlert, hasNewOrdersAlert } from '../utils/adminAlerts';
import { readProducts } from '../utils/catalog';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';
import './AdminBilling.css';

function AdminBilling() {
  const navigate = useNavigate();
  const isAdmin = isAdminSession();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualOrder, setManualOrder] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    deliveryAddress: '',
    items: [{ productId: '', quantity: '', size: '' }]
  });
  const showOrdersDot = hasNewOrdersAlert();
  const showEnquiriesDot = hasNewEnquiriesAlert();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/login');
      return;
    }
    loadData();
  }, [isAdmin, navigate]);

  const loadData = async () => {
    const allOrders = readAllOrders();
    setOrders(allOrders);
    setNotifications(readNotifications());
    setLowStockProducts(getLowStockProducts());
    
    const { fetchProducts } = await import('../utils/catalog');
    const res = await fetchProducts();
    if (res.success) setProducts(res.products);
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const handleDismissNotification = (notificationId) => {
    dismissNotification(notificationId);
    setNotifications(readNotifications());
  };

  const getProductSizes = (productId) => {
    const product = products.find((p) => String(p.id || p._id) === String(productId));
    if (!product) return [];
    // Check for sizes array first
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      return product.sizes;
    }
    // Check for single size value
    if (product.size && String(product.size).trim()) {
      return [String(product.size).trim()];
    }
    // No sizes defined - will show text input in form
    return [];
  };

  const getProductPrice = (productId) => {
    const product = products.find((p) => String(p.id || p._id) === String(productId));
    return product ? Number(product.price || 0) : 0;
  };

  const calculateItemTotal = (productId, quantity) => {
    return getProductPrice(productId) * Number(quantity || 0);
  };

  const calculateOrderTotal = () => {
    return manualOrder.items.reduce((sum, item) => {
      return sum + calculateItemTotal(item.productId, item.quantity);
    }, 0);
  };

  const handleUpdateOrderStatus = (orderId, newStatus) => {
    const updated = orders.map((order) => {
      if (order.id === orderId) {
        return { ...order, status: newStatus };
      }
      return order;
    });
    writeAllOrders(updated);
    setOrders(updated);
    if (selectedOrderId === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrderId(orderId);
    const order = orders.find((o) => o.id === orderId);
    setSelectedOrder(order);
  };

  const handleManualOrderChange = (field, value) => {
    setManualOrder((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...manualOrder.items];
    updated[index] = { ...updated[index], [field]: value };
    setManualOrder((prev) => ({ ...prev, items: updated }));
  };

  const handleAddItem = () => {
    setManualOrder((prev) => ({
      ...prev,
      items: [...prev.items, { productId: '', quantity: '', size: '' }]
    }));
  };

  const handleRemoveItem = (index) => {
    setManualOrder((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleAddManualOrder = () => {
    // Validate form
    if (!manualOrder.customerName.trim() || !manualOrder.customerEmail.trim() || !manualOrder.deliveryAddress.trim()) {
      alert('Please fill in customer name, email, and delivery address.');
      return;
    }

    const normalizedPhone = manualOrder.customerPhone.trim();
    if (normalizedPhone && !/^\d{10}$/.test(normalizedPhone)) {
      alert('Phone number must be exactly 10 digits.');
      return;
    }

    if (!manualOrder.items.some((item) => item.productId && item.quantity)) {
      alert('Please add at least one item with product and quantity.');
      return;
    }

    // Validate that all items have size
    const itemsWithoutSize = manualOrder.items.filter((item) => item.productId && item.quantity && !item.size?.trim());
    if (itemsWithoutSize.length > 0) {
      alert('Please select or enter a size for all items.');
      return;
    }

    // Build order items with product details
    const orderItems = manualOrder.items
      .filter((item) => item.productId && item.quantity && item.size?.trim())
      .map((item) => {
        const product = products.find((p) => String(p.id || p._id) === String(item.productId));
        return {
          name: product?.name || 'Unknown Product',
          quantity: Number(item.quantity),
          price: product?.price || 0,
          size: item.size || ''
        };
      });

    if (orderItems.length === 0) {
      alert('Please add at least one valid item.');
      return;
    }

    // Calculate total
    const totalAmount = orderItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    // Create new order
    const newOrder = {
      id: Date.now(),
      userId: `manual_${Date.now()}`,
      email: manualOrder.customerEmail,
      name: manualOrder.customerName,
      phone: normalizedPhone || 'Not provided',
      address: manualOrder.deliveryAddress,
      delivery: {
        address: manualOrder.deliveryAddress,
        city: '',
        state: '',
        pincode: '',
        phone: normalizedPhone
      },
      items: orderItems,
      totalAmount: totalAmount.toFixed(2),
      status: 'Pending',
      createdAt: new Date().toISOString(),
      isManual: true // Flag to identify manual orders
    };

    // Add to orders
    const updatedOrders = [newOrder, ...orders];
    writeAllOrders(updatedOrders);
    window.dispatchEvent(new Event('dm:orders-updated'));
    setOrders(updatedOrders);

    // Reduce product quantities
    manualOrder.items
      .filter((item) => item.productId && item.quantity)
      .forEach((item) => {
        reduceProductQuantity(item.productId, Number(item.quantity));
      });

    // Reload low stock products and notifications
    setLowStockProducts(getLowStockProducts());
    setNotifications(readNotifications());

    // Reset form
    setManualOrder({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      deliveryAddress: '',
      items: [{ productId: '', quantity: '', size: '' }]
    });
    setShowManualForm(false);

    alert(`Order #${newOrder.id} created successfully!`);
  };

  const filteredOrders = filterStatus === 'All'
    ? orders
    : orders.filter((order) => order.status === filterStatus);

  const totalAmount = filteredOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0
  );

  const statuses = ['Pending', 'Processing', 'Completed', 'Cancelled'];

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
          <span className="adminDash__metaText">Billing Manager</span>
        </div>
      </aside>

      <main className="adminDash__main">
        <header className="adminDash__header">
          <div>
            <h1 className="adminDash__heading">Billing Management</h1>
            <p className="adminDash__lead">
              Manage customer orders, track billing status, and refill inventory.
            </p>
          </div>
          <div className="adminDash__badge">Admin</div>
        </header>

        {/* Notifications Section */}
        {notifications.length > 0 && (
          <section className="adminDash__alerts">
            {notifications.map((notif) => (
              <div key={notif.id || `notif_${notif.message}`} className="adminDash__alert adminDash__alert--warning">
                <div className="adminDash__alertContent">
                  <strong>Stock Alert:</strong> {notif.message}
                </div>
                <button
                  type="button"
                  className="adminDash__alertClose"
                  onClick={() => handleDismissNotification(notif.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Low Stock Products */}
        {lowStockProducts.length > 0 && (
          <section className="adminBilling__lowStock">
            <h2 className="adminBilling__lowStockTitle">
              ⚠️ {lowStockProducts.length} Product(s) Need Refill
            </h2>
            <div className="adminBilling__lowStockGrid">
              {lowStockProducts.map((product) => (
                <div key={product.id || product._id} className="adminBilling__lowStockCard">
                  <div className="adminBilling__lowStockName">{product.name}</div>
                  <div className="adminBilling__lowStockQuantity">
                    {product.quantity} units left
                  </div>
                  <button
                    type="button"
                    className="adminBilling__refillBtn"
                    onClick={() => navigate('/admin/products')}
                  >
                    Refill Now
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Orders Summary */}
        <section className="adminDash__stats" aria-label="Billing overview">
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Orders</div>
            <div className="adminDash__cardValue">{filteredOrders.length}</div>
            <div className="adminDash__cardHint">In {filterStatus} status</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Revenue</div>
            <div className="adminDash__cardValue">₹{totalAmount.toFixed(2)}</div>
            <div className="adminDash__cardHint">Combined amount</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Pending Orders</div>
            <div className="adminDash__cardValue">
              {orders.filter((o) => o.status === 'Pending').length}
            </div>
            <div className="adminDash__cardHint">Awaiting processing</div>
          </article>
        </section>

        {/* Filter */}
        <div className="adminBilling__controls">
          <div className="adminBilling__filterGroup">
            <label className="adminBilling__filterLabel">Filter by Status:</label>
            <div className="adminBilling__filterButtons">
              {['All', ...statuses].map((status) => (
                <button
                  key={`filter_${status}`}
                  type="button"
                  className={`adminBilling__filterBtn ${filterStatus === status ? 'adminBilling__filterBtn--active' : ''}`}
                  onClick={() => setFilterStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="adminBilling__addManualBtn"
            onClick={() => setShowManualForm(!showManualForm)}
          >
            {showManualForm ? '✕ Cancel' : '+ Add Manual Order'}
          </button>
        </div>

        {/* Manual Order Form */}
        {showManualForm && (
          <div className="adminBilling__formContainer">
            <h3 className="adminBilling__formTitle">Create Manual Order</h3>
            
            <div className="adminBilling__formGrid">
              <div className="adminBilling__formGroup">
                <label className="adminBilling__formLabel">Customer Name *</label>
                <input
                  type="text"
                  className="adminBilling__formInput"
                  value={manualOrder.customerName}
                  onChange={(e) => handleManualOrderChange('customerName', e.target.value)}
                  placeholder="e.g., John Doe"
                />
              </div>
              <div className="adminBilling__formGroup">
                <label className="adminBilling__formLabel">Email *</label>
                <input
                  type="email"
                  className="adminBilling__formInput"
                  value={manualOrder.customerEmail}
                  onChange={(e) => handleManualOrderChange('customerEmail', e.target.value)}
                  placeholder="customer@example.com"
                />
              </div>
              <div className="adminBilling__formGroup">
                <label className="adminBilling__formLabel">Phone</label>
                <input
                  type="tel"
                  className="adminBilling__formInput"
                  value={manualOrder.customerPhone}
                  onChange={(e) => handleManualOrderChange('customerPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="9876543210"
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                />
              </div>
              <div className="adminBilling__formGroup adminBilling__formGroup--full">
                <label className="adminBilling__formLabel">Delivery Address *</label>
                <textarea
                  className="adminBilling__formTextarea"
                  value={manualOrder.deliveryAddress}
                  onChange={(e) => handleManualOrderChange('deliveryAddress', e.target.value)}
                  placeholder="Full delivery address"
                  rows="2"
                />
              </div>
            </div>

            {/* Items Section */}
            <div className="adminBilling__itemsSection">
              <h4 className="adminBilling__itemsTitle">Order Items</h4>
              
              {/* Table Header */}
              <div className="adminBilling__itemsTable">
                <div className="adminBilling__itemsHeader">
                  <div className="adminBilling__itemHeaderCol">Product *</div>
                  <div className="adminBilling__itemHeaderCol">Price</div>
                  <div className="adminBilling__itemHeaderCol">Qty *</div>
                  <div className="adminBilling__itemHeaderCol">Size</div>
                  <div className="adminBilling__itemHeaderCol">Total</div>
                  <div className="adminBilling__itemHeaderCol"></div>
                </div>

                {/* Items */}
                {manualOrder.items.map((item, index) => {
                  const price = getProductPrice(item.productId);
                  const total = calculateItemTotal(item.productId, item.quantity);
                  const sizes = getProductSizes(item.productId);
                  
                  return (
                    <div key={index} className="adminBilling__itemsRow">
                      <div className="adminBilling__itemCol">
                        <select
                          className="adminBilling__formSelect"
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                        >
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option key={product.id || product._id} value={product.id || product._id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="adminBilling__itemCol">
                        <span className="adminBilling__priceDisplay">
                          {price > 0 ? `₹${price}` : '—'}
                        </span>
                      </div>

                      <div className="adminBilling__itemCol">
                        <input
                          type="number"
                          className="adminBilling__formInput"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          placeholder="0"
                          min="1"
                        />
                      </div>

                      <div className="adminBilling__itemCol">
                        {sizes.length > 0 ? (
                          <select
                            className="adminBilling__formSelect"
                            value={item.size}
                            onChange={(e) => handleItemChange(index, 'size', e.target.value)}
                            required
                          >
                            <option value="">Select size *</option>
                            {sizes.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="adminBilling__sizeInputWrapper">
                            <input
                              type="text"
                              className="adminBilling__formInput"
                              value={item.size}
                              onChange={(e) => handleItemChange(index, 'size', e.target.value)}
                              placeholder="E.g., 40 x 50"
                              required
                            />
                            <div className="adminBilling__sizeHint">Required *</div>
                          </div>
                        )}
                      </div>

                      <div className="adminBilling__itemCol">
                        <span className="adminBilling__totalDisplay">
                          {total > 0 ? `₹${total.toFixed(2)}` : '₹0.00'}
                        </span>
                      </div>

                      <div className="adminBilling__itemCol">
                        <button
                          type="button"
                          className="adminBilling__removeItemBtn"
                          onClick={() => handleRemoveItem(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Item Button */}
              <button
                type="button"
                className="adminBilling__addItemBtn"
                onClick={handleAddItem}
              >
                + Add Item
              </button>

              {/* Order Total */}
              <div className="adminBilling__orderTotalRow">
                <div className="adminBilling__orderTotalLabel">Order Total:</div>
                <div className="adminBilling__orderTotalValue">
                  ₹{calculateOrderTotal().toFixed(2)}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="adminBilling__formActions">
              <button
                type="button"
                className="adminBilling__submitBtn"
                onClick={handleAddManualOrder}
              >
                Create Order
              </button>
              <button
                type="button"
                className="adminBilling__cancelBtn"
                onClick={() => setShowManualForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <section className="adminBilling__ordersSection">
          <h2 className="adminBilling__ordersTitle">Orders ({filteredOrders.length})</h2>
          
          {filteredOrders.length === 0 ? (
            <div className="adminBilling__emptyState">
              <p>No orders found for status: {filterStatus}</p>
            </div>
          ) : (
            <div className="adminBilling__ordersContainer">
              <div className="adminBilling__ordersList">
                {filteredOrders.map((order) => (
                  <div
                    key={order.orderId || order.id || order._id}
                    className={`adminBilling__orderItem ${selectedOrderId === (order.orderId || order.id || order._id) ? 'adminBilling__orderItem--selected' : ''}`}
                    onClick={() => handleSelectOrder(order.orderId || order.id || order._id)}
                  >
                    <div className="adminBilling__orderItemHeader">
                      <strong>Order #{order.id}</strong>
                      <span className={`adminBilling__orderStatus adminBilling__orderStatus--${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="adminBilling__orderItemDetails">
                      <div>
                        <strong>{order.name}</strong>
                        <p>{order.email}</p>
                      </div>
                      <div className="adminBilling__orderAmount">
                        ₹{order.totalAmount}
                      </div>
                    </div>
                    <div className="adminBilling__orderDate">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Order Details Panel */}
              {selectedOrder && (
                <div className="adminBilling__orderDetails">
                  <h3 className="adminBilling__detailsTitle">Order Details</h3>
                  
                  <div className="adminBilling__detailsSection">
                    <h4 className="adminBilling__detailsSubtitle">Order Information</h4>
                    <div className="adminBilling__detailsGrid">
                      <div>
                        <strong>Order ID:</strong> {selectedOrder.id}
                      </div>
                      <div>
                        <strong>Date:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}
                      </div>
                      <div>
                        <strong>Status:</strong> {selectedOrder.status}
                      </div>
                      <div>
                        <strong>Total Amount:</strong> ₹{selectedOrder.totalAmount}
                      </div>
                    </div>
                  </div>

                  <div className="adminBilling__detailsSection">
                    <h4 className="adminBilling__detailsSubtitle">Customer Information</h4>
                    <div className="adminBilling__detailsGrid">
                      <div>
                        <strong>Name:</strong> {selectedOrder.name}
                      </div>
                      <div>
                        <strong>Email:</strong> {selectedOrder.email}
                      </div>
                      <div>
                        <strong>Phone:</strong> {selectedOrder.phone}
                      </div>
                    </div>
                  </div>

                  <div className="adminBilling__detailsSection">
                    <h4 className="adminBilling__detailsSubtitle">Delivery Address</h4>
                    <p className="adminBilling__addressText">{selectedOrder.address}</p>
                  </div>

                  <div className="adminBilling__detailsSection">
                    <h4 className="adminBilling__detailsSubtitle">Items ({selectedOrder.items.length})</h4>
                    <div className="adminBilling__itemsTable">
                      <div className="adminBilling__tableHeader">
                        <div>Product</div>
                        <div>Qty</div>
                        <div>Price</div>
                        <div>Total</div>
                      </div>
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="adminBilling__tableRow">
                          <div>{item.name} {item.size && <span className="adminBilling__size">({item.size})</span>}</div>
                          <div>{item.quantity}</div>
                          <div>₹{item.price}</div>
                          <div>₹{(Number(item.price) * Number(item.quantity)).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="adminBilling__detailsSection">
                    <h4 className="adminBilling__detailsSubtitle">Update Status</h4>
                    <div className="adminBilling__statusButtons">
                      {statuses.map((status) => (
                        <button
                          key={`status_btn_${status}`}
                          type="button"
                          className={`adminBilling__statusBtn ${selectedOrder.status === status ? 'adminBilling__statusBtn--active' : ''}`}
                          onClick={() => handleUpdateOrderStatus(selectedOrder.orderId || selectedOrder.id || selectedOrder._id, status)}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminBilling;
