import { useState } from 'react';
import { API_BASE } from '../config/api';

const ContactPage = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [flash, setFlash] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = new URLSearchParams(form);
      const response = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload,
        credentials: 'include',
      });

      if (response.ok) {
        setFlash({ type: 'success', message: "Message sent successfully! We'll get back to you soon." });
        setForm({ name: '', email: '', phone: '', subject: '', message: '' });
      } else {
        setFlash({ type: 'error', message: 'Unable to send the message. Please try again.' });
      }
    } catch (error) {
      setFlash({ type: 'error', message: 'Network error. Please try again later.' });
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-content">
          <h1>Contact Us</h1>
          <p>We'd love to hear from you</p>
        </div>
      </div>

      <section className="contact-section">
        <div className="container">
          {flash && <div className={`flash ${flash.type}`}>{flash.message}</div>}
          <div className="row g-4">
            <div className="col-lg-4">
              <div className="contact-info-card">
                <h3>
                  <i className="fa fa-address-book me-2"></i>Get In Touch
                </h3>
                <div className="contact-info-item">
                  <div className="ci-icon">
                    <i className="fa fa-location-dot"></i>
                  </div>
                  <div>
                    <h6>Address</h6>
                    <p>GTL Utsav Dining, MG Road,<br />Koregaon Park, Pune - 411001</p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="ci-icon">
                    <i className="fa fa-phone"></i>
                  </div>
                  <div>
                    <h6>Phone</h6>
                    <p>+91 9876543210<br />+91 2024 000111</p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="ci-icon">
                    <i className="fa fa-envelope"></i>
                  </div>
                  <div>
                    <h6>Email</h6>
                    <p>support@gtlutsav.com<br />reservations@gtlutsav.com</p>
                  </div>
                </div>
                <div className="contact-info-item">
                  <div className="ci-icon">
                    <i className="fa fa-clock"></i>
                  </div>
                  <div>
                    <h6>Hours</h6>
                    <p>Mon - Fri: 11 AM - 11 PM<br />Sat - Sun: 9 AM - 12 AM</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  {[ 'instagram', 'facebook', 'twitter', 'whatsapp' ].map((network) => (
                    <a key={network} href="#" style={{ color: 'var(--accent-gold)', fontSize: '1.3rem' }}>
                      <i className={`fab fa-${network}`}></i>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-lg-8">
              <div className="contact-form-card">
                <h3>
                  <i className="fa fa-paper-plane me-2" style={{ color: 'var(--accent-gold)' }}></i>Send a Message
                </h3>
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>
                          <i className="fa fa-user me-1"></i> Full Name
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Your name"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>
                          <i className="fa fa-envelope me-1"></i> Email
                        </label>
                        <input
                          type="email"
                          className="form-control"
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="your@email.com"
                          required
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>
                          <i className="fa fa-phone me-1"></i> Phone
                        </label>
                        <input
                          type="tel"
                          className="form-control"
                          name="phone"
                          value={form.phone}
                          onChange={handleChange}
                          placeholder="+91 XXXXX XXXXX"
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>
                          <i className="fa fa-tag me-1"></i> Subject
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="subject"
                          value={form.subject}
                          onChange={handleChange}
                          placeholder="How can we help?"
                        />
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="form-group">
                        <label>
                          <i className="fa fa-message me-1"></i> Message
                        </label>
                        <textarea
                          className="form-control"
                          name="message"
                          value={form.message}
                          onChange={handleChange}
                          rows="5"
                          placeholder="Write your message here..."
                          required
                        ></textarea>
                      </div>
                    </div>
                    <div className="col-12">
                      <button type="submit" className="btn-gold">
                        <i className="fa fa-paper-plane me-2"></i>Send Message
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <h3 className="section-title mb-4">Find Us</h3>
            <div style={{ borderRadius: '15px', overflow: 'hidden', border: '3px solid var(--accent-gold)' }}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3783.149839261876!2d73.89253!3d18.53631!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c1441f58b09b%3A0x13f67b3e9cad7c98!2sKoregaon%20Park%2C%20Pune%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1700000000000"
                width="100%"
                height="350"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                title="Restaurant location"
              ></iframe>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default ContactPage;
