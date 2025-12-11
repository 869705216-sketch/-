import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Scene } from './components/Scene';
import VisionController from './components/VisionController';
import { MagicState, HandData } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<MagicState>(MagicState.FORMED);
  const [handData, setHandData] = useState<HandData | null>(null);

  const handleVisionUpdate = (data: HandData) => {
    setHandData(data);
    
    // Logic: 
    // OPEN Hand = Unleash = CHAOS
    // CLOSED Hand = Contain = FORMED
    if (data.state === 'OPEN') {
      setAppState(MagicState.CHAOS);
    } else if (data.state === 'CLOSED') {
      setAppState(MagicState.FORMED);
    }
  };

  return (
    <div className="w-full h-screen bg-[#000000] relative overflow-hidden font-sans select-none">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Scene appState={appState} handData={handData} />
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute top-0 left-0 w-full p-8 z-10 pointer-events-none">
        <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-100 to-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
          SAKURA
        </h1>
        <p className="text-pink-100/70 mt-2 text-sm tracking-[0.5em] uppercase">
          Crystal Star Visualization
        </p>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-8 left-8 z-10 pointer-events-none max-w-sm hidden md:block">
        <div className="bg-gradient-to-br from-gray-900/60 to-black/60 backdrop-blur-md p-6 rounded-xl border border-white/10 text-pink-100 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
           <h3 className="text-lg font-bold text-pink-200 mb-2 border-b border-white/20 pb-2">SPELL CASTING</h3>
           <ul className="space-y-2 text-sm">
             <li className="flex items-center gap-3">
               <span className="w-2 h-2 rounded-full bg-pink-400 shadow-[0_0_10px_pink]"></span>
               <span>Show <strong>OPEN HAND</strong> to Unleash</span>
             </li>
             <li className="flex items-center gap-3">
               <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_10px_white]"></span>
               <span>Show <strong>FIST</strong> to Form Circle</span>
             </li>
             <li className="flex items-center gap-3">
               <span className="w-2 h-2 rounded-full bg-purple-300"></span>
               <span>Move hand to rotate perspective</span>
             </li>
           </ul>
        </div>
      </div>

      {/* Vision Controller (Camera Feed) */}
      <VisionController onUpdate={handleVisionUpdate} />
      
    </div>
  );
};

export default App;