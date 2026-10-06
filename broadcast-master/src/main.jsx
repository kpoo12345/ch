import React from 'react';
import { createRoot } from 'react-dom/client';
import BroadcastMasterGame from './BroadcastMasterGame.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BroadcastMasterGame />
  </React.StrictMode>,
);
