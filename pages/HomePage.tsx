import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, Mic, FileText, TrendingUp, Sun, Cloud, CloudRain, CloudSun, Loader2, ThermometerSun } from 'lucide-react';
import { db } from '../services/db';

// Positive greetings pool
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
  code: number; // WMO Weather code
}

export const HomePage: React.FC = () => {
  const allStreets = db.getAll();
  const mistakeCount = allStreets.filter(s => s.failureCount > 0).length;

  const [greeting, setGreeting] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);

  useEffect(() => {
    // 1. Set Random Greeting
    const randomIdx = Math.floor(Math.random() * GREETINGS.length);
    setGreeting(GREETINGS[randomIdx]);

    // 2. Fetch Weather (Open-Meteo Free API)
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
            console.error("Weather fetch failed", e);
          } finally {
            setLoadingWeather(false);
          }
        },
        (error) => {
          console.warn("Geolocation denied", error);
          setLoadingWeather(false);
        }
      );
    } else {
      setLoadingWeather(false);
    }
  }, []);

  // Helper to map WMO code to Icon/Text
  const getWeatherDisplay = (code: number) => {
    // WMO Weather interpretation codes
    if (code === 0) return { icon: <Sun className="w-8 h-8 text-yellow-300" />, label: '晴朗' };
    if (code >= 1 && code <= 3) return { icon: <CloudSun className="w-8 h-8 text-white/90" />, label: '多云' };
    if (code >= 45 && code <= 48) return { icon: <Cloud className="w-8 h-8 text-gray-200" />, label: '雾' };
    if (code >= 51) return { icon: <CloudRain className="w-8 h-8 text-blue-200" />, label: '雨/雪' };
    return { icon: <Sun className="w-8 h-8 text-yellow-300" />, label: '晴' };
  };

  const weatherInfo = weather ? getWeatherDisplay(weather.code) : null;

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-500 to-brand-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        {/* Decorative Circles */}
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
                <span>已收录 {allStreets.length} 条</span>
              </div>
            </div>

            {/* Weather Widget */}
            <div className="flex flex-col items-end">
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
                 // Fallback if no permission/error
                 <div className="opacity-50 flex flex-col items-center">
                    <Sun className="w-6 h-6 mb-1" />
                    <span className="text-xs">今天</span>
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-1 gap-4">
        {/* Module B: Search */}
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

        {/* Module A: Practice */}
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
      </div>

      {/* Stats / Mistakes */}
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