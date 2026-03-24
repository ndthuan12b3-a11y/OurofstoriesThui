import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, includeTime = false) {
  if (!date) return 'N/A';
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
    options.hour12 = false;
  }
  return d.toLocaleDateString('vi-VN', options);
}

export function calculateDays(start: string) {
  if (!start) return 0;
  const diff = Date.now() - new Date(start).getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
}

export function encodeHTML(s: string) {
  if (typeof s !== 'string') return s;
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
