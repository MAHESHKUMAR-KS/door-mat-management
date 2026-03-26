import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
// Footer intentionally omitted on non-home pages.
import './Contact.css';
import { readEnquiries, writeEnquiries } from '../utils/dataTools';

const ENQUIRY_PHONE_DISPLAY = '+91 94438 41358';
const ENQUIRY_PHONE_WHATSAPP = '919443841358';

function Contact() {
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    product: '',
    message: ''
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadProducts = async () => {
      const { fetchProducts } = await import('../utils/catalog');
      const res = await fetchProducts();
      if (res.success) setProducts(res.products);
    };
    loadProducts();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const product = params.get('product') || '';
    if (product) {
      setFormData((prev) => ({ ...prev, product }));
    }
  }, [location.search]);

  const categories = useMemo(
    () => products.map((product) => product.name).filter(Boolean),
    [products]
  );

  const validate = (values) => {
    const nextErrors = {};
    if (!values.name.trim()) nextErrors.name = 'Customer name is required';
    if (!values.email.trim()) nextErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(values.email)) {
      nextErrors.email = 'Enter a valid email address';
    }
    if (!values.phone.trim()) nextErrors.phone = 'Phone number is required';
    else if (!/^\d{10}$/.test(values.phone.trim())) {
      nextErrors.phone = 'Phone number must be exactly 10 digits';
    }
    if (!values.product.trim()) nextErrors.product = 'Select a product';
    if (!values.message.trim()) nextErrors.message = 'Message is required';
    else if (values.message.trim().length < 10) {
      nextErrors.message = 'Message must be at least 10 characters';
    }
    return nextErrors;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const nextEnquiry = {
      id: Date.now(),
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      product: formData.product.trim(),
      message: formData.message.trim(),
      createdAt: new Date().toISOString()
    };
    const updated = [nextEnquiry, ...readEnquiries()];
    writeEnquiries(updated);
    window.dispatchEvent(new Event('dm:enquiries-updated'));

    const whatsappMessage = [
      'New enquiry received:',
      `Name: ${nextEnquiry.name}`,
      `Email: ${nextEnquiry.email}`,
      `Phone: ${nextEnquiry.phone}`,
      `Product: ${nextEnquiry.product}`,
      `Message: ${nextEnquiry.message}`
    ].join('\n');

    const whatsappUrl = `https://wa.me/${ENQUIRY_PHONE_WHATSAPP}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    setFormData({ name: '', email: '', phone: '', product: '', message: '' });
    setErrors({});
    setSuccess('Thanks! Your enquiry has been sent and shared on WhatsApp.');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="contactPage">
      <Navbar />
      <main className="contactPage__main">
        <header className="contactPage__header">
          <div>
            <h1 className="contactPage__title">Contact Us</h1>
            <p className="contactPage__subtitle">
              Reach our team for product questions, pricing, and custom orders.
            </p>
          </div>
        </header>

        <section className="contactPage__infoGrid">
          <div className="contactPage__card">
            <h3>Company Address</h3>
            <p>
              65, Kamaraj St,
              <br />
              NMS Compound, Erode Fort,
              <br />
              Erode, Tamil Nadu 638001
            </p>
          </div>
          <div className="contactPage__card">
            <h3>Phone Number</h3>
            <p>
              <strong>{ENQUIRY_PHONE_DISPLAY}</strong>
            </p>
          </div>
          <div className="contactPage__card">
            <h3>Email</h3>
            <p>
              <strong>info@example.com</strong>
            </p>
          </div>
        </section>

        <section className="contactPage__map" aria-label="Location map">
          <iframe
            title="Govindasamy and Co location"
            src="https://www.google.com/maps?q=65%2C%20Kamaraj%20St%2C%20NMS%20Compound%2C%20Erode%20Fort%2C%20Erode%2C%20Tamil%20Nadu%20638001&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </section>

        <section className="contactPage__form" aria-label="Contact form">
          <div className="contactPage__formHeader">
            <div>
              <h2>Send an Enquiry</h2>
              <p>We will get back to you within 1 business day.</p>
            </div>
            {success && <div className="contactPage__success">{success}</div>}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="contactPage__row">
              <label className="contactPage__field">
                Customer Name
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                />
                {errors.name && <span className="contactPage__error">{errors.name}</span>}
              </label>
              <label className="contactPage__field">
                Email
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@email.com"
                />
                {errors.email && <span className="contactPage__error">{errors.email}</span>}
              </label>
            </div>

            <div className="contactPage__row">
              <label className="contactPage__field">
                Phone Number
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                />
                {errors.phone && <span className="contactPage__error">{errors.phone}</span>}
              </label>
              <label className="contactPage__field">
                Selected Product
                <select name="product" value={formData.product} onChange={handleChange}>
                  <option value="">Select product</option>
                  {categories.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {errors.product && (
                  <span className="contactPage__error">{errors.product}</span>
                )}
              </label>
            </div>

            <label className="contactPage__field">
              Message
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Share your requirements"
              />
              {errors.message && (
                <span className="contactPage__error">{errors.message}</span>
              )}
            </label>

            <div className="contactPage__actions">
              <button type="submit">Send Enquiry</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default Contact;