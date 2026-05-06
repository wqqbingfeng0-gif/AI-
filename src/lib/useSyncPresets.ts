import { useState, useEffect } from 'react';

export function useSyncPresets<T>(key: string, defaultVal: T) {
  const [presets, setPresets] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultVal;
    } catch {
      return defaultVal;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(presets));
  }, [presets, key]);

  const updatePresets = (updater: T | ((prev: T) => T)) => {
    setPresets((prev) => {
      const nextVal = typeof updater === 'function' ? (updater as any)(prev) : updater;
      return nextVal;
    });
  };

  return [presets, updatePresets] as const;
}
