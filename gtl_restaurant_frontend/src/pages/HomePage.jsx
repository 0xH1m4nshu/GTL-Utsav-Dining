import { Link } from 'react-router-dom';
import testimonials from '../data/testimonials';
import UserDashboard from '../components/UserDashboard';
import { useUser } from '../context/UserContext';

const HomePage = () => {
  const { user } = useUser();

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-copy">
            <h1>Celebrate Every Bite</h1>
            <p>Where Rustic Indian Tradition Meets Smart Technology</p>
            {!user && (
              <div className="mt-4">
                <Link to="/book-table" className="btn btn-gold me-3">
                  <i className="fa fa-calendar-check"></i> Book a Table
                </Link>
                <Link to="/order-online" className="btn btn-outline-custom">
                  <i className="fa fa-utensils"></i> Order Online
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* USER DASHBOARD */}
      <div id="user-dashboard">
        <div style={{
          background: 'var(--accent-gold)',
          color: '#fff',
          textAlign: 'center',
          padding: '18px 20px',
        }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>
            Your Personal Food Control Centre
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '.88rem', opacity: .85 }}>
            Browse menu · Add to cart · Checkout · Track orders · Book tables
          </p>
        </div>
        <UserDashboard />
      </div>

      {/* Testimonials */}
      <section className="testimonial-section">
        <div className="container">
          <h2 className="section-title">What Our Guests Say</h2>
          <div className="row mt-5">
            {testimonials.map((testimonial) => (
              <div className="col-md-4" key={testimonial.author}>
                <div className="testimonial-card">
                  <p>"{testimonial.quote}"</p>
                  <h5>— {testimonial.author}</h5>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default HomePage;
