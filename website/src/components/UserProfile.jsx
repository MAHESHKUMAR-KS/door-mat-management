import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession, getSession, getSessionUserId, isUserSession } from '../utils/auth';
import { downloadPdfLike, readProfile, writeProfile } from '../utils/dataTools';
import logo from '../assets/gsco-logo.svg';
import './Dashboard.css';
import './UserProfile.css';

function UserProfile() {
  const navigate = useNavigate();
  const session = getSession();
  const userId = getSessionUserId();
  const [profile, setProfile] = useState({
    name: '',
    email: session?.username || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isUserSession()) {
      navigate('/login');
      return;
    }
    const stored = readProfile(userId);
    if (stored) {
      setProfile((prev) => {
        const next = { ...prev, ...stored };
        if (!next.address && stored.location) {
          next.address = stored.location;
        }
        return next;
      });
    }
  }, [navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    writeProfile(userId, profile);
    setIsEditing(false);
    setSuccess('Profile updated successfully.');
    setTimeout(() => setSuccess(''), 2500);
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  const handleExportProfile = () => {
    const lines = [
      'Profile Details',
      '---------------',
      `Name: ${profile.name}`,
      `Email: ${profile.email}`,
      `Phone: ${profile.phone}`
    ];
    downloadPdfLike('profile-details.pdf', lines);
  };

  return (
    <div className="adminDash">
      <aside className="adminDash__sidebar">
        <div className="adminDash__brand">
          <div className="adminDash__logo">
            <img className="adminDash__logoImg" src={logo} alt="GS & Co logo" />
          </div>
          <div>
            <div className="adminDash__title">User Console</div>
            <div className="adminDash__subtitle">Govindasamy &amp; Co</div>
          </div>
        </div>
        <nav className="adminDash__nav" aria-label="User navigation">
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/user')}>
            Dashboard
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/products')}>
            View Products
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/orders')}>
            My Orders
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/wishlist')}>
            Wishlist
          </button>
          <button className="adminDash__navBtn" type="button" onClick={() => navigate('/profile')}>
            Profile
          </button>
          <button className="adminDash__navBtn adminDash__navBtn--danger" type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
        <div className="adminDash__meta">
          <span className="adminDash__chip">Member</span>
          <span className="adminDash__metaText">Last login: Today</span>
        </div>
      </aside>

      <main className="adminDash__main">
        <header className="adminDash__header">
          <div>
            <p className="userProfile__eyebrow">Profile</p>
            <h1 className="userProfile__title">Your Account</h1>
            <p className="userProfile__subtitle">Keep your information up to date.</p>
          </div>
          <div className="userProfile__actions">
            <button type="button" onClick={() => setIsEditing((prev) => !prev)}>
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
            <button type="button" onClick={handleExportProfile}>
              Download Profile PDF
            </button>
          </div>
        </header>

        <section className="userProfile__card">
          <form onSubmit={handleSave}>
            <div className="userProfile__row">
              <label>
                Name
                <input
                  name="name"
                  value={profile.name}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Your name"
                />
              </label>
              <label>
                Email
                <input
                  name="email"
                  value={profile.email}
                  onChange={handleChange}
                  disabled
                />
              </label>
            </div>
            <div className="userProfile__row">
              <label>
                Phone
                <input
                  name="phone"
                  value={profile.phone}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="+91 90000 00000"
                />
              </label>
              <label>
                Address
                <input
                  name="address"
                  value={profile.address}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Street address"
                />
              </label>
            </div>
            <div className="userProfile__row">
              <label>
                City
                <input
                  name="city"
                  value={profile.city}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Erode"
                />
              </label>
              <label>
                State
                <input
                  name="state"
                  value={profile.state}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Tamil Nadu"
                />
              </label>
            </div>
            <div className="userProfile__row">
              <label>
                Pincode
                <input
                  name="pincode"
                  value={profile.pincode}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="638001"
                />
              </label>
            </div>
            {isEditing && (
              <button type="submit" className="userProfile__save">
                Save Changes
              </button>
            )}
            {success && <div className="userProfile__success">{success}</div>}
          </form>
        </section>
      </main>
    </div>
  );
}

export default UserProfile;
