import './Hero.css';
import { FiGithub, FiLinkedin, FiMail, FiFileText } from 'react-icons/fi';
import main_img from '../../assets/images/photoFront.jpg';

export default function Hero() {
  return (
    <section className='hero' id='hero'>
      {/* Left Side - Content */}
      <div className='hero__content'>
        <p className='hero__greeting'> Hello, I'm</p>
        <h1 className='hero__title'>
          <span className='hero__title--brush'>Shardul Joshi</span>
        </h1>
        <p className='hero__bio'>
          Full Stack Developer passionate about building elegant, accessible web experiences.
        </p>
        
        {/* Skill Badges (Flex Pills) */}
        <div className='hero__badges'>
          <span className='hero__badge'>React.js</span>
          <span className='hero__badge'>Node.js</span>
          <span className='hero__badge'>JavaScript (ES6+)</span>
          <span className='hero__badge'>C++</span>
          <span className='hero__badge'>Vue.js</span>
          <span className='hero__badge'>PostgreSQL</span>
        </div>

        {/* Persona Line (Monospace with Tooltip) */}
        <p className='hero__persona'>
          <span>Algorithmic Problem Solver</span>
          {' • '}
          <span>Creative Web Developer</span>
          {' • '}
          <span 
            className='hero__persona--special' 
            data-tooltip="Mountain logs coming soon..."
          >
            Avid Trekker 🏔️
          </span>
        </p>

        <a href='#contact' className='hero__cta'>
          Let's Connect
        </a>

        {/* Social Media Links */}
        <div className="hero__socials">
          <a
            href="https://github.com/Sharduljoshi2001"
            className="hero__social hero__social--tooltip"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            data-tooltip="GitHub"
          >
            <FiGithub />
          </a>
          <a
            href="https://www.linkedin.com/in/shardul-joshi-558137222/"
            className="hero__social hero__social--tooltip"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            data-tooltip="LinkedIn"
          >
            <FiLinkedin />
          </a>
          <a
            href="mailto:sharduljoshi2001@gmail.com"
            className="hero__social hero__social--tooltip"
            aria-label="Email"
            data-tooltip="Email"
          >
            <FiMail />
          </a>
          <a
            href="/ATS_Shardul.pdf"
            className="hero__social hero__social--tooltip"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Resume"
            data-tooltip="Resume"
          >
            <FiFileText />
          </a>
        </div>
      </div>

      {/* Right Side - Image */}
      <div className='hero__image-wrapper'>
        <img
          src={main_img}
          alt="Professional photograph of Shardul Joshi, Full Stack Developer"
          className="hero__image"
        />
      </div>
    </section>
  );
}