import React, { useEffect, useRef, useState, useCallback } from 'react';
import { analyzeFrame } from '../services/geminiService';
import { HandData, MagicState } from '../types';

interface VisionControllerProps {
  onUpdate: (data: HandData) => void;
}

const VisionController: React.FC<VisionControllerProps> = ({ onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: 320, 
                height: 240,
                frameRate: { ideal: 10 }
            } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setError("Please allow camera access to control the magic.");
      }
    };
    startCamera();
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    // Check if video is ready
    if (videoRef.current.readyState !== 4) return;

    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get base64 (low quality to save bandwidth/speed)
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        
        // Call Gemini
        const result = await analyzeFrame(base64);
        onUpdate(result);
      }
    } catch (e) {
      console.error("Analysis loop error:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, onUpdate]);

  // Polling loop
  useEffect(() => {
    const intervalId = setInterval(() => {
      captureAndAnalyze();
    }, 800); // Check every 800ms to avoid rate limits while maintaining responsiveness

    return () => clearInterval(intervalId);
  }, [captureAndAnalyze]);

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
      <div className="bg-black/50 p-2 rounded-lg border border-pink-500/30 backdrop-blur-md mb-2">
         {error ? (
             <span className="text-red-400 text-xs font-mono">{error}</span>
         ) : (
             <span className="text-pink-200 text-xs font-mono animate-pulse">
                {isProcessing ? 'GATHERING MANA...' : 'AWAITING GESTURE'}
             </span>
         )}
      </div>
      
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />
      
      {/* Preview Feed (Small) */}
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        className="w-32 h-24 rounded-lg border-2 border-pink-500 opacity-70 object-cover scale-x-[-1]" 
      />
    </div>
  );
};

export default VisionController;