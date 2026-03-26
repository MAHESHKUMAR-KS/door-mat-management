import Navbar from './Navbar';
// Footer intentionally omitted on non-home pages.
import './About.css';

function About() {
  return (
    <div className="aboutPage">
      <Navbar />
      <main className="aboutPage__main">
        <header className="aboutHeader">
          <h1 className="aboutTitle">About DoorMat Co.</h1>
          <p className="aboutLead">
            We craft durable, eco-friendly entrance solutions that blend functionality with refined design.
          </p>
        </header>

        <section className="aboutSection">
          <h2 className="aboutSection__title">Company Profile</h2>
          <p>
            We are a leading manufacturer of high-quality door mats, committed to providing durable and eco-friendly products
            that enhance the entrance of homes and businesses worldwide. With a focus on innovation and sustainability,
            we strive to deliver textile solutions that combine functionality with aesthetic appeal.
          </p>
        </section>

        <section className="aboutSection">
          <h2 className="aboutSection__title">Vision & Mission</h2>
          <div className="aboutSplit">
            <div>
              <h3>Vision</h3>
              <p>
                To be the premier provider of custom door mats worldwide, setting the standard for quality,
                innovation, and sustainability in the textile industry.
              </p>
            </div>
            <div>
              <h3>Mission</h3>
              <p>
                To deliver innovative, sustainable textile solutions that enhance home and business environments,
                while maintaining the highest standards of quality and customer satisfaction.
              </p>
            </div>
          </div>
        </section>

        <div className="aboutGrid">
          <section className="aboutCard">
            <h2>Years of Experience</h2>
            <p>
              Over 20 years in the textile industry, specializing in door mats and entrance solutions.
              Our extensive experience ensures we understand the unique needs of our customers.
            </p>
          </section>

          <section className="aboutCard">
            <h2>Infrastructure & Manufacturing</h2>
            <p>
              State-of-the-art manufacturing facility equipped with modern machinery for efficient production.
              Our advanced technology ensures consistent quality and timely delivery.
            </p>
          </section>
        </div>

        <section className="aboutSection">
          <h2 className="aboutSection__title">Certifications & Quality Standards</h2>
          <p>
            ISO 9001 certified, adhering to international quality standards for safety and sustainability.
            We are committed to environmental responsibility and ethical manufacturing practices.
          </p>
        </section>
      </main>
    </div>
  );
}

export default About;