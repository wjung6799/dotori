import ReviewsClient from './ReviewsClient';

export const metadata = {
  title: 'Parent Reviews | Dotori School',
  description:
    'What Dotori School families say about our math, English literacy, Korean, and summer camp programs in Bellevue.',
};

// Parent reviews with four program tabs. Submissions are hidden until an
// admin approves them at /admin/reviews.
export default function ReviewsPage() {
  return <ReviewsClient />;
}
