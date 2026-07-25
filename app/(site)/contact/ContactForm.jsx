'use client';

import { useState } from 'react';

const inputStyle = {
  width: '100%',
  padding: '0.7rem',
  borderRadius: 8,
  border: '1px solid #ddd',
  marginTop: '0.3rem',
};

const labelStyle = { color: '#6b5b47', fontWeight: 600 };

export default function ContactForm({ heading }) {
  const [parentFirstName, setParentFirstName] = useState('');
  const [parentLastName, setParentLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const [students, setStudents] = useState(['']);
  const [formMessage, setFormMessage] = useState('');
  const [messageColor, setMessageColor] = useState('#6b5b47');

  const addStudent = () => {
    setStudents((prev) => [...prev, '']);
  };

  const removeStudent = (index) => {
    setStudents((prev) => prev.filter((_, i) => i !== index));
  };

  const updateStudent = (index, value) => {
    setStudents((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const resetForm = () => {
    setParentFirstName('');
    setParentLastName('');
    setEmail('');
    setPhone('');
    setMessage('');
    setNewsletter(false);
    setStudents(['']);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormMessage('');

    const data = {
      parentFirstName,
      parentLastName,
      email,
      phone,
      message: message || '',
      newsletter,
      students: students
        .map((s) => s && s.trim())
        .filter((s) => s && s.length > 0),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        resetForm();
        setMessageColor('#6b5b47');
        setFormMessage('Thank you! Your message has been sent.');
      } else {
        const errData = await res.json();
        setMessageColor('red');
        setFormMessage(errData.error || 'Failed to send message. Please try again.');
      }
    } catch (err) {
      setMessageColor('red');
      setFormMessage('Network error. Please try again.');
    }
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
    @media (max-width: 768px) {
        .contact-section {
            padding-top: 32px !important;
        }
        #contactForm > div:first-child {
            grid-template-columns: 1fr !important;
        }
    }
    @media (min-width: 769px) {
        .contact-section {
            padding-top: 90px !important;
        }
    }
    `,
        }}
      />

      <section
        className="container contact-section"
        style={{ maxWidth: 700, margin: '48px auto' }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            padding: '2.5rem 2rem',
          }}
        >
          <h1 style={{ textAlign: 'center', color: '#6b5b47', marginBottom: '2rem' }}>
            {heading}
          </h1>
          <form
            id="contactForm"
            style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}
            autoComplete="off"
            onSubmit={handleSubmit}
          >
            {/* Parent Information */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="parentFirstName" style={labelStyle}>
                  Parent First Name <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <br />
                <input
                  type="text"
                  id="parentFirstName"
                  name="parentFirstName"
                  required
                  value={parentFirstName}
                  onChange={(e) => setParentFirstName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label htmlFor="parentLastName" style={labelStyle}>
                  Parent Last Name <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <br />
                <input
                  type="text"
                  id="parentLastName"
                  name="parentLastName"
                  required
                  value={parentLastName}
                  onChange={(e) => setParentLastName(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" style={labelStyle}>
                Parent Email <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <br />
              <input
                type="email"
                id="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="phone" style={labelStyle}>
                Phone Number <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <br />
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Student Information */}
            <div id="studentContainer">
              {students.map((student, index) => (
                <div
                  key={index}
                  className="student-info"
                  style={
                    index === 0
                      ? { marginBottom: '1rem' }
                      : { marginBottom: '1rem', position: 'relative' }
                  }
                >
                  <div>
                    <label htmlFor={`studentFirstName${index + 1}`} style={labelStyle}>
                      Student First Name <span style={{ color: '#e74c3c' }}>*</span>
                    </label>
                    <br />
                    <input
                      type="text"
                      id={`studentFirstName${index + 1}`}
                      name={`studentFirstName${index + 1}`}
                      required
                      value={student}
                      onChange={(e) => updateStudent(index, e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  {index > 0 && (
                    <button
                      type="button"
                      className="remove-student"
                      onClick={() => removeStudent(index)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        background: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add Another Student Button */}
            <div>
              <button
                type="button"
                id="addStudentBtn"
                onClick={addStudent}
                style={{
                  color: '#6b5b47',
                  background: 'none',
                  border: 'none',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>⊕</span> Add another student
              </button>
            </div>

            {/* Newsletter Subscription */}
            <div style={{ margin: '1rem 0' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  color: '#6b5b47',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  id="newsletter"
                  name="newsletter"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                  style={{ marginTop: '0.2rem' }}
                />
                <span>
                  Yes, I would like to receive information about new courses, seasonal
                  schedules, and event announcements from Dotori School.
                </span>
              </label>
            </div>

            {/* Message Field */}
            <div>
              <label htmlFor="message" style={labelStyle}>
                Message
              </label>
              <br />
              <textarea
                id="message"
                name="message"
                rows="5"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={inputStyle}
              ></textarea>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '0.8rem 2rem',
                borderRadius: 30,
                background: '#d2691e',
                color: '#fff',
                fontSize: '1.1rem',
                fontWeight: 600,
                border: 'none',
                marginTop: '1rem',
              }}
            >
              SUBMIT
            </button>
          </form>
          <div id="formMessage" style={{ marginTop: '1rem', textAlign: 'center', color: messageColor }}>
            {formMessage}
          </div>
          <div style={{ marginTop: '2.5rem', textAlign: 'center', color: '#888' }}>
            <p>
              <strong>Email:</strong> info@dotorischool.org
            </p>
            <p>
              <strong>Phone:</strong> (425) 405-0822 (Please leave a voice or text message)
            </p>
            <p>
              <strong>Address:</strong> 12721 NE Bel Red Rd. #220 Bellevue WA 98005
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
