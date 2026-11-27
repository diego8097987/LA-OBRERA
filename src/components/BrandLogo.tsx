import React, { useId } from 'react';

interface BrandLogoProps {
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = 'w-11 h-11' }) => {
  const uid = useId().replace(/:/g, '');
  const fireBgId = `fireBgGrad_${uid}`;
  const flameFillId = `flameFillGrad_${uid}`;
  const grillYellowId = `grillYellowGrad_${uid}`;
  const asaderoCurveId = `asaderoCurvePath_${uid}`;
  const grillClipId = `grillClipCircle_${uid}`;

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="Logotipo oficial LA OBRERA Grill Asadero"
    >
      <defs>
        <radialGradient id={fireBgId} cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#ff9900" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#cc3300" stopOpacity="0.75" />
          <stop offset="80%" stopColor="#4a0e00" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0d0502" stopOpacity="1" />
        </radialGradient>
        <linearGradient id={flameFillId} x1="0%" y1="100%" x2="10%" y2="0%">
          <stop offset="0%" stopColor="#e65c00" />
          <stop offset="55%" stopColor="#ff9914" />
          <stop offset="100%" stopColor="#ffcc33" />
        </linearGradient>
        <linearGradient id={grillYellowId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffd000" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <path id={asaderoCurveId} d="M 102,292 A 118,118 0 0,0 298,292" />
        <clipPath id={grillClipId}>
          <circle cx="200" cy="242" r="82" />
        </clipPath>
      </defs>

      <circle cx="200" cy="200" r="196" fill={`url(#${fireBgId})`} />
      <circle cx="200" cy="242" r="118" fill="#050505" stroke="#ffffff" strokeWidth="11" />
      <g clipPath={`url(#${grillClipId})`} fill={`url(#${grillYellowId})`}>
        <rect x="110" y="242" width="180" height="10" rx="3" />
        <rect x="110" y="258" width="180" height="10" rx="3" />
        <rect x="110" y="274" width="180" height="10" rx="3" />
        <rect x="110" y="290" width="180" height="10" rx="3" />
        <rect x="110" y="306" width="180" height="10" rx="3" />
      </g>

      <path
        d="M 92,190 C 90,145 128,118 148,86 C 155,73 149,54 143,45 C 168,52 184,78 181,102 C 196,65 232,32 272,18 C 262,48 242,74 238,105 C 254,96 266,92 280,96 C 260,116 254,142 260,190 Z"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="18"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M 255,95 C 254,68 275,54 282,30 C 298,48 298,75 278,94 C 268,103 257,104 255,95 Z"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="16"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M 96,190 C 94,148 130,120 150,88 C 157,75 151,57 146,48 C 167,55 182,80 179,105 C 194,68 230,36 268,22 C 258,50 238,76 234,108 C 250,99 262,95 275,98 C 256,118 250,144 256,190 Z"
        fill={`url(#${flameFillId})`}
        stroke="#1a0800"
        strokeWidth="2.5"
      />
      <path
        d="M 256,94 C 255,69 275,55 282,32 C 296,49 296,74 277,92 C 268,100 258,101 256,94 Z"
        fill={`url(#${flameFillId})`}
        stroke="#1a0800"
        strokeWidth="2.5"
      />

      <rect x="30" y="182" width="340" height="66" rx="10" fill="#050505" stroke="#ffffff" strokeWidth="9" />
      <text
        x="198"
        y="224"
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="'Cinzel', Georgia, serif"
        fontWeight="900"
        fontSize="31"
        letterSpacing="2.5"
      >
        LA OBRERA
      </text>
      <text
        x="315"
        y="240"
        textAnchor="end"
        fill="#e5e5e5"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontWeight="700"
        fontSize="7.5"
        letterSpacing="0.8"
      >
        DESDE 1996
      </text>

      <g transform="translate(202, 286) rotate(-14)">
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fill="#050505"
          stroke="#050505"
          strokeWidth="12"
          strokeLinejoin="round"
          fontFamily="'Dancing Script', cursive"
          fontWeight="700"
          fontSize="56"
        >
          Grill
        </text>
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="'Dancing Script', cursive"
          fontWeight="700"
          fontSize="56"
        >
          Grill
        </text>
      </g>

      <text
        fill="#ffffff"
        fontFamily="'Cinzel', Georgia, serif"
        fontWeight="900"
        fontSize="25"
        letterSpacing="2"
        stroke="#000000"
        strokeWidth="1.5"
        paintOrder="stroke"
      >
        <textPath href={`#${asaderoCurveId}`} startOffset="50%" textAnchor="middle">
          ASADERO
        </textPath>
      </text>
      <circle cx="200" cy="200" r="196" fill="none" stroke="rgba(255,136,0,0.45)" strokeWidth="3" />
    </svg>
  );
};
