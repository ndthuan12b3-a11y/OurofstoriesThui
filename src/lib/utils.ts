import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cleanAddress(address: string | null | undefined): string {
  if (!address) return '';
  
  // 1. Phân tách địa chỉ thành các phần
  const segments = address.split(',').map(s => s.trim()).filter(Boolean);
  
  // 2. Lọc bỏ các cấp hành chính lớn (Tỉnh, Thành phố, Quốc gia)
  const excludeKeywords = ['tỉnh', 'thành phố', 'thanh pho', 'quốc gia', 'vietnam', 'việt nam', 'province', 'city', 'country'];
  
  // Lấy các phần chi tiết (Số nhà, đường, phường, quận)
  const detailParts = segments.filter(s => {
    const l = s.toLowerCase();
    return !excludeKeywords.some(k => l.includes(k));
  });

  if (detailParts.length >= 1) {
    // Trả về tối đa 3 phần chi tiết đầu tiên (thường là Tên -> Số nhà/Đường -> Phường/Quận)
    return detailParts.slice(0, 3).join(', ');
  }

  // Fallback
  return segments[0];
}

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
