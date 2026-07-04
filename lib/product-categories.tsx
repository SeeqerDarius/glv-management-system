import type { LucideIcon } from "lucide-react";
import {
  ArmchairIcon,
  BlenderIcon,
  BoxesIcon,
  CookingPotIcon,
  FanIcon,
  HousePlugIcon,
  MicrowaveIcon,
  MonitorSmartphoneIcon,
  PackageIcon,
  RefrigeratorIcon,
  ScissorsIcon,
  ShirtIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  SnowflakeIcon,
  SofaIcon,
  TvIcon,
  UtensilsIcon,
  WashingMachineIcon,
} from "lucide-react";

export type ProductCategoryOption = {
  label: string;
  icon: LucideIcon;
};

export const productCategories: ProductCategoryOption[] = [
  { label: "Refrigerators", icon: RefrigeratorIcon },
  { label: "Air Conditioners", icon: SnowflakeIcon },
  { label: "TVs", icon: TvIcon },
  { label: "Fans", icon: FanIcon },
  { label: "Phones", icon: SmartphoneIcon },
  { label: "Kitchenware", icon: UtensilsIcon },
  { label: "Rice Cookers", icon: CookingPotIcon },
  { label: "Blenders", icon: BlenderIcon },
  { label: "Microwaves", icon: MicrowaveIcon },
  { label: "Washing Machines", icon: WashingMachineIcon },
  { label: "Home Appliances", icon: HousePlugIcon },
  { label: "Home Accessories", icon: SofaIcon },
  { label: "Furniture", icon: ArmchairIcon },
  { label: "Salon Equipment", icon: ScissorsIcon },
  { label: "Sewing Machines", icon: ShirtIcon },
  { label: "Electronics", icon: MonitorSmartphoneIcon },
  { label: "Combos", icon: BoxesIcon },
  { label: "Other", icon: PackageIcon },
];

const categoryLookup = new Map(
  productCategories.map((category) => [
    category.label.toLowerCase(),
    category,
  ])
);

export function getProductCategoryMeta(category: string) {
  return (
    categoryLookup.get(category.toLowerCase()) ?? {
      label: category || "Other",
      icon: ShoppingBagIcon,
    }
  );
}

export function ProductCategoryBadge({
  category,
  className = "",
}: {
  category: string;
  className?: string;
}) {
  const meta = getProductCategoryMeta(category);
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex size-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-600 ${className}`}
      title={meta.label}
      aria-label={meta.label}
    >
      <Icon className="size-4" />
      <span className="sr-only">{meta.label}</span>
    </span>
  );
}
