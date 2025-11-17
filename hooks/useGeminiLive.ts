import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Language, Transcription } from '../types';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

export const useGeminiLive = (language: Language) => {
  const [transcripts, setTranscripts] = useState<Transcription[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const isAiTurnRef = useRef(false);
  const currentInputTranscriptionRef = useRef('');

  const getSystemInstruction = (lang: Language): string => {
      return `You are an AI language tutor. Your goal is to help me practice conversational ${lang}.
- Personality: Act as a friendly, calm, and relaxed conversation partner. Your tone should be encouraging and patient. Keep your sentences concise.
- Language: Speak ONLY in ${lang} unless I ask to switch.
- Interaction: You can see me through the webcam. You can make friendly, non-intrusive comments about my surroundings or actions to make the conversation feel natural. DO NOT comment on my physical appearance.
- Corrections: If I make a small grammar or wording mistake, correct it gently and briefly without interrupting the flow of conversation.
- Micro-feedback: After every 3-5 exchanges, you can optionally offer a single, small piece of feedback.`;
  };

  const startSession = useCallback((stream: MediaStream) => {
    if (sessionPromiseRef.current) return;
    
    setError(null);
    setTranscripts([]);
    setIsListening(true);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // FIX: Cast window to `any` to allow `webkitAudioContext` for broader browser compatibility.
    const outputAudioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    let nextStartTime = 0;

    sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: getSystemInstruction(language),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
        callbacks: {
            onopen: () => {
                isAiTurnRef.current = false;
                mediaStreamRef.current = stream;
                // FIX: Cast window to `any` to allow `webkitAudioContext` for broader browser compatibility.
                audioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
                scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                
                scriptProcessorRef.current.onaudioprocess = (event) => {
                    const inputData = event.inputBuffer.getChannelData(0);
                    const pcmBlob: Blob = {
                        data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                        mimeType: 'audio/pcm;rate=16000',
                    };
                    sessionPromiseRef.current?.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                };
                mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(audioContextRef.current.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
                if (message.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
                    setIsSpeaking(true);
                    const audioData = message.serverContent.modelTurn.parts[0].inlineData.data;
                    const decoded = decode(audioData);
                    const audioBuffer = await decodeAudioData(decoded, outputAudioContext, 24000, 1);

                    const source = outputAudioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputAudioContext.destination);
                    
                    const currentTime = outputAudioContext.currentTime;
                    nextStartTime = Math.max(nextStartTime, currentTime);
                    source.start(nextStartTime);
                    nextStartTime += audioBuffer.duration;
                    
                    source.onended = () => {
                        if (outputAudioContext.currentTime >= nextStartTime - 0.1) {
                            setIsSpeaking(false);
                        }
                    };
                }
                
                if (message.serverContent?.inputTranscription) {
                    currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                }
        
                if (message.serverContent?.outputTranscription) {
                    const aiTextChunk = message.serverContent.outputTranscription.text;
        
                    if (!isAiTurnRef.current) {
                        isAiTurnRef.current = true;
                        const userText = currentInputTranscriptionRef.current.trim();
                        currentInputTranscriptionRef.current = '';
        
                        setTranscripts(prev => {
                            const newTranscripts = [...prev];
                            if (userText) {
                                newTranscripts.push({ author: 'user', text: userText });
                            }
                            newTranscripts.push({ author: 'ai', text: aiTextChunk });
                            return newTranscripts;
                        });
                    } else {
                        setTranscripts(prev => {
                            const newTranscripts = [...prev];
                            const lastIndex = newTranscripts.length - 1;
                            if (lastIndex >= 0 && newTranscripts[lastIndex].author === 'ai') {
                                newTranscripts[lastIndex].text += aiTextChunk;
                            }
                            return newTranscripts;
                        });
                    }
                }
        
                if (message.serverContent?.turnComplete) {
                    isAiTurnRef.current = false;
                    const userText = currentInputTranscriptionRef.current.trim();
                    if (userText) {
                        setTranscripts(prev => [...prev, { author: 'user', text: userText }]);
                        currentInputTranscriptionRef.current = '';
                    }
                }
            },
            onclose: () => {
                setIsListening(false);
                const userText = currentInputTranscriptionRef.current.trim();
                if (userText) {
                    setTranscripts(prev => [...prev, { author: 'user', text: userText }]);
                    currentInputTranscriptionRef.current = '';
                }
            },
            onerror: (e) => {
                console.error("Gemini session error:", e);
                setError("A connection error occurred. Please end the session and try again.");
                setIsListening(false);
            }
        }
    });
  }, [language]);

  const stopSession = useCallback(() => {
    sessionPromiseRef.current?.then((session) => {
        session.close();
    }).catch(e => console.error("Error closing session:", e));
    
    scriptProcessorRef.current?.disconnect();
    mediaStreamSourceRef.current?.disconnect();
    audioContextRef.current?.close();

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    
    sessionPromiseRef.current = null;
    setIsListening(false);
  }, []);
  
  const sendImageFrame = useCallback((base64Data: string) => {
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            session.sendRealtimeInput({
                media: { data: base64Data, mimeType: 'image/jpeg' }
            });
        }).catch(e => console.error("Could not send image frame:", e));
      }
  }, []);

  return { startSession, stopSession, sendImageFrame, transcripts, isListening, isSpeaking, error };
};
