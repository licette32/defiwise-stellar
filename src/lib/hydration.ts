"use client";

import { useState, useEffect, useCallback, ReactNode, createElement, Fragment } from "react";

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}

export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createElement(Fragment, null, children);
}

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const isHydrated = useHydrated();
  const [value, setValue] = useState<T>(defaultValue);

  useEffect(() => {
    if (isHydrated) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          setValue(JSON.parse(stored));
        }
      } catch {
        setValue(defaultValue);
      }
    }
  }, [key, defaultValue, isHydrated]);

  const saveValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof newValue === "function"
          ? (newValue as (prev: T) => T)(prev)
          : newValue;
        localStorage.setItem(key, JSON.stringify(resolved));
        return resolved;
      });
    },
    [key]
  );

  return [value, saveValue] as const;
}

export function getHydratedValue<T>(isHydrated: boolean, hydratedValue: T, defaultValue: T): T {
  return isHydrated ? hydratedValue : defaultValue;
}
