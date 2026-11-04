import { Banknote, Car, Clapperboard, Coins, Gift, GraduationCap, HeartPulse, House, Laptop, Plane, ShoppingBag, ShoppingBasket, Store, Tag, TrendingUp, Zap } from 'lucide-react';

const ICONS = { Banknote, Car, Clapperboard, Coins, Gift, GraduationCap, HeartPulse, House, Laptop, Plane, ShoppingBag, ShoppingBasket, Store, Tag, TrendingUp, Zap };
export const ICON_NAMES = Object.keys(ICONS);

export default function CatIcon({ icon, color = '#6b7280', size = 40 }) {
  const Icon = ICONS[icon] || Tag;
  return (
    <span className="grid shrink-0 place-items-center rounded-xl" style={{ width: size, height: size, background: `${color}22`, color }}>
      <Icon size={size * 0.5} aria-hidden />
    </span>
  );
}
