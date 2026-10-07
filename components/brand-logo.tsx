import Link from 'next/link';

export function BrandImage() {
  // Original artwork supplied and approved by the client.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/aperte-play-logo-cliente.png" alt="Aperte Play" width={640} height={640} />;
}

export function BrandLogo() {
  return <Link href="/" className="brand-logo" aria-label="Aperte Play, início"><BrandImage /></Link>;
}
