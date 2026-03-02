"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { LayoutProvider } from "@/context/layout-provider";
import { cn } from "@/lib/utils";

export default function ChatLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <LayoutProvider>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset
                    className={cn(
                        "@container/content",
                        "has-data-[layout=fixed]:h-svh",
                        "peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]"
                    )}
                >
                    {children}
                </SidebarInset>
            </SidebarProvider>
        </LayoutProvider>
    );
}
