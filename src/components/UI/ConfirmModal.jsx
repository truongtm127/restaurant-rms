// src/components/UI/ConfirmModal.jsx
import React, { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react"; // Dùng icon X để đóng

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  const [isVisible, setIsVisible] = useState(false);

  // Effect để tạo hiệu ứng fade-in/out mượt mà
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 200); // Đợi animation đóng xong
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  return (
    // 1. LỚP NỀN (OVERLAY):
    // - fixed inset-0 z-50: Phủ kín màn hình, nằm trên cùng.
    // - bg-slate-900/40: Màu xám đen trong suốt nhẹ.
    // - backdrop-blur-sm: HIỆU ỨNG LÀM MỜ NỀN QUAN TRỌNG.
    // - transition-opacity: Hiệu ứng hiện dần.
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-200
        ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        bg-slate-900/40 backdrop-blur-sm`}
      onClick={onClose} // Bấm ra ngoài thì đóng
    >
      {/* 2. HỘP MODAL (CONTAINER): */}
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden transform transition-all duration-200
          ${isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"}
          border border-slate-100`}
        onClick={(e) => e.stopPropagation()} // Chặn sự kiện click xuyên qua hộp
      >
        {/* Nút X đóng nhanh góc phải */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        <div className="p-6 pt-8 flex flex-col items-center text-center">
          {/* Icon cảnh báo lớn */}
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="text-rose-600 w-8 h-8" />
          </div>
          
          {/* Tiêu đề */}
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            {title}
          </h3>
          
          {/* Nội dung */}
          <p className="text-slate-500 leading-relaxed mb-6">
            {message}
          </p>

          {/* Khu vực nút bấm (Footer) */}
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              // Style nút đồng bộ với nút Thanh toán/Thêm trong app (dùng màu Rose cho hành động xóa)
              className="flex-1 px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 shadow-sm transition-transform active:scale-95"
            >
              Đồng ý
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;