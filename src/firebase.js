// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ⚠️ Thay đoạn này bằng cấu hình riêng của bạn
// Bạn lấy nó từ Firebase Console > Project settings > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "AIzaSyAOKeFao616puOXPfjVenctYA6Q05yd1kQ",
  authDomain: "restaurant-rms-c7351.firebaseapp.com",
  projectId: "restaurant-rms-c7351",
  storageBucket: "restaurant-rms-c7351.firebasestorage.app",
  messagingSenderId: "67298717295",
  appId: "1:67298717295:web:0ffe3766d6b816119ae79a",
  measurementId: "G-RNMB78GST9"
};

// Khởi tạo Firebase App
const app = initializeApp(firebaseConfig);

// Xuất ra để app React có thể dùng
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
