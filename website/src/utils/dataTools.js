const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const buildUserKey = (baseKey, userId) => `${baseKey}_${userId}`;

export const readCart = (userId) => {
  if (!userId) return [];
  const parsed = readJson(buildUserKey('dm_cart', userId), []);
  return Array.isArray(parsed) ? parsed : [];
};

export const writeCart = (userId, items) => {
  if (!userId) return;
  localStorage.setItem(buildUserKey('dm_cart', userId), JSON.stringify(items));
};

export const readProfile = (userId) => {
  if (!userId) return null;
  const parsed = readJson(buildUserKey('dm_profile', userId), null);
  return parsed || null;
};

export const writeProfile = (userId, profile) => {
  if (!userId) return;
  localStorage.setItem(buildUserKey('dm_profile', userId), JSON.stringify(profile));
};

export const readEnquiries = () => {
  const parsed = readJson('dm_enquiries', []);
  return Array.isArray(parsed) ? parsed : [];
};

export const writeEnquiries = (items) => {
  localStorage.setItem('dm_enquiries', JSON.stringify(items));
};

export const readUserOrders = (userId) => {
  if (!userId) return [];
  const parsed = readJson(buildUserKey('dm_orders', userId), []);
  return Array.isArray(parsed) ? parsed : [];
};

export const writeUserOrders = (userId, items) => {
  if (!userId) return;
  localStorage.setItem(buildUserKey('dm_orders', userId), JSON.stringify(items));
};

export const readAllOrders = () => {
  const parsed = readJson('dm_orders_all', []);
  return Array.isArray(parsed) ? parsed : [];
};

export const writeAllOrders = (items) => {
  localStorage.setItem('dm_orders_all', JSON.stringify(items));
};

export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.length || row.length) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current.trim());
    rows.push(row);
  }

  return rows.filter((values) => values.some((value) => value.length));
};

export const toCsv = (headers, rows) => {
  const escapeValue = (value) => {
    const safe = String(value ?? '');
    if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };

  const lines = [headers.map(escapeValue).join(',')];
  rows.forEach((row) => {
    lines.push(row.map(escapeValue).join(','));
  });
  return lines.join('\n');
};

export const downloadFile = (filename, content, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadPdfLike = (filename, lines) => {
  const content = lines.join('\n');
  // Create a proper text file with the catalog data
  const fileExt = filename.endsWith('.pdf') ? filename.replace('.pdf', '.txt') : filename;
  downloadFile(fileExt, content, 'text/plain');
};
// Billing and Stock Management
export const readNotifications = () => {
  const parsed = readJson('dm_notifications', []);
  return Array.isArray(parsed) ? parsed : [];
};

export const writeNotifications = (notifications) => {
  localStorage.setItem('dm_notifications', JSON.stringify(notifications));
};

export const reduceProductQuantity = (productId, quantityToReduce) => {
  const PRODUCTS_KEY = 'dm_products';
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    const products = raw ? JSON.parse(raw) : [];
    
    const updated = products.map((product) => {
      if (product.id === productId) {
        const newQuantity = Math.max(0, Number(product.quantity || 0) - quantityToReduce);
        
        // Check if quantity reaches 10 or below
        if (newQuantity <= 10 && newQuantity > 0) {
          const notifications = readNotifications();
          const existsNotif = notifications.find((n) => n.productId === productId);
          if (!existsNotif) {
            notifications.push({
              id: Date.now(),
              productId,
              productName: product.name,
              quantity: newQuantity,
              message: `Product "${product.name}" has low stock (${newQuantity} units). Please refill.`,
              createdAt: new Date().toISOString(),
              status: 'active'
            });
            writeNotifications(notifications);
          }
        }
        
        return { ...product, quantity: newQuantity };
      }
      return product;
    });
    
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
};

export const getLowStockProducts = () => {
  const PRODUCTS_KEY = 'dm_products';
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    const products = raw ? JSON.parse(raw) : [];
    return products.filter((p) => Number(p.quantity || 0) <= 10 && Number(p.quantity || 0) > 0);
  } catch {
    return [];
  }
};

export const dismissNotification = (notificationId) => {
  const notifications = readNotifications();
  const updated = notifications.filter((n) => n.id !== notificationId);
  writeNotifications(updated);
};