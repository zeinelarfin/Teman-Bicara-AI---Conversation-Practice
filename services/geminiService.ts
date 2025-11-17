
import { GoogleGenAI } from '@google/genai';
import { Language } from '../types';

const getCorrectionSummaryPrompt = (language: Language, userTranscripts: string): string => {
  return `I am practicing my ${language} skills. Below is a transcript of everything I said during our conversation.
Please provide a concise, structured language correction summary in English. The summary should be friendly, supportive, and encouraging, not critical.

Follow this format exactly, using Markdown:
## Language Correction Summary

Here’s a quick look at our conversation today! You did a great job.

### Common Mistakes
- **Mistake 1:** [Describe the type of mistake, e.g., "Verb Conjugation"]
  - **You said:** "[User's incorrect phrase]"
  - **A better way:** "[Corrected phrase]"
  - **Why:** [Brief, simple explanation]
- **Mistake 2:** [Describe another mistake]
  - **You said:** "..."
  - **A better way:** "..."
  - **Why:** "..."

### Suggestions for Improvement
- [Provide 1-2 tailored suggestions based on the mistakes.]

### Practice Sentences
- [Provide 2-3 optional practice sentences related to the corrections.]

If there were no significant mistakes, just say something encouraging.

Here is the transcript of what I said:
---
${userTranscripts}
---
`;
};

const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Translate the following text into ${targetLanguage}. Provide only the translation, without any introductory phrases or labels.

Text to translate:
---
${text}
---
`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error(`Error translating text to ${targetLanguage}:`, error);
    return `(Translation to ${targetLanguage} failed.)`;
  }
};

export const getCorrectionSummaries = async (language: Language, userTranscripts: string): Promise<{ english: string; indonesian: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = getCorrectionSummaryPrompt(language, userTranscripts);
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    const englishSummary = response.text;
    const indonesianSummary = await translateText(englishSummary, 'Indonesian');

    return { english: englishSummary, indonesian: indonesianSummary };
  } catch (error) {
    console.error('Error generating correction summary:', error);
    throw new Error('Failed to get correction summary from Gemini API.');
  }
};
