import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cleanAddress(address: string | null | undefined): string {
  if (!address) return '';
  
  // 1. Phân tách địa chỉ thành các phần
  const segments = address.split(',').map(s => s.trim()).filter(Boolean);
  
  // 2. Lọc bỏ các cấp hành chính (Ấp, Xã, Phường, Quận, Huyện...)
  const excludeKeywords = ['ấp', 'xã', 'phường', 'huyện', 'quận', 'tỉnh', 'thành phố', 'thanh pho', 'district', 'province', 'thị trấn', 'thị xã'];
  
  // Lấy các phần không chứa từ khóa hành chính (thường là số nhà và đường)
  const streetParts = segments.filter(s => {
    const l = s.toLowerCase();
    return !excludeKeywords.some(k => l.includes(k));
  });

  if (streetParts.length >= 1) {
    let houseNum = '';
    let streetName = '';

    // Kiểm tra xem phần đầu tiên có phải là số nhà không
    const firstPart = streetParts[0];
    if (/^\d/.test(firstPart)) {
      houseNum = firstPart.replace(/^số\s+/gi, '').trim();
      streetName = streetParts.slice(1).join(', ');
    } else {
      streetName = streetParts.join(', ');
    }

    let result = '';
    if (houseNum) {
      result += `Số ${houseNum} `;
    }
    
    if (streetName) {
      // Thêm tiền tố "Đường" nếu chưa có
      const streetLower = streetName.toLowerCase();
      if (!streetLower.includes('đường') && !streetLower.includes('phố') && !streetLower.includes('ql') && !streetLower.includes('quốc lộ')) {
        result += `Đường ${streetName}`;
      } else {
        result += streetName;
      }
    }

    return result.trim() || segments[0];
  }

  // Fallback
  return segments[0].replace(/^(Ấp|Xã|Phường)\s+/gi, '').trim();
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
