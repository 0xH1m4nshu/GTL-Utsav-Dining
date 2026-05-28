import { Link } from 'react-router-dom';
import logo from '../assets/images/logo.png';

const WelcomePage = () => (
  <div className="welcome-page">
    <div className="welcome-overlay">
      <div className="welcome-content text-center">
        <img src={logo} className="logo-circle mb-4" alt="GTL Logo" />
        <p className="welcome-subtitle">GRAND TASTE LEAGUE PRESENTS</p>
        <h1>GTL Utsav Dining</h1>
        <p className="welcome-tagline">Where Rustic Indian Tradition Meets Smart Technology</p>
        <Link to="/home" className="btn-gold mt-4 d-inline-block">
          ⧓ Continue ⧓
        </Link>
      </div>
    </div>
  </div>
);

export default WelcomePage;
