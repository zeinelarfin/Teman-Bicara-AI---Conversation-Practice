
export enum Language {
  ENGLISH = 'English',
  INDONESIAN = 'Indonesian',
  JAPANESE = 'Japanese',
}

export enum AppState {
  SELECTING_LANGUAGE,
  CONVERSING,
  GENERATING_SUMMARY,
  VIEWING_SUMMARY,
}

export interface Transcription {
  author: 'user' | 'ai';
  text: string;
}
