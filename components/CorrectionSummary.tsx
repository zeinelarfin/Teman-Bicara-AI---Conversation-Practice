
import React, { useState, useEffect } from 'react';

// A simple hook for a typing animation effect.
const useTypingEffect = (text: string = '', speed: number = 20) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsFinished(false);
    
    if (!text) {
      setIsFinished(true);
      return;
    }
    
    let i = 0;
    const intervalId = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      i++;
      if (i > text.length) {
        clearInterval(intervalId);
        setIsFinished(true);
      }
    }, speed);

    return () => clearInterval(intervalId);
  }, [text, speed]);

  return { displayedText, isFinished };
};

// A component to format the text with markdown-like syntax
const FormattedText: React.FC<{ text: string }> = React.memo(({ text }) => {
  const formattedContent = text.split('\n').map((line, index) => {
    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-xl font-semibold text-purple-400 mt-6 mb-2">{line.replace('### ', '')}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-2xl font-bold text-gray-100 mt-8 mb-4">{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('- **')) {
      const bolded = line.replace('- **', '').split('**');
      return (
        <p key={index} className="mt-4 text-gray-300">
            - <strong>{bolded[0]}</strong>{bolded[1]}
        </p>
      );
    }
    if (line.startsWith('- ')) {
       return <p key={index} className="mt-2 ml-4 text-gray-300">{line}</p>;
    }
    return <p key={index} className="text-gray-300 mt-1">{line}</p>;
  });

  return <>{formattedContent}</>;
});

interface CorrectionSummaryProps {
  summary: string;
  indonesianSummary: string;
  isLoading: boolean;
  onStartNewSession: () => void;
}

const CorrectionSummary: React.FC<CorrectionSummaryProps> = ({ summary, indonesianSummary, isLoading, onStartNewSession }) => {
  const { displayedText: displayedEnglishSummary, isFinished: englishIsFinished } = useTypingEffect(isLoading ? '' : summary, 15);
  const { displayedText: displayedIndonesianSummary, isFinished: indonesianIsFinished } = useTypingEffect(englishIsFinished ? indonesianSummary : '', 15);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 md:p-8">
      <div className="bg-gray-800 rounded-xl p-6 md:p-8 w-full max-w-3xl shadow-2xl border border-gray-700">
        {isLoading ? (
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-100 mb-4">Generating Your Feedback...</h1>
            <p className="text-gray-400">Please wait a moment.</p>
            <div className="mt-6 animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto"></div>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-center text-gray-100 mb-6">Session Summary</h1>
            <div className="prose prose-invert max-w-none text-gray-300 min-h-[100px]">
              <FormattedText text={displayedEnglishSummary} />
            </div>

            {englishIsFinished && indonesianSummary && (
                <div className="mt-8 pt-6 border-t border-gray-700">
                     <div className="prose prose-invert max-w-none text-gray-300 min-h-[100px]">
                        <FormattedText text={displayedIndonesianSummary} />
                    </div>
                </div>
            )}
            
            <div className="text-center mt-8 h-14">
              {(englishIsFinished && indonesianIsFinished) && (
                <button
                  onClick={onStartNewSession}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors text-lg"
                >
                  Start New Session
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CorrectionSummary;
