import React from 'react';
import { createRoot } from 'react-dom/client';
// นำเข้า Component หลักของ Dashboard ที่ชื่อ App
// ใช้ตัวพิมพ์เล็กและเพิ่มนามสกุล .jsx กลับเข้าไปเพื่อความแน่นอน
import App from './inwzashopdashboard.jsx'; 

const container = document.getElementById('root');

if (container) {
    const root = createRoot(container);
    // Render Component App ลงใน element ที่มี id="root"
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
} else {
    console.error("Failed to find the root element to render the React application.");
}
