import React from 'react';

export const EnglishFlag: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg" {...props}>
    <clipPath id="t">
      <path d="M0,0 v30 h60 v-30 z"/>
    </clipPath>
    <path d="M0,0 v30 h60 v-30 z" fill="#00247d"/>
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" clipPath="url(#t)"/>
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#cf142b" strokeWidth="4" clipPath="url(#t)"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#cf142b" strokeWidth="6"/>
  </svg>
);

export const IndonesianFlag: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect fill="#fff" width="900" height="600"/>
    <rect fill="#ce1126" width="900" height="300"/>
  </svg>
);

export const JapaneseFlag: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect fill="#fff" width="900" height="600"/>
    <circle fill="#bc002d" cx="450" cy="300" r="180"/>
  </svg>
);