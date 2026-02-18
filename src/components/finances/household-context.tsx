"use client";

import { createContext, useContext } from "react";

interface HouseholdContextValue {
  householdId: number;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  householdId,
  children,
}: {
  householdId: number;
  children: React.ReactNode;
}) {
  return <HouseholdContext.Provider value={{ householdId }}>{children}</HouseholdContext.Provider>;
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error("useHousehold must be used within a HouseholdProvider");
  }
  return ctx;
}
