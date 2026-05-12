import { toast } from 'react-hot-toast';

/**
 * Dismisses all active toast notifications.
 * This is also exposed globally to prevent ReferenceErrors if called from outside React.
 */
export const dismissAllNotifications = () => {
  try {
    toast.dismiss();
  } catch (error) {
    console.warn("Failed to dismiss notifications:", error);
  }
};

export const showNotification = (message: string, isError = false) => {
  let displayMessage = message;
  
  // Clean translation for common tech errors
  if (message === 'Failed to fetch' || message.includes('Failed to fetch')) {
    displayMessage = 'Mất kết nối mạng hoặc Server đang tạm nghỉ. Vui lòng thử lại sau! ⏳';
  } else if (message.includes('refresh_token_not_found')) {
    displayMessage = 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại. 🔑';
  }

  const options = {
    style: {
      borderRadius: '12px',
      background: isError ? '#333' : '#fff',
      color: isError ? '#fff' : '#333',
      fontSize: '14px',
      fontWeight: 'bold',
      padding: '12px 20px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    duration: isError ? 4000 : 3000,
  };

  if (isError) {
    toast.error(displayMessage, options);
  } else {
    toast.success(displayMessage, options);
  }
};
