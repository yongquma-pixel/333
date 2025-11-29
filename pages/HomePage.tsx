import React from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, Mic, FileText, TrendingUp } from 'lucide-react';
import { db } from '../services/db';

export const HomePage: React.FC = () => {
  const allStreets = db.getAll();
  const mistakeCount = allStreets.filter(s => s.failureCount > 0).length;

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-500 to-brand-700 rounded-2xl p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold mb-2">你好，快递员</h1>
        <p className="opacity-90 text-sm mb-4">今天也要精准投递哦！</p>
        <div className="flex items-center space-x-4 text-sm bg-white/10 p-3 rounded-lg backdrop-blur-sm">
          <FileText className="w-4 h-4" />
          <span>总收录: {allStreets.length} 条道路</span>
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
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TrendingUp className="text-orange-500 w-5 h-5" />
            <div>
              <p className="font-bold text-orange-900">错题本</p>
              <p className="text-xs text-orange-700">你有 {mistakeCount} 个易错路区待复习</p>
            </div>
          </div>
          <Link to="/quiz?mode=mistakes" className="bg-white text-orange-600 px-3 py-1.5 rounded-lg text-sm font-medium border border-orange-200 shadow-sm">
            去复习
          </Link>
        </div>
      )}
    </div>
  );
};