import { Link } from 'react-router-dom';
import events from '../data/events';

const EventsPage = () => (
  <>
    <div className="page-header">
      <div className="page-header-content">
        <h1>Upcoming Events</h1>
        <p>Celebrate special moments with us</p>
      </div>
    </div>

    <section className="events-section">
      <div className="container">
        <h2 className="section-title mb-5">Featured Events</h2>
        <div className="row g-4">
          {events.map((event) => (
            <div className="col-md-4" key={event.title}>
              <div className="event-card">
                <img src={event.image} className="event-img" alt={event.title} />
                <div className="event-body">
                  <span className="event-date">
                    <i className="fa fa-calendar me-1"></i>
                    {event.date}
                  </span>
                  <h5>{event.title}</h5>
                  <div className="event-meta">
                    <span>
                      <i className="fa fa-clock"></i> {event.time}
                    </span>
                    <span>
                      <i className="fa fa-location-dot"></i> {event.location}
                    </span>
                  </div>
                  <p>{event.description}</p>
                  <Link to="/book-table" className="btn-gold" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
                    <i className="fa fa-calendar-check me-1"></i>Reserve Seat
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section style={{ background: 'var(--deep-brown)', padding: '60px 0', textAlign: 'center' }}>
      <div className="container">
        <h2 style={{ fontFamily: "'Playfair Display',serif", color: 'var(--accent-gold)', marginBottom: '15px' }}>
          Planning a Private Event?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: '25px', fontSize: '1.05rem' }}>
          Let us create an unforgettable experience tailored just for you.
        </p>
        <Link to="/contact" className="btn-gold">
          <i className="fa fa-envelope me-2"></i>Contact Our Events Team
        </Link>
      </div>
    </section>
  </>
);

export default EventsPage;
