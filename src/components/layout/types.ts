export type User = {
    name: string
    email: string
    avatar: string
}

export type Team = {
    name: string
    logo: React.ElementType
    plan: string
}

export type BaseNavItem = {
    title: string
    badge?: string
    icon?: React.ElementType
}

export type NavLink = BaseNavItem & {
    url: string
    items?: never
}

export type NavCollapsible = BaseNavItem & {
    items: (BaseNavItem & { url: string })[]
    url?: never
}

export type NavItem = NavCollapsible | NavLink

export type NavGroup = {
    title: string
    items: NavItem[]
}

export type SidebarData = {
    user: User
    teams: Team[]
    navGroups: NavGroup[]
}
