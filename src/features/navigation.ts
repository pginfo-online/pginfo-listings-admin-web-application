import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ContactRound,
  Download,
  Layers3,
  LayoutDashboard,
  MapPin,
  Smartphone,
  Users,
} from "lucide-react";

export const groups = [
  {
    label: "Workspace",
    links: [
      {
        id: "dashboard",
        title: "Overview",
        icon: LayoutDashboard,
        description:
          "Track listing activity and the work that needs attention.",
      },
      {
        id: "analytics",
        title: "Analytics",
        icon: Activity,
        description:
          "Review listing coverage, account totals, leads, and visit requests.",
      },
    ],
  },
  {
    label: "Operations",
    links: [
      {
        id: "properties",
        title: "Properties",
        icon: Building2,
        description:
          "Manage the property catalogue and review listing submissions.",
      },
      {
        id: "reviews",
        title: "Update requests",
        icon: ClipboardCheck,
        description: "Review changes proposed for existing listings.",
      },
      {
        id: "activity",
        title: "Leads & visits",
        icon: ContactRound,
        description:
          "Review listing inquiries and scheduled visits across the marketplace.",
      },
      {
        id: "users",
        title: "Users",
        icon: Users,
        description: "Manage accounts, access, and roles.",
      },
      {
        id: "locations",
        title: "Cities & areas",
        icon: MapPin,
        description: "Maintain the locations people use to find properties.",
      },
      {
        id: "meetups",
        title: "Meetups",
        icon: CalendarDays,
        description: "Manage events, approvals, and participants.",
      },
      {
        id: "categories",
        title: "Meetup categories",
        icon: Layers3,
        description:
          "Organize event discovery categories and their display order.",
      },
    ],
  },
  {
    label: "Platform",
    links: [
      {
        id: "notifications",
        title: "Notifications",
        icon: Bell,
        description:
          "Compose campaigns, schedule delivery, and review receipts.",
      },
      {
        id: "versions",
        title: "App versions",
        icon: Smartphone,
        description: "Manage mobile releases, rollout rules, and maintenance.",
      },
      {
        id: "exports",
        title: "Data exports",
        icon: Download,
        description: "Generate Excel files for approved marketing workflows.",
      },
    ],
  },
];

export const sections = groups.flatMap((group) => group.links);
