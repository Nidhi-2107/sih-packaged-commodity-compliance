import React from 'react';

/**
 * State Emblem of India (Lion Capital of Ashoka with Satyameva Jayate)
 * Vector rendering for official Government of India portal styling.
 */
export default function Emblem({ size = 48, color = 'currentColor', className = '' }) {
  return (
    <div
      className={`emblem-container ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        userSelect: 'none'
      }}
      title="State Emblem of India (सत्यमेव जयते)"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="National Emblem of India"
      >
        {/* Crown / Top Crest */}
        <path
          d="M50 4 C47 4 45 7 45 10 C45 12 47 14 50 14 C53 14 55 12 55 10 C55 7 53 4 50 4 Z"
          fill={color}
        />
        
        {/* Central Lion Head & Mane */}
        <path
          d="M42 16 C38 18 36 22 36 27 C36 34 40 39 44 42 L42 49 L46 48 L47 52 L53 52 L54 48 L58 49 L56 42 C60 39 64 34 64 27 C64 22 62 18 58 16 C55 15 53 17 50 17 C47 17 45 15 42 16 Z"
          fill={color}
        />
        {/* Central Lion Face Details */}
        <ellipse cx="46.5" cy="24" rx="2" ry="2.5" fill="#ffffff" />
        <ellipse cx="53.5" cy="24" rx="2" ry="2.5" fill="#ffffff" />
        <circle cx="46.5" cy="24.5" r="1.2" fill={color} />
        <circle cx="53.5" cy="24.5" r="1.2" fill={color} />
        <path d="M48 29 L52 29 L50 33 Z" fill="#ffffff" />
        <path d="M47 35 Q50 37 53 35" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" />

        {/* Left Lion (Profile) */}
        <path
          d="M37 22 C33 22 28 25 26 29 C24 33 24 38 27 42 C29 44 32 46 35 47 L33 53 L38 51 C39 52 41 53 42 53 L41 46 C37 43 35 38 35 32 C35 28 36 24 37 22 Z"
          fill={color}
          opacity="0.95"
        />
        <circle cx="29" cy="30" r="1.5" fill="#ffffff" />
        <circle cx="29" cy="30" r="0.8" fill={color} />

        {/* Right Lion (Profile) */}
        <path
          d="M63 22 C67 22 72 25 74 29 C76 33 76 38 73 42 C71 44 68 46 65 47 L67 53 L62 51 C61 52 59 53 58 53 L59 46 C63 43 65 38 65 32 C65 28 64 24 63 22 Z"
          fill={color}
          opacity="0.95"
        />
        <circle cx="71" cy="30" r="1.5" fill="#ffffff" />
        <circle cx="71" cy="30" r="0.8" fill={color} />

        {/* Capital Abacus Platform */}
        <rect x="20" y="55" width="60" height="4" rx="1" fill={color} />
        <rect x="18" y="60" width="64" height="15" rx="1.5" fill={color} />

        {/* Ashoka Chakra in Central Abacus */}
        <circle cx="50" cy="67.5" r="5.5" fill="#ffffff" />
        <circle cx="50" cy="67.5" r="4.5" fill="none" stroke={color} strokeWidth="0.8" />
        <circle cx="50" cy="67.5" r="1" fill={color} />
        {/* Spoke markers */}
        <line x1="50" y1="63" x2="50" y2="72" stroke={color} strokeWidth="0.5" />
        <line x1="45.5" y1="67.5" x2="54.5" y2="67.5" stroke={color} strokeWidth="0.5" />
        <line x1="46.8" y1="64.3" x2="53.2" y2="70.7" stroke={color} strokeWidth="0.5" />
        <line x1="53.2" y1="64.3" x2="46.8" y2="70.7" stroke={color} strokeWidth="0.5" />

        {/* Galloping Horse (Left of Chakra) */}
        <path
          d="M28 69 C27 67 29 65 32 65 C34 65 36 67 37 68 L41 68 L39 71 L36 70 L34 72 L31 72 L32 70 L29 71 Z"
          fill="#ffffff"
          opacity="0.9"
        />

        {/* Bull (Right of Chakra) */}
        <path
          d="M62 68 C63 66 65 65 67 65 C70 65 72 67 71 69 L73 70 L72 72 L69 71 L67 72 L65 71 L63 72 Z"
          fill="#ffffff"
          opacity="0.9"
        />

        {/* Inverted Lotus Base */}
        <path
          d="M22 76 C30 79 40 80 50 80 C60 80 70 79 78 76 L80 81 C71 85 59 87 50 87 C41 87 29 85 20 81 Z"
          fill={color}
        />
        <rect x="25" y="88" width="50" height="2" rx="0.5" fill={color} />

        {/* Stylized "सत्यमेव जयते" Script Below Base */}
        <text
          x="50"
          y="99"
          textAnchor="middle"
          fill={color}
          fontSize="8.5"
          fontWeight="700"
          fontFamily="'Plus Jakarta Sans', 'Inter', 'Noto Sans Devanagari', sans-serif"
          letterSpacing="0.06em"
        >
          सत्यमेव जयते
        </text>
        <text
          x="50"
          y="107"
          textAnchor="middle"
          fill={color}
          fontSize="5"
          fontWeight="600"
          fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif"
          letterSpacing="0.08em"
          opacity="0.85"
        >
          SATYAMEVA JAYATE
        </text>
      </svg>
    </div>
  );
}
