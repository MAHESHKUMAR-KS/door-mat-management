import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import matHero from '../assets/mat-hero-home.svg';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const highlights = [
    { title: '20+ Years', text: 'Manufacturing experience' },
    { title: '5000+ Orders', text: 'Delivered across India' },
    { title: 'ISO Focus', text: 'Quality-first production' }
  ];

  const heroStyle = {
    backgroundImage: `linear-gradient(rgba(245, 241, 235, 0.8), rgba(237, 229, 221, 0.8)), url(${matHero})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  };

  const handleBrowseProducts = () => {
    navigate('/products');
  };

  return (
    <div className="homePage">
      <Navbar />

      <section className="homeHero" style={heroStyle}>
        <div className="homeHero__shell">
          <div className="homeHero__left">
            <div className="homeHero__content">
              <p className="homeHero__eyebrow">Govindasamy &amp; Co</p>
              <h1 className="homeHero__title">Professional Entrance Solutions for Modern Spaces</h1>
              <p className="homeHero__subtitle">
                Built for offices, retail, and homes with dependable materials, tailored dimensions, and design-forward finishes.
              </p>
              <div className="homeHero__actions">
                <button className="homeBtn homeBtn--primary" type="button" onClick={handleBrowseProducts}>
                  Browse Products
                </button>
                <a className="homeBtn homeBtn--ghost" href="/contact">
                  Talk to Us
                </a>
              </div>
            </div>
          </div>

          <aside className="homeHero__panel" aria-label="Business highlights">
            <div className="homeHero__panelMain">
              <p className="homeHero__panelLabel">5000+ Orders</p>
              <h2>Delivered across India</h2>
              <p>Professional Entrance Solutions for Modern Spaces</p>
            </div>
            <div className="homeHero__stats">
              {highlights.map((item) => (
                <div key={item.title} className="homeHero__stat">
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <main className="homeMain">
        <section className="homeSection">
          <h2 className="homeSection__title">Quality Door Mats for Every Environment</h2>
          <p className="homeSection__lead">
            From high-footfall commercial entrances to premium residential interiors, our range is engineered for durability, cleanliness, and visual consistency.
          </p>
        </section>

        <section className="homeSection">
          <h2 className="homeSection__title">Why Businesses Choose Us</h2>
          <div className="homeCards">
            {[
              { title: 'Commercial-grade durability', text: 'Engineered to withstand daily heavy traffic while keeping entrances neat and safe.' },
              { title: 'Custom sizing and branding', text: 'Order in precise dimensions and choose styles that align with your space or brand identity.' },
              { title: 'Responsible material choices', text: 'Production methods and materials are selected to reduce waste and support long-term use.' }
            ].map((item) => (
              <div key={item.title} className="homeCard">
                <h3 className="homeCard__title">{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="homeCTA">
          <h2 className="homeSection__title">Start Your Next Mat Program</h2>
          <p>
            Share your requirement and receive product recommendations with dimensions, finish options, and pricing support.
          </p>
          <div className="homeCTA__actions">
            <a className="homeBtn homeBtn--primary" href="/about">
              About Us
            </a>
            <a className="homeBtn homeBtn--dark" href="/contact">
              Contact Us
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Home;
