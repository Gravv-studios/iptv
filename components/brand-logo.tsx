import Link from 'next/link';

export function BrandImage() {
  // Hand-drawn vector logo; the earlier PNG artwork stays in public/images for reference.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/aperte-play-logo.svg" alt="Aperte Play" width={1076} height={112} />;
}

export function BrandLogo() {
  return <Link href="/" className="brand-logo" aria-label="Aperte Play, início"><BrandImage /></Link>;
}
