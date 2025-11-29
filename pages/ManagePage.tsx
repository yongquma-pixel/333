import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, Save, X, Download, Upload, AlertTriangle, Mail } from 'lucide-react';
import { db } from '../services/db';
import { StreetRecord } from '../types';
import * as XLSX from 'xlsx';

export const ManagePage: React.FC = () => {
  const [streets, setStreets] = useState<StreetRecord[]>([]);
  const [filter, setFilter] = useState('');
  
  // Modal States
  const [isAdding, setIsAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [formData, setFormData] = useState({ streetName: '', routeArea: '', pinyin: '' });
  const [emailAddress, setEmailAddress] = useState('');

  useEffect(() => {
    loadData();
    // Load saved email preference
    const savedEmail = localStorage.getItem('backup_email');
    if (savedEmail) setEmailAddress(savedEmail);
  }, []);

  const loadData = () => {
    setStreets(db.getAll());
  };

  const confirmDelete = () => {
    if (deleteId) {
      db.delete(deleteId);
      loadData();
      setDeleteId(null);
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

  // --- EXPORT FUNCTIONALITY ---
  const handleExport = () => {
    try {
      // 1. Convert data to format with Chinese headers
      const dataToExport = streets.map(s => ({
        "道路名称": s.streetName,
        "所属路区": s.routeArea,
        "拼音": s.pinyin || '',
        "错误次数": s.failureCount || 0,
        "创建时间": new Date(s.createdAt).toLocaleDateString()
      }));

      // 2. Create workbook and sheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // 3. Append sheet
      XLSX.utils.book_append_sheet(wb, ws, "路区数据");

      // 4. Write file
      const filename = `路区题库备份_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, filename);

      // 5. Prompt for email
      setShowEmailModal(true);

    } catch (error) {
      console.error("Export failed:", error);
      alert("导出失败，请重试");
    }
  };

  const handleSendEmail = () => {
    if (!emailAddress) {
      alert("请输入邮箱地址");
      return;
    }
    
    // Save email for next time
    localStorage.setItem('backup_email', emailAddress);

    const filename = `路区题库备份_${new Date().toISOString().slice(0,10)}.xlsx`;
    const subject = encodeURIComponent(`路区通数据备份 - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(
      `你好，\n\n这是路区通APP的数据备份文件。\n\n⚠️ 重要提示：\n由于浏览器安全限制，APP无法自动挂载本地文件。\n\n请您手动将刚刚下载的 "${filename}" 文件作为附件添加到这封邮件中，然后发送。\n\n祝工作顺利！`
    );
    
    window.location.href = `mailto:${emailAddress}?subject=${subject}&body=${body}`;
    setShowEmailModal(false);
  };

  // --- IMPORT FUNCTIONALITY ---
  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        // Get first worksheet
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Map back to app format
        const records = data.map((row: any) => ({
          streetName: row['道路名称'],
          routeArea: row['所属路区'],
          pinyin: row['拼音'] || ''
        })).filter(r => r.streetName && r.routeArea); // Basic validation

        if (records.length === 0) {
          alert("未在Excel中找到有效的【道路名称】和【所属路区】列，请检查格式。");
          return;
        }

        const count = db.addMany(records);
        alert(`成功导入 ${count} 条新数据（已跳过重复项）。`);
        loadData();
      } catch (error) {
        console.error("Import failed:", error);
        alert("文件解析失败，请确保是标准的 Excel (.xlsx) 文件。");
      } finally {
        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredStreets = streets.filter(s => 
    s.streetName.includes(filter) || s.routeArea.includes(filter)
  );

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input 
        type="file" 
        accept=".xlsx, .xls" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">题库管理 ({streets.length})</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-brand-600 text-white px-3 py-2 rounded-lg flex items-center space-x-1 text-sm font-medium shadow-md active:scale-95 transition-transform"
        >
          <Plus className="w-4 h-4" />
          <span>新增</span>
        </button>
      </div>

      {/* Excel Actions Bar */}
      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex space-x-3">
        <button 
          onClick={handleExport}
          className="flex-1 flex items-center justify-center space-x-2 bg-green-50 text-green-700 py-2 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>导出备份</span>
        </button>
        <button 
          onClick={triggerImport}
          className="flex-1 flex items-center justify-center space-x-2 bg-blue-50 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span>导入Excel</span>
        </button>
      </div>

      {/* Add Modal Overlay */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
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

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fade-in-up">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4 mx-auto text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">确认删除</h3>
            <p className="text-gray-500 text-sm mb-6 text-center">
              确定要删除这条记录吗？<br/>此操作无法撤销。
            </p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 active:bg-red-700 shadow-md shadow-red-200 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Confirmation Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-fade-in-up">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4 mx-auto text-brand-600">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">文件已下载</h3>
            <p className="text-gray-500 text-sm mb-4 text-center leading-relaxed">
              是否将备份文件发送给指定邮箱？<br/>
              <span className="text-xs text-orange-500">(注意：发送时请手动挂载附件)</span>
            </p>
            
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-400 mb-1 ml-1 uppercase">接收邮箱</label>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-brand-500 outline-none"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
            </div>

            <div className="flex space-x-3">
              <button 
                onClick={() => setShowEmailModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                暂不需要
              </button>
              <button 
                onClick={handleSendEmail}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-md transition-colors"
              >
                去发送
              </button>
            </div>
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
          <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center group">
            <div>
              <div className="font-bold text-gray-800">{item.streetName}</div>
              <div className="text-xs text-brand-600 bg-brand-50 inline-block px-2 py-0.5 rounded mt-1">
                {item.routeArea}
              </div>
            </div>
            <button 
              onClick={() => setDeleteId(item.id)}
              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-95"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
        {filteredStreets.length === 0 && (
            <div className="text-center text-gray-400 py-10 text-sm">
                暂无数据，请点击右上角新增
            </div>
        )}
      </div>
    </div>
  );
};