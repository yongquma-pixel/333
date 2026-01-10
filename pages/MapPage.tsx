
import React from 'react';
import { Navigate } from 'react-router-dom';

// This page is deprecated in favor of LibraryPage (Memory Atlas)
export const MapPage: React.FC = () => {
  return <Navigate to="/library" replace />;
};
