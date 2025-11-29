import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Search as SearchIcon, MapPin, AlertCircle } from 'lucide-react';
import { db } from '../services/db';
import { StreetRecord } from '../types';

export const SearchPage: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StreetRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Ref for speech recognition
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'zh-CN';
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        // Remove punctuation commonly added by voice rec
        const cleanTranscript = transcript.replace(/[。，？！]/g, '');
        setQuery(cleanTranscript);
        handleSearch(cleanTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error(event.error);
        setIsListening(false);
        setError("语音识别失败，请重试或手动输入");
      };
    } else {
      setError("您的浏览器不支持语音识别");
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      } else {
        setError("语音功能不可用");
      }
    }
  };

  const handleSearch = (text: string) => {
    if (!text.trim()) {
      setResults([]);
      return;
    }
    const matches = db.search(text);
    setResults(matches);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    handleSearch(val);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-6">说出道路名称</h2>
        
        <button
          onClick={toggleListening}
          className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto transition-all shadow-xl ${
            isListening 
              ? 'bg-red-500 animate-pulse ring-4 ring-red-200' 
              : 'bg-brand-600 hover:bg-brand-700 ring-4 ring-blue-100'
          }`}
        >
          {isListening ? (
            <MicOff className="w-12 h-12 text-white" />
          ) : (
            <Mic className="w-12 h-12 text-white" />
          )}
        </button>
        
        <p className="mt-4 text-gray-500 h-6">
          {isListening ? "正在聆听..." : "点击麦克风开始"}
        </p>

        {error && (
          <div className="mt-2 text-red-500 text-sm flex items-center justify-center space-x-1">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 sm:text-sm shadow-sm"
          placeholder="或者手动输入 (如: 文三路)"
          value={query}
          onChange={handleInputChange}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
        {results.length > 0 ? (
          results.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl border-l-4 border-brand-500 shadow-sm flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{item.streetName}</h3>
                <p className="text-xs text-gray-400 font-mono mt-1">{item.pinyin}</p>
              </div>
              <div className="text-right">
                <span className="block text-2xl font-bold text-brand-600">{item.routeArea}</span>
                <div className="flex items-center justify-end text-gray-400 text-xs mt-1">
                  <MapPin className="w-3 h-3 mr-1" />
                  <span>路区</span>
                </div>
              </div>
            </div>
          ))
        ) : query ? (
           <div className="text-center text-gray-400 py-10">
             <p>未找到 "{query}" 相关路区</p>
             <p className="text-xs mt-2">请尝试去题库管理添加该道路</p>
           </div>
        ) : null}
      </div>
    </div>
  );
};