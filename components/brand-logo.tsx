import Link from 'next/link';

export function BrandImage() {
  // Refined artwork approved by the client; original asset is preserved.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/aperte-play-logo-20261014.png" alt="Aperte Play" width={640} height={640} />;
}

export function BrandLogo() {
  return <Link href="/" className="brand-logo" aria-label="Aperte Play, início"><BrandImage /></Link>;
}
