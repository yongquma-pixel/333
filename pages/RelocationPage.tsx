
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Plus, Trash2, Download, Upload, AlertTriangle, CheckCircle2, Save, X, Phone, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../services/db';
import { RelocationRecord } from '../types';
import * as XLSX from 'xlsx';

export const RelocationPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RelocationRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [records, setRecords] = useState<RelocationRecord[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState({ oldAddress: '', newAddress: '', phoneNumber: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    await db.init();
    const all = await db.getAllRelocations();
    setRecords(all.sort((a,b) => b.createdAt - a.createdAt));
  };

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text) {
        setResults([]);
        setIsSearching(false);
        return;
    }
    setIsSearching(true);
    const matches = await db.searchRelocation(text);
    setResults(matches);
  };

  const handleAdd = async () => {
    if(!newForm.oldAddress || !newForm.newAddress) return;
    await db.addRelocation(newForm);
    setNewForm({ oldAddress: '', newAddress: '', phoneNumber: '' });
    setShowAddModal(false);
    loadRecords();
  };

  const handleDelete = async (id: string) => {
    if(confirm("确认删除此记录？")) {
        await db.deleteRelocation(id);
        loadRecords();
        if (query) handleSearch(query); // Refresh search results if necessary
    }
  };

  const handleReportError = async (id: string) => {
      await db.incrementRelocationError(id);
      handleSearch(query); // Refresh results to show new count
  };

  // Excel Export
  const handleExport = () => {
    const data = records.map(r => ({
        "旧地址": r.oldAddress,
        "新地址": r.newAddress,
        "客户电话": r.phoneNumber,
        "纠错次数": r.errorCount || 0,
        "登记时间": new Date(r.createdAt).toLocaleDateString()
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "搬迁记录");
    XLSX.writeFile(wb, `搬迁数据_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Excel Import
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
        const recordsToImport = data.map((row: any) => ({
          oldAddress: row['旧地址'],
          newAddress: row['新地址'],
          phoneNumber: row['客户电话'] || ''
        })).filter(r => r.oldAddress && r.newAddress);
        
        await db.addManyRelocations(recordsToImport);
        alert(`成功导入 ${recordsToImport.length} 条记录`);
        loadRecords();
      } catch (err) {
        alert("导入失败，请检查格式");
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx" />
      
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
           <Link to="/" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></Link>
           <h1 className="text-lg font-bold text-gray-800">历史搬迁查询</h1>
        </div>
        <button onClick={() => setShowManage(!showManage)} className="text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
            {showManage ? "返回查询" : "管理数据"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* QUERY MODE */}
        {!showManage && (
            <div className="space-y-4">
                <div className="bg-white rounded-xl p-2 shadow-sm border border-orange-100 flex items-center sticky top-0 z-10">
                    <Search className="w-5 h-5 text-gray-400 ml-2" />
                    <input 
                        type="text" 
                        placeholder="输入老地址 或 手机号..." 
                        className="w-full p-3 outline-none text-gray-700 font-medium"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        autoFocus
                    />
                    {query && <button onClick={() => handleSearch('')} className="p-2"><X className="w-4 h-4 text-gray-400" /></button>}
                </div>

                <div className="space-y-3">
                    {query && results.length > 0 ? (
                        results.map(result => {
                            const isHighRisk = (result.errorCount || 0) > 3;
                            return (
                                <div key={result.id} className={`${isHighRisk ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'} rounded-2xl p-5 border-2 shadow-md animate-fade-in-up relative`}>
                                    <div className="absolute top-0 right-0 bg-orange-200 text-orange-800 text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">已搬迁</div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <label className={`${isHighRisk ? 'text-red-500' : 'text-orange-500'} text-xs font-medium flex items-center gap-1`}><AlertTriangle className="w-3 h-3" /> 老地址</label>
                                                <div className="font-bold text-gray-800 line-through decoration-2 decoration-gray-400 opacity-60">{result.oldAddress}</div>
                                            </div>
                                            {/* Error Count Badge */}
                                            {(result.errorCount || 0) > 0 && (
                                                <div className="flex flex-col items-end">
                                                    <span className="flex items-center text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        报错 {result.errorCount}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`pl-4 border-l-2 ${isHighRisk ? 'border-red-300' : 'border-orange-300'}`}>
                                            <label className={`${isHighRisk ? 'text-red-500' : 'text-orange-500'} text-xs font-medium`}>新地址</label>
                                            <div className="font-bold text-gray-900 text-lg">{result.newAddress}</div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="bg-white/60 p-2 rounded-lg flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-gray-500" />
                                                <div className="font-mono text-gray-800 font-bold">{result.phoneNumber}</div>
                                            </div>
                                            <button 
                                                onClick={() => handleReportError(result.id)}
                                                className="text-xs text-red-400 hover:text-red-600 underline"
                                            >
                                                信息有误?
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        isSearching && query ? (
                            <div className="text-center py-10">
                                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                                </div>
                                <h3 className="font-bold text-gray-800">未发现搬迁记录</h3>
                                <p className="text-sm text-gray-500 mt-1">该地址可能未发生变更</p>
                            </div>
                        ) : (
                             !query && (
                                <div className="text-center py-20 opacity-30">
                                    <Search className="w-16 h-16 mx-auto mb-4" />
                                    <p>输入关键词开始查询</p>
                                </div>
                             )
                        )
                    )}
                </div>
            </div>
        )}

        {/* MANAGE MODE */}
        {showManage && (
            <div className="space-y-4 animate-fade-in">
                <div className="flex gap-2">
                    <button onClick={() => setShowAddModal(true)} className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md">
                        <Plus className="w-5 h-5" /> 录入新纪录
                    </button>
                    <button onClick={handleExport} className="w-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-500"><Download className="w-5 h-5" /></button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-500"><Upload className="w-5 h-5" /></button>
                </div>

                <div className="space-y-3">
                    {records.map(rec => (
                        <div key={rec.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative">
                            <button onClick={() => handleDelete(rec.id)} className="absolute top-3 right-3 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            <div className="pr-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-gray-100 text-gray-500 text-xs px-1.5 py-0.5 rounded">旧</span>
                                    <span className="font-medium text-gray-800 line-through decoration-gray-400 decoration-2">{rec.oldAddress}</span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded font-bold">新</span>
                                    <span className="font-bold text-gray-900">{rec.newAddress}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                     <div className="text-xs text-gray-400 flex items-center gap-1">
                                        <span>Tel: {rec.phoneNumber}</span>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                        <span>{new Date(rec.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    {(rec.errorCount || 0) > 0 && (
                                        <span className="text-xs font-bold text-red-500 flex items-center">
                                            <AlertCircle className="w-3 h-3 mr-1" /> {rec.errorCount} 次报错
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {records.length === 0 && <div className="text-center py-10 text-gray-400">暂无数据</div>}
                </div>
            </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">录入搬迁信息</h3>
                    <button onClick={() => setShowAddModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500">原运单地址</label>
                        <input type="text" className="w-full border p-2.5 rounded-lg font-medium" placeholder="例如：文三路100号" value={newForm.oldAddress} onChange={e => setNewForm({...newForm, oldAddress: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">新搬迁地址</label>
                        <input type="text" className="w-full border p-2.5 rounded-lg font-medium border-orange-200 bg-orange-50 text-orange-900" placeholder="例如：古墩路88号" value={newForm.newAddress} onChange={e => setNewForm({...newForm, newAddress: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">客户电话</label>
                        <input type="tel" className="w-full border p-2.5 rounded-lg font-medium" placeholder="139..." value={newForm.phoneNumber} onChange={e => setNewForm({...newForm, phoneNumber: e.target.value})} />
                    </div>
                    <button onClick={handleAdd} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold mt-4 shadow-lg">保存记录</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
