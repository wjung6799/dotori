export default function Footer() {
  return (
    <footer style={{ background: '#f7f5f2', padding: '2rem 0', textAlign: 'center', color: '#888' }}>
      <div className="container">
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0.3rem 0', color: '#6b5b47', fontWeight: 600 }}>
            12721 NE Bel Red Rd. #220 (2nd Floor) Bellevue WA 98005
          </p>
          <p style={{ margin: '0.3rem 0', color: '#6b5b47', fontWeight: 600 }}>info@dotorischool.org</p>
        </div>
        <p style={{ margin: 0 }}>&copy; 2025 Dotori School. All rights reserved.</p>
      </div>
    </footer>
  );
}
