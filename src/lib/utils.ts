/**
 * Shared class-merging helper for composing Tailwind utility sets.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Combines conditional class names and resolves Tailwind utility conflicts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
