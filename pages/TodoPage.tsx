import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, Mic, Plus, Trash2, Calendar, Check, X, RotateCcw, AlertTriangle, Clock, Camera } from 'lucide-react';
import { db } from '../services/db';
import { TodoItem } from '../types';

export const TodoPage: React.FC = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      await db.init();
      await db.cleanupOldTodos();
      refreshTodos();
    };
    init();
  }, []);

  const refreshTodos = async () => {
    const all = await db.getAllTodos();
    const today = new Date().toISOString().slice(0, 10);
    const displayList = all.filter(t => !t.isDone || t.date === today);
    displayList.sort((a, b) => {
      if (a.isDone === b.isDone) {
        return !a.isDone ? a.date.localeCompare(b.date) || (b.createdAt - a.createdAt) : b.createdAt - a.createdAt;
      }
      return a.isDone ? 1 : -1;
    });
    setTodos(displayList);
  };

  const handleToggle = async (id: string) => {
    await db.toggleTodo(id);
    refreshTodos();
  };

  const executeDelete = async () => {
    if (confirmDeleteId) {
      await db.deleteTodo(confirmDeleteId);
      refreshTodos();
      setConfirmDeleteId(null);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskContent.trim() && !newImage) return;
    await db.addTodo(newTaskContent.trim() || "图片待办", newImage || undefined);
    setNewTaskContent('');
    setNewImage(null);
    setShowAddModal(false);
    refreshTodos();
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
         const img = new Image();
         img.src = evt.target?.result as string;
         img.onload = () => {
           const canvas = document.createElement('canvas');
           const MAX = 800;
           let w = img.width, h = img.height;
           if (w > h && w > MAX) { h *= MAX/w; w = MAX; }
           else if (h > MAX) { w *= MAX/h; h = MAX; }
           canvas.width = w; canvas.height = h;
           canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
           setNewImage(canvas.toDataURL('image/jpeg', 0.7));
         };
      };
      reader.readAsDataURL(file);
    }
  };

  const startVoice = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (e: any) => {
        setNewTaskContent(e.results[0][0].transcript);
        setShowAddModal(true);
      };
      recognition.start();
    } else alert("不支持语音");
  };

  return (
    <div className="space-y-6">
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageFile} />
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div><h2 className="text-xl font-bold flex items-center gap-2"><CheckSquare className="w-5 h-5 text-brand-600" /><span>每日待办</span></h2><p className="text-sm text-gray-500 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date().toLocaleDateString()}</p></div>
        <button onClick={() => setShowAddModal(true)} className="bg-gray-100 p-3 rounded-full text-brand-600"><Plus className="w-5 h-5" /></button>
      </div>

      <div className="space-y-3">
        {todos.filter(t=>!t.isDone).map(t => {
           const overdue = Math.ceil((new Date().setHours(0,0,0,0) - new Date(t.date).setHours(0,0,0,0))/(1000*60*60*24));
           return (
             <div key={t.id} className={`p-3 rounded-xl shadow-sm border flex items-start gap-3 ${overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
               <button onClick={() => handleToggle(t.id)} className="mt-1 w-5 h-5 border-2 border-gray-300 rounded-md"><Check className="w-3.5 h-3.5 opacity-0" /></button>
               <div className="flex-1">
                 <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{t.content}</p>{overdue > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">{overdue}天未办</span>}</div>
                 {t.imageUrl && <img src={t.imageUrl} onClick={() => setPreviewImage(t.imageUrl||null)} className="w-16 h-16 rounded mt-1 object-cover" />}
               </div>
               <button onClick={() => setConfirmDeleteId(t.id)}><Trash2 className="w-4 h-4 text-gray-400" /></button>
             </div>
           );
        })}
        {todos.filter(t=>t.isDone).map(t => (
           <div key={t.id} className="bg-gray-50 p-3 rounded-xl border flex items-start gap-3 opacity-70">
              <button onClick={() => handleToggle(t.id)} className="mt-1 w-5 h-5 bg-brand-100 border-2 border-brand-200 rounded-md flex items-center justify-center text-brand-600"><Check className="w-3.5 h-3.5" /></button>
              <div className="flex-1"><p className="text-sm line-through text-gray-500">{t.content}</p>{t.imageUrl && <img src={t.imageUrl} className="w-10 h-10 rounded mt-1 opacity-50" />}</div>
              <button onClick={() => setConfirmDeleteId(t.id)}><Trash2 className="w-4 h-4 text-gray-400" /></button>
           </div>
        ))}
      </div>

      <div className="fixed bottom-24 left-0 right-0 flex justify-center pointer-events-none">
        <button onClick={startVoice} disabled={isListening} className={`pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-xl ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-brand-600 text-white'}`}><Mic className="w-5 h-5" /><span>语音添加</span></button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <h3 className="font-bold mb-4">添加待办</h3>
            <textarea className="w-full border p-3 rounded-xl mb-4 bg-gray-50" rows={3} value={newTaskContent} onChange={e => setNewTaskContent(e.target.value)} placeholder="输入内容..." />
            {newImage && <div className="relative h-32 mb-4"><img src={newImage} className="h-full w-full object-cover rounded-xl" /><button onClick={() => setNewImage(null)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X className="w-4 h-4" /></button></div>}
            <div className="flex gap-2 mb-6"><button onClick={startVoice} className="flex-1 p-2 bg-brand-50 text-brand-600 rounded-xl flex justify-center items-center gap-2"><RotateCcw className="w-4 h-4" />重说</button><button onClick={() => fileInputRef.current?.click()} className="flex-1 p-2 bg-brand-50 text-brand-600 rounded-xl flex justify-center items-center gap-2"><Camera className="w-4 h-4" />拍照</button></div>
            <div className="flex justify-end gap-3"><button onClick={() => setShowAddModal(false)}>取消</button><button onClick={handleAddTask} className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold">完成</button></div>
          </div>
        </div>
      )}
      
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
             <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" />
             <h3 className="font-bold mb-6">确认删除？</h3>
             <div className="flex gap-3"><button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 border rounded-xl">取消</button><button onClick={executeDelete} className="flex-1 py-2 bg-red-500 text-white rounded-xl">删除</button></div>
           </div>
        </div>
      )}

      {previewImage && <div className="fixed inset-0 z-[60] bg-black flex justify-center items-center p-4" onClick={() => setPreviewImage(null)}><img src={previewImage} className="max-w-full max-h-full rounded-lg" /></div>}
    </div>
  );
};