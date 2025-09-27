import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Zap, Users, CheckSquare, Clock, Globe, Brain, Send } from 'lucide-react';

// URL ของ WebSocket Server ที่ Deploy บน Render
const REALTIME_API_ENDPOINT = "wss://inwzashop-farm-dashboard-backend-1.onrender.com/ws";

// Gemini API Configuration
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=";
const API_KEY = ""; // Key จะถูกจัดการโดย Canvas Environment

// --- Utility Functions and Mock Data ---

/**
 * @typedef {Object} AccountStatus
 * @property {string} id - Account ID (masked)
 * @property {string} status - 'Farming', 'Completed', 'Offline'
 * @property {number} gemsCurrent
 * @property {number} gemsTarget
 * @property {number} monarchTokens
 * @property {number} flowers
 * @property {string} timer - Time remaining/status text
 * @property {string} taskGoal - Current objective
 */

/**
 * @typedef {Object} DashboardData
 * @property {Object} summary
 * @property {number} summary.completedOrders
 * @property {string} summary.ordersGrowth
 * @property {number} summary.totalCustomers
 * @property {number} summary.newCustomers
 * @property {number} summary.totalAccounts
 * @property {string} summary.shopStatus
 * @property {AccountStatus[]} accounts
 * @property {Object[]} recentOrders
 * @property {Object[]} topBuyers
 */

/**
 * ฟังก์ชันสำหรับเรียก Gemini API ด้วย Exponential Backoff
 * @param {string} prompt - ข้อความ prompt ที่จะส่งให้ AI
 * @param {string} systemPrompt - คำแนะนำสำหรับ AI
 * @param {number} maxRetries - จำนวนครั้งสูงสุดที่จะลองใหม่
 */
const callGeminiApi = async (prompt, systemPrompt, maxRetries = 3) => {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };
    
    const url = `${GEMINI_API_URL}${API_KEY}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                return result.candidates?.[0]?.content?.parts?.[0]?.text || "AI ไม่สามารถสร้างคำแนะนำได้ในขณะนี้";
            } else if (response.status === 429 && attempt < maxRetries - 1) {
                // Too Many Requests - ใช้ Exponential Backoff
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                const errorText = await response.text();
                throw new Error(`API returned status ${response.status}: ${errorText}`);
            }
        } catch (error) {
            console.error(`Gemini API Error (Attempt ${attempt + 1}):`, error);
            if (attempt === maxRetries - 1) {
                return `เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI: ${error.message}.`;
            }
        }
    }
    return "เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI: ไม่สามารถลองใหม่ได้อีก";
};

/**
 * ฟังก์ชันจำลองการดึงข้อมูลจาก API (ใช้สำหรับ Initial Load และ Fallback)
 * @returns {DashboardData}
 */
const getMockData = () => {
    const completedOrders = 12450 + Math.floor(Math.random() * 5);
    const customers = 8900 + Math.floor(Math.random() * 3);
    
    /** @type {AccountStatus[]} */
    const mockAccounts = [
        { id: 'sp***s4', status: 'Farming', gemsCurrent: 35000 + (Math.random() * 100), gemsTarget: 40000, monarchTokens: 125, flowers: 800, timer: '02:45:10', taskGoal: 'Gems Target' },
        { id: 'ro***22', status: 'Completed', gemsCurrent: 40000, gemsTarget: 40000, monarchTokens: 200, flowers: 1500, timer: 'Task Done', taskGoal: 'Waiting' },
        { id: 'da***88', status: 'Offline', gemsCurrent: 12000, gemsTarget: 30000, monarchTokens: 50, flowers: 300, timer: 'Down', taskGoal: 'Reconnect' },
        { id: 'ne***x1', status: 'Farming', gemsCurrent: 15000 + (Math.random() * 100), gemsTarget: 20000, monarchTokens: 80, flowers: 450, timer: '00:15:30', taskGoal: 'Collect Eggs' },
        { id: 'ki***3a', status: 'Farming', gemsCurrent: 42000 + (Math.random() * 100), gemsTarget: 50000, monarchTokens: 180, flowers: 1200, timer: '05:00:00', taskGoal: 'Gems Target' },
        { id: 'wi***2p', status: 'Farming', gemsCurrent: 21000 + (Math.random() * 100), gemsTarget: 35000, monarchTokens: 100, flowers: 600, timer: '01:50:20', taskGoal: 'Boss Raid' },
    ].map(acc => ({
        ...acc,
        gemsCurrent: Math.round(acc.gemsCurrent) 
    }));

    return {
        summary: {
            completedOrders: completedOrders,
            ordersGrowth: (Math.random() * 5 + 1).toFixed(2),
            totalCustomers: customers,
            newCustomers: Math.floor(Math.random() * 10),
            totalAccounts: mockAccounts.filter(a => a.status !== 'Offline').length,
            shopStatus: 'LIVE',
        },
        accounts: mockAccounts,
        recentOrders: [
            { name: 'User' + Math.floor(Math.random() * 999), item: '40K Gems', price: 15.99 },
            { name: 'JameD', item: 'Monarch Token 50', price: 5.50 },
            { name: 'AlexH', item: '10K Flowers', price: 9.99 },
            { name: 'LisaM', item: 'Full Set Armor', price: 25.00 },
            { name: 'NewUser', item: '500 Flowers', price: 1.50 },
        ],
        topBuyers: [
            { name: 'CryptoKing', spent: 1245.50 },
            { name: 'FarmLord', spent: 980.00 },
            { name: 'SpeedyGonz', spent: 750.25 },
            { name: 'EliteGamer', spent: 500.00 },
        ]
    };
};

// --- Sub Components ---

/**
 * Modal Component สำหรับแสดงผลลัพธ์จาก AI
 * @param {{ title: string, content: string, onClose: () => void }} props
 */
const Modal = ({ title, content, onClose }) => {
    if (!content) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e1e1e] rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-accent-primary">
                <div className="p-6">
                    <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                        <h3 className="text-xl font-mono font-bold text-accent-primary flex items-center">
                            <Brain className="h-5 w-5 mr-2"/>{title}
                        </h3>
                        <button onClick={onClose} className="text-white/60 hover:text-white transition duration-200 text-2xl leading-none">
                            &times;
                        </button>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-white/80 p-2 bg-[#2a2a2a] rounded-lg border border-white/5">
                        {content}
                    </div>
                    <div className="mt-4 text-right">
                        <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition duration-300">
                            ปิด
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


/**
 * Card สำหรับแสดงสถิติสรุป
 * ... (unchanged)
 */
const SummaryCard = ({ title, value, icon, subText, accentColor, isUpdating }) => (
    <div 
        className={`p-5 rounded-xl border border-accent-primary/30 shadow-2xl transition duration-300
                    bg-[#1e1e1e] hover:shadow-[0_0_20px_#00CED150]
                    ${isUpdating ? 'animate-pulse-once' : ''}`}
        style={{ '--tw-shadow-color': accentColor }}
    >
        <div className="flex justify-between items-start">
            <p className="text-sm text-white/60 mb-2">{title}</p>
            {React.cloneElement(icon, { className: 'h-6 w-6 text-white/40' })}
        </div>
        <span className="text-4xl font-mono font-bold text-accent-primary block mt-1">{value}</span>
        <p className="text-sm mt-2 font-mono text-green-400">{subText}</p>
    </div>
);

/**
 * Row สำหรับตารางสถานะบัญชี
 * ... (unchanged)
 */
const AccountRow = ({ account }) => {
    const percent = Math.min(100, (account.gemsCurrent / account.gemsTarget) * 100);
    const isComplete = account.status === 'Completed';

    const statusMap = {
        'Farming': { class: 'bg-green-600 text-white', text: 'Farming' },
        'Completed': { class: 'bg-[#00CED1] text-gray-900 font-bold', text: 'COMPLETED' },
        'Offline': { class: 'bg-red-600 text-white', text: 'Offline' },
    };

    const currentStatus = statusMap[account.status] || { class: 'bg-gray-500 text-white', text: 'Unknown' };

    const gemsCurrentFormatted = Math.round(account.gemsCurrent).toLocaleString();
    const gemsTargetFormatted = account.gemsTarget.toLocaleString();

    return (
        <tr className="hover:bg-[#282828] transition duration-150 border-b border-white/5">
            <td className="px-6 py-4 whitespace-nowrap text-white/90">{account.id}</td>
            <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${currentStatus.class}`}>
                    {currentStatus.text}
                </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
                <p className={`text-xs mb-1 ${isComplete ? 'text-[#00CED1]' : 'text-white/80'}`}>{gemsCurrentFormatted} / ${gemsTargetFormatted} Gems</p>
                <div className="progress-bar-container w-full max-w-[200px] h-2 bg-[#333] rounded-sm overflow-hidden">
                    <div 
                        className="h-full bg-[#00CED1] shadow-glow" 
                        style={{ width: `${percent}%`, transition: 'width 0.5s ease-out', boxShadow: '0 0 5px #00CED1' }}
                    ></div>
                </div>
                <p className="text-xs mt-1 text-white/50">Tokens: {account.monarchTokens} | Flowers: {account.flowers}</p>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                <p className="font-mono">{account.timer}</p>
                <p className="text-xs text-white/50 mt-1">Goal: {account.taskGoal}</p>
            </td>
        </tr>
    );
};

// --- Main App Component ---

const initialData = {
    summary: { completedOrders: 0, ordersGrowth: '0.00', totalCustomers: 0, newCustomers: 0, totalAccounts: 0, shopStatus: '...'},
    accounts: [],
    recentOrders: [],
    topBuyers: []
};

function App() {
    const [dashboardData, setDashboardData] = useState(initialData);
    const [updatingCards, setUpdatingCards] = useState({});
    const [aiStrategy, setAiStrategy] = useState(null); 
    const [aiDraft, setAiDraft] = useState(null); 
    const [isLoading, setIsLoading] = useState(false); 

    // *** NEW: State สำหรับสถานะ WebSocket ***
    const [wsStatus, setWsStatus] = useState('CONNECTING');
    const [wsMessageCount, setWsMessageCount] = useState(0);

    // ฟังก์ชันหลักสำหรับดึงข้อมูลเริ่มต้น (ใช้ Mock Data)
    const fetchInitialData = useCallback(() => {
        const newData = getMockData(); 
        setDashboardData(newData);
    }, []);

    // Effect สำหรับการเชื่อมต่อ WebSocket และจัดการข้อมูล
    useEffect(() => {
        fetchInitialData(); // โหลด Mock Data ทันที
        
        let ws;
        let reconnectTimeout;

        const connect = () => {
            setWsStatus('CONNECTING');
            try {
                ws = new WebSocket(REALTIME_API_ENDPOINT);
                
                ws.onopen = () => {
                    console.log('WebSocket Connected.');
                    setWsStatus('LIVE');
                    // ในชีวิตจริง: อาจส่ง Request เพื่อขอข้อมูล Snapshot ครั้งแรก
                };

                ws.onmessage = (event) => {
                    setWsMessageCount(prev => prev + 1);
                    try {
                        const incomingData = JSON.parse(event.data);
                        // *** IMPORTANT: อัปเดต State ด้วยข้อมูลจริงที่ได้รับจาก Backend ***
                        // ตรวจสอบว่า incomingData มีโครงสร้างเดียวกับ DashboardData
                        setDashboardData(incomingData); 
                        
                        // ในกรณีที่มีการอัปเดตข้อมูลจำนวนมาก ควรเพิ่ม logic เพื่อจัดการ Animation (updatingCards) 
                        // ที่นี่ based on incomingData
                    } catch (e) {
                        console.error('Error parsing WebSocket data:', e);
                    }
                };

                ws.onerror = (error) => {
                    console.error('WebSocket Error:', error);
                    setWsStatus('ERROR');
                    ws.close();
                };

                ws.onclose = () => {
                    console.log('WebSocket Disconnected. Attempting reconnect...');
                    setWsStatus('DISCONNECTED');
                    clearTimeout(reconnectTimeout);
                    reconnectTimeout = setTimeout(connect, 5000); // ลองเชื่อมต่อใหม่ทุก 5 วินาที
                };

            } catch (error) {
                console.error("Failed to initialize WebSocket:", error);
                setWsStatus('ERROR');
            }
        };

        connect();

        // Cleanup function: ปิดการเชื่อมต่อเมื่อ Component ถูกถอดออก
        return () => {
            clearTimeout(reconnectTimeout);
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                ws.close();
            }
        };
    }, [fetchInitialData]); // รันครั้งเดียวเมื่อ Component ถูกโหลด

    // --------------------------------------------------------
    // *** ฟังก์ชัน Gemini API (unchanged) ***
    // --------------------------------------------------------

    const handleGenerateStrategy = async () => {
        setIsLoading(true);
        setAiStrategy(null);

        const farmingAccounts = dashboardData.accounts
            .filter(acc => acc.status === 'Farming' && acc.gemsCurrent < acc.gemsTarget)
            .map(acc => (
                `Account ID: ${acc.id}, Status: ${acc.status}, Gems: ${acc.gemsCurrent}/${acc.gemsTarget}, Tokens: ${acc.monarchTokens}, Flowers: ${acc.flowers}, Goal: ${acc.taskGoal}`
            ))
            .join('\n');

        if (!farmingAccounts) {
            setAiStrategy("ไม่มีบัญชีที่กำลัง 'Farming' อยู่ในขณะนี้");
            setIsLoading(false);
            return;
        }

        const prompt = `Based on the following active farming accounts, provide a concise, actionable, and prioritized strategy recommendation for the next 4 hours to maximize resource gain (Gems, Monarch Tokens, Flowers). 
        
        Active Accounts:
        ${farmingAccounts}`;

        const systemPrompt = "You are a professional game macro farm strategist. Respond in Thai using bullet points. Focus on key decisions: which account needs a priority check, which resource is currently most critical to focus on, and any accounts nearing their target.";

        const result = await callGeminiApi(prompt, systemPrompt);
        setAiStrategy(result);
        setIsLoading(false);
    };

    const handleGenerateDraft = async () => {
        setIsLoading(true);
        setAiDraft(null);

        const recentOrdersText = dashboardData.recentOrders
            .map(order => `${order.item} (Price: $${order.price.toFixed(2)})`)
            .join(', ');
        
        const topBuyersText = dashboardData.topBuyers
            .map(buyer => `${buyer.name} (Spent: $${buyer.spent.toFixed(2)})`)
            .slice(0, 3)
            .join(', ');


        const prompt = `Draft a short, compelling social media post (e.g., for Discord/Facebook) to promote the INWZASHOP farming service. 
        
        The post must highlight the success based on these recent data points:
        - Recent Successful Orders: ${recentOrdersText}
        - Top 3 Buyers Last Period: ${topBuyersText}
        - Total Completed Orders: ${dashboardData.summary.completedOrders}
        
        The tone should be professional and exciting. Include relevant emojis.`;

        const systemPrompt = "You are a social media marketing specialist for a gaming service. Draft the post in a captivating Thai language and keep it under 10 lines, emphasizing trust and speed.";

        const result = await callGeminiApi(prompt, systemPrompt);
        setAiDraft(result);
        setIsLoading(false);
    };

    // --- การแสดงผลสถานะ WS ---
    const getWsStatusDisplay = () => {
        switch (wsStatus) {
            case 'LIVE':
                return { text: `LIVE (${wsMessageCount} updates)`, color: 'text-green-400', icon: <Globe className="h-4 w-4 mr-1 text-green-400" /> };
            case 'CONNECTING':
                return { text: 'CONNECTING...', color: 'text-yellow-400', icon: <Globe className="h-4 w-4 mr-1 text-yellow-400 animate-spin" /> };
            case 'DISCONNECTED':
                return { text: 'DISCONNECTED (Reconnecting)', color: 'text-orange-400', icon: <Globe className="h-4 w-4 mr-1 text-orange-400" /> };
            case 'ERROR':
                return { text: 'ERROR', color: 'text-red-600', icon: <Globe className="h-4 w-4 mr-1 text-red-600" /> };
            default:
                return { text: 'UNKNOWN', color: 'text-gray-400', icon: <Globe className="h-4 w-4 mr-1 text-gray-400" /> };
        }
    };
    const wsDisplay = getWsStatusDisplay();


    return (
        <div className="min-h-screen bg-dark-bg text-white font-sans pb-10">
            <style jsx global>{`
                /* Global CSS for aesthetic */
                body {
                    font-family: 'Inter', sans-serif;
                }
                .text-accent-primary {
                    color: #00CED1;
                }
                .shadow-glow {
                    box-shadow: 0 0 5px #00CED1;
                }
                .animate-pulse-once {
                    animation: glow 0.5s ease-in-out 2 alternate;
                }
                @keyframes glow {
                    0%, 100% { box-shadow: 0 0 5px #00CED180; }
                    50% { box-shadow: 0 10px 20px #00CED150; }
                }
                .marquee {
                    white-space: nowrap;
                    overflow: hidden;
                    box-sizing: border-box;
                    animation: marquee 10s linear infinite;
                }
                @keyframes marquee {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                .bg-dark-bg {
                    background-color: #121212; /* Dark background for modern look */
                }
            `}</style>
            
            {/* Modal Components */}
            <Modal 
                title="✨ AI Strategy Recommendation" 
                content={isLoading && !aiStrategy ? "กำลังวิเคราะห์ข้อมูล..." : aiStrategy} 
                onClose={() => setAiStrategy(null)} 
            />
            <Modal 
                title="✨ Social Media Draft" 
                content={isLoading && !aiDraft ? "กำลังร่างข้อความ..." : aiDraft} 
                onClose={() => setAiDraft(null)} 
            />

            {/* Header / Navigation Bar */}
            <header className="bg-[#0f0f0f] border-b border-accent-primary/30 p-4 shadow-xl">
                <div className="max-w-7xl mx-auto flex justify-between items-center flex-wrap">
                    <div className="text-2xl md:text-3xl font-mono font-bold text-accent-primary tracking-widest cursor-pointer">
                        INWZASHOP<span className="text-white/70 text-sm ml-1">v2.1</span>
                    </div>
                    <div className="flex space-x-3 items-center mt-2 md:mt-0">
                         <span className={`text-sm flex items-center ${wsDisplay.color}`}>
                            {wsDisplay.icon} WS Status: <span className="ml-1 font-mono font-bold">{wsDisplay.text}</span>
                        </span>
                        <button className="bg-[#6a0dad] hover:bg-[#8525cc] text-white text-sm font-semibold py-2 px-3 rounded-lg transition duration-300 shadow-lg shadow-[#6a0dad]/50 flex items-center">
                            <Zap className="h-4 w-4 mr-1" />
                            Login with Discord
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Dashboard Content */}
            <main className="max-w-7xl mx-auto p-4 md:p-8">
                <h1 className="text-3xl md:text-4xl font-mono font-light mb-8 text-white/90">
                    <span className="text-accent-primary">/</span>FARMING<span className="text-accent-primary">_</span>CONSOLE
                </h1>

                {/* AI Feature Buttons */}
                <div className="flex flex-wrap gap-4 mb-10">
                    <button 
                        onClick={handleGenerateStrategy}
                        disabled={isLoading}
                        className={`py-3 px-6 rounded-lg font-bold transition duration-300 flex items-center ${
                            isLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/50'
                        }`}
                    >
                        {isLoading && !aiStrategy ? 'กำลังวิเคราะห์...' : '✨ Farming Strategy Advisor'}
                    </button>
                    <button 
                        onClick={handleGenerateDraft}
                        disabled={isLoading}
                        className={`py-3 px-6 rounded-lg font-bold transition duration-300 flex items-center ${
                            isLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/50'
                        }`}
                    >
                        {isLoading && !aiDraft ? 'กำลังร่างข้อความ...' : '✨ Order Draft Creator'}
                    </button>
                </div>


                {/* 1. Summary Statistics Section */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                    <SummaryCard
                        title="Completed Orders"
                        value={dashboardData.summary.completedOrders.toLocaleString()}
                        icon={<CheckSquare />}
                        subText={`+${dashboardData.summary.ordersGrowth}% (This Month)`}
                        accentColor="#00CED1"
                        isUpdating={updatingCards.orders}
                    />
                    <SummaryCard
                        title="Total Customers"
                        value={dashboardData.summary.totalCustomers.toLocaleString()}
                        icon={<Users />}
                        subText={`+${dashboardData.summary.newCustomers} (New This Month)`}
                        accentColor="#00CED1"
                        isUpdating={updatingCards.customers}
                    />
                    <SummaryCard
                        title="Total Accounts (Active)"
                        value={dashboardData.summary.totalAccounts.toLocaleString()}
                        icon={<RefreshCw />}
                        subText={`10 Accounts Offline`}
                        accentColor="#00CED1"
                        isUpdating={updatingCards.accounts}
                    />
                    <SummaryCard
                        title="Shop Status (Uptime)"
                        value={dashboardData.summary.shopStatus}
                        icon={<Clock />}
                        subText="Open 24/7 (GMT+7)"
                        accentColor="#00CED1"
                        isUpdating={false}
                    />
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* 2. Accounts Overview Table (Main Content - 3/4 Width) */}
                    <section className="lg:col-span-3">
                        <h2 className="text-2xl font-mono font-light mb-4 text-white/80 border-b border-white/10 pb-2">
                            LIVE FARMING STATUS
                        </h2>
                        <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-2xl border border-white/10">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-white/10 text-sm font-mono">
                                    <thead className="bg-[#2a2a2a] text-accent-primary/80">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left tracking-wider">Avatar/Account ID</th>
                                            <th scope="col" className="px-6 py-3 text-left tracking-wider">Status</th>
                                            <th scope="col" className="px-6 py-3 text-left tracking-wider">Resources (Gems/Tokens)</th>
                                            <th scope="col" className="px-6 py-3 text-left tracking-wider">Timer / Task Goal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {dashboardData.accounts.length > 0 ? (
                                            dashboardData.accounts.map(account => (
                                                <AccountRow key={account.id} account={account} />
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="py-10 text-center text-white/50">
                                                    Waiting for initial data...
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    {/* 3. Side Panel (1/4 Width) */}
                    <aside className="lg:col-span-1 space-y-6">

                        {/* Recent Orders */}
                        <div className="bg-[#1e1e1e] p-4 rounded-xl shadow-2xl border border-accent-primary/20">
                            <h3 className="text-xl font-mono font-light mb-3 text-white/80 border-b border-white/10 pb-2">
                                RECENT ORDERS
                            </h3>
                            <div className="h-40 border border-white/10 rounded-lg overflow-hidden relative">
                                <div className="absolute top-0 w-[200%] h-full marquee p-1">
                                    <div className="space-y-2 inline-block">
                                        {dashboardData.recentOrders.map((order, index) => (
                                            <span key={index} className="flex justify-between items-center text-white/80 p-2 bg-[#1e1e1e]/50 border-l-4 border-accent-primary/50 mr-4 inline-block w-[200px] text-xs">
                                                <span>{order.name}: {order.item}</span>
                                                <span className="text-green-400 font-bold ml-2">${order.price.toFixed(2)}</span>
                                            </span>
                                        )).concat( // Duplicate content for seamless loop
                                            dashboardData.recentOrders.map((order, index) => (
                                                <span key={`dup-${index}`} className="flex justify-between items-center text-white/80 p-2 bg-[#1e1e1e]/50 border-l-4 border-accent-primary/50 mr-4 inline-block w-[200px] text-xs">
                                                    <span>{order.name}: {order.item}</span>
                                                    <span className="text-green-400 font-bold ml-2">${order.price.toFixed(2)}</span>
                                                </span>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-white/50 mt-2">Streaming live transactions...</p>
                        </div>

                        {/* Top Buyers */}
                        <div className="bg-[#1e1e1e] p-4 rounded-xl shadow-2xl border border-[#6a0dad]/20">
                            <h3 className="text-xl font-mono font-light mb-3 text-white/80 border-b border-white/10 pb-2">
                                TOP BUYERS
                            </h3>
                            <ol className="space-y-2 list-decimal list-inside text-sm">
                                {dashboardData.topBuyers.map((buyer, index) => (
                                    <li key={index} className="text-white/90 truncate">
                                        <span className="font-bold text-[#6a0dad] mr-2">{index + 1}.</span> {buyer.name} <span className="text-xs text-white/60">(${(buyer.spent).toLocaleString('en-US', { minimumFractionDigits: 2 })})</span>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
}

export default App;
