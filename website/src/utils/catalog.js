import { fetchProducts as fetchProductsApi } from './productsApi';

const PRODUCTS_KEY = 'dm_products';
const WISHLIST_KEY = 'dm_wishlist';
const buildUserKey = (baseKey, userId) => `${baseKey}_${userId}`;

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const fetchProducts = async () => {
  return await fetchProductsApi();
};

export const readProducts = () => {
  const parsed = readJson(PRODUCTS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
};

export const readWishlist = (userId) => {
  if (!userId) return [];
  const parsed = readJson(buildUserKey(WISHLIST_KEY, userId), []);
  return Array.isArray(parsed) ? parsed : [];
};

export const writeWishlist = (userId, ids) => {
  if (!userId) return;
  localStorage.setItem(buildUserKey(WISHLIST_KEY, userId), JSON.stringify(ids));
};

export const isWishlisted = (productId, list) => {
  return list.includes(productId);
};

export const toggleWishlist = (productId, list) => {
  if (list.includes(productId)) {
    return list.filter((id) => id !== productId);
  }
  return [productId, ...list];
};
