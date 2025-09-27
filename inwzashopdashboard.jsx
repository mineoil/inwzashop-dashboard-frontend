import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, Gem, Scroll, DollarSign, Plug, Server, Zap, AlertTriangle, MessageSquare } from 'lucide-react';

// URL ของ WebSocket Server ที่ Deploy บน Render
// *** กรุณาเปลี่ยน URL นี้เป็น URL ที่คุณได้รับจากการ Deploy Server.js ***
const REALTIME_API_ENDPOINT = "wss://inwzashop-farm-dashboard-backend-1.onrender.com/ws
// ข้อมูลจำลองสำหรับแสดงผลเมื่อยังไม่มีการเชื่อมต่อ หรือยังไม่มีข้อมูล
const initialData = {
    statistics: {
        gemsTotal: 0,
        traitsTotal: 0,
        goldTotal: 0,
        macroRuntime: "00:00:00",
        matchWinRate: 0,
    },
    challenge: {
        gemsToday: 0,
        traitsToday: 0,
        goldToday: 0,
        nextHalfHour: 0,
        rerollCount: 0,
    },
    bounty: {
        gemsBounty: 0,
        traitsBounty: 0,
        goldBounty: 0,
        nextBountyCheck: 0,
    },
    legend: {
        gemsLegend: 0,
        traitsLegend: 0,
        goldLegend: 0,
    }
};

/**
 * 🎨 Component สำหรับแสดงผลตัวเลขสถิติหลัก
 */
const StatisticCard = React.memo(({ icon: Icon, title, value, unit, color }) => (
    <div className="bg-gray-800 p-4 rounded-xl shadow-lg transition-all duration-300 hover:bg-gray-700/70 transform hover:scale-[1.02] border border-gray-700">
        <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-full ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
                <p className="text-sm font-medium text-gray-400 uppercase">{title}</p>
                <div className="text-3xl font-extrabold text-white mt-1 flex items-baseline">
                    {value.toLocaleString()}
                    {unit && <span className="text-sm font-normal text-gray-400 ml-2">{unit}</span>}
                </div>
            </div>
        </div>
    </div>
));

/**
 * 📊 Component สำหรับแสดงผลรายการย่อยในหมวดหมู่
 */
const DetailList = React.memo(({ title, data, iconMap }) => (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700/50 h-full">
        <h3 className="text-xl font-bold text-blue-400 mb-4 border-b border-blue-400/30 pb-2">{title}</h3>
        <ul className="space-y-3">
            {Object.entries(data).map(([key, value]) => {
                const Icon = iconMap[key];
                return (
                    <li key={key} className="flex justify-between items-center text-gray-300 transition-colors duration-200 hover:text-white">
                        <div className="flex items-center">
                            {Icon && <Icon className="w-5 h-5 mr-2 text-blue-300" />}
                            <span className="font-medium capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                        </div>
                        <span className="font-bold text-lg text-white">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </span>
                    </li>
                );
            })}
        </ul>
    </div>
));


/**
 * 🚀 Component หลักของ Dashboard
 */
function App() {
    const [data, setData] = useState(initialData);
    const [wsStatus, setWsStatus] = useState('DISCONNECTED');
    const [lastUpdate, setLastUpdate] = useState(null);
    const [logMessage, setLogMessage] = useState('');

    const connectWebSocket = useCallback(() => {
        setWsStatus('CONNECTING');
        setLogMessage('Attempting to connect to WebSocket server...');
        
        const ws = new WebSocket(REALTIME_API_ENDPOINT);

        ws.onopen = () => {
            setWsStatus('CONNECTED');
            setLogMessage('WebSocket connected successfully.');
        };

        ws.onmessage = (event) => {
            try {
                const newData = JSON.parse(event.data);
                setData(prevData => ({ ...prevData, ...newData }));
                setLastUpdate(new Date());
                setLogMessage('Data received and updated.');
            } catch (e) {
                console.error("Error parsing WebSocket message:", e);
                setLogMessage(`Error processing data: ${event.data.substring(0, 50)}...`);
            }
        };

        ws.onclose = () => {
            setWsStatus('DISCONNECTED');
            setLogMessage('WebSocket disconnected. Attempting to reconnect in 5 seconds...');
            // Reconnect logic
            setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            setWsStatus('ERROR');
            setLogMessage('WebSocket error occurred. Check server status.');
            ws.close();
        };
        
        // Cleanup function for useEffect
        return ws;
    }, []);

    useEffect(() => {
        const wsInstance = connectWebSocket();
        
        // Clean up the WebSocket connection when the component unmounts
        return () => {
            if (wsInstance) {
                wsInstance.onclose = null; // Prevent unwanted reconnect on unmount
                wsInstance.close();
            }
        };
    }, [connectWebSocket]);

    const formattedLastUpdate = useMemo(() => {
        if (!lastUpdate) return "N/A";
        return lastUpdate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, [lastUpdate]);
    
    // Icon map for detail list components
    const commonIconMap = useMemo(() => ({
        gemsToday: Gem,
        traitsToday: Scroll,
        goldToday: DollarSign,
        nextHalfHour: Clock,
        rerollCount: Zap,
        gemsBounty: Gem,
        traitsBounty: Scroll,
        goldBounty: DollarSign,
        nextBountyCheck: Clock,
        gemsLegend: Gem,
        traitsLegend: Scroll,
        goldLegend: DollarSign,
    }), []);
    

    const statusColor = useMemo(() => {
        switch (wsStatus) {
            case 'CONNECTED': return 'bg-green-500';
            case 'CONNECTING': return 'bg-yellow-500';
            case 'ERROR': return 'bg-red-600';
            default: return 'bg-gray-500';
        }
    }, [wsStatus]);

    // Determine win rate color based on value
    const winRateColor = useMemo(() => {
        if (data.statistics.matchWinRate >= 80) return 'bg-green-500';
        if (data.statistics.matchWinRate >= 50) return 'bg-yellow-500';
        return 'bg-red-500';
    }, [data.statistics.matchWinRate]);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
            {/* Header and Status */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 border-b border-blue-500/50 pb-4">
                <h1 className="text-4xl font-extrabold text-blue-400 tracking-tight mb-2 sm:mb-0">
                    INWZASHOP FARMING DASHBOARD
                </h1>
                <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full flex items-center ${statusColor}`}>
                        {wsStatus === 'CONNECTED' ? <Plug className="w-4 h-4 mr-1" /> : <Server className="w-4 h-4 mr-1" />}
                        WS: {wsStatus}
                    </span>
                    <span className="text-sm text-gray-400">
                        อัพเดทล่าสุด: {formattedLastUpdate}
                    </span>
                </div>
            </header>

            {/* Connection Log Message Box */}
            <div className="bg-gray-800 p-3 rounded-xl mb-6 shadow-md border border-gray-700/50 flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <p className="text-sm font-mono text-gray-300 truncate">{logMessage}</p>
            </div>

            {/* Main Statistics Grid */}
            <section className="mb-10">
                <h2 className="text-2xl font-bold text-white mb-4">สถานะภาพรวม (Lifetime Statistics)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <StatisticCard 
                        icon={Gem} 
                        title="GEMS TOTAL" 
                        value={data.statistics.gemsTotal} 
                        color="bg-purple-600" 
                    />
                    <StatisticCard 
                        icon={Scroll} 
                        title="TRAITS TOTAL" 
                        value={data.statistics.traitsTotal} 
                        color="bg-indigo-600" 
                    />
                    <StatisticCard 
                        icon={DollarSign} 
                        title="GOLD TOTAL" 
                        value={data.statistics.goldTotal} 
                        color="bg-yellow-600" 
                    />
                    <StatisticCard 
                        icon={Clock} 
                        title="MACRO RUNTIME" 
                        value={data.statistics.macroRuntime} 
                        unit="HH:MM:SS"
                        color="bg-pink-600" 
                    />
                    <StatisticCard 
                        icon={Zap} 
                        title="MATCH WIN RATE" 
                        value={data.statistics.matchWinRate} 
                        unit="%"
                        color={winRateColor} 
                    />
                </div>
            </section>

            {/* Detailed Categories Grid */}
            <section>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <DetailList 
                        title="CHALLENGE STATUS (TODAY)" 
                        data={{
                            gemsToday: data.challenge.gemsToday,
                            traitsToday: data.challenge.traitsToday,
                            goldToday: data.challenge.goldToday,
                            nextHalfHour: data.challenge.nextHalfHour,
                            rerollCount: data.challenge.rerollCount,
                        }}
                        iconMap={commonIconMap}
                    />
                    <DetailList 
                        title="BOUNTY STATUS" 
                        data={{
                            gemsBounty: data.bounty.gemsBounty,
                            traitsBounty: data.bounty.traitsBounty,
                            goldBounty: data.bounty.goldBounty,
                            nextBountyCheck: data.bounty.nextBountyCheck,
                        }}
                        iconMap={commonIconMap}
                    />
                    <DetailList 
                        title="LEGEND STAGE" 
                        data={{
                            gemsLegend: data.legend.gemsLegend,
                            traitsLegend: data.legend.traitsLegend,
                            goldLegend: data.legend.goldLegend,
                        }}
                        iconMap={commonIconMap}
                    />
                </div>
            </section>
            
            {/* Footer / Credits */}
            <footer className="mt-10 pt-4 border-t border-gray-700 text-center text-sm text-gray-500">
                Dashboard powered by React and Tailwind CSS. Real-time updates via WebSockets.
            </footer>
        </div>
    );
}

export default App; // ต้อง export ตัวนี้
