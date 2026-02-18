"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  List,
  PiggyBank,
  Repeat,
  ScanLine,
  ShoppingCart,
  Tags,
  Wallet,
} from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

const items = [
  {
    title: "Finances",
    url: "/finances",
    icon: Wallet,
    items: [
      {
        title: "Monthly Budget",
        url: "/finances",
        icon: CalendarCheck,
      },
      {
        title: "Caixinhas",
        url: "/finances/caixinhas",
        icon: PiggyBank,
      },
      {
        title: "Recurring",
        url: "/finances/recurring",
        icon: Repeat,
      },
      {
        title: "Categories",
        url: "/finances/categories",
        icon: Tags,
      },
    ],
  },
  {
    title: "Groceries",
    url: "/groceries",
    icon: ShoppingCart,
    items: [
      {
        title: "Purchases",
        url: "/groceries",
        icon: List,
      },
      {
        title: "Scan Receipt",
        url: "/groceries/scan",
        icon: ScanLine,
      },
    ],
  },
];

export function NavMain() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={pathname.startsWith(item.url)}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={item.title}>
                    <item.icon />
                    <span>{item.title}</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild isActive={pathname === subItem.url}>
                          <Link href={subItem.url}>
                            <subItem.icon />
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
