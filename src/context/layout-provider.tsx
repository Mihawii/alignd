"use client";

import { createContext, useContext, useState } from "react";

export type Collapsible = "offcanvas" | "icon" | "none";
export type Variant = "inset" | "sidebar" | "floating";

const DEFAULT_VARIANT: Variant = "sidebar";
const DEFAULT_COLLAPSIBLE: Collapsible = "icon";

type LayoutContextType = {
    resetLayout: () => void;
    defaultCollapsible: Collapsible;
    collapsible: Collapsible;
    setCollapsible: (collapsible: Collapsible) => void;
    defaultVariant: Variant;
    variant: Variant;
    setVariant: (variant: Variant) => void;
};

const LayoutContext = createContext<LayoutContextType | null>(null);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const [collapsible, setCollapsible] = useState<Collapsible>(DEFAULT_COLLAPSIBLE);
    const [variant, setVariant] = useState<Variant>(DEFAULT_VARIANT);

    const resetLayout = () => {
        setCollapsible(DEFAULT_COLLAPSIBLE);
        setVariant(DEFAULT_VARIANT);
    };

    return (
        <LayoutContext value={{
            resetLayout,
            defaultCollapsible: DEFAULT_COLLAPSIBLE,
            collapsible,
            setCollapsible,
            defaultVariant: DEFAULT_VARIANT,
            variant,
            setVariant,
        }}>
            {children}
        </LayoutContext>
    );
}

export function useLayout() {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error("useLayout must be used within a LayoutProvider");
    }
    return context;
}
