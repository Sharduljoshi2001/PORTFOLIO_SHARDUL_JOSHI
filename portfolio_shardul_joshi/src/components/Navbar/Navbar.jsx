import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { FiCloudLightning, FiDownload } from "react-icons/fi";
import "./Navbar.css";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleToggle = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  // Grow the island's shadow once the page is scrolled past the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  // react-router marks the matching route; we turn that into our active class.
  const linkClass = ({ isActive }) =>
    `navbar__link ${isActive ? "navbar__link--active" : ""}`;

  return (
    <nav className="navbar">
      <div className={`navbar__island ${scrolled ? "navbar__island--scrolled" : ""}`}>
        {/* Logo */}
        <Link to="/" className="navbar__logo-link" onClick={closeMenu}>
          <span className="navbar__logo-text">
            <span className="navbar__logo-prompt">$</span> dev_shardul<span className="navbar__logo-cursor" aria-hidden="true"></span>
          </span>
        </Link>

        <span className="navbar__sep" aria-hidden="true"></span>

        {/* Hamburger (mobile only) */}
        {!isMenuOpen && (
          <button
            onClick={handleToggle}
            className="navbar__toggle"
            aria-label="Open navigation menu"
            aria-expanded={isMenuOpen}
          >
            <span className="navbar__toggle-bar"></span>
            <span className="navbar__toggle-bar"></span>
            <span className="navbar__toggle-bar"></span>
          </button>
        )}

        {/* Click-away overlay (mobile) */}
        {isMenuOpen && (
          <div
            className="navbar__overlay navbar__overlay--active"
            onClick={closeMenu}
            aria-hidden="true"
          />
        )}

        {/* Links */}
        <ul className={`navbar__menu ${isMenuOpen ? "navbar__menu--open" : ""}`}>
          <li className="navbar__item">
            <NavLink to="/" end className={linkClass} onClick={closeMenu}>
              <FiCloudLightning className="navbar__link-icon" aria-hidden="true" />
              <span>About</span>
            </NavLink>
          </li>
          <li className="navbar__item">
            <NavLink to="/projects" className={linkClass} onClick={closeMenu}>
              <FiCloudLightning className="navbar__link-icon" aria-hidden="true" />
              <span>Projects</span>
            </NavLink>
          </li>
          <li className="navbar__item">
            <NavLink to="/contact" className={linkClass} onClick={closeMenu}>
              <FiCloudLightning className="navbar__link-icon" aria-hidden="true" />
              <span>Contact</span>
            </NavLink>
          </li>
          <li className="navbar__item navbar__item--resume">
            <a
              className="navbar__resume"
              href="/ATS_Shardul.pdf"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
            >
              <FiDownload aria-hidden="true" />
              <span>Resume</span>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
