import {
    LayoutDashboard,
    Upload,
    MessageSquare,
    BarChart3,
    Settings,
    HelpCircle,
} from "lucide-react";
import { type SidebarData } from "./types";

export const sidebarData: SidebarData = {
    user: {
        name: "User",
        email: "user@alignd.ai",
        avatar: "",
    },
    teams: [
        {
            name: "alignd",
            logo: BarChart3,
            plan: "AI Analytics",
        },
    ],
    navGroups: [
        {
            title: "General",
            items: [
                {
                    title: "Dashboard",
                    url: "/chat",
                    icon: LayoutDashboard,
                },
                {
                    title: "Upload",
                    url: "/upload",
                    icon: Upload,
                },
                {
                    title: "Chat",
                    url: "/chat",
                    icon: MessageSquare,
                },
                {
                    title: "Analytics",
                    url: "/chat",
                    icon: BarChart3,
                },
            ],
        },
        {
            title: "Other",
            items: [
                {
                    title: "Settings",
                    icon: Settings,
                    items: [
                        {
                            title: "General",
                            url: "/chat",
                        },
                    ],
                },
                {
                    title: "Help Center",
                    url: "/chat",
                    icon: HelpCircle,
                },
            ],
        },
    ],
};
