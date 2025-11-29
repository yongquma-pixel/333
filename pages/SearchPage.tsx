import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Search as SearchIcon, MapPin, AlertCircle, Layers, Type, Trash2, Wand2, Activity, Loader2 } from 'lucide-react';
import { db } from '../services/db';
import { StreetRecord } from '../types';

type SearchMode = 'single' | 'batch';

interface BatchResultItem {
  id: string;
  text: string;
  match: StreetRecord | null;
}

export const SearchPage: React.FC = () => {
  const [mode, setMode] = useState<SearchMode>('single');
  const [isListening, setIsListening] = useState(false);
  const [query, setQuery] = useState('');
  const [interimText, setInterimText] = useState('');
  const [singleResults, setSingleResults] = useState<StreetRecord[]>([]);
  const [batchList, setBatchList] = useState<BatchResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Initialize DB
  useEffect(() => {
    db.init().then(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (listEndRef.current) listEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [batchList, interimText]);

  useEffect(() => {
    setIsListening(false);
    recognitionRef.current?.stop();
    setQuery('');
    setInterimText('');
    setSingleResults([]);
  }, [mode]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'zh-CN';
      recognitionRef.current.interimResults = true; 
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        setIsListening(false);
        setInterimText('');
        setError("语音服务中断");
      };

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          else interimTranscript += event.results[i][0].transcript;
        }

        if (mode === 'single') {
          const currentText = finalTranscript || interimTranscript;
          if (currentText) {
             const clean = currentText.replace(/[。，？！]/g, '');
             setQuery(clean);
             handleSingleSearch(clean);
          }
        } else {
          if (finalTranscript) {
            handleBatchProcess(finalTranscript);
            setInterimText('');
          } else {
            setInterimText(interimTranscript);
          }
        }
      };
    } else {
      setError("不支持语音识别");
    }
  }, [mode]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.continuous = (mode === 'batch');
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    }
  };

  const handleSingleSearch = async (text: string) => {
    if (!text.trim()) {
      setSingleResults([]);
      return;
    }
    const matches = await db.search(text);
    setSingleResults(matches);
  };

  const handleBatchProcess = async (transcript: string) => {
    const results = await db.batchRecognize(transcript);
    const newItems: BatchResultItem[] = results.map(r => ({
      id: Math.random().toString(36).substr(2, 9),
      text: r.original,
      match: r.match
    }));
    setBatchList(prev => [...prev, ...newItems]);
  };

  const clearBatch = () => {
    setBatchList([]);
    setInterimText('');
  };

  if (!isReady) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" /></div>;

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="bg-gray-200 p-1 rounded-xl flex text-sm font-medium shrink-0">
        <button onClick={() => setMode('single')} className={`flex-1 py-2 rounded-lg flex justify-center items-center space-x-2 ${mode === 'single' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>
          <Type className="w-4 h-4" /><span>单条查询</span>
        </button>
        <button onClick={() => setMode('batch')} className={`flex-1 py-2 rounded-lg flex justify-center items-center space-x-2 ${mode === 'batch' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'}`}>
          <Layers className="w-4 h-4" /><span>批量连续</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4 scroll-smooth min-h-0">
        {mode === 'single' ? (
          <div className="space-y-3">
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                  placeholder="手动输入..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    handleSingleSearch(e.target.value);
                  }}
                />
              </div>

            {singleResults.length > 0 ? (
              singleResults.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl border-l-4 border-brand-500 shadow-sm flex justify-between items-center animate-fade-in-up">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{item.streetName}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-1">{item.pinyin}</p>
                    {query && !item.streetName.includes(query) && !item.pinyin.includes(query) && (
                      <span className="flex items-center text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1 w-fit">
                         <Wand2 className="w-3 h-3 mr-1" /> 自动纠正
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="block text-2xl font-bold text-brand-600">{item.routeArea}</span>
                  </div>
                </div>
              ))
            ) : query ? (
               <div className="text-center text-gray-400 py-10"><p>未找到 "{query}"</p></div>
            ) : (
               <div className="text-center text-gray-400 py-10 opacity-50">
                 <SearchIcon className="w-12 h-12 mx-auto mb-2 text-gray-200" />
                 <p>点击下方麦克风开始查询</p>
               </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">识别列表 ({batchList.length})</span>
              {batchList.length > 0 && (
                <button onClick={clearBatch} className="text-xs text-red-500 flex items-center space-x-1 bg-red-50 px-2 py-1 rounded">
                  <Trash2 className="w-3 h-3" /><span>清空</span>
                </button>
              )}
            </div>
            <div className="space-y-2">
                {batchList.map((item) => {
                  const isCorrection = item.match && item.text !== item.match.streetName;
                  return (
                    <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center animate-fade-in-left">
                      <div className="flex flex-col">
                         <div className="flex items-center space-x-2">
                             <div className={`w-2 h-2 rounded-full ${item.match ? 'bg-green-500' : 'bg-gray-300'}`} />
                             <span className="font-medium text-gray-800">{item.match ? item.match.streetName : item.text}</span>
                         </div>
                         {isCorrection && (
                           <div className="flex items-center space-x-1 text-[10px] text-amber-600 ml-4 mt-0.5">
                             <Wand2 className="w-3 h-3" /><span>语音: "{item.text}"</span>
                           </div>
                         )}
                      </div>
                      {item.match ? (
                        <div className="bg-brand-50 text-brand-700 px-3 py-1 rounded-md font-bold text-sm border border-brand-100 ml-2">
                          {item.match.routeArea}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic ml-2">未找到</span>
                      )}
                    </div>
                  );
                })}
                {interimText && (
                  <div className="bg-brand-50 p-3 rounded-lg border border-brand-200 border-dashed flex items-center space-x-3 opacity-90 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-brand-500 animate-ping" />
                    <span className="text-brand-700 font-medium italic">{interimText}...</span>
                  </div>
                )}
                <div ref={listEndRef} />
            </div>
          </div>
        )}
      </div>

      <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 text-center transition-all duration-300 relative overflow-hidden shrink-0 ${mode === 'batch' ? 'p-4' : 'p-6'}`}>
        {mode === 'batch' && isListening && <div className="absolute inset-0 bg-brand-50 opacity-50 animate-pulse pointer-events-none"></div>}
        <h2 className="text-lg font-bold text-gray-800 mb-3 relative z-10">{mode === 'single' ? "语音查路区" : "批量语音识别"}</h2>
        <button onClick={toggleListening} className={`relative z-10 rounded-full flex items-center justify-center mx-auto transition-all shadow-xl ${mode === 'batch' ? 'w-20 h-20' : 'w-24 h-24'} ${isListening ? 'bg-red-500 ring-4 ring-red-200 scale-105' : 'bg-brand-600 hover:bg-brand-700 ring-4 ring-blue-100'}`}>
          {isListening ? (
            <div className="flex flex-col items-center"><MicOff className="w-8 h-8 text-white" />{mode === 'batch' && <Activity className="w-4 h-4 text-white/80 animate-bounce mt-1" />}</div>
          ) : <Mic className="w-10 h-10 text-white" />}
        </button>
        <div className="mt-3 relative z-10 h-6 flex justify-center items-center">
          {isListening ? <span className="text-brand-600 text-sm font-medium animate-pulse flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>{mode === 'single' ? "正在聆听..." : "正在连续监听..."}</span> : <span className="text-gray-400 text-sm">点击麦克风开始</span>}
        </div>
        {error && <div className="mt-2 text-red-500 text-xs flex items-center justify-center space-x-1 relative z-10"><AlertCircle className="w-3 h-3" /><span>{error}</span></div>}
      </div>
    </div>
  );
};