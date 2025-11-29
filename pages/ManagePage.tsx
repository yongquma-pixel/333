import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, Save, X, Download, Upload, AlertTriangle, Mail } from 'lucide-react';
import { db } from '../services/db';
import { StreetRecord } from '../types';
import * as XLSX from 'xlsx';
// @ts-ignore
import { pinyin } from 'pinyin-pro';

export const ManagePage: React.FC = () => {
  const [streets, setStreets] = useState<StreetRecord[]>([]);
  const [filter, setFilter] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({ streetName: '', routeArea: '', pinyin: '' });
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

  const handleStreetNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    let generatedPinyin = formData.pinyin;
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
    await db.add(formData);
    setFormData({ streetName: '', routeArea: '', pinyin: '' });
    setIsAdding(false);
    loadData();
  };

  const handleExport = () => {
    try {
      const dataToExport = streets.map(s => ({
        "道路名称": s.streetName,
        "所属路区": s.routeArea,
        "拼音": s.pinyin || '',
        "错误次数": s.failureCount || 0,
        "创建时间": new Date(s.createdAt).toLocaleDateString()
      }));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      XLSX.utils.book_append_sheet(wb, ws, "路区数据");
      XLSX.writeFile(wb, `路区题库备份_${new Date().toISOString().slice(0,10)}.xlsx`);
      setShowEmailModal(true);
    } catch (error) {
      alert("导出失败");
    }
  };

  const handleSendEmail = () => {
    if (!emailAddress) return alert("请输入邮箱地址");
    localStorage.setItem('backup_email', emailAddress);
    const filename = `路区题库备份_${new Date().toISOString().slice(0,10)}.xlsx`;
    const subject = encodeURIComponent(`路区通数据备份 - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(`备份文件: ${filename}\n\n请手动挂载附件发送。`);
    window.location.href = `mailto:${emailAddress}?subject=${subject}&body=${body}`;
    setShowEmailModal(false);
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
        const records = data.map((row: any) => ({
          streetName: row['道路名称'],
          routeArea: row['所属路区'],
          pinyin: row['拼音'] || ''
        })).filter(r => r.streetName && r.routeArea);
        if (records.length === 0) return alert("格式错误");
        const count = await db.addMany(records);
        alert(`导入 ${count} 条数据`);
        loadData();
      } catch (error) {
        alert("文件解析失败");
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredStreets = streets.filter(s => s.streetName.includes(filter) || s.routeArea.includes(filter));

  return (
    <div className="space-y-4">
      <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">题库管理 ({streets.length})</h2>
        <button onClick={() => setIsAdding(true)} className="bg-brand-600 text-white px-3 py-2 rounded-lg flex items-center space-x-1 text-sm font-medium shadow-md">
          <Plus className="w-4 h-4" /><span>新增</span>
        </button>
      </div>
      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex space-x-3">
        <button onClick={handleExport} className="flex-1 flex items-center justify-center space-x-2 bg-green-50 text-green-700 py-2 rounded-lg text-sm font-medium hover:bg-green-100"><Download className="w-4 h-4" /><span>导出备份</span></button>
        <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center space-x-2 bg-blue-50 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-100"><Upload className="w-4 h-4" /><span>导入Excel</span></button>
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">录入新路区</h3><button onClick={() => setIsAdding(false)}><X className="w-6 h-6 text-gray-400" /></button></div>
            <form onSubmit={handleAdd} className="space-y-4">
              <input type="text" required className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-500" placeholder="道路名称" value={formData.streetName} onChange={handleStreetNameChange} />
              <input type="text" required className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-brand-500" placeholder="所属路区" value={formData.routeArea} onChange={e => setFormData({...formData, routeArea: e.target.value})} />
              <input type="text" className="w-full border rounded-lg p-2.5 bg-gray-50" placeholder="自动生成拼音" value={formData.pinyin} onChange={e => setFormData({...formData, pinyin: e.target.value})} />
              <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold flex justify-center items-center space-x-2"><Save className="w-5 h-5" /><span>保存</span></button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl text-center">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">确认删除</h3>
            <p className="text-gray-500 text-sm mb-6">操作不可撤销</p>
            <div className="flex space-x-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border">取消</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold">删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
             <Mail className="w-10 h-10 text-brand-600 mx-auto mb-4" />
             <h3 className="text-lg font-bold text-center mb-2">发送备份</h3>
             <input type="email" placeholder="邮箱地址" className="w-full border p-3 rounded-xl mb-4" value={emailAddress} onChange={e => setEmailAddress(e.target.value)} />
             <div className="flex space-x-3">
               <button onClick={() => setShowEmailModal(false)} className="flex-1 py-2 border rounded-xl">取消</button>
               <button onClick={handleSendEmail} className="flex-1 py-2 bg-brand-600 text-white rounded-xl">发送</button>
             </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="搜索..." className="w-full pl-9 pr-4 py-2.5 border rounded-xl" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      <div className="space-y-2 pb-20">
        {filteredStreets.map(item => (
          <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
            <div><div className="font-bold text-gray-800">{item.streetName}</div><div className="text-xs text-brand-600 bg-brand-50 inline-block px-2 py-0.5 rounded mt-1">{item.routeArea}</div></div>
            <button onClick={() => setDeleteId(item.id)} className="p-2 text-gray-300 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};