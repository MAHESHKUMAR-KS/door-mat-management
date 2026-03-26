import { Link } from 'react-router-dom';
import logo from '../assets/gsco-logo.svg';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="siteNav">
      <div className="siteNav__brand">
        <img src={logo} alt="GS & Co logo" className="siteNav__logo" />
        Govindasamy & Co
      </div>

      <ul className="siteNav__links">
        {['Home', 'About', 'Contact'].map((item) => (
          <li key={item}>
            <Link to={`/${item === 'Home' ? '' : item.toLowerCase()}`} className="siteNav__link">
              {item}
            </Link>
          </li>
        ))}

        <li>
          <Link to="/login" className="siteNav__link siteNav__link--login">
            Login
          </Link>
        </li>
        <li>
          <Link to="/register" className="siteNav__link siteNav__link--register">
            Register
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
