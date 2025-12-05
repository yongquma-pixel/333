
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BrainCircuit, 
  Mic, 
  TrendingUp, 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSun, 
  Loader2, 
  Database,
  Zap,
  CalendarClock,
  XCircle,
} from 'lucide-react';
import { db } from '../services/db';

export const HomePage: React.FC = () => {
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [greeting, setGreeting] = useState("你好，分拣员");
  const [storageStats, setStorageStats] = useState({ usedMB: "0", remainingGB: "0", percentUsed: 0 });
  const [dueReviewCount, setDueReviewCount] = useState(0);
  const [mistakePoolCount, setMistakePoolCount] = useState(0);
  
  useEffect(() => {
    // 1. Random Greeting
    const greetings = [
      "气昂昂的分拣员，太帅了！",
      "朝气蓬勃的分拣员，加油！",
      "又是效率满满的一天！",
      "你是路区最靓的仔！",
      "精准分拣，使命必达！"
    ];
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)]);

    // 2. Weather
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
          const data = await res.json();
          setWeather({ temp: data.current_weather.temperature, code: data.current_weather.weathercode });
        } catch (e) {
          console.error("Weather error", e);
        }
      });
    }

    // 3. Storage Stats & Due Reviews
    db.init().then(() => {
      db.getStorageStats().then(setStorageStats);
      db.getDueStreets().then(res => setDueReviewCount(res.length));
      db.getMistakePool().then(res => setMistakePoolCount(res.length));
    });
  }, []);

  const getWeatherIcon = (code: number) => {
    if (code <= 1) return <Sun className="w-5 h-5 text-orange-400" />;
    if (code <= 3) return <CloudSun className="w-5 h-5 text-gray-400" />;
    if (code <= 48) return <Cloud className="w-5 h-5 text-gray-500" />;
    return <CloudRain className="w-5 h-5 text-blue-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-brand-600 mb-2">{greeting}</h1>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            {weather ? (
              <div className="flex items-center space-x-1 bg-blue-50 px-2 py-1 rounded-lg">
                {getWeatherIcon(weather.code)}
                <span className="font-bold">{weather.temp}°C</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1"><Loader2 className="w-3 h-3 animate-spin" /><span>天气加载中</span></div>
            )}
            <div className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded-lg">
              <Database className="w-3 h-3 text-gray-500" />
              <span className="text-xs">余 {storageStats.remainingGB} GB</span>
            </div>
          </div>
        </div>
        <div className="absolute right-0 top-0 opacity-10">
          <TrendingUp className="w-32 h-32 text-brand-600" />
        </div>
      </div>

      {/* NEW LAYOUT: Hero Section for Core Function */}
      <div className="space-y-4">
        {/* Core Function: Voice Search (Hero Card) */}
        <Link to="/search" className="block w-full bg-gradient-to-r from-brand-600 to-brand-500 p-6 rounded-3xl shadow-lg shadow-brand-200 text-white relative overflow-hidden group active:scale-95 transition-transform">
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="bg-white/20 p-4 rounded-full mb-3 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300 shadow-inner">
              <Mic className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-1">语音查路区</h2>
            <div className="flex items-center space-x-2 mt-2">
               <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-white/10 flex items-center">
                 <Zap className="w-3 h-3 mr-1 fill-yellow-300 text-yellow-300" /> 
                 秒级识别
               </span>
               <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-white/10">
                 批量模式
               </span>
            </div>
          </div>
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
        </Link>

        {/* Secondary Actions Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Daily Quiz */}
          <Link to="/quiz" className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32 relative overflow-hidden group active:scale-95 transition-transform">
             <div className="relative z-10">
               <div className="flex justify-between items-start">
                   <div className="bg-blue-50 w-10 h-10 rounded-xl flex items-center justify-center mb-2 group-hover:bg-blue-100 transition-colors">
                      <BrainCircuit className="w-6 h-6 text-blue-600" />
                   </div>
                   {dueReviewCount > 0 && (
                       <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                           {dueReviewCount} 待复习
                       </span>
                   )}
               </div>
               <span className="font-bold text-gray-800 block text-lg">每日一练</span>
               <span className="text-gray-400 text-xs">保持记忆热度</span>
             </div>
          </Link>

          {/* Mistake Pool (Dedicated Hardcore Mode) */}
          <Link to="/quiz?mode=mistake" className="bg-red-50 p-5 rounded-2xl shadow-sm border border-red-100 flex flex-col justify-between h-32 relative overflow-hidden group active:scale-95 transition-transform">
             <div className="relative z-10">
               <div className="flex justify-between items-start">
                  <div className="bg-red-100 w-10 h-10 rounded-xl flex items-center justify-center mb-2 group-hover:bg-red-200 transition-colors">
                      <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                  {mistakePoolCount > 0 && (
                       <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                           {mistakePoolCount} 个死磕
                       </span>
                  )}
               </div>
               <span className="font-bold text-gray-800 block text-lg">强化错题本</span>
               <span className="text-red-600 text-xs font-medium">连续5次正确才能移除</span>
             </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
