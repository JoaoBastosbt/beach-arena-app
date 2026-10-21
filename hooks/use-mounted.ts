"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true apenas no cliente após a hidratação (LocalStorage disponível) */
export function useMounted() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
