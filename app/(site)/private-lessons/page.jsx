import PrivateLessonsClient from './PrivateLessonsClient';

export const metadata = {
  title: 'Private & Semi-Private Lessons in Bellevue | Dotori School',
  description:
    'One-on-one and semi-private lessons at Dotori School in Bellevue. Flexible scheduling with the instructor and a lesson plan built around your child, in any academic area.',
};

// Private & Semi-Private Lessons page. Copy (EN + KO) lives in PrivateLessonsClient.
export default function PrivateLessonsPage() {
  return <PrivateLessonsClient />;
}
