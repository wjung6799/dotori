import { redirect } from 'next/navigation';

// Mirrors the original Express behavior: /shop redirects to /store.
export default function ShopPage() {
  redirect('/store');
}
