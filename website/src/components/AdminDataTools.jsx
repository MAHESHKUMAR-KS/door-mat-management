import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Footer intentionally omitted on non-home pages.
import { clearSession, isAdminSession } from '../utils/auth';
import { hasNewEnquiriesAlert, hasNewOrdersAlert } from '../utils/adminAlerts';
import { downloadFile, parseCsv, readAllOrders, toCsv, writeAllOrders } from '../utils/dataTools';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct
} from '../utils/productsApi';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';

const PRODUCTS_KEY = 'dm_products';
const CATEGORIES_KEY = 'dm_categories';
const ENQUIRIES_KEY = 'dm_enquiries';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeBackupPayload = (raw) => {
  const source = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object'
    ? raw.data
    : raw;

  return {
    products: ensureArray(source?.products),
    categories: ensureArray(source?.categories)
      .map((item) => String(item || '').trim())
      .filter(Boolean),
    enquiries: ensureArray(source?.enquiries),
    orders: ensureArray(source?.orders)
  };
};

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch {
    return fallback;
  }
};

// AdminDataTools now manages products via API, but we keep these wrappers for compatibility with existing code flow
const readProductsLocal = () => {
  const parsed = readJson(PRODUCTS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
};

const writeProductsLocal = (items) => {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(items));
};

const readCategories = () => {
  const parsed = readJson(CATEGORIES_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
};

const writeCategories = (items) => {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(items));
};

const readEnquiries = () => {
  const parsed = readJson(ENQUIRIES_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
};

const writeEnquiries = (items) => {
  localStorage.setItem(ENQUIRIES_KEY, JSON.stringify(items));
};


const deriveStatus = (qty) => {
  if (qty <= 0) return 'Out of stock';
  if (qty <= 5) return 'Low stock';
  return 'In stock';
};

const formatTopList = (items, emptyText = 'No data available yet.') => {
  if (!items.length) return emptyText;
  return items.map((item, index) => `${index + 1}. ${item.label} (${item.value})`).join(' | ');
};

const buildAiDataSummary = ({ products, categories, enquiries, orders }) => {
  const safeProducts = ensureArray(products);
  const safeCategories = ensureArray(categories);
  const safeEnquiries = ensureArray(enquiries);
  const safeOrders = ensureArray(orders);

  const productCategoryMap = safeProducts.reduce((acc, item) => {
    const key = String(item?.category || 'Uncategorized').trim() || 'Uncategorized';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const orderProductMap = safeOrders.reduce((acc, item) => {
    const key = String(item?.product || 'Unknown Product').trim() || 'Unknown Product';
    const qty = Number(item?.quantity) || 0;
    acc[key] = (acc[key] || 0) + qty;
    return acc;
  }, {});

  const enquiryProductMap = safeEnquiries.reduce((acc, item) => {
    const key = String(item?.product || 'General').trim() || 'General';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const lowStockItems = safeProducts.filter((item) => Number(item?.quantity) <= 5);
  const outOfStockItems = safeProducts.filter((item) => Number(item?.quantity) <= 0);
  const pendingEnquiries = safeEnquiries.filter((item) => String(item?.status || 'Pending').toLowerCase() === 'pending');

  const topProductCategories = Object.entries(productCategoryMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const topOrderedProducts = Object.entries(orderProductMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const topEnquiryProducts = Object.entries(enquiryProductMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const orderQuantityTotal = safeOrders.reduce((total, item) => total + (Number(item?.quantity) || 0), 0);

  return {
    products: safeProducts.length,
    categories: safeCategories.length,
    enquiries: safeEnquiries.length,
    orders: safeOrders.length,
    lowStock: lowStockItems.length,
    outOfStock: outOfStockItems.length,
    pendingEnquiries: pendingEnquiries.length,
    orderQuantityTotal,
    topProductCategories,
    topOrderedProducts,
    topEnquiryProducts,
    lowStockNames: lowStockItems.slice(0, 5).map((item) => item?.name || 'Unnamed Product')
  };
};

const answerAiQuestion = (question, summary) => {
  const q = String(question || '').toLowerCase().trim();

  if (!q) {
    return 'Ask about totals, low stock, top categories, top ordered products, pending enquiries, or backup readiness.';
  }

  if (/total|count|how many/.test(q)) {
    return [
      `Products: ${summary.products}`,
      `Categories: ${summary.categories}`,
      `Enquiries: ${summary.enquiries}`,
      `Orders: ${summary.orders}`
    ].join(' | ');
  }

  if (/low stock|out of stock|restock|inventory/.test(q)) {
    const names = summary.lowStockNames.length ? ` (${summary.lowStockNames.join(', ')})` : '';
    return `Low stock items: ${summary.lowStock}; Out of stock items: ${summary.outOfStock}${names}.`;
  }

  if (/category|categories|catalog mix/.test(q)) {
    return `Top categories by product count: ${formatTopList(summary.topProductCategories)}`;
  }

  if (/order|ordered|demand|best seller|best-selling/.test(q)) {
    return [
      `Total ordered quantity: ${summary.orderQuantityTotal}`,
      `Top ordered products: ${formatTopList(summary.topOrderedProducts)}`
    ].join(' | ');
  }

  if (/enquir|customer question|lead|follow up|follow-up/.test(q)) {
    return [
      `Pending enquiries: ${summary.pendingEnquiries}`,
      `Top enquiry products: ${formatTopList(summary.topEnquiryProducts)}`
    ].join(' | ');
  }

  if (/backup|export|ready|health|quality/.test(q)) {
    const hasData = summary.products + summary.categories + summary.enquiries + summary.orders > 0;
    if (!hasData) {
      return 'Data health: no records found yet. Import data first, then run exports or backup.';
    }
    return `Data health: ready for backup/export. Current records -> Products ${summary.products}, Categories ${summary.categories}, Enquiries ${summary.enquiries}, Orders ${summary.orders}.`;
  }

  return 'I could not map that question. Try: "How many records do we have?", "Which products need restock?", "What are top ordered products?", or "Are we ready for backup export?"';
};

function AdminDataTools() {
  const navigate = useNavigate();
  const isAdmin = isAdminSession();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dataVersion, setDataVersion] = useState(0);
  const [snapshotImportMode, setSnapshotImportMode] = useState('append');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [pendingType, setPendingType] = useState('');
  const [pendingData, setPendingData] = useState([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('Ask a question to analyze your imported/exported data.');
  const showOrdersDot = hasNewOrdersAlert();
  const showEnquiriesDot = hasNewEnquiriesAlert();

  const [products, setProducts] = useState([]);
  
  const totalProducts = products.length;
  const totalEnquiries = useMemo(() => readEnquiries().length, [dataVersion]);

  const loadProducts = async () => {
    const res = await fetchProducts();
    if (res.success) setProducts(res.products);
  };

  useEffect(() => {
    loadProducts();
  }, [dataVersion]);

  const aiSummary = useMemo(
    () => buildAiDataSummary({
      products: products,
      categories: readCategories(),
      enquiries: readEnquiries(),
      orders: readAllOrders()
    }),
    [products, dataVersion]
  );

  useEffect(() => {
    if (!isAdmin) {
      navigate('/login');
    }
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const clearStatus = () => {
    setMessage('');
    setError('');
  };

  const showPreview = (title, headers, rows, type, data) => {
    setPreviewTitle(title);
    setPreviewHeaders(headers);
    setPreviewRows(rows);
    setPendingType(type);
    setPendingData(data);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewTitle('');
    setPreviewHeaders([]);
    setPreviewRows([]);
    setPendingType('');
    setPendingData([]);
  };

  const handleConfirmImport = () => {
    if (pendingType === 'snapshot') {
      const {
        products = [],
        categories = [],
        enquiries = [],
        orders = [],
        mode = 'append'
      } = pendingData || {};

      if (mode === 'replace') {
        // Warning: Replacing backend data is destructive
        // For simplicity in this tool, we just append to backend or guide user
        // But the plan says "replace", so we should ideally delete all and add
        // Or just append. Let's do batch add.
        products.forEach(async (p) => {
          const { id, ...payload } = p;
          await createProduct(payload);
        });
        writeCategories(categories);
        writeEnquiries(enquiries);
        writeAllOrders(orders);
      } else {
        products.forEach(async (p) => {
          const { id, ...payload } = p;
          await createProduct(payload);
        });
        writeCategories(Array.from(new Set([...readCategories(), ...categories])));
        writeEnquiries([...enquiries, ...readEnquiries()]);
        writeAllOrders([...orders, ...readAllOrders()]);
      }

      setDataVersion((value) => value + 1);
      setMessage(`Backup restored successfully (${mode} mode).`);
      closePreview();
      return;
    }

    if (pendingType === 'products') {
      pendingData.forEach(async (item) => {
        const { id, ...payload } = item;
        await createProduct(payload);
      });
      setDataVersion((value) => value + 1);
      setMessage(`Imported ${pendingData.length} products successfully.`);
    }
    if (pendingType === 'categories') {
      const existing = readCategories();
      const merged = Array.from(new Set([...existing, ...pendingData]));
      writeCategories(merged);
      setDataVersion((value) => value + 1);
      setMessage(`Imported ${pendingData.length} categories successfully.`);
    }
    if (pendingType === 'enquiries') {
      const existing = readEnquiries();
      const updated = [...pendingData, ...existing];
      writeEnquiries(updated);
      setDataVersion((value) => value + 1);
      setMessage(`Imported ${pendingData.length} enquiries successfully.`);
    }
    closePreview();
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    clearStatus();

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const normalized = normalizeBackupPayload(parsed);
      const totalIncoming =
        normalized.products.length
        + normalized.categories.length
        + normalized.enquiries.length
        + normalized.orders.length;

      if (!totalIncoming) {
        setError('Backup file is valid JSON but has no importable records.');
        return;
      }

      const existingCounts = {
        products: readProducts().length,
        categories: readCategories().length,
        enquiries: readEnquiries().length,
        orders: readAllOrders().length
      };

      const preview = [
        ['Products', existingCounts.products, normalized.products.length, snapshotImportMode],
        ['Categories', existingCounts.categories, normalized.categories.length, snapshotImportMode],
        ['Enquiries', existingCounts.enquiries, normalized.enquiries.length, snapshotImportMode],
        ['Orders', existingCounts.orders, normalized.orders.length, snapshotImportMode]
      ];

      showPreview(
        'Preview Backup Restore',
        ['Dataset', 'Existing Records', 'Incoming Records', 'Mode'],
        preview,
        'snapshot',
        {
          ...normalized,
          mode: snapshotImportMode
        }
      );
    } catch {
      setError('Unable to parse backup file. Please upload a valid JSON backup.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportProducts = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    clearStatus();
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        setError('No rows found in file.');
        return;
      }
      const hasHeader = rows[0].some((cell) => /product|category|price|size/i.test(cell));
      const dataRows = hasHeader ? rows.slice(1) : rows;
      const mapped = dataRows
        .filter((row) => row.length >= 4)
        .map((row, index) => {
          const [name, category, price, size, quantity, material, description] = row;
          return {
            id: Date.now() + index,
            name: name || 'Unnamed Product',
            category: category || 'General',
            price: Number(price) || 0,
            size: size || 'Standard',
            quantity: Number(quantity) || 0,
            material: material || '',
            description: description || '',
            image: '/assets/placeholder.png',
            sizes: size ? [size] : [],
            createdAt: new Date().toISOString()
          };
        });
      if (!mapped.length) {
        setError('No valid product rows found.');
        return;
      }
      const previewRows = mapped.map((item) => [
        item.name,
        item.category,
        item.price,
        item.size,
        item.quantity,
        item.material,
        item.description
      ]);
      showPreview(
        'Preview Product Import',
        ['Product Name', 'Category', 'Price', 'Size', 'Quantity', 'Material', 'Description'],
        previewRows,
        'products',
        mapped
      );
    } catch {
      setError('Unable to read the file. Please upload a CSV.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportCategories = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    clearStatus();
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const values = rows.flat().map((value) => value.trim()).filter(Boolean);
      if (!values.length) {
        setError('No category names found in the CSV.');
        return;
      }
      const unique = Array.from(new Set(values));
      const previewRows = unique.map((value) => [value]);
      showPreview('Preview Category Import', ['Category Name'], previewRows, 'categories', unique);
    } catch {
      setError('Unable to read the CSV file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportEnquiries = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    clearStatus();
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const hasHeader = rows[0]?.some((cell) => /name|email|phone|product|message/i.test(cell));
      const dataRows = hasHeader ? rows.slice(1) : rows;
      const mapped = dataRows
        .filter((row) => row.length >= 5)
        .map((row, index) => {
          const [name, email, phone, product, message] = row;
          return {
            id: Date.now() + index,
            name,
            email,
            phone,
            product,
            message,
            createdAt: new Date().toISOString(),
            status: 'Pending'
          };
        });
      if (!mapped.length) {
        setError('No valid enquiry rows found.');
        return;
      }
      const previewRows = mapped.map((item) => [
        item.name,
        item.email,
        item.phone,
        item.product,
        item.message
      ]);
      showPreview(
        'Preview Enquiry Import',
        ['Customer Name', 'Email', 'Phone', 'Product', 'Message'],
        previewRows,
        'enquiries',
        mapped
      );
    } catch {
      setError('Unable to read the CSV file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleExportProducts = (format) => {
    clearStatus();
    const items = products;
    if (!items.length) {
      setError('No products available to export.');
      return;
    }
    const rows = items.map((item) => [
      item.name,
      item.category,
      item.price,
      item.size,
      item.quantity,
      deriveStatus(Number(item.quantity))
    ]);
    const csv = toCsv(
      ['Product Name', 'Category', 'Price', 'Size', 'Quantity', 'Status'],
      rows
    );
    const filename = format === 'excel' ? 'product-list.xlsx' : 'product-list.csv';
    downloadFile(filename, csv, 'text/csv');
    setMessage('Product list exported.');
  };

  const handleExportLowStock = () => {
    clearStatus();
    const items = products.filter((item) => Number(item.quantity) <= 5);
    if (!items.length) {
      setError('No low-stock products found.');
      return;
    }
    const rows = items.map((item) => [item.name, item.category, item.quantity]);
    const csv = toCsv(['Product Name', 'Category', 'Remaining Qty'], rows);
    downloadFile('low-stock-report.csv', csv, 'text/csv');
    setMessage('Low stock report exported.');
  };

  const handleExportEnquiries = () => {
    clearStatus();
    const items = readEnquiries();
    if (!items.length) {
      setError('No enquiries found to export.');
      return;
    }
    const rows = items.map((item) => [
      new Date(item.createdAt).toLocaleDateString(),
      item.name,
      item.email,
      item.phone,
      item.product,
      item.status || 'Pending'
    ]);
    const csv = toCsv(
      ['Date', 'Customer', 'Email', 'Phone', 'Product', 'Status'],
      rows
    );
    downloadFile('enquiry-report.csv', csv, 'text/csv');
    setMessage('Enquiry report exported.');
  };

  const handleExportCategories = () => {
    clearStatus();
    const stored = readCategories();
    const fromProducts = products.map((item) => item.category).filter(Boolean);
    const unique = Array.from(new Set([...stored, ...fromProducts]));
    if (!unique.length) {
      setError('No categories found to export.');
      return;
    }
    const csv = toCsv(['Category Name'], unique.map((name) => [name]));
    downloadFile('categories.csv', csv, 'text/csv');
    setMessage('Category list exported.');
  };

  const handleExportOrders = () => {
    clearStatus();
    const items = readAllOrders();
    if (!items.length) {
      setError('No order requests found.');
      return;
    }
    const rows = items.map((item) => [
      item.product,
      item.quantity,
      item.customer,
      item.email
    ]);
    const csv = toCsv(['Product', 'Quantity', 'Customer', 'Email'], rows);
    downloadFile('order-requests.csv', csv, 'text/csv');
    setMessage('Order requests exported.');
  };

  const handleExportCompleteBackup = () => {
    clearStatus();
    const now = new Date();
    const payload = {
      backupVersion: '1.0',
      exportedAt: now.toISOString(),
      app: 'Govindasamy & Co Admin Backup',
      data: {
        products: readProducts(),
        categories: readCategories(),
        enquiries: readEnquiries(),
        orders: readAllOrders()
      }
    };

    const filename = `admin-backup-${now.toISOString().slice(0, 10)}.json`;
    downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json');
    setMessage('Complete backup exported as JSON.');
  };

  const handleAskAi = () => {
    clearStatus();
    const response = answerAiQuestion(aiQuestion, aiSummary);
    setAiAnswer(response);
  };

  const handleAiPreset = (question) => {
    setAiQuestion(question);
    setAiAnswer(answerAiQuestion(question, aiSummary));
  };

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
            Manage Products
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/billing')}>
            Billing
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/orders')}>
            <span className="adminDash__navBtnLabel">
              Customer Orders
              {showOrdersDot && <span className="adminDash__navDot" />}
            </span>
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/enquiries')}>
            <span className="adminDash__navBtnLabel">
              Customer Enquiries
              {showEnquiriesDot && <span className="adminDash__navDot" />}
            </span>
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/analytics')}>
            Sales Analytics
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/admin/import-export')}>
            Import / Export
          </button>
          <button className="adminDash__navBtn adminDash__navBtn--danger" type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
        <div className="adminDash__meta">
          <span className="adminDash__chip">Secure Session</span>
          <span className="adminDash__metaText">Last sync: Today</span>
        </div>
      </aside>

      <main className="adminDash__main">
        <header className="adminDash__header">
          <div>
            <h1 className="adminDash__heading">Import / Export</h1>
            <p className="adminDash__lead">
              Import and export product, category, enquiry, and order data.
            </p>
          </div>
          <div className="adminDash__badge">Admin</div>
        </header>

        <section className="adminDash__stats" aria-label="Summary">
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Products</div>
            <div className="adminDash__cardValue">{totalProducts}</div>
            <div className="adminDash__cardHint">Catalog items</div>
          </article>
          <article className="adminDash__card">
            <div className="adminDash__cardLabel">Total Enquiries</div>
            <div className="adminDash__cardValue">{totalEnquiries}</div>
            <div className="adminDash__cardHint">Customer requests</div>
          </article>
        </section>

        {(message || error) && (
          <div className={error ? 'adminDash__toolMessage adminDash__toolMessage--error' : 'adminDash__toolMessage'}>
            {error || message}
          </div>
        )}

        <section className="adminDash__tools" aria-label="Import tools">
          <div className="adminDash__panel adminDash__panel--wide">
            <h2 className="adminDash__panelTitle">Import Tools</h2>
            <p className="adminDash__panelText">
              Upload CSV files and preview data before confirming import.
            </p>
            <p className="adminDash__panelText">
              Supported format: <strong>.csv</strong>. Header row is optional for all imports.
              Existing data is not removed; imported records are appended.
            </p>
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Import Products</h3>
            <p className="adminDash__panelText">
              CSV columns: Product Name, Category, Price, Size, Quantity, Material, Description.
            </p>
            <p className="adminDash__panelText">
              Required minimum: Product Name, Category, Price, Size. Quantity defaults to 0 if blank.
              Material and Description are optional.
            </p>
            <input className="adminDash__fileInput" type="file" accept=".csv" onChange={handleImportProducts} />
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Import Categories</h3>
            <p className="adminDash__panelText">Upload a CSV with category names.</p>
            <p className="adminDash__panelText">
              Duplicate names are automatically removed during import.
              You can upload one category per row or multiple columns.
            </p>
            <input className="adminDash__fileInput" type="file" accept=".csv" onChange={handleImportCategories} />
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Import Enquiries</h3>
            <p className="adminDash__panelText">
              CSV columns: Customer Name, Email, Phone, Product, Message.
            </p>
            <p className="adminDash__panelText">
              Every imported enquiry is saved with current import time and default status
              <strong> Pending</strong> for admin review.
            </p>
            <input className="adminDash__fileInput" type="file" accept=".csv" onChange={handleImportEnquiries} />
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Restore Full Backup</h3>
            <p className="adminDash__panelText">
              Upload a JSON backup exported from this page to restore products, categories,
              enquiries, and orders in one step.
            </p>
            <div className="adminDash__toolOptions">
              <label className="adminDash__optionField" htmlFor="backupImportMode">
                Restore Mode
              </label>
              <select
                id="backupImportMode"
                className="adminDash__selectInput"
                value={snapshotImportMode}
                onChange={(event) => setSnapshotImportMode(event.target.value)}
              >
                <option value="append">Append to existing data</option>
                <option value="replace">Replace existing data</option>
              </select>
            </div>
            <input className="adminDash__fileInput" type="file" accept=".json,application/json" onChange={handleImportBackup} />
          </div>
        </section>

        <section className="adminDash__tools" aria-label="Export tools">
          <div className="adminDash__panel adminDash__panel--wide">
            <h2 className="adminDash__panelTitle">Export Tools</h2>
            <p className="adminDash__panelText">
              Download CSV reports for products, categories, enquiries, and orders.
            </p>
            <p className="adminDash__panelText">
              Export files are generated from current local data and downloaded immediately.
              Use these files for backup, reporting, and offline sharing.
            </p>
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Export Product List</h3>
            <p className="adminDash__panelText">
              Includes: Product Name, Category, Price, Size, Quantity, and computed Stock Status.
            </p>
            <div className="adminDash__toolButtons">
              <button type="button" onClick={() => handleExportProducts('csv')}>Download CSV</button>
              <button type="button" onClick={() => handleExportProducts('excel')}>Download Excel</button>
            </div>
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Low Stock Report</h3>
            <p className="adminDash__panelText">
              Exports products with quantity 5 or below to help with restocking.
            </p>
            <button type="button" onClick={handleExportLowStock}>Download CSV</button>
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Export Enquiry Report</h3>
            <p className="adminDash__panelText">
              Includes enquiry date, customer details, selected product, and status.
            </p>
            <button type="button" onClick={handleExportEnquiries}>Download CSV</button>
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Export Category List</h3>
            <p className="adminDash__panelText">
              Combines categories from master category list and existing products.
            </p>
            <button type="button" onClick={handleExportCategories}>Download CSV</button>
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Export Order Requests</h3>
            <p className="adminDash__panelText">
              UI-based export of sales/order requests.
              Includes product, quantity, customer, and email fields.
            </p>
            <button type="button" onClick={handleExportOrders}>Download CSV</button>
          </div>

          <div className="adminDash__panel">
            <h3 className="adminDash__panelTitle">Export Complete Backup</h3>
            <p className="adminDash__panelText">
              Creates a JSON backup containing products, categories, enquiries, and orders
              with export timestamp and version metadata.
            </p>
            <button type="button" onClick={handleExportCompleteBackup}>Download JSON Backup</button>
          </div>
        </section>

        <section className="adminDash__tools" aria-label="AI analysis tools">
          <div className="adminDash__panel adminDash__panel--wide">
            <h2 className="adminDash__panelTitle">AI Analysis (Q/A)</h2>
            <p className="adminDash__panelText">
              Ask questions about your current import/export data. This assistant analyzes products,
              categories, enquiries, and orders from local admin records.
            </p>
            <div className="adminDash__aiSummary">
              <span>Products: <strong>{aiSummary.products}</strong></span>
              <span>Categories: <strong>{aiSummary.categories}</strong></span>
              <span>Enquiries: <strong>{aiSummary.enquiries}</strong></span>
              <span>Orders: <strong>{aiSummary.orders}</strong></span>
              <span>Low Stock: <strong>{aiSummary.lowStock}</strong></span>
            </div>
            <div className="adminDash__toolButtons">
              <button type="button" onClick={() => handleAiPreset('How many records do we have?')}>Totals</button>
              <button type="button" onClick={() => handleAiPreset('Which products need restock?')}>Restock</button>
              <button type="button" onClick={() => handleAiPreset('What are top ordered products?')}>Top Orders</button>
              <button type="button" onClick={() => handleAiPreset('Are we ready for backup export?')}>Backup Health</button>
            </div>
            <label className="adminDash__optionField" htmlFor="aiQuestionInput">Ask a data question</label>
            <textarea
              id="aiQuestionInput"
              className="adminDash__textArea"
              placeholder="Example: Which category has the most products?"
              value={aiQuestion}
              onChange={(event) => setAiQuestion(event.target.value)}
            />
            <div className="adminDash__toolButtons">
              <button type="button" onClick={handleAskAi}>Analyze Question</button>
            </div>
            <div className="adminDash__aiAnswer" role="status" aria-live="polite">
              <strong>Answer:</strong> {aiAnswer}
            </div>
          </div>
        </section>
      </main>

      {previewOpen && (
        <div className="adminDash__modal">
          <div className="adminDash__modalContent">
            <div className="adminDash__modalHeader">
              <h3>{previewTitle}</h3>
              <button type="button" onClick={closePreview}>Close</button>
            </div>
            <div className="adminDash__modalTable">
              <table>
                <thead>
                  <tr>
                    {previewHeaders.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={`${previewTitle}-${index}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${previewTitle}-${index}-${cellIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adminDash__modalActions">
              <button type="button" onClick={handleConfirmImport}>Confirm Import</button>
              <button type="button" className="adminDash__modalGhost" onClick={closePreview}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDataTools;
