import React from 'react';
import {
  Smartphone,
  Wallet,
  Key,
  Briefcase,
  CreditCard,
  Watch,
  Shirt,
  Dog,
  BookOpen,
  Package,
  Laptop,
  Headphones,
  Glasses,
  Footprints,
  Dumbbell,
  CupSoda,
  Umbrella,
  Bike,
  Music,
  Baby,
  GraduationCap,
  Trophy,
  Tag,
  LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  // Direct icon names (lowercase & uppercase)
  smartphone: Smartphone,
  wallet: Wallet,
  key: Key,
  briefcase: Briefcase,
  'credit-card': CreditCard,
  creditcard: CreditCard,
  watch: Watch,
  shirt: Shirt,
  dog: Dog,
  'book-open': BookOpen,
  bookopen: BookOpen,
  package: Package,
  laptop: Laptop,
  headphones: Headphones,
  glasses: Glasses,
  footprints: Footprints,
  dumbbell: Dumbbell,
  'cup-soda': CupSoda,
  cupsoda: CupSoda,
  umbrella: Umbrella,
  bike: Bike,
  music: Music,
  baby: Baby,
  'graduation-cap': GraduationCap,
  graduationcap: GraduationCap,
  trophy: Trophy,

  // Common slugs fallback
  'phones-electronics': Smartphone,
  electronics: Smartphone,
  'wallets-cards': Wallet,
  'wallets-purses': Wallet,
  keys: Key,
  'bags-luggage': Briefcase,
  'documents-ids': CreditCard,
  'jewelry-watches': Watch,
  'clothing-accessories': Shirt,
  pets: Dog,
  'books-stationery': BookOpen,
  'laptops-tablets': Laptop,
  'headphones-audio': Headphones,
  eyewear: Glasses,
  footwear: Footprints,
  'sports-equipment': Dumbbell,
  'sports-outdoors': Dumbbell,
  'water-bottles-containers': CupSoda,
  umbrellas: Umbrella,
  'bicycles-vehicle-items': Bike,
  'musical-instruments': Music,
  'toys-baby-items': Baby,
  'college-items-id-cards': GraduationCap,
  other: Package,
};

export function getCategoryIcon(identifier?: string | null): LucideIcon {
  if (!identifier) return Tag;
  const key = identifier.toLowerCase().trim();
  return iconMap[key] || Tag;
}

export interface CategoryIconProps {
  icon?: string | null;
  slug?: string | null;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  icon,
  slug,
  className = 'w-4 h-4',
  size,
}) => {
  const IconComponent = getCategoryIcon(icon || slug);
  return <IconComponent className={className} size={size} />;
};
