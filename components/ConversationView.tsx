
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Language, Transcription } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { MicIcon, MicOffIcon, StopIcon, VideoIcon, VideoOffIcon } from './icons';

interface ConversationViewProps {
  language: Language;
  onSessionEnd: (conversationHistory: Transcription[]) => void;
}

const ConversationView: React.FC<ConversationViewProps> = ({ language, onSessionEnd }) => {
  const {
    startSession,
    stopSession,
    sendImageFrame,
    transcripts,
    isListening,
    isSpeaking,
    error,
  } = useGeminiLive(language);

  const [isCameraOn, setIsCameraOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const setupMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isCameraOn,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      startSession(stream);
    } catch (err) {
      console.error("Error accessing media devices.", err);
    }
  }, [isCameraOn, startSession]);

  useEffect(() => {
    setupMedia();

    return () => {
      stopSession();
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  useEffect(() => {
    if (isCameraOn && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      const captureFrame = () => {
        if (context && video.readyState >= 2) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
          canvas.toBlob(async (blob) => {
            if (blob) {
              const base64Data = await blobToBase64(blob);
              sendImageFrame(base64Data);
            }
          }, 'image/jpeg', 0.8);
        }
      };

      frameIntervalRef.current = window.setInterval(captureFrame, 2000); // Send frame every 2s
    } else {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    }
  }, [isCameraOn, sendImageFrame]);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts]);
  
  const handleEndSessionClick = () => {
    stopSession();
    onSessionEnd(transcripts);
  };
  
  const toggleCamera = () => {
      setIsCameraOn(prev => !prev);
      // Note: This simple toggle won't re-request the stream without video. 
      // A full implementation might re-run setupMedia. For this app, it just stops sending frames.
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 p-4 relative">
      <div className="relative w-48 h-36 md:w-64 md:h-48 rounded-lg overflow-hidden self-center shadow-lg border-2 border-gray-700">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform -scale-x-100" />
        {!isCameraOn && <div className="absolute inset-0 bg-black flex items-center justify-center"><VideoOffIcon className="w-12 h-12 text-gray-500"/></div>}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div ref={transcriptContainerRef} className="flex-grow my-4 overflow-y-auto space-y-4 pr-2">
        {transcripts.map((t, index) => (
          <div key={index} className={`flex ${t.author === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-lg ${t.author === 'user' ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p>{t.text}</p>
            </div>
          </div>
        ))}
         {isSpeaking && (
            <div className="flex justify-start">
              <div className="p-3 rounded-lg bg-gray-700 text-gray-400 italic">
                AI is speaking...
              </div>
            </div>
         )}
      </div>
      
      {error && <p className="text-red-400 text-center mb-2">{error}</p>}
      
      <div className="flex flex-col items-center justify-center pt-2">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors duration-300 ${isListening ? 'bg-purple-600 animate-pulse' : 'bg-gray-700'}`}>
           {isListening ? <MicIcon className="w-10 h-10 text-white"/> : <MicOffIcon className="w-10 h-10 text-gray-400"/>}
        </div>
        <p className="text-gray-400 mt-2">{isListening ? "Listening..." : "Mic is off"}</p>
      </div>

      <div className="absolute bottom-5 right-5 flex space-x-4">
        <button onClick={toggleCamera} className="bg-gray-700 hover:bg-gray-600 p-3 rounded-full transition-colors">
          {isCameraOn ? <VideoIcon className="w-6 h-6 text-white"/> : <VideoOffIcon className="w-6 h-6 text-white"/>}
        </button>
        <button onClick={handleEndSessionClick} className="bg-red-600 hover:bg-red-700 p-3 rounded-full transition-colors">
          <StopIcon className="w-6 h-6 text-white"/>
        </button>
      </div>
    </div>
  );
};

export default ConversationView;
