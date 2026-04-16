import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';

export function useLiveQuery<T>(querier: () => Promise<T> | T, deps: any[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  
  useEffect(() => {
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (val) => setValue(val),
      error: (err) => console.error("Dexie query error:", err)
    });
    return () => subscription.unsubscribe();
  }, deps);
  
  return value;
}
