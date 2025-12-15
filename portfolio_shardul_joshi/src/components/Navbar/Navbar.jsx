import { useState } from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const handleToggle = () => {
    console.log(isMenuOpen);
    setIsMenuOpen((prevState) => !prevState);
  };
  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <nav className="navbar">
      {/* logo section */}
      <div className="navbar__logo">
        <a href="/" className="navbar__logo-link">
          <span className="navbar__logo-text">
            {"<"}DEV_SHARDUL{"/>"}
          </span>
        </a>
      </div>
      {/* hamburger menu button(for mobile only) - Hide when menu is open */}
      {!isMenuOpen && (
        <button
          onClick={handleToggle}
          className="navbar__toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
        >
          <span className="navbar__toggle-bar"></span>
          <span className="navbar__toggle-bar"></span>
          <span className="navbar__toggle-bar"></span>
        </button>
      )}

      {/* Click overlay to close menu */}
      {isMenuOpen && (
        <div
          className="navbar__overlay navbar__overlay--active"
          onClick={handleToggle}
          aria-hidden="true"
        />
      )}

      {/* navigation menu */}
      <ul className={`navbar__menu ${isMenuOpen ? "navbar__menu--open" : ""}`}>
        {/* <li className="navbar__item">
          <Link to="/" className="navbar__link navbar__link--active" onClick={closeMenu}>
            Home
          </Link>
        </li> */}
        <li className="navbar__item">
          <Link to="/" className="navbar__link" onClick={closeMenu}>
            About
          </Link>
        </li>
        <li className="navbar__item">
          <Link to="/projects" className="navbar__link" onClick={closeMenu}>
            Projects
          </Link>
        </li>
        <li className="navbar__item">
          <Link to="/contact" className="navbar__link" onClick={closeMenu}>
            Contact
          </Link>
        </li>
      </ul>
    </nav>
  );
}
