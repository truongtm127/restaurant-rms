// src/utils/helpers.js

/* ----------------------------- Formatting ------------------------------ */

// Định dạng tiền tệ Việt Nam (VD: 100.000đ)
export const fmtVND = (v) => (Number(v) || 0).toLocaleString('vi-VN') + 'đ';

// Nhãn hiển thị thứ trong tuần (0=CN, 1=T2, ...)
export const dayLabel = (i) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][i];


/* ----------------------------- Date Helpers ---------------------------- */

// Cộng trừ ngày
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Bắt đầu ngày (00:00:00)
export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// Kết thúc ngày (23:59:59)
export const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

// Bắt đầu tuần (Thứ 2)
export const startOfWeek = (d = new Date()) => {
  const x = new Date(d);
  const dw = (x.getDay() + 6) % 7; // Chuyển T2=0 ... CN=6
  x.setDate(x.getDate() - dw);
  x.setHours(0, 0, 0, 0);
  return x;
};

// Kết thúc tuần (Chủ nhật)
export const endOfWeek = (d = new Date()) => {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
};

// Bắt đầu tháng
export const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);

// Kết thúc tháng
export const endOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

// Bắt đầu quý
export const startOfQuarter = (d = new Date()) =>
  new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1, 0, 0, 0, 0);

// Kết thúc quý
export const endOfQuarter = (d = new Date()) =>
  new Date(
    d.getFullYear(),
    Math.floor(d.getMonth() / 3) * 3 + 3,
    0,
    23,
    59,
    59,
    999
  );

// Bắt đầu năm
export const startOfYear = (d = new Date()) =>
  new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);

// Kết thúc năm
export const endOfYear = (d = new Date()) =>
  new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);


/* ----------------------------- Error Handling -------------------------- */

// Chuyển mã lỗi Firebase Auth sang tiếng Việt
export const getAuthErrorMessage = (code) => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Thông tin đăng nhập chưa chính xác';
    case 'auth/invalid-email':
      return 'Email không hợp lệ';
    case 'auth/too-many-requests':
      return 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau';
    case 'auth/network-request-failed':
      return 'Không thể kết nối mạng. Kiểm tra internet của bạn';
    default:
      return 'Đăng nhập thất bại. Vui lòng thử lại';
  }
};

/* ----------------------------- Image Helpers -------------------------- */

// HÀM MỚI: Nén ảnh client-side bằng Canvas
export const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        // Tính toán kích thước mới (Max width = 800px)
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Xuất ra file JPEG chất lượng 70%
        canvas.toBlob((blob) => {
          const newFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(newFile);
        }, 'image/jpeg', 0.7); 
      };
    };
  });
};