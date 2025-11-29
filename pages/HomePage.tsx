import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, Mic, FileText, TrendingUp, Sun, Cloud, CloudRain, CloudSun, Loader2, ThermometerSun, Database, ClipboardCheck, ArrowRight } from 'lucide-react';
import { db } from '../services/db';

const GREETINGS = [
  "朝气蓬勃的分拣员，加油！",
  "气昂昂的分拣员，太帅了！",
  "又是精准分拣的一天！",
  "效率满满，奥利给！",
  "守护包裹的英雄，你好！",
  "今天的你，也是元气满满呢！",
  "分拣速度快如闪电，冲鸭！",
  "每一个包裹都承载着期待，辛苦了！"
];

interface WeatherData {
  temp: number;
  code: number;
}

export const HomePage: React.FC = () => {
  const [streetCount, setStreetCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [greeting, setGreeting] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [storage, setStorage] = useState<{ usedMB: string, remainingGB: string } | null>(null);

  useEffect(() => {
    const initData = async () => {
      // 1. Init DB & Migrate
      await db.init();
      
      // 2. Load Data Async
      const allStreets = await db.getAll();
      setStreetCount(allStreets.length);
      setMistakeCount(allStreets.filter(s => s.failureCount > 0).length);
      
      // 3. Storage
      const stats = await db.getStorageStats();
      setStorage(stats);
    };

    initData();
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

    // Weather
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
            );
            const data = await res.json();
            if (data.current_weather) {
              setWeather({
                temp: data.current_weather.temperature,
                code: data.current_weather.weathercode,
              });
            }
          } catch (e) {
            console.error("Weather error", e);
          } finally {
            setLoadingWeather(false);
          }
        },
        () => setLoadingWeather(false)
      );
    } else {
      setLoadingWeather(false);
    }
  }, []);

  const getWeatherDisplay = (code: number) => {
    if (code === 0) return { icon: <Sun className="w-8 h-8 text-yellow-300" />, label: '晴朗' };
    if (code >= 1 && code <= 3) return { icon: <CloudSun className="w-8 h-8 text-white/90" />, label: '多云' };
    if (code >= 45 && code <= 48) return { icon: <Cloud className="w-8 h-8 text-gray-200" />, label: '雾' };
    if (code >= 51) return { icon: <CloudRain className="w-8 h-8 text-blue-200" />, label: '雨/雪' };
    return { icon: <Sun className="w-8 h-8 text-yellow-300" />, label: '晴' };
  };

  const weatherInfo = weather ? getWeatherDisplay(weather.code) : null;

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="bg-gradient-to-r from-brand-500 to-brand-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-10 -mb-10 blur-xl"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-xl font-bold mb-2 leading-relaxed max-w-[70%]">
                {greeting || "你好，快递员"}
              </h1>
              <div className="flex items-center space-x-2 text-sm bg-white/20 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
                <FileText className="w-3.5 h-3.5" />
                <span>已收录 {streetCount} 条</span>
              </div>
            </div>

            <div className="flex flex-col items-end space-y-2">
              {loadingWeather ? (
                <Loader2 className="w-6 h-6 animate-spin opacity-50" />
              ) : weather && weatherInfo ? (
                <div className="flex flex-col items-center">
                   <div className="mb-1 drop-shadow-md filter">{weatherInfo.icon}</div>
                   <div className="flex items-center space-x-1 font-medium">
                     <ThermometerSun className="w-4 h-4" />
                     <span className="text-lg">{weather.temp}°</span>
                   </div>
                   <span className="text-xs opacity-80">{weatherInfo.label}</span>
                </div>
              ) : (
                 <div className="opacity-50 flex flex-col items-center">
                    <Sun className="w-6 h-6 mb-1" />
                    <span className="text-xs">今天</span>
                 </div>
              )}

              {/* Enhanced Storage Stats */}
              {storage && (
                <div className="flex items-center space-x-1 text-[10px] bg-white/10 px-2 py-0.5 rounded backdrop-blur-md opacity-90 border border-white/10" title="数据库容量">
                  <Database className="w-3 h-3" />
                  <span>已用{storage.usedMB}M / 余{storage.remainingGB}G</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Link to="/search" className="group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">语音查路区</h2>
              <p className="text-gray-500 text-sm">工作现场 · 极速查询</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
              <Mic className="w-6 h-6" />
            </div>
          </div>
        </Link>

        <Link to="/quiz" className="group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">每日一练</h2>
              <p className="text-gray-500 text-sm">巩固记忆 · 提升效率</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
              <BrainCircuit className="w-6 h-6" />
            </div>
          </div>
        </Link>

        {/* HP-A-1 Inspection Link Card */}
        <Link to="/hpa1" className="group relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-600 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
           <div className="relative z-10 flex items-center justify-between">
            <div className="text-white">
              <h2 className="text-xl font-bold mb-1 flex items-center">
                HP-A-1 检查
                <ArrowRight className="w-5 h-5 ml-1 opacity-80" />
              </h2>
              <p className="text-purple-100 text-sm">运单记录 · 异常拍照</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">
              <ClipboardCheck className="w-6 h-6" />
            </div>
          </div>
        </Link>
      </div>

      {mistakeCount > 0 && (
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center space-x-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <TrendingUp className="text-orange-500 w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-orange-900">错题本</p>
              <p className="text-xs text-orange-700">你有 {mistakeCount} 个易错路区待复习</p>
            </div>
          </div>
          <Link to="/quiz?mode=mistakes" className="bg-white text-orange-600 px-3 py-1.5 rounded-lg text-sm font-medium border border-orange-200 shadow-sm hover:bg-orange-50">
            去复习
          </Link>
        </div>
      )}
    </div>
  );
};