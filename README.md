# RMS - Restaurant Management System

Hệ thống quản lý nhà hàng (Restaurant Management System) được xây dựng nhằm tối ưu hóa quy trình vận hành, từ việc quản lý bàn, gọi món, quản lý nhân viên đến báo cáo doanh thu.

Dự án được phát triển bằng ReactJS (Vite) kết hợp với Firebase cho backend.

## Tính năng chính

* Dashboard: Tổng quan tình hình kinh doanh, trạng thái bàn nhanh.
* Quản lý Bàn & Gọi món (Order):
    * Xem sơ đồ bàn, trạng thái bàn (Trống, Có khách, Đang chờ món).
    * Thêm/Sửa/Xóa món ăn cho từng bàn.
    * Thanh toán và xuất hóa đơn.
* Quản lý Thực đơn (Menu):
    * Danh sách món ăn, phân loại danh mục.
    * Cập nhật giá, hình ảnh và trạng thái món (Còn/Hết).
* Quản lý Nhân viên (Staff):
    * Phân quyền người dùng (Manager/Staff).
    * Thêm mới và quản lý thông tin nhân viên.
* Báo cáo (Reports):
    * Báo cáo doanh thu theo ngày/tháng.
    * Thống kê món ăn bán chạy.
* Authentication: Đăng nhập bảo mật thông qua Firebase Auth.

## Công nghệ sử dụng

* Core: React (Vite)
* Ngôn ngữ: JavaScript (ES6+)
* Styling: Tailwind CSS
* Hiệu ứng: Framer Motion
* Backend & Database:
    * Firebase Authentication (Xác thực người dùng)
    * Firebase Firestore (Cơ sở dữ liệu thời gian thực)
    * Firebase Hosting (Triển khai ứng dụng)
* Quản lý State: React Hooks (useState, useEffect, useContext...)

## Cấu trúc thư mục
```text
src/
├── assets/          # Tài nguyên tĩnh (ảnh, icon)
├── components/      # Các component tái sử dụng (Layout, UI, Auth)
├── features/        # Các chức năng chính (Dashboard, Order, Kitchen, Menu, Staff, Reports)
├── utils/           # Các hàm tiện ích (helpers)
├── App.jsx          # Component gốc & Routing
├── firebase.js      # Cấu hình Firebase
└── main.jsx         # Entry point
```
## Cài đặt và Chạy dự án

Để chạy dự án này trên máy local, hãy làm theo các bước sau:

1. Clone dự án
git clone https://github.com/truongtm127/restaurant-rms.git

cd restaurant-rms

2. Cài đặt thư viện
npm install

3. Cấu hình Firebase
Mở file src/firebase.js và đảm bảo bạn đã điền đúng thông tin cấu hình Firebase của bạn:
```text
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```
4. Chạy môi trường Dev
npm run dev


