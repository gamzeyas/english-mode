"use client";

import { useState } from "react";

/**
 * Local state seeded from server-rendered props that follows fresh props.
 * Next keeps visited routes mounted and restores them on return; a plain
 * `useState(prop)` would keep showing the data from the first visit even
 * after the server sends newer data (e.g. phrases saved on another page).
 * Uses React's "adjust state when a prop changes" pattern.
 */
export function useServerState<T>(serverValue: T) {
  const [value, setValue] = useState(serverValue);
  const [seen, setSeen] = useState(serverValue);
  if (seen !== serverValue) {
    setSeen(serverValue);
    setValue(serverValue);
  }
  return [value, setValue] as const;
}
