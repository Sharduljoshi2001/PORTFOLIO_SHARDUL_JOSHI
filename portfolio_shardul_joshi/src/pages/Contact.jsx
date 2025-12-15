import './Contact.css';
import React, { useState } from 'react';
import { contactResponses } from '../data/contactResponses';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    contactResponses.push({ name: form.name, email: form.email });
    setSubmitted(true);
    setForm({ name: '', email: '', message: '' });
  }

  return (
    <section className="contact" id="contact">
      <h1 className="contact__title">Let's Connect</h1>
      <p className="contact__subtitle">I'm always open to new opportunities, collaborations, or just a friendly chat.</p>
      {submitted ? (
        <div className="contact__thankyou">
          Thank you for your response, we'll be connecting soon.
        </div>
      ) : (
        <form className="contact__form" onSubmit={handleSubmit}>
          <label className="contact__label">
            Name
            <input className="contact__input" type="text" name="name" placeholder="Your Name" value={form.name} onChange={handleChange} required />
          </label>
          <label className="contact__label">
            Email
            <input className="contact__input" type="email" name="email" placeholder="you@email.com" value={form.email} onChange={handleChange} required />
          </label>
          <label className="contact__label">
            Message
            <textarea className="contact__textarea" name="message" placeholder="Say hello..." value={form.message} onChange={handleChange} required />
          </label>
          <button className="contact__button" type="submit">Send Message</button>
        </form>
      )}
      <div className="contact__socials">
        <a href="mailto:sharduljoshi2001@gmail.com" className="contact__icon" aria-label="Email">@</a>
        <a href="https://github.com/Sharduljoshi2001" className="contact__icon" target="_blank" rel="noopener noreferrer" aria-label="GitHub">GH</a>
        <a href="https://www.linkedin.com/in/shardul-joshi-558137222/" className="contact__icon" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">in</a>
      </div>
    </section>
  );
}
