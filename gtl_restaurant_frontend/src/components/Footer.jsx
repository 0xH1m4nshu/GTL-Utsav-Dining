const Footer = () => (
  <footer className="footer">
    <div className="container">
      <div className="row">
        <div className="col-md-4">
          <h5>GTL Utsav Dining</h5>
          <p>Grand Taste League - Celebrate Every Bite</p>
        </div>
        <div className="col-md-4">
          <h5>Quick Links</h5>
          <ul className="footer-links">
            <li>
              <a href="/book-table">
                <i className="fa fa-calendar-check me-1"></i>Book Table
              </a>
            </li>
            <li>
              <a href="/order-online">
                <i className="fa fa-utensils me-1"></i>Order Online
              </a>
            </li>
            <li>
              <a href="/events">
                <i className="fa fa-star me-1"></i>Events
              </a>
            </li>
            <li>
              <a href="/contact">
                <i className="fa fa-envelope me-1"></i>Contact
              </a>
            </li>
          </ul>
        </div>
        <div className="col-md-4">
          <h5>Contact</h5>
          <p>
            <i className="fa fa-envelope me-2" style={{ color: 'var(--accent-gold)' }}></i>
            support@gtlutsav.com
          </p>
          <p>
            <i className="fa fa-phone me-2" style={{ color: 'var(--accent-gold)' }}></i>
            +91 9876543210
          </p>
        </div>
      </div>
      <hr />
      <p className="text-center">© 2026 Grand Taste League</p>
    </div>
  </footer>
);

export default Footer;
