import React, { useState, useEffect } from 'react';
import { Language } from '../types';
import { EnglishFlag, IndonesianFlag, JapaneseFlag } from './flags';

interface LanguageSelectorProps {
  onLanguageSelect: (language: Language) => void;
}

const LanguageButton: React.FC<{ language: Language; icon: React.ReactNode; onClick: (language: Language) => void }> = ({ language, icon, onClick }) => (
  <button
    onClick={() => onClick(language)}
    className="bg-gray-800 border border-gray-700 hover:bg-purple-700 hover:border-purple-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 text-lg w-full md:w-72 flex items-center justify-center space-x-4"
  >
    {icon}
    <span>{language}</span>
  </button>
);

const getFlagComponent = (language: Language | null) => {
    switch(language) {
        case Language.ENGLISH: return <EnglishFlag className="w-48 h-48 md:w-64 md:h-64 rounded-lg shadow-2xl"/>;
        case Language.INDONESIAN: return <IndonesianFlag className="w-48 h-48 md:w-64 md:h-64 rounded-lg shadow-2xl"/>;
        case Language.JAPANESE: return <JapaneseFlag className="w-48 h-48 md:w-64 md:h-64 rounded-lg shadow-2xl"/>;
        default: return null;
    }
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ onLanguageSelect }) => {
  const [animatingLanguage, setAnimatingLanguage] = useState<Language | null>(null);

  useEffect(() => {
    if (animatingLanguage) {
      const timer = setTimeout(() => {
        onLanguageSelect(animatingLanguage);
      }, 1500); // Duration matches the animation
      return () => clearTimeout(timer);
    }
  }, [animatingLanguage, onLanguageSelect]);

  const handleLanguageClick = (language: Language) => {
    setAnimatingLanguage(language);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 text-center overflow-hidden">
      {animatingLanguage && (
         <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-50">
            <div className="animate-flag">
              {getFlagComponent(animatingLanguage)}
            </div>
         </div>
      )}

      <div className={`transition-opacity duration-500 ${animatingLanguage ? 'opacity-0' : 'opacity-100'}`}>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-4">Welcome to TemanBicara</h1>
        <p className="text-lg md:text-xl text-gray-400 mb-12">Which language would you like to practice today?</p>
        <div className="flex flex-col md:flex-row gap-6">
          <LanguageButton 
            language={Language.ENGLISH} 
            icon={<EnglishFlag className="w-8 h-8 rounded-full"/>} 
            onClick={handleLanguageClick} 
          />
          <LanguageButton 
            language={Language.INDONESIAN} 
            icon={<IndonesianFlag className="w-8 h-8 rounded-full"/>} 
            onClick={handleLanguageClick} 
          />
          <LanguageButton 
            language={Language.JAPANESE} 
            icon={<JapaneseFlag className="w-8 h-8 rounded-full"/>} 
            onClick={handleLanguageClick} 
          />
        </div>
      </div>
      
      <footer className={`absolute bottom-4 text-gray-600 text-sm transition-opacity duration-500 ${animatingLanguage ? 'opacity-0' : 'opacity-100'}`}>
        Developed by Zeinel Arfin Sadiq using Google AI Studio
      </footer>
    </div>
  );
};

export default LanguageSelector;
