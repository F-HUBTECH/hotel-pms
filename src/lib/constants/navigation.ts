import {
  LayoutDashboard,
  Building2,
  Layers,
  DoorOpen,
  BedDouble,
  DollarSign,
  Calculator,
  Users,
  Globe,
  FileText,
  CreditCard,
  Tv2,
  Building,
  UserCog,
  Sparkles,
  FolderOpen,
  MapPin,
  Plane,
  Eye,
  BookOpen,
  CalendarDays,
  ClipboardList,
  PlusCircle,
  UserSearch,
  BarChart3,
  Sparkles as SparklesIcon,
  Moon,
  Webhook,
  Receipt,
  type LucideIcon,
} from "lucide-react";

import { type UserRole } from "@/lib/types/database";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[]; // If undefined, available to all
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  roles?: UserRole[]; // If undefined, available to all
}

export const navigationGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Analytics",
    items: [
      { title: "Reports", href: "/dashboard/reports", icon: BarChart3 },
      {
        title: "30-Day Forecast",
        href: "/dashboard/reports/forecast",
        icon: FileText,
      },
    ],
  },
  {
    title: "Front Desk",
    items: [
      {
        title: "Reservations",
        href: "/dashboard/reservations",
        icon: ClipboardList,
      },
      {
        title: "New Booking",
        href: "/dashboard/reservations/new",
        icon: PlusCircle,
      },
      { title: "Room Chart", href: "/dashboard/room-chart", icon: DoorOpen },
      { title: "Groups & Blocks", href: "/dashboard/groups", icon: Users },
      { title: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
      { title: "Guests", href: "/dashboard/guests", icon: UserSearch },
    ],
  },
  {
    title: "Cashier",
    items: [
      { title: "Billing Folio", href: "/dashboard/cashier", icon: Receipt },
      {
        title: "Folio Groups",
        href: "/dashboard/master/folio-groups",
        icon: FolderOpen,
      },
    ],
  },
  {
    title: "Hotel Operations",
    items: [
      {
        title: "Channel Sync",
        href: "/dashboard/operations/channel-sync",
        icon: Webhook,
      },
      {
        title: "Housekeeping",
        href: "/dashboard/operations/housekeeping",
        icon: SparklesIcon,
      },
      {
        title: "Night Audit",
        href: "/dashboard/operations/night-audit",
        icon: Moon,
      },
    ],
  },
  {
    title: "Property (Master)",
    roles: ["super_admin", "admin", "manager"],
    items: [
      {
        title: "Buildings",
        href: "/dashboard/master/buildings",
        icon: Building2,
      },
      {
        title: "Floor Plans",
        href: "/dashboard/master/floor-plans",
        icon: Layers,
      },
      {
        title: "Room Types",
        href: "/dashboard/master/room-types",
        icon: BedDouble,
      },
      { title: "Rooms", href: "/dashboard/master/rooms", icon: DoorOpen },
    ],
  },
  {
    title: "Rates (Master)",
    roles: ["super_admin", "admin", "manager"],
    items: [
      {
        title: "Rate Plans",
        href: "/dashboard/master/rate-plans",
        icon: DollarSign,
      },
      {
        title: "Rate Groups",
        href: "/dashboard/master/rate-groups",
        icon: DollarSign,
      },
      {
        title: "Rate Formulas",
        href: "/dashboard/master/rate-formulas",
        icon: Calculator,
      },
    ],
  },
  {
    title: "Guests (Master)",
    roles: ["super_admin", "admin", "manager"],
    items: [
      {
        title: "Guest Types",
        href: "/dashboard/master/guest-types",
        icon: Users,
      },
      {
        title: "Nationalities",
        href: "/dashboard/master/nationalities",
        icon: Globe,
      },
      {
        title: "Passport Types",
        href: "/dashboard/master/passport-types",
        icon: FileText,
      },
      { title: "Visa Types", href: "/dashboard/master/visa-types", icon: Eye },
    ],
  },
  {
    title: "Booking (Master)",
    roles: ["super_admin", "admin", "manager"],
    items: [
      {
        title: "Booking Sources",
        href: "/dashboard/master/booking-sources",
        icon: BookOpen,
      },
      { title: "Channels", href: "/dashboard/master/channels", icon: Tv2 },
      {
        title: "Market Groups",
        href: "/dashboard/master/market-groups",
        icon: CreditCard,
      },
      { title: "Markets", href: "/dashboard/master/markets", icon: Plane },
    ],
  },
  {
    title: "Rooms (Master)",
    roles: ["super_admin", "admin", "manager"],
    items: [
      {
        title: "Room Views",
        href: "/dashboard/master/room-views",
        icon: Eye,
      },
    ],
  },
  {
    title: "Operations (Master)",
    roles: ["super_admin", "admin", "manager"],
    items: [
      {
        title: "Departments",
        href: "/dashboard/master/departments",
        icon: Building,
      },
      {
        title: "User Groups",
        href: "/dashboard/master/user-groups",
        icon: UserCog,
      },
      {
        title: "Special Services",
        href: "/dashboard/master/special-services",
        icon: Sparkles,
      },
      {
        title: "Zone Codes",
        href: "/dashboard/master/zone-codes",
        icon: MapPin,
      },
    ],
  },
];
