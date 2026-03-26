import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Footer intentionally omitted on non-home pages.
import { clearSession, isAdminSession } from '../utils/auth';
import { hasNewEnquiriesAlert, hasNewOrdersAlert } from '../utils/adminAlerts';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct
} from '../utils/productsApi';
import * as XLSX from 'xlsx';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';
import './ProductManagement.css';

const STORAGE_KEY = 'dm_products';

const readProducts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeProducts = (products) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
};

const emptyForm = {
  name: '',
  category: '',
  price: '',
  size: '',
  material: '',
  quantity: '',
  image: '',
  description: '',
  sizes: ''
};

const isValidImageUrl = (value) => {
  if (!value) return false;
  return (
    /^https?:\/\//i.test(value) ||
    /^data:image\//i.test(value) ||
    /^\//.test(value) ||
    /^\.\//.test(value)
  );
};

function ProductManagement() {
  const navigate = useNavigate();
  const isAdmin = isAdminSession();
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkQuantity, setBulkQuantity] = useState('');
  const [undoHistory, setUndoHistory] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const showOrdersDot = hasNewOrdersAlert();
  const showEnquiriesDot = hasNewEnquiriesAlert();
  const imageInputRef = useRef(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/login');
      return;
    }

    const loadAndMigrate = async () => {
      const response = await fetchProducts();
      let serverProducts = response.success ? response.products : [];

      // Migration Logic: If localStorage has products, upload them to server
      const localRaw = localStorage.getItem(STORAGE_KEY);
      const localProducts = localRaw ? JSON.parse(localRaw) : [];

      if (localProducts.length > 0) {
        console.log('Migrating local products to server...');
        for (const lp of localProducts) {
          // Check if product already exists on server by name (simple check)
          const exists = serverProducts.find((sp) => sp.name === lp.name);
          if (!exists) {
            const { id, ...payload } = lp; // Remove local numeric ID
            await createProduct(payload);
          }
        }
        // Clear local storage after migration attempt
        localStorage.removeItem(STORAGE_KEY);
        // Reload from server
        const finalResponse = await fetchProducts();
        serverProducts = finalResponse.success ? finalResponse.products : [];
      }

      setProducts(serverProducts);
    };

    loadAndMigrate();

    const storedUndo = localStorage.getItem('dm_products_undo');
    setUndoHistory(storedUndo ? JSON.parse(storedUndo) : []);
  }, [isAdmin, navigate]);

  const updateUndoHistory = (newHistory) => {
    const limited = newHistory.slice(0, 20);
    setUndoHistory(limited);
    localStorage.setItem('dm_products_undo', JSON.stringify(limited));
  };

  const totals = useMemo(() => products.length, [products]);
  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    return products.filter((product) => {
      const byCategory = filterCategory === 'All' || product.category === filterCategory;
      const byQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);
      return byCategory && byQuery;
    });
  }, [products, filterCategory, filterQuery]);

  const isAllFilteredSelected =
    filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.includes(product.id));

  if (!isAdmin) return null;

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const validate = (values) => {
    const nextErrors = {};
    if (!values.name.trim()) nextErrors.name = 'Product name is required';
    if (!values.category.trim()) nextErrors.category = 'Category is required';
    if (!values.size.trim()) nextErrors.size = 'Size is required';

    const priceValue = Number(values.price);
    if (!values.price) nextErrors.price = 'Price is required';
    else if (Number.isNaN(priceValue) || priceValue <= 0) {
      nextErrors.price = 'Price must be greater than 0';
    }

    const quantityValue = Number(values.quantity);
    if (values.quantity === '') nextErrors.quantity = 'Quantity is required';
    else if (!Number.isInteger(quantityValue) || quantityValue < 0) {
      nextErrors.quantity = 'Quantity must be 0 or more';
    }

    if (!values.image.trim()) nextErrors.image = 'Product photo is required';
    else if (!isValidImageUrl(values.image.trim())) {
      nextErrors.image = 'Use a valid image file or URL';
    }

    return nextErrors;
  };

  const clearImportStatus = () => {
    setImportMessage('');
    setImportError('');
  };

  const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '');

  const handleImportProducts = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    clearImportStatus();

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setImportError('No sheets found in the file.');
        return;
      }
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      if (!rows.length) {
        setImportError('No rows found in the sheet.');
        return;
      }

      const imported = [];
      let skippedRows = 0;

      rows.forEach((row, index) => {
        const normalized = Object.fromEntries(
          Object.keys(row).map((key) => [normalizeKey(key), row[key]])
        );
        const readField = (keys) => {
          for (const key of keys) {
            const value = normalized[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
              return value;
            }
          }
          return '';
        };

        const name = String(readField(['name', 'productname'])).trim();
        const category = String(readField(['category'])).trim();
        const priceValue = Number(readField(['price', 'unitprice']));
        const size = String(readField(['size'])).trim();
        const quantityValue = Number(readField(['quantity', 'qty', 'stock']));
        const image = String(readField(['image', 'imageurl', 'photo'])).trim();

        if (!name || !category || !size || !image) {
          skippedRows += 1;
          return;
        }
        if (!Number.isFinite(priceValue) || priceValue <= 0) {
          skippedRows += 1;
          return;
        }
        if (!Number.isInteger(quantityValue) || quantityValue < 0) {
          skippedRows += 1;
          return;
        }

        const rawSizes = String(readField(['sizes', 'availablesizes'])).trim();
        const sizes = rawSizes
          ? rawSizes.split(',').map((item) => item.trim()).filter(Boolean)
          : [];

        const createdValue = readField(['createdat', 'created', 'date']);
        const parsedDate = createdValue instanceof Date ? createdValue : new Date(createdValue);
        const createdAt = Number.isNaN(parsedDate.getTime())
          ? new Date().toISOString()
          : parsedDate.toISOString();

        imported.push({
          id: Date.now() + index,
          name,
          category,
          price: priceValue,
          size,
          material: String(readField(['material'])).trim(),
          quantity: quantityValue,
          image,
          description: String(readField(['description'])).trim(),
          sizes,
          createdAt
        });
      });

      if (!imported.length) {
        setImportError('No valid product rows were found. Check required columns.');
        return;
      }

      const updated = [...imported, ...products];
      setProducts(updated);
      
      // Batch create on server
      for (const item of imported) {
        const { id, ...payload } = item;
        await createProduct(payload);
      }
      
      // Refresh from server to get BSON IDs
      const finalResponse = await fetchProducts();
      if (finalResponse.success) {
        setProducts(finalResponse.products);
      }

      setImportMessage(`Imported ${imported.length} products. Skipped ${skippedRows} invalid rows.`);
    } catch (error) {
      setImportError('Unable to import the Excel file. Please check the format.');
    } finally {
      event.target.value = '';
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'Please select an image file' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setFormData((prev) => ({ ...prev, image: result }));
      setErrors((prev) => ({ ...prev, image: '' }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (editingId) {
      const payload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        price: Number(formData.price),
        size: formData.size.trim(),
        material: formData.material.trim(),
        quantity: Number(formData.quantity),
        image: formData.image.trim(),
        description: formData.description.trim(),
        sizes: formData.sizes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      };

      updateProduct(editingId, payload).then((res) => {
        if (res.success) {
          fetchProducts().then((latest) => {
            if (latest.success) setProducts(latest.products);
          });
        }
      });
    } else {
      const nextProduct = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        price: Number(formData.price),
        size: formData.size.trim(),
        material: formData.material.trim(),
        quantity: Number(formData.quantity),
        image: formData.image.trim(),
        description: formData.description.trim(),
        sizes: formData.sizes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      };

      createProduct(nextProduct).then((res) => {
        if (res.success) {
          fetchProducts().then((latest) => {
            if (latest.success) setProducts(latest.products);
          });
        }
      });
    }

    setFormData(emptyForm);
    setEditingId(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleEdit = (product) => {
    setFormData({
      name: product.name,
      category: product.category,
      price: String(product.price),
      size: product.size,
      material: product.material || '',
      quantity: String(product.quantity),
      image: product.image,
      description: product.description || '',
      sizes: Array.isArray(product.sizes) ? product.sizes.join(', ') : ''
    });
    setEditingId(product.id);
    setErrors({});
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleDelete = async (productId) => {
    const target = products.find((product) => (product.id || product._id) === productId);
    if (!target) return;
    const confirmed = window.confirm(`Delete "${target.name}"?`);
    if (!confirmed) return;

    const response = await deleteProduct(productId);
    if (response.success) {
      const finalRes = await fetchProducts();
      if (finalRes.success) setProducts(finalRes.products);
      setSelectedIds((prev) => prev.filter((id) => id !== productId));
      updateUndoHistory([
        { product: target, deletedAt: new Date().toISOString(), action: 'delete' },
        ...undoHistory
      ]);
    }
  };

  const handleToggleSelect = (productId) => {
    setSelectedIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleToggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredSet = new Set(filteredProducts.map((product) => product.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredSet.has(id)));
      return;
    }
    const merged = new Set(selectedIds);
    filteredProducts.forEach((product) => merged.add(product.id));
    setSelectedIds(Array.from(merged));
  };

  const handleBulkDelete = () => {
    if (!selectedIds.length) {
      window.alert('Select at least one product to delete.');
      return;
    }
    const confirmed = window.confirm(`Delete ${selectedIds.length} selected products?`);
    if (!confirmed) return;
    const selectedSet = new Set(selectedIds);
    const deletedProducts = products.filter((product) => selectedSet.has(product.id));
    const updated = products.filter((product) => !selectedSet.has(product.id));
    setProducts(updated);
    writeProducts(updated);
    setSelectedIds([]);
    const newEntries = deletedProducts.map((product) => ({
      product,
      deletedAt: new Date().toISOString(),
      action: 'delete'
    }));
    updateUndoHistory([...newEntries, ...undoHistory]);
  };

  const handleBulkEdit = () => {
    if (!selectedIds.length) {
      window.alert('Select at least one product to edit.');
      return;
    }
    const nextCategory = bulkCategory.trim();
    const hasQuantityInput = bulkQuantity !== '';
    const quantityValue = Number(bulkQuantity);

    if (!nextCategory && !hasQuantityInput) {
      window.alert('Enter category or quantity to apply bulk edit.');
      return;
    }
    if (hasQuantityInput && (!Number.isInteger(quantityValue) || quantityValue < 0)) {
      window.alert('Quantity must be a whole number 0 or greater.');
      return;
    }

    const selectedSet = new Set(selectedIds);
    const updated = products.map((product) => {
      if (!selectedSet.has(product.id)) return product;
      return {
        ...product,
        category: nextCategory || product.category,
        quantity: hasQuantityInput ? quantityValue : product.quantity
      };
    });

    setProducts(updated);
    writeProducts(updated);
    setBulkCategory('');
    setBulkQuantity('');
  };

  const handleRestoreProduct = (entry) => {
    const { product } = entry;
    const exists = products.find((p) => p.id === product.id);
    if (exists) {
      window.alert(`Product "${product.name}" already exists in catalog.`);
      return;
    }
    const updated = [product, ...products];
    setProducts(updated);
    writeProducts(updated);
    updateUndoHistory(undoHistory.filter((_, index) => undoHistory.indexOf(entry) !== index));
    window.alert(`Restored "${product.name}" to catalog.`);
  };

  const handleClearUndoHistory = () => {
    if (!window.confirm('Clear all undo history? This cannot be undone.')) return;
    updateUndoHistory([]);
  };

  const handleDeleteByDate = () => {
    if (!dateFrom && !dateTo) {
      window.alert('Select at least a start or end date.');
      return;
    }
    const fromDate = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toDate = dateTo ? new Date(dateTo).getTime() : Date.now();
    const productsInRange = products.filter((product) => {
      const createdTime = product.createdAt ? new Date(product.createdAt).getTime() : 0;
      return createdTime >= fromDate && createdTime <= toDate;
    });

    if (!productsInRange.length) {
      window.alert('No products found in the selected date range.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${productsInRange.length} product(s) created between ${dateFrom || 'start'} and ${dateTo || 'now'}?`
    );
    if (!confirmed) return;

    const updated = products.filter((product) => {
      const createdTime = product.createdAt ? new Date(product.createdAt).getTime() : 0;
      return !(createdTime >= fromDate && createdTime <= toDate);
    });

    setProducts(updated);
    writeProducts(updated);
    const newEntries = productsInRange.map((product) => ({
      product,
      deletedAt: new Date().toISOString(),
      action: 'delete'
    }));
    updateUndoHistory([...newEntries, ...undoHistory]);
    setDateFrom('');
    setDateTo('');
    window.alert(`Deleted ${productsInRange.length} product(s). Use undo to restore.`);
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setErrors({});
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
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
      </aside>

      <main className="adminDash__main">
        <div className="productModule productModule--embedded">
          <header className="productModule__header">
            <div>
              <p className="productModule__eyebrow">Admin</p>
              <h1 className="productModule__title">Product Management</h1>
              <p className="productModule__subtitle">
                Keep the catalog updated and monitor inventory levels.
              </p>
            </div>
            <div className="productModule__summary">
              <div className="productModule__summaryLabel">Total Products</div>
              <div className="productModule__summaryValue">{totals}</div>
              <button
                className="productModule__backBtn"
                type="button"
                onClick={() => navigate('/dashboard')}
              >
                Back to Dashboard
              </button>
            </div>
          </header>

          <section className="productModule__content">
            <form className="productModule__form productModule__form--compact" onSubmit={handleSubmit}>
              <div className="productModule__formHeader">
                <div>
                  <h2>{editingId ? 'Edit Product' : 'Add Product'}</h2>
                  <p>Fill in the product details and save.</p>
                </div>
                <div className="productModule__bulkUpload">
                  <label className="productModule__fileLabel">
                    <input
                      className="productModule__fileInput"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportProducts}
                    />
                    📁 Bulk Upload (.xlsx)
                  </label>
                  {importMessage && (
                    <div className="orders__message orders__message--success">{importMessage}</div>
                  )}
                  {importError && (
                    <div className="orders__message orders__message--error">{importError}</div>
                  )}
                </div>
              </div>

              <div className="productModule__formGrid">
              <label className="productModule__field">
                Product Name
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Classic jute mat"
                />
                {errors.name && <span className="productModule__error">{errors.name}</span>}
              </label>

              <label className="productModule__field">
                Category
                <input
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="Natural fiber"
                />
                {errors.category && <span className="productModule__error">{errors.category}</span>}
              </label>
              <label className="productModule__field">
                Price
                <input
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="799"
                />
                {errors.price && <span className="productModule__error">{errors.price}</span>}
              </label>

              <label className="productModule__field">
                Size
                <input
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  placeholder="60 x 90 cm"
                />
                {errors.size && <span className="productModule__error">{errors.size}</span>}
              </label>
              <label className="productModule__field">
                Material
                <input
                  name="material"
                  value={formData.material}
                  onChange={handleChange}
                  placeholder="Coir / Rubber"
                />
              </label>
              <label className="productModule__field">
                Available Sizes
                <input
                  name="sizes"
                  value={formData.sizes}
                  onChange={handleChange}
                  placeholder="40x60, 60x90"
                />
              </label>
              <label className="productModule__field">
                Quantity
                <input
                  type="number"
                  name="quantity"
                  min="0"
                  step="1"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="50"
                />
                {errors.quantity && (
                  <span className="productModule__error">{errors.quantity}</span>
                )}
              </label>

              <label className="productModule__field">
                Product Photo
                <input
                  type="file"
                  accept="image/*"
                  ref={imageInputRef}
                  onChange={handleImageChange}
                />
                {formData.image && (
                  <span className="productModule__hint">Photo selected</span>
                )}
                {errors.image && <span className="productModule__error">{errors.image}</span>}
              </label>

              <label className="productModule__field productModule__field--full">
                Description
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Short product description"
                  rows="2"
                />
              </label>
              </div>

              {formData.image && isValidImageUrl(formData.image) && (
                <div className="productModule__preview">
                  <img src={formData.image} alt="Preview" />
                </div>
              )}

              <div className="productModule__actions">
                <button type="submit">
                  {editingId ? 'Update Product' : 'Add Product'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="productModule__secondary"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="productModule__table">
              <div className="productModule__tableHeader">
                <h2>Products</h2>
                <span>{filteredProducts.length} filtered / {products.length} total</span>
              </div>

              <div className="productModule__filters">
                <label className="productModule__filterField">
                  Search
                  <input
                    value={filterQuery}
                    onChange={(event) => setFilterQuery(event.target.value)}
                    placeholder="Search by name or category"
                  />
                </label>
                <label className="productModule__filterField">
                  Category
                  <select
                    value={filterCategory}
                    onChange={(event) => setFilterCategory(event.target.value)}
                  >
                    <option value="All">All</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="productModule__tableBtn" onClick={handleToggleSelectAllFiltered}>
                  {isAllFilteredSelected ? 'Clear Filtered Selection' : 'Select Filtered'}
                </button>
              </div>

              <div className="productModule__bulkBar">
                <div className="productModule__bulkCount">
                  {selectedIds.length} selected
                </div>
                <label className="productModule__filterField">
                  Bulk Category
                  <input
                    value={bulkCategory}
                    onChange={(event) => setBulkCategory(event.target.value)}
                    placeholder="Set new category"
                  />
                </label>
                <label className="productModule__filterField">
                  Bulk Quantity
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={bulkQuantity}
                    onChange={(event) => setBulkQuantity(event.target.value)}
                    placeholder="Set new qty"
                  />
                </label>
                <button type="button" className="productModule__tableBtn" onClick={handleBulkEdit}>
                  Edit Selected
                </button>
                <button
                  type="button"
                  className="productModule__tableBtn productModule__tableBtn--danger"
                  onClick={handleBulkDelete}
                >
                  Delete Selected
                </button>
              </div>

              <div className="productModule__dateDeleteBar">
                <div className="productModule__dateDeleteTitle">🗑️ Delete by Date Range</div>
                <label className="productModule__filterField">
                  From Date
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                </label>
                <label className="productModule__filterField">
                  To Date
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="productModule__tableBtn productModule__tableBtn--danger"
                  onClick={handleDeleteByDate}
                >
                  Delete by Date Range
                </button>
              </div>

              <div className="productModule__tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Size</th>
                      <th>Qty</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="productModule__empty">
                          No products found for this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr key={product.id || product._id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(product.id || product._id)}
                              onChange={() => handleToggleSelect(product.id || product._id)}
                            />
                          </td>
                          <td>
                            <img
                              className="productModule__thumb"
                              src={product.image}
                              alt={product.name}
                            />
                          </td>
                          <td>{product.name}</td>
                          <td>{product.category}</td>
                          <td>Rs. {product.price.toFixed(2)}</td>
                          <td>{product.size}</td>
                          <td>{product.quantity}</td>
                          <td className="productModule__tableActions">
                            <button
                              type="button"
                              className="productModule__tableBtn"
                              onClick={() => handleEdit(product)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="productModule__tableBtn productModule__tableBtn--danger"
                              onClick={() => handleDelete(product.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {undoHistory.length > 0 && (
              <div className="productModule__undoPanel">
                <h3 className="productModule__undoPanelTitle">
                  🔄 Recently Deleted ({undoHistory.length})
                </h3>
                <div className="productModule__undoList">
                  {undoHistory.map((entry, index) => (
                    <div key={index} className="productModule__undoItem">
                      <div className="productModule__undoItemInfo">
                        <div className="productModule__undoItemName">{entry.product.name}</div>
                        <div className="productModule__undoItemDetails">
                          {entry.product.category} • Rs. {entry.product.price.toFixed(2)} • Qty: {entry.product.quantity}
                        </div>
                        <div className="productModule__undoItemTime">
                          Deleted: {new Date(entry.deletedAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="productModule__undoBtn"
                        onClick={() => handleRestoreProduct(entry)}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="productModule__undoClearBtn"
                  onClick={handleClearUndoHistory}
                >
                  Clear History
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default ProductManagement;
