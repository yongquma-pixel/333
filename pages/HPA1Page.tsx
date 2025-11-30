import React, { useState, useEffect, useRef } from 'react';
import { Box, Mic, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, Plus, Calendar, Check, X, Info, Circle, CircleDashed, Download, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../services/db';
import { HPA1Item } from '../types';
import * as XLSX from 'xlsx';

export const HPA1Page: React.FC = () => {
  const [items, setItems] = useState<HPA1Item[]>([]);
  const [trackingNum, setTrackingNum] = useState('');
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().slice(0, 10));
  const [isListening, setIsListening] = useState(false);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    await db.init();
    const all = await db.getAllHPA1();
    // Filter only pending items and sort by arrival date
    const pending = all.filter(item => item.status === 'pending');
    pending.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
    setItems(pending);
  };

  const startVoice = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (e: any) => {
        const raw = e.results[0][0].transcript;
        // Filter only alphanumeric characters
        const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        setTrackingNum(clean);
      };
      recognition.start();
    } else {
      alert("设备不支持语音识别");
    }
  };

  const handleAdd = async () => {
    if (!trackingNum) return;
    await db.addHPA1(trackingNum, arrivalDate);
    setTrackingNum('');
    loadItems();
  };

  const initiateCompletion = (id: string) => {
    setConfirmCompleteId(id);
  };

  const executeCompletion = async () => {
    if (confirmCompleteId) {
      await db.completeHPA1(confirmCompleteId);
      setConfirmCompleteId(null);
      loadItems();
    }
  };

  const handleDateChange = async (id: string, newDate: string) => {
    if (!newDate) return;
    await db.updateHPA1(id, { arrivalDate: newDate });
    loadItems();
  };

  const handleExport = () => {
    const data = items.map(item => ({
        "运单号": item.trackingNumber,
        "到港日期": item.arrivalDate,
        "状态": item.status === 'paid' ? '已完结' : '待处理'
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "滞留件数据");
    XLSX.writeFile(wb, `滞留件_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
            const records = data.map((row: any) => ({
                trackingNumber: row['运单号'],
                arrivalDate: row['到港日期'] || new Date().toISOString().slice(0, 10)
            })).filter((r: any) => r.trackingNumber);
            
            // Use Merge (Upsert)
            const { added, updated } = await db.mergeHPA1(records);
            alert(`导入完成！\n✅ 新增: ${added} 条\n🔄 更新: ${updated} 条`);
            loadItems();
        } catch (err) {
            alert("导入失败");
        }
    };
    reader.readAsBinaryString(file);
  };

  const getDaysRetained = (dateStr: string) => {
    const start = new Date(dateStr).setHours(0,0,0,0);
    const now = new Date().setHours(0,0,0,0);
    return Math.floor((now - start) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (days: number) => {
    if (days >= 7) return 'text-red-600 bg-red-50 border-red-200';
    if (days >= 3) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx" />
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm border-b border-gray-100 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center space-x-3">
           <Link to="/" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></Link>
           <h1 className="text-lg font-bold text-gray-800">滞留件管理</h1>
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={handleExport} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-purple-600"><Download className="w-5 h-5" /></button>
            <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-purple-600"><Upload className="w-5 h-5" /></button>
            <div className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold flex items-center">
               <Box className="w-3 h-3 mr-1" />
               {items.length} 待处理
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20 space-y-4">
        
        {/* Input Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
           <div className="flex items-center justify-between mb-3">
             <div className="flex items-center space-x-2 text-sm font-bold text-gray-700">
               <Plus className="w-4 h-4 text-purple-600" />
               <span>录入新件</span>
             </div>
             {/* Global Date Picker for Entry */}
             <div className="flex items-center bg-gray-50 rounded-lg px-2 py-1 border border-gray-200 group focus-within:ring-2 focus-within:ring-purple-100">
                <Calendar className="w-3 h-3 text-gray-400 mr-2" />
                <input 
                  type="date" 
                  value={arrivalDate}
                  onChange={e => setArrivalDate(e.target.value)}
                  className="bg-transparent text-xs font-medium text-gray-600 outline-none w-24"
                />
             </div>
           </div>
           
           <div className="flex space-x-2">
             <div className="flex-1 relative">
                <input 
                  type="text" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-base font-bold uppercase focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none transition-all"
                  placeholder="单号 (如 SF123)"
                  value={trackingNum}
                  onChange={e => setTrackingNum(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <button 
                  onClick={startVoice} 
                  disabled={isListening}
                  className={`absolute right-1 top-1 bottom-1 px-3 rounded-md flex items-center transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-400 hover:text-purple-600'}`}
                >
                  <Mic className="w-4 h-4" />
                </button>
             </div>
             <button onClick={handleAdd} disabled={!trackingNum} className="bg-purple-600 text-white px-4 rounded-lg font-bold shadow-md hover:bg-purple-700 disabled:opacity-50 disabled:shadow-none">
               添加
             </button>
           </div>
        </div>

        {/* List Area */}
        <div className="space-y-3">
          {items.map(item => {
            const days = getDaysRetained(item.arrivalDate);
            
            return (
              <div 
                key={item.id} 
                className={`bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between transition-all border-gray-100`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`font-mono font-bold text-lg truncate text-gray-800`}>
                      {item.trackingNumber}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${getStatusColor(days)}`}>
                      滞留 {days} 天
                    </span>
                  </div>
                  
                  <div className="flex items-center text-xs text-gray-400 space-x-4">
                    <div className="flex items-center hover:bg-gray-100 rounded px-1 -ml-1 py-0.5 transition-colors cursor-pointer group relative">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span className="group-hover:text-purple-600 transition-colors">{item.arrivalDate}</span>
                      {/* Inline Date Edit */}
                      <input 
                        type="date" 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        value={item.arrivalDate}
                        onChange={(e) => handleDateChange(item.id, e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Side Action */}
                <div className="ml-4 flex-shrink-0">
                    <button 
                      onClick={() => initiateCompletion(item.id)}
                      className="w-10 h-10 rounded-full border-2 border-gray-300 flex items-center justify-center text-transparent hover:border-green-500 hover:text-green-500 hover:bg-green-50 transition-all active:scale-95"
                    >
                      <Check className="w-6 h-6" />
                    </button>
                </div>
              </div>
            );
          })}
          
          {items.length === 0 && (
             <div className="text-center py-10 text-gray-400">
               <Box className="w-12 h-12 mx-auto mb-2 opacity-20" />
               <p className="text-sm">暂无滞留快件</p>
             </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmCompleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-slide-up">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">确认支付关税？</h3>
              <p className="text-sm text-gray-500 mb-6">
                该运单将标记为已完结并归档，不再计算滞留费用。
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setConfirmCompleteId(null)} 
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button 
                  onClick={executeCompletion} 
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:bg-green-700"
                >
                  确认完结
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};