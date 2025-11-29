import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ManagePage } from './pages/ManagePage';
import { QuizPage } from './pages/QuizPage';
import { SearchPage } from './pages/SearchPage';
import { TodoPage } from './pages/TodoPage';
import { HPA1Page } from './pages/HPA1Page';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/manage" element={<ManagePage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/todo" element={<TodoPage />} />
          <Route path="/hpa1" element={<HPA1Page />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;