
import React, { useState, useEffect } from 'react';
import { Search, BookOpen, ChevronRight, Building2, Layers, Loader2, MapPin } from 'lucide-react';
import { db } from '../services/db';
import { StreetRecord } from '../types';

export const LibraryPage: React.FC = () => {
  const [streets, setStreets] = useState<StreetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeArea, setActiveArea] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await db.init();
    const data = await db.getAll();
    setStreets(data);
    setLoading(false);
  };

  const openMap = (record: StreetRecord) => {
    // 优先使用高德地图 URI，如果是移动端会自动唤起高德 APP
    const keyword = encodeURIComponent(record.streetName);
    let url = '';
    if (record.lat && record.lng) {
      url = `https://uri.amap.com/marker?position=${record.lng},${record.lat}&name=${keyword}&src=courier_assistant`;
    } else {
      url = `https://uri.amap.com/search?keyword=${keyword}&src=courier_assistant`;
    }
    window.open(url, '_blank');
  };

  // Group streets by route area
  const groupedData = streets.reduce((acc, street) => {
    const area = street.routeArea;
    if (!acc[area]) acc[area] = [];
    acc[area].push(street);
    return acc;
  }, {} as Record<string, StreetRecord[]>);

  const areas = Object.keys(groupedData).sort();

  const filteredAreas = areas.filter(area => {
    if (activeArea && area !== activeArea) return false;
    const areaMatch = area.toLowerCase().includes(searchQuery.toLowerCase());
    const hasMatchingStreet = groupedData[area].some(s => 
      s.streetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.companyName && s.companyName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return areaMatch || hasMatchingStreet;
  });

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center text-gray-400">
      <Loader2 className="w-10 h-10 animate-spin text-brand-600 mb-4" />
      <p className="font-bold">正在整理图谱...</p>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Search Header */}
      <div className="sticky top-0 z-20 bg-gray-50 pb-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder="搜路名、路区或公司..."
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-transparent focus:border-brand-500 rounded-2xl shadow-sm outline-none transition-all font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Quick Filter Tabs */}
        <div className="flex overflow-x-auto py-3 no-scrollbar space-x-2">
           <button 
             onClick={() => setActiveArea(null)}
             className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap border-2 transition-all ${!activeArea ? 'bg-brand-600 border-brand-600 text-white shadow-md shadow-brand-100' : 'bg-white border-gray-100 text-gray-500'}`}
           >
             全部路区
           </button>
           {areas.map(area => (
             <button 
                key={area}
                onClick={() => setActiveArea(area)}
                className={`px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap border-2 transition-all ${activeArea === area ? 'bg-brand-600 border-brand-600 text-white shadow-md shadow-brand-100' : 'bg-white border-gray-100 text-gray-500'}`}
             >
               {area}
             </button>
           ))}
        </div>
      </div>

      {/* Grouped List */}
      <div className="flex-1 space-y-6 pb-20">
        {filteredAreas.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <Layers className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-bold">未找到相关匹配项</p>
          </div>
        ) : (
          filteredAreas.map(area => (
            <div key={area} className="space-y-3 animate-fade-in-up">
              <div className="flex items-center justify-between px-2">
                <h3 className="flex items-center text-lg font-black text-gray-800">
                  <div className="w-2 h-6 bg-brand-600 rounded-full mr-2"></div>
                  {area}
                  <span className="ml-2 text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {groupedData[area].length} 条
                  </span>
                </h3>
              </div>
              
              <div className="grid gap-3">
                {groupedData[area]
                  .filter(s => 
                    s.streetName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    (s.companyName && s.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    area.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(street => (
                    <div key={street.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-brand-100 transition-colors">
                      <div className="flex items-start space-x-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openMap(street); }}
                          className="mt-1 bg-brand-50 p-2 rounded-xl text-brand-600 active:scale-90 transition-transform hover:bg-brand-100"
                        >
                          <MapPin className="w-4 h-4" />
                        </button>
                        <div>
                          <div className="text-lg font-black text-gray-800 leading-none mb-2">
                            {street.streetName}
                          </div>
                          {street.companyName && (
                            <div className="flex items-center text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100 w-fit">
                              <Building2 className="w-3 h-3 mr-1" />
                              {street.companyName}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="text-xs font-black text-brand-600 uppercase opacity-30 group-hover:opacity-100 transition-opacity">
                           {street.pinyin}
                         </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Memo Tip */}
      <div className="fixed bottom-20 left-4 right-4 bg-gray-900/90 backdrop-blur-md text-white p-4 rounded-2xl flex items-center space-x-3 border border-white/10 shadow-2xl z-30">
        <div className="bg-brand-500 p-2 rounded-lg">
          <MapPin className="w-5 h-5" />
        </div>
        <div className="text-xs">
          <p className="font-bold">地图直达</p>
          <p className="opacity-70 text-[10px]">点击左侧图标可自动在地图中搜索该位置。</p>
        </div>
      </div>
    </div>
  );
};
