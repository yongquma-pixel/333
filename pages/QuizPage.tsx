import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ChevronRight, RefreshCw, Trophy } from 'lucide-react';
import { db } from '../services/db';
import { QuizQuestion, StreetRecord } from '../types';

type QuizState = 'start' | 'playing' | 'result';

export const QuizPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMistakeMode = searchParams.get('mode') === 'mistakes';

  const [gameState, setGameState] = useState<QuizState>('start');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [wrongAnswers, setWrongAnswers] = useState<StreetRecord[]>([]);

  const startQuiz = () => {
    let quizData: QuizQuestion[] = [];
    
    if (isMistakeMode) {
      // Load mistakes logic: get streets with failureCount > 0
      const all = db.getAll();
      const mistakes = all.filter(s => s.failureCount > 0);
      if (mistakes.length === 0) {
        alert("暂无错题！请先进行普通练习。");
        navigate('/');
        return;
      }
      // Generate questions specifically for these streets
      // We assume db.generateQuiz can take IDs or we manually construct. 
      // For simplicity, we'll re-use generate logic but filter pool.
      // Re-implementing simplified logic here for custom pool:
      const allAreas = Array.from(new Set(all.map(s => s.routeArea)));
      quizData = mistakes.map(q => {
        const correct = q.routeArea;
        const wrongPool = allAreas.filter(a => a !== correct);
        const distractors = wrongPool.sort(() => 0.5 - Math.random()).slice(0, 3);
        // Padding if not enough
        while (distractors.length < 3) distractors.push("未知区域");
        
        return {
          question: q,
          options: [...distractors, correct].sort(() => 0.5 - Math.random())
        };
      });
    } else {
      quizData = db.generateQuiz(10); // 10 questions for normal mode
    }

    if (quizData.length === 0) {
      alert("题库题目不足，请先去【管理】页面添加至少 4 条不同路区的街道数据。");
      navigate('/manage');
      return;
    }

    setQuestions(quizData);
    setCurrentIndex(0);
    setScore(0);
    setWrongAnswers([]);
    setGameState('playing');
    setIsAnswered(false);
    setSelectedOption(null);
  };

  const handleAnswer = (option: string) => {
    if (isAnswered) return;
    
    setSelectedOption(option);
    setIsAnswered(true);
    
    const currentQ = questions[currentIndex];
    const isCorrect = option === currentQ.question.routeArea;

    if (isCorrect) {
      setScore(s => s + 1);
    } else {
      setWrongAnswers(prev => [...prev, currentQ.question]);
      // Update DB
      const currentFailures = currentQ.question.failureCount || 0;
      db.update(currentQ.question.id, { failureCount: currentFailures + 1 });
    }

    // Auto advance after short delay
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsAnswered(false);
        setSelectedOption(null);
      } else {
        setGameState('result');
      }
    }, 1500);
  };

  if (gameState === 'start') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-8">
        <div className="bg-white p-8 rounded-full shadow-lg mb-4">
          <Trophy className="w-16 h-16 text-yellow-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isMistakeMode ? '错题复习' : '路区测试'}
          </h2>
          <p className="text-gray-500">
            {isMistakeMode ? '针对薄弱环节进行强化训练' : '随机抽取 10 道题目，测试你的记忆力'}
          </p>
        </div>
        <button 
          onClick={startQuiz}
          className="w-full max-w-xs bg-brand-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-brand-700 transition-transform active:scale-95"
        >
          开始挑战
        </button>
      </div>
    );
  }

  if (gameState === 'result') {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="p-6 h-full overflow-y-auto pb-20">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mb-6">
          <div className="text-sm text-gray-500 uppercase tracking-wide mb-2">最终得分</div>
          <div className="text-6xl font-black text-brand-600 mb-2">{percentage}</div>
          <p className="text-gray-400">答对 {score} / {questions.length}</p>
        </div>

        {wrongAnswers.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-gray-800 ml-1">错题回顾</h3>
            {wrongAnswers.map((w, idx) => (
              <div key={idx} className="bg-red-50 p-4 rounded-xl border border-red-100 flex justify-between">
                <span className="font-medium text-gray-800">{w.streetName}</span>
                <span className="font-bold text-red-600">{w.routeArea}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 space-y-3">
          <button 
            onClick={startQuiz}
            className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold flex items-center justify-center space-x-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>再练一次</span>
          </button>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-white text-gray-600 py-3 rounded-xl font-bold border border-gray-200"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // Playing State
  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="h-full flex flex-col p-6">
      {/* Progress */}
      <div className="w-full bg-gray-200 h-2 rounded-full mb-6">
        <div 
          className="bg-brand-500 h-2 rounded-full transition-all duration-300" 
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-8">
          <span className="text-gray-400 text-sm font-medium">题目 {currentIndex + 1}/{questions.length}</span>
          <h2 className="text-3xl font-bold text-gray-900 mt-2 leading-tight">
            <span className="text-brand-600">{currentQ.question.streetName}</span> 属于哪个路区？
          </h2>
        </div>

        <div className="space-y-3">
          {currentQ.options.map((option, idx) => {
            let stateClass = "bg-white border-gray-200 text-gray-700 hover:border-brand-300";
            let icon = null;

            if (isAnswered) {
              if (option === currentQ.question.routeArea) {
                stateClass = "bg-green-50 border-green-500 text-green-700";
                icon = <CheckCircle className="w-5 h-5" />;
              } else if (option === selectedOption) {
                stateClass = "bg-red-50 border-red-500 text-red-700";
                icon = <XCircle className="w-5 h-5" />;
              } else {
                stateClass = "bg-gray-50 border-gray-100 text-gray-300 opacity-50";
              }
            }

            return (
              <button
                key={idx}
                disabled={isAnswered}
                onClick={() => handleAnswer(option)}
                className={`w-full p-4 rounded-xl border-2 text-left font-bold text-lg transition-all flex justify-between items-center ${stateClass}`}
              >
                <span>{option}</span>
                {icon}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};