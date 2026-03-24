import { toast } from 'react-hot-toast';

export const showNotification = (message: string, isError = false) => {
  if (isError) {
    toast.error(message, {
      style: {
        borderRadius: '12px',
        background: '#333',
        color: '#fff',
      },
    });
  } else {
    toast.success(message, {
      style: {
        borderRadius: '12px',
        background: '#fff',
        color: '#333',
      },
    });
  }
};
