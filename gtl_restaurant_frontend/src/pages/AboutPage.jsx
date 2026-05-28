import { Link } from 'react-router-dom';

const AboutPage = () => (
  <>
    <div className="page-header">
      <div className="page-header-content">
        <h1>About Us</h1>
        <p>Our story, our passion, our promise</p>
      </div>
    </div>

    <section className="about-section">
      <div className="container">
        <div className="row align-items-center g-5">
          <div className="col-lg-6">
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=700&q=80"
              className="about-img"
              alt="Restaurant interior"
            />
          </div>
          <div className="col-lg-6 about-text">
            <h2>Our Story</h2>
            <p>
              GTL Utsav Dining was born out of a dream - to recreate the warmth of a grandmother's kitchen at scale. Founded in
              2015 by the Grand Taste League, we set out to bring the rich tapestry of Indian regional cuisines under one roof.
            </p>
            <p>
              Every dish on our menu is a tribute to a tradition - from the clay-pot biryani of Hyderabad to the slow-cooked dal of
              Rajasthan. We source our spices directly from farms, our vegetables from local mandis, and our inspiration from every corner of India.
            </p>
            <p>
              Today, GTL Utsav Dining is more than a restaurant. It is a celebration space where technology meets tradition - where you can book a table with a tap,
              order online seamlessly, and yet feel the soul of rustic India in every bite.
            </p>
            <Link to="/book-table" className="btn-gold mt-3">
              <i className="fa fa-calendar-check me-2"></i>Reserve a Table
            </Link>
          </div>
        </div>
      </div>
    </section>

    <section className="values-section">
      <div className="container">
        <h2 className="section-title">Our Values</h2>
        <div className="row mt-5 g-4">
          {[
            { icon: 'ðŸŒ±', title: 'Farm Fresh', description: 'Locally sourced ingredients, always fresh, always seasonal.' },
            { icon: 'ðŸ¥‡', title: 'Authentic Recipes', description: 'Time-honored recipes passed down through generations.' },
            { icon: 'ðŸ§ ', title: 'Smart Technology', description: 'Digital ordering, AI recommendations, seamless experience.' },
            { icon: 'ðŸ’›', title: 'Community', description: 'Supporting local farmers, artisans, and our community.' },
          ].map((value) => (
            <div className="col-md-3 col-6" key={value.title}>
              <div className="value-card">
                <div className="icon">{value.icon}</div>
                <h5>{value.title}</h5>
                <p>{value.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="about-section" style={{ background: '#f9f5ef' }}>
      <div className="container">
        <h2 className="section-title" style={{ marginBottom: '40px' }}>
          Meet Our Team
        </h2>
        <div className="row g-4 justify-content-center">
          {[
            {
              name: 'Ramesh Kumar',
              role: 'Executive Chef',
              desc: "25 years of culinary mastery across India's finest kitchens.",
              image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=300&q=80',
            },
            {
              name: 'Anjali Verma',
              role: 'Operations Manager',
              desc: 'Ensuring every guest leaves with a smile and a full heart.',
              image: 'https://images.unsplash.com/photo-1543168256-418811576931?w=300&q=80',
            },
            {
              name: 'Sunil Mehta',
              role: 'Founder & CEO',
              desc: 'Visionary behind the GTL legacy of authentic Indian dining.',
              image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&q=80',
            },
          ].map((member) => (
            <div className="col-md-4 text-center" key={member.name}>
              <img
                src={member.image}
                alt={member.name}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid var(--accent-gold)',
                }}
              />
              <h5 className="mt-3" style={{ color: 'var(--deep-brown)', fontFamily: "'Playfair Display',serif" }}>
                {member.name}
              </h5>
              <p style={{ color: 'var(--accent-gold)', fontSize: '0.85rem' }}>{member.role}</p>
              <p style={{ color: '#777', fontSize: '0.85rem' }}>{member.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  </>
);

export default AboutPage;
