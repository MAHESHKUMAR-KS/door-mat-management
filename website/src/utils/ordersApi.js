const API_BASE = import.meta.env.VITE_API_URL || '';

const toJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return { success: false, message: 'Invalid server response' };
  }
};

export const getPaymentConfig = async () => {
  const response = await fetch(`${API_BASE}/api/payment/config`);
  return toJson(response);
};

export const createPaymentOrder = async ({ amount, receipt, customer, paymentMethod }) => {
  const response = await fetch(`${API_BASE}/api/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, receipt, customer, paymentMethod })
  });
  return toJson(response);
};

export const verifyPayment = async (payload) => {
  const response = await fetch(`${API_BASE}/api/payment/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return toJson(response);
};

export const createOfflineOrder = async (payload) => {
  const response = await fetch(`${API_BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return toJson(response);
};

export const confirmOnlineOrder = async (payload) => {
  const response = await fetch(`${API_BASE}/api/orders/confirm-online`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return toJson(response);
};

export const fetchUserOrders = async (userId) => {
  const response = await fetch(`${API_BASE}/api/orders/user/${encodeURIComponent(userId)}`);
  return toJson(response);
};

export const fetchAllOrders = async () => {
  const response = await fetch(`${API_BASE}/api/orders`);
  return toJson(response);
};

export const updateOrderStatus = async (orderId, status) => {
  const response = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return toJson(response);
};
