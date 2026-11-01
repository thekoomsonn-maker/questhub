import {
  Briefcase,
  Building2,
  Car,
  Dumbbell,
  Factory,
  LayoutGrid,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  Sprout,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  car: Car,
  building: Building2,
  shirt: Shirt,
  sofa: Sofa,
  sparkles: Sparkles,
  briefcase: Briefcase,
  dumbbell: Dumbbell,
  factory: Factory,
  sprout: Sprout,
};

export function CategoryIcon({ name, size = 22, className }: { name: string | null; size?: number; className?: string }) {
  const Icon = (name && icons[name]) || LayoutGrid;
  return <Icon size={size} className={className} aria-hidden />;
}
