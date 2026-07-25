import Link from 'next/link';
import { getPosts } from '@/lib/cms';

export const metadata = {
  title: 'Blog',
  description: 'News, literacy tips, and updates from Dotori School.',
};

export const dynamic = 'force-dynamic';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <main className="container" style={{ maxWidth: 960, margin: '48px auto', padding: '0 1rem' }}>
      <h1 style={{ textAlign: 'center', color: '#6b5b47', marginBottom: '0.5rem' }}>Blog</h1>
      <p style={{ textAlign: 'center', color: '#9b8b77', marginBottom: '2.5rem' }}>
        News, literacy tips, and updates from Dotori School.
      </p>

      {posts.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#9b8b77' }}>No posts yet — check back soon.</p>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <article style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 20px rgba(139,115,85,0.08)', height: '100%' }}>
                {post.coverImage?.url ? (
                  <img
                    src={post.coverImage.url}
                    alt={post.coverImage.alt || post.title}
                    style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                  />
                ) : null}
                <div style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ color: '#9b8b77', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    {fmtDate(post.publishedDate)}
                    {post.author ? ` · ${post.author}` : ''}
                  </div>
                  <h2 style={{ color: '#4a3c28', fontSize: '1.25rem', margin: '0 0 0.5rem' }}>{post.title}</h2>
                  {post.excerpt ? (
                    <p style={{ color: '#6b5b47', fontSize: '0.95rem', margin: 0 }}>{post.excerpt}</p>
                  ) : null}
                  <span style={{ display: 'inline-block', marginTop: '0.9rem', color: '#8b7355', fontWeight: 600, fontSize: '0.9rem' }}>
                    Read more →
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
