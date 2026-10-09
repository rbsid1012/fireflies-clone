"use client";

import { createContext, useContext } from "react";

type Shell = { openNav: () => void };
const ShellContext = createContext<Shell>({ openNav: () => {} });

export const ShellProvider = ShellContext.Provider;
/** Lets a page with its own top bar (the meeting page) open the navigation drawer. */
export const useShell = () => useContext(ShellContext);
