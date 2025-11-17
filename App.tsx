
import React, { useState, useCallback } from 'react';
import { Language, AppState, Transcription } from './types';
import LanguageSelector from './components/LanguageSelector';
import ConversationView from './components/ConversationView';
import CorrectionSummary from './components/CorrectionSummary';
import { getCorrectionSummaries } from './services/geminiService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.SELECTING_LANGUAGE);
  const [language, setLanguage] = useState<Language | null>(null);
  const [correctionSummary, setCorrectionSummary] = useState<string>('');
  const [indonesianSummary, setIndonesianSummary] = useState<string>('');
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLanguageSelect = (selectedLanguage: Language) => {
    setLanguage(selectedLanguage);
    setAppState(AppState.CONVERSING);
    setError(null);
    setCorrectionSummary('');
    setIndonesianSummary('');
  };

  const handleSessionEnd = useCallback(async (conversationHistory: Transcription[]) => {
    if (!language) return;

    setAppState(AppState.GENERATING_SUMMARY);
    setIsLoadingSummary(true);
    setError(null);

    try {
      const userTranscripts = conversationHistory
        .filter(t => t.author === 'user')
        .map(t => t.text)
        .join('\n');

      if (userTranscripts.trim().length === 0) {
        setCorrectionSummary("We didn't chat much this time, so there's no feedback to give. Let's talk more next session!");
        setIndonesianSummary("Kita tidak banyak mengobrol kali ini, jadi tidak ada masukan yang bisa diberikan. Mari kita bicara lebih banyak di sesi berikutnya!");
      } else {
        const summaries = await getCorrectionSummaries(language, userTranscripts);
        setCorrectionSummary(summaries.english);
        setIndonesianSummary(summaries.indonesian);
      }
      setAppState(AppState.VIEWING_SUMMARY);
    } catch (e) {
      console.error("Failed to generate correction summary:", e);
      setError("Sorry, I couldn't generate the summary. Please try again later.");
      setAppState(AppState.SELECTING_LANGUAGE); // Go back to start on error
    } finally {
      setIsLoadingSummary(false);
    }
  }, [language]);

  const handleStartNewSession = () => {
    setLanguage(null);
    setAppState(AppState.SELECTING_LANGUAGE);
    setCorrectionSummary('');
    setIndonesianSummary('');
    setError(null);
  };

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={handleStartNewSession}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    switch (appState) {
      case AppState.SELECTING_LANGUAGE:
        return <LanguageSelector onLanguageSelect={handleLanguageSelect} />;
      case AppState.CONVERSING:
        if (language) {
          return <ConversationView language={language} onSessionEnd={handleSessionEnd} />;
        }
        return null;
      case AppState.GENERATING_SUMMARY:
      case AppState.VIEWING_SUMMARY:
        return (
          <CorrectionSummary
            summary={correctionSummary}
            indonesianSummary={indonesianSummary}
            isLoading={isLoadingSummary}
            onStartNewSession={handleStartNewSession}
          />
        );
      default:
        return <LanguageSelector onLanguageSelect={handleLanguageSelect} />;
    }
  };

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen font-sans">
      {renderContent()}
    </div>
  );
};

export default App;
