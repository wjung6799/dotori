export default function StorePage() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .store-wrap {
            max-width: 520px;
            margin: 0 auto;
            padding: 48px 20px 64px;
            text-align: center;
        }
        .store-logo { max-width: 110px; margin: 0 auto 1rem; display: block; }
        .store-wrap h1 { font-size: 2rem; color: #6b5b47; margin: 0 0 0.4rem; }
        .store-wrap .tagline { color: #8b7355; font-size: 1.05rem; margin: 0 0 2.2rem; }
        .store-links { display: flex; flex-direction: column; gap: 1rem; }
        .store-link {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.6rem;
            padding: 1.05rem 1.4rem;
            background: #fff;
            border: 2px solid #e6ddd0;
            border-radius: 16px;
            color: #6b5b47;
            font-size: 1.08rem;
            font-weight: 700;
            text-decoration: none;
            box-shadow: 0 3px 10px rgba(139,115,85,0.08);
            transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .store-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(139,115,85,0.18);
            background: #fbf9f5;
        }
        .store-link.primary {
            background: linear-gradient(135deg, #8b7355, #a0856b);
            color: #fff;
            border-color: transparent;
        }
        .store-link.primary:hover { background: linear-gradient(135deg, #7a6549, #8f7660); }
        .store-link .ico { font-size: 1.3rem; line-height: 1; }
      `,
        }}
      />

      <main className="store-wrap">
        <img src="/assets/images/logo.png" alt="Dotori School Logo" className="store-logo" />
        <h1>Dotori School Store</h1>
        <p className="tagline">Books, workbooks &amp; merchandise, all in one place.</p>

        <div className="store-links">
          {/* Primary: Amazon author store */}
          <a
            className="store-link primary"
            href="https://www.amazon.com/stores/author/B0GWTZKS55/allbooks"
            target="_blank"
            rel="noreferrer"
          >
            <span className="ico">📚</span> Shop Books on Amazon
          </a>

          {/* Merchandise */}
          <a
            className="store-link primary"
            href="https://dotori-store-2.myshopify.com/"
            target="_blank"
            rel="noreferrer"
          >
            <span className="ico">🛍️</span> Shop Merchandise
          </a>
        </div>
      </main>
    </>
  );
}
