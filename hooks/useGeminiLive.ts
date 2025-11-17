
import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Language, Transcription } from '../types';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

const getVoiceForLanguage = (lang: Language): string => {
  if (lang === Language.JAPANESE) {
    return 'Kore'; // A more suitable voice for Japanese conversation
  }
  return 'Zephyr'; // Default voice
};

export const useGeminiLive = (language: Language) => {
  const [transcripts, setTranscripts] = useState<Transcription[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const isAiTurnRef = useRef(false);
  const currentInputTranscriptionRef = useRef('');

  const getSystemInstruction = (lang: Language): string => {
      const baseInstruction = `You are an AI language tutor. Your goal is to help me practice conversational ${lang}.
- Personality: Act as a friendly, calm, and relaxed conversation partner. Your tone should be encouraging and patient. Keep your sentences concise.
- Language: Speak ONLY in ${lang} unless I ask to switch.
- Interaction: You can see me through the webcam. You can make friendly, non-intrusive comments about my surroundings or actions to make the conversation feel natural. DO NOT comment on my physical appearance.
- Corrections: If I make a small grammar or wording mistake, correct it gently and briefly without interrupting the flow of conversation.
- Micro-feedback: After every 3-5 exchanges, you can optionally offer a single, small piece of feedback.`;

      if (lang === Language.JAPANESE) {
        return `${baseInstruction}\n- Transcription: Transcribe my spoken Japanese into Japanese characters (Kanji, Hiragana, Katakana), not Romaji.`;
      }
      
      return baseInstruction;
  };

  const stopSession = useCallback(() => {
    // Stop local media first to prevent further processing and sending data.
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }

    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.onaudioprocess = null; // Stop the callback from firing.
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
    }

    // Close the remote session.
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then((session) => {
            session.close();
        }).catch(e => console.error("Error closing session:", e));
        sessionPromiseRef.current = null; // Set to null immediately to prevent multiple close attempts.
    }

    // Close audio contexts safely.
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        inputAudioContextRef.current.close().catch(e => console.error("Error closing input AudioContext:", e));
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close().catch(e => console.error("Error closing output AudioContext:", e));
    }
    outputAudioContextRef.current = null;

    // Reset component state.
    setIsListening(false);
    setIsSpeaking(false);
  }, []);

  const startSession = useCallback((stream: MediaStream) => {
    if (sessionPromiseRef.current) return;
    
    setError(null);
    setTranscripts([]);
    setIsListening(true);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
        outputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const outputAudioContext = outputAudioContextRef.current;
    let nextStartTime = 0;

    const promise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: getVoiceForLanguage(language) } },
            },
            systemInstruction: getSystemInstruction(language),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
        },
        callbacks: {
            onopen: () => {
                isAiTurnRef.current = false;
                mediaStreamRef.current = stream;
                inputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                const inputAudioContext = inputAudioContextRef.current;
                mediaStreamSourceRef.current = inputAudioContext.createMediaStreamSource(stream);
                scriptProcessorRef.current = inputAudioContext.createScriptProcessor(4096, 1, 1);
                
                scriptProcessorRef.current.onaudioprocess = (event) => {
                    const inputData = event.inputBuffer.getChannelData(0);
                    const pcmBlob: Blob = {
                        data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                        mimeType: 'audio/pcm;rate=16000',
                    };
                    // Use the original promise reference to send data.
                    sessionPromiseRef.current?.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                };
                mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                scriptProcessorRef.current.connect(inputAudioContext.destination);
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
                const userText = currentInputTranscriptionRef.current.trim();
                if (userText) {
                    setTranscripts(prev => [...prev, { author: 'user', text: userText }]);
                    currentInputTranscriptionRef.current = '';
                }
                // Call stopSession for a full cleanup on natural closure
                stopSession();
            },
            onerror: (e: ErrorEvent) => {
                console.error("Gemini session error:", e);
                let errorMessage = "A connection error occurred. The session has been ended.";
                if (e.message && e.message.includes("Internal error")) {
                    errorMessage = "An internal AI service error occurred. The session has ended.";
                } else if (e.message) {
                    errorMessage = `Session error: ${e.message}. The session has been ended.`;
                }
                setError(errorMessage);
                stopSession();
            }
        }
    });

    sessionPromiseRef.current = promise;
    
    promise.catch((e: Error) => {
        console.error("Gemini session connection failed:", e);
        let errorMessage = "Failed to connect. Please check your network and try again.";
        if (e.message) {
            if (e.message.includes("API key")) {
                 errorMessage = "Failed to connect. Please check your API key.";
            } else if (e.message.includes("Internal error")) {
                 errorMessage = "The AI service is temporarily unavailable. Please try again later.";
            }
        }
        setError(errorMessage);
        stopSession();
    });

  }, [language, stopSession]);
  
  const sendImageFrame = useCallback((base64Data: string) => {
      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            session.sendRealtimeInput({
                media: { data: base64Data, mimeType: 'image/jpeg' }
            });
        }).catch(e => {
            // It's possible the session closed between the check and the `then`.
            // This is not a critical error to show to the user.
            console.error("Could not send image frame:", e)
        });
      }
  }, []);

  return { startSession, stopSession, sendImageFrame, transcripts, isListening, isSpeaking, error };
};
