import KoreanClient from './KoreanClient';

export const metadata = {
  title: 'K-1 Hangeul (Korean Phonics) in Bellevue | Dotori School',
  description:
    'Dotori K-1 Hangeul: a structured foundational Korean literacy program for children in multilingual families. Three progressive levels from basic consonants and vowels to complex vowel combinations, taught in warm small groups in Bellevue.',
};

// The K-1 Hangeul program page. Course description (EN + KO) lives in
// KoreanClient; the old PDF downloads and the retired Korean Book Club card
// are gone.
export default function KoreanPage() {
  return <KoreanClient />;
}
