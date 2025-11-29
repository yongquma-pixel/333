import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Mic, Camera, Save, ArrowLeft, X, Image as ImageIcon } from 'lucide-react';
import { db } from '../services/db';

export const HPA1Page: React.FC = () => {
  const navigate = useNavigate();
  const [trackingNum, setTrackingNum] = useState('');
  const [remarks, setRemarks] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startVoice = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'zh-CN'; 
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        // Simple heuristic: if text contains numbers, treat it as tracking number, else remarks
        // Or if tracking number is empty, fill it first.
        if (!trackingNum) {
            // Try to strip punctuation for tracking number
            const clean = text.replace(/[，。、？]/g, '');
            setTrackingNum(clean);
        } else {
            setRemarks(prev => prev + (prev ? ' ' : '') + text);
        }
      };
      recognition.start();
    } else {
      alert("您的设备不支持语音识别");
    }
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
           setImage(canvas.toDataURL('image/jpeg', 0.7));
         };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!trackingNum.trim() && !image) {
      alert("请至少输入运单号或拍摄照片");
      return;
    }
    
    // Format: 【HP-A-1】 运单号: XXXXX 备注: YYYYY
    let content = `【HP-A-1检查】`;
    if (trackingNum) content += ` 运单号:${trackingNum}`;
    if (remarks) content += ` 备注:${remarks}`;

    await db.addTodo(content, image || undefined);
    
    // Provide feedback
    const choice = window.confirm("记录已保存到待办！\n\n要继续录入下一条吗？");
    if (choice) {
      setTrackingNum('');
      setRemarks('');
      setImage(null);
    } else {
      navigate('/todo');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
       <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageFile} />
       
       {/* Header */}
       <div className="bg-white p-4 shadow-sm flex items-center space-x-3 sticky top-0 z-10">
         <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
           <ArrowLeft className="w-6 h-6" />
         </button>
         <h1 className="text-xl font-bold text-gray-800 flex items-center">
            <ClipboardCheck className="w-6 h-6 text-purple-600 mr-2" />
            HP-A-1 检查
         </h1>
       </div>

       <div className="flex-1 p-4 space-y-6 overflow-y-auto">
         
         {/* Tracking Number Input */}
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
           <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">运单号 / Tracking No.</label>
           <div className="relative">
             <input 
               type="text" 
               value={trackingNum}
               onChange={e => setTrackingNum(e.target.value)}
               placeholder="输入或语音念出单号..."
               className="w-full text-2xl font-mono font-bold text-gray-800 border-b-2 border-gray-200 focus:border-purple-500 outline-none py-2 bg-transparent"
             />
             {trackingNum && (
               <button onClick={() => setTrackingNum('')} className="absolute right-0 top-3 text-gray-300 hover:text-gray-500">
                 <X className="w-5 h-5" />
               </button>
             )}
           </div>
         </div>

         {/* Image Area */}
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">现场拍照 / Photo</label>
            {image ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <img src={image} alt="Evidence" className="w-full h-48 object-cover" />
                <button 
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full backdrop-blur-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-purple-300 transition-colors"
              >
                <Camera className="w-8 h-8 mb-2" />
                <span>点击拍照 / 选取照片</span>
              </button>
            )}
         </div>

         {/* Remarks Input */}
         <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">异常描述 / Remarks</label>
            <textarea 
              rows={3}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="如有破损或特殊情况，请在此补充..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-purple-500 outline-none"
            />
         </div>

         {/* Action Bar */}
         <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={startVoice}
              className={`p-4 rounded-xl flex flex-col items-center justify-center shadow-sm transition-all active:scale-95 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              <Mic className="w-8 h-8 mb-1" />
              <span className="text-xs font-bold">{isListening ? '正在听...' : '语音输入'}</span>
            </button>

            <button 
              onClick={handleSave}
              className="bg-purple-600 text-white p-4 rounded-xl flex flex-col items-center justify-center shadow-md hover:bg-purple-700 active:scale-95 transition-all"
            >
              <Save className="w-8 h-8 mb-1" />
              <span className="text-xs font-bold">提交待办</span>
            </button>
         </div>
       </div>
    </div>
  );
};