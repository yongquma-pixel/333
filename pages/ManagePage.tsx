import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Save, X } from 'lucide-react';
import { db } from '../services/db';
import { StreetRecord } from '../types';

export const ManagePage: React.FC = () => {
  const [streets, setStreets] = useState<StreetRecord[]>([]);
  const [filter, setFilter] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({ streetName: '', routeArea: '', pinyin: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setStreets(db.getAll());
  };

  const handleDelete = (id: string) => {
    if (confirm('确定删除这条记录吗？')) {
      db.delete(id);
      loadData();
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.streetName || !formData.routeArea) return;
    
    db.add(formData);
    setFormData({ streetName: '', routeArea: '', pinyin: '' });
    setIsAdding(false);
    loadData();
  };

  // Simple pinyin generator (client-side simplified)
  const autoFillPinyin = (name: string) => {
    // Ideally this would use a library like 'pinyin-pro', 
    // but for this snippet we'll just leave it empty or user enters it manually 
    // to avoid external dependency bloat in this specific output format.
    // Users can type it manually.
  };

  const filteredStreets = streets.filter(s => 
    s.streetName.includes(filter) || s.routeArea.includes(filter)
  );

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">题库管理 ({streets.length})</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-medium shadow-md active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span>新增道路</span>
        </button>
      </div>

      {/* Add Modal / Form Overlay */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">录入新路区</h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">道路名称</label>
                <input 
                  type="text" 
                  required
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="例如：文三路"
                  value={formData.streetName}
                  onChange={e => setFormData({...formData, streetName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">所属路区</label>
                <input 
                  type="text" 
                  required
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="例如：西湖 1 区"
                  value={formData.routeArea}
                  onChange={e => setFormData({...formData, routeArea: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">拼音 (用于语音搜索)</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="wensanlu"
                  value={formData.pinyin}
                  onChange={e => setFormData({...formData, pinyin: e.target.value})}
                />
              </div>
              
              <button 
                type="submit" 
                className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold mt-2 flex justify-center items-center space-x-2 hover:bg-brand-700"
              >
                <Save className="w-5 h-5" />
                <span>保存</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
        <input 
          type="text"
          placeholder="搜索道路或区域..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="space-y-2 pb-20">
        {filteredStreets.map(item => (
          <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
            <div>
              <div className="font-bold text-gray-800">{item.streetName}</div>
              <div className="text-xs text-brand-600 bg-brand-50 inline-block px-2 py-0.5 rounded mt-1">
                {item.routeArea}
              </div>
            </div>
            <button 
              onClick={() => handleDelete(item.id)}
              className="p-2 text-gray-300 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};