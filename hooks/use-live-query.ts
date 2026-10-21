"use client";

import { useEffect, useRef, useState, type DependencyList } from "react";
import { subscribe } from "@/services/core/events";

/**
 * Executa uma consulta assíncrona aos serviços e a refaz sempre que qualquer
 * dado mudar (escritas nos repositórios, troca de arena, outra aba).
 * Retorna `undefined` enquanto carrega pela primeira vez.
 */
export function useLiveQuery<T>(query: () => Promise<T>, deps: DependencyList = []): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);
  const queryRef = useRef(query);
  const runId = useRef(0);

  useEffect(() => {
    queryRef.current = query;
  });

  useEffect(() => {
    let active = true;
    const run = () => {
      const id = ++runId.current;
      queryRef.current()
        .then((result) => {
          if (active && id === runId.current) setData(result);
        })
        .catch((err) => console.error("[useLiveQuery]", err));
    };
    run();
    const unsubscribe = subscribe(run);
    return () => {
      active = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}
