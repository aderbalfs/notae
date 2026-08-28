"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutList, ListChecks, LogOut, Radio, Trophy } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface AdminSidebarProps {
  eventId: string;
  eventName: string;
  children: React.ReactNode;
}

export function AdminSidebar({ eventId, eventName, children }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const items = [
    {
      href: `/admin/${eventId}`,
      label: "Participantes e jurados",
      icon: ListChecks,
      exact: true,
    },
    {
      href: `/admin/${eventId}/ao-vivo`,
      label: "Votação ao vivo",
      icon: Radio,
      exact: false,
    },
    {
      href: `/admin/${eventId}/resultados`,
      label: "Ver apuração",
      icon: Trophy,
      exact: false,
    },
  ];

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    // Ocupa a viewport inteira: a área do admin é um app à parte, com sua
    // própria marca no cabeçalho do sidebar — por isso cobre o BrandHeader
    // global (necessário para os cálculos de altura do sidebar baterem
    // certo, já que ele assume que é o único elemento na tela).
    <div className="fixed inset-0 z-40 overflow-hidden bg-white">
      <SidebarProvider className="h-full">
        <Sidebar>
          <SidebarHeader>
            <Link
              href="/admin"
              className="flex flex-col gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent"
            >
              <Image
                src="/brand/logo-itabaiana.png"
                alt="Prefeitura de Itabaiana"
                width={1030}
                height={300}
                className="h-7 w-auto"
              />
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {eventName}
              </span>
            </Link>
          </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Evento</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Conta</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"} tooltip="Criar evento">
                    <Link href="/admin">
                      <LayoutList />
                      <span>Criar evento</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Sair">
                <LogOut />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="h-full overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-2 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-medium text-brand-blue-dark">{eventName}</span>
        </div>
        {children}
      </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
