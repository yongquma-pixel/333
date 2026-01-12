import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, Save, X, Download, Upload, AlertTriangle, Mail, Filter, ChevronDown, FileSpreadsheet, Building2 } from 'lucide-react';
import { db } from '../services/db';
import { StreetRecord } from '../types';
import * as XLSX from 'xlsx';
// @ts-ignore
import { pinyin } from 'pinyin-pro';

export const ManagePage: React.FC = () => {
  const [streets, setStreets] = useState<StreetRecord[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({ streetName: '', routeArea: '', companyName: '', pinyin: '' });
  const [emailAddress, setEmailAddress] = useState('');

  useEffect(() => {
    loadData();
    const savedEmail = localStorage.getItem('backup_email');
    if (savedEmail) setEmailAddress(savedEmail);
  }, []);

  const loadData = async () => {
    await db.init();
    const data = await db.getAll();
    setStreets(data);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await db.delete(deleteId);
      loadData();
      setDeleteId(null);
    }
  };

  const clearAllData = async () => {
    await db.clearAll();
    setShowClearConfirm(false);
    loadData();
  };

  const handleStreetNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    let generatedPinyin = '';
    if (val) {
      try {
        generatedPinyin = pinyin(val, { toneType: 'none', type: 'string' }).replace(/\s/g, '');
      } catch (err) {}
    }
    setFormData({ ...formData, streetName: val, pinyin: generatedPinyin });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.streetName || !formData.routeArea) return;
    
    const finalPinyin = formData.pinyin || pinyin(formData.streetName, { toneType: 'none', type: 'string' }).replace(/\s/g, '');
    
    await db.add({
      ...formData,
      companyName: formData.companyName.trim(), 
      pinyin: finalPinyin
    });
    setFormData({ streetName: '', routeArea: '', companyName: '', pinyin: '' });
    setIsAdding(false);
    loadData();
  };

  const handleExport = () => {
    try {
      const dataToExport = streets.map(s => ({
        "道路名称": s.streetName,
        "所属路区": s.routeArea,
        "公司名称": s.companyName || ""
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      XLSX.utils.book_append_sheet(wb, ws, "路区数据");
      XLSX.writeFile(wb, `路区题库备份_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (error) {
      alert("导出失败");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
        
        const records = data.map((row: any) => {
          const streetName = row['道路名称'] || row['路名'] || '';
          const routeArea = row['所属路区'] || row['路区'] || '';
          const companyName = row['公司名称'] || ''; 
          if (!streetName || !routeArea) return null;
          
          return {
            streetName,
            routeArea,
            companyName,
            pinyin: pinyin(streetName, { toneType: 'none', type: 'string' }).replace(/\s/g, '')
          };
        }).filter(r => r !== null) as any[];
        
        if (records.length === 0) return alert("格式错误或无有效数据（请检查表头是否包含：道路名称、所属路区）");
        
        const { added, updated } = await db.mergeStreets(records);
        
        alert(`导入完成！\n✅ 新增: ${added} 条\n🔄 更新: ${updated} 条`);
        loadData();
      } catch (error) {
        alert("文件解析失败");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const filteredStreets = streets.filter(s => {
    const matchesFilter = s.streetName.includes(filter) || s.routeArea.includes(filter) || (s.companyName && s.companyName.includes(filter));
    const matchesArea = selectedArea ? s.routeArea === selectedArea : true;
    return matchesFilter && matchesArea;
  });

  return (
    <div className="space-y-4 relative min-h-full pb-20">
      <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-black text-gray-800 mb-4 flex items-center">
           <FileSpreadsheet className="w-6 h-6 mr-2 text-brand-600" />
           题库管理 ({streets.length})
        </h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button onClick={() => setIsAdding(true)} className="bg-brand-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-lg shadow-brand-100">
            <Plus className="w-4 h-4" />
            <span>手动添加</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-blue-50 text-blue-700 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 active:scale-95 transition-all">
            <Upload className="w-4 h-4" />
            <span>导入Excel</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleExport} className="bg-green-50 text-green-700 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border border-green-100 active:scale-95">
            <Download className="w-4 h-4" />
            <span>备份导出</span>
          </button>
          <button onClick={() => setShowClearConfirm(true)} className="bg-red-50 text-red-700 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border border-red-100 active:scale-95">
            <Trash2 className="w-4 h-4" />
            <span>清空题库</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-800">新增数据</h3>
              <button onClick={() => setIsAdding(false)} className="p-2 bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <input required className="w-full border p-3 rounded-xl font-bold" placeholder="路名/小区名称 *" value={formData.streetName} onChange={handleStreetNameChange} />
              <input required className="w-full border p-3 rounded-xl font-bold" placeholder="所属路区 *" value={formData.routeArea} onChange={e => setFormData({...formData, routeArea: e.target.value})} />
              <input className="w-full border p-3 rounded-xl font-bold" placeholder="公司/网点名称 (可选)" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} />
              <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95">保存</button>
            </form>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-xl font-black mb-2">清空确认</h3>
            <p className="text-gray-500 text-sm mb-8">此操作将永久清空所有路区数据（共 {streets.length} 条），清空前请务必确认已备份导出。</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3.5 rounded-2xl border-2 border-gray-100 font-bold text-gray-500">取消</button>
              <button onClick={clearAllData} className="flex-1 py-3.5 rounded-2xl bg-red-600 text-white font-bold shadow-lg">确认清空</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredStreets.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center animate-fade-in-up">
            <div>
              <div className="font-black text-gray-800 text-lg">{item.streetName}</div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-brand-600 font-bold">{item.routeArea}</span>
                {item.companyName && <span className="text-[10px] text-green-600 font-bold">({item.companyName})</span>}
              </div>
            </div>
            <button onClick={() => setDeleteId(item.id)} className="p-3 text-gray-200 hover:text-red-500 transition-all">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {deleteId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-black mb-2">确认删除？</h3>
            <div className="flex space-x-3 mt-8">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-3 rounded-xl border font-bold">取消</button>
              <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};