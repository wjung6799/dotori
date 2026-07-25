import Link from 'next/link';
import { notFound } from 'next/navigation';
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html';
import { getPostBySlug } from '@/lib/cms';

export const dynamic = 'force-dynamic';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  return post ? { title: post.title, description: post.excerpt || undefined } : { title: 'Post not found' };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  let bodyHtml = '';
  try {
    if (post.body) bodyHtml = convertLexicalToHTML({ data: post.body });
  } catch (err) {
    console.error('Post body render failed:', err);
  }

  return (
    <main className="container" style={{ maxWidth: 760, margin: '48px auto', padding: '0 1rem' }}>
      <p style={{ marginBottom: '1.5rem' }}>
        <Link href="/blog" style={{ color: '#8b7355', fontWeight: 600, fontSize: '0.9rem' }}>← All posts</Link>
      </p>

      <h1 style={{ color: '#4a3c28', marginBottom: '0.5rem' }}>{post.title}</h1>
      <div style={{ color: '#9b8b77', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        {fmtDate(post.publishedDate)}
        {post.author ? ` · ${post.author}` : ''}
      </div>

      {post.coverImage?.url ? (
        <img
          src={post.coverImage.url}
          alt={post.coverImage.alt || post.title}
          style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 16, display: 'block', marginBottom: '2rem' }}
        />
      ) : null}

      <div
        style={{ color: '#4a3c28', fontSize: '1.08rem', lineHeight: 1.75 }}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </main>
  );
}
