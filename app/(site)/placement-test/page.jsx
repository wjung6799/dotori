import { permanentRedirect } from 'next/navigation';

// The placement test and the free diagnostic are the same 45-minute visit
// (30-min assessment + 15-min parent consultation), so they share one page.
// This URL is kept because it is linked from old emails and program pages.
export default function PlacementTestPage() {
  permanentRedirect('/diagnostic');
}
