/* eslint-disable @next/next/no-img-element */
export default function Logo({ size = 40, className = '' }) {
  return <img src="/icons/logo.svg" width={size} height={size} alt="" className={className} />;
}
