import logo from '../assets/gsco-logo.svg';
import './Footer.css';

function Footer({ fixed = false }) {
  return (
    <footer
      className={`siteFooter${fixed ? ' siteFooter--fixed' : ''}`}
      aria-label="Site footer"
    >
      <div className="siteFooter__card">
        <div className="siteFooter__top">
          {/* Brand */}
          <div className="siteFooter__brand">
            <div className="siteFooter__logo">
              <img className="siteFooter__logoImg" src={logo} alt="GS & Co logo" />
            </div>
            <div className="siteFooter__brandName">Govindasamy &amp; Co</div>
          </div>

          {/* Address */}
          <div className="siteFooter__section">
            <div className="siteFooter__title">Address</div>
            <address className="siteFooter__address">
              65, Kamaraj St,
              <br />
              NMS Compound, Erode Fort,
              <br />
              Erode, Tamil Nadu 638001
              <br />
              <a className="siteFooter__link" href="tel:+919443841358">
                +91 94438 41358
              </a>
            </address>

            <div className="siteFooter__icons">
              <a className="siteFooter__iconBtn ig" href="#" aria-label="Instagram">
                <IconInstagram />
              </a>
              <a
                className="siteFooter__iconBtn mail"
                href="mailto:info@example.com"
                aria-label="Email"
              >
                <IconMail />
              </a>
              <a
                className="siteFooter__iconBtn map"
                href="https://www.google.com/maps"
                target="_blank"
                rel="noreferrer"
                aria-label="Map"
              >
                <IconMapPin />
              </a>
            </div>
          </div>

          {/* Motto */}
          <div className="siteFooter__section">
            <div className="siteFooter__title">Our Motto</div>
            <p className="siteFooter__motto">
              “Fashion is the armor to survive the reality of everyday life. At GS
              &amp; Co, we weave elegance into every floor mat.”
            </p>
          </div>
        </div>

        <div className="siteFooter__divider" />

        <div className="siteFooter__bottom">
          © 2026 GS &amp; Co. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

/* ===== Icons ===== */

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path
        d="M12 22s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default Footer;
