const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const toJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return { success: false, message: 'Invalid server response' };
  }
};

export const fetchProducts = async () => {
  const response = await fetch(`${API_BASE}/api/products`);
  return toJson(response);
};

export const createProduct = async (productData) => {
  const response = await fetch(`${API_BASE}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  });
  return toJson(response);
};

export const updateProduct = async (id, productData) => {
  const response = await fetch(`${API_BASE}/api/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData)
  });
  return toJson(response);
};

export const deleteProduct = async (id) => {
  const response = await fetch(`${API_BASE}/api/products/${id}`, {
    method: 'DELETE'
  });
  return toJson(response);
};
