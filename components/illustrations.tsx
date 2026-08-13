type IllustrationProps = {
  className?: string;
};

/** Hand-drawn double stroke that sits under a highlighted phrase. Stretches to the text width. */
export function ScribbleUnderline({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 240 16" fill="none" preserveAspectRatio="none" aria-hidden className={className}>
      <path d="M3 9.5C60 3 134 1.5 237 6" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path
        d="M24 15c46-3.5 110-4.5 188-1.5"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Sketched arrow used to point at the hero stat badges. */
export function CurvedArrow({ className = "" }: IllustrationProps) {
  return (
    <svg viewBox="0 0 80 60" fill="none" aria-hidden className={className}>
      <path d="M5 53C9 24 33 6 69 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M57 4l14 9-12 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FlowIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 520 520"
      fill="none"
      role="img"
      aria-label="Create a project, deliver work with attached proof, keep a verified record"
      className={className}
    >
      <defs>
        <linearGradient id="fl-wine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#561C24" />
          <stop offset="1" stopColor="#82313D" />
        </linearGradient>
        <linearGradient id="fl-paper" x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#FFFDFA" />
          <stop offset="1" stopColor="#F4ECDF" />
        </linearGradient>
        <filter id="fl-card" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#561C24" floodOpacity="0.14" />
        </filter>
      </defs>

      <circle cx="452" cy="70" r="78" fill="#C7B7A3" opacity="0.32" />
      <circle cx="70" cy="446" r="62" fill="#9A4B55" opacity="0.14" />

      <path
        d="M170 158c62 8 96 26 118 52"
        stroke="#C7B7A3"
        strokeWidth="2.5"
        strokeDasharray="5 9"
        strokeLinecap="round"
      />
      <path
        d="M300 332c-40 26-82 34-124 40"
        stroke="#C7B7A3"
        strokeWidth="2.5"
        strokeDasharray="5 9"
        strokeLinecap="round"
      />

      {/* step 1 */}
      <g filter="url(#fl-card)">
        <rect x="34" y="46" width="286" height="106" rx="26" fill="url(#fl-paper)" stroke="#E8D8C4" />
      </g>
      <rect x="58" y="76" width="46" height="46" rx="16" fill="#F4ECDF" />
      <path
        d="M70 93.5c0-1.5 1.2-2.7 2.7-2.7h6l2.2 2.4h9.4c1.5 0 2.7 1.2 2.7 2.7v10.4c0 1.5-1.2 2.7-2.7 2.7H72.7c-1.5 0-2.7-1.2-2.7-2.7V93.5Z"
        fill="#6D2932"
      />
      <text x="120" y="92" fontSize="16" fontWeight="700" letterSpacing="-0.3" fill="#561C24">
        Create project
      </text>
      <text x="120" y="112" fontSize="11.5" fill="#A9917A">
        Client, platform, agreement
      </text>
      <rect x="120" y="122" width="86" height="20" rx="10" fill="#F4ECDF" stroke="#E8D8C4" />
      <circle cx="132" cy="132" r="4" fill="#9A4B55" />
      <text x="142" y="136" fontSize="9.5" fill="#A9917A">
        Northline
      </text>
      <circle cx="296" cy="70" r="18" fill="#6D2932" />
      <text x="296" y="75" fontSize="11" fontWeight="700" fill="#F4ECDF" textAnchor="middle">
        01
      </text>

      {/* step 2 */}
      <g filter="url(#fl-card)">
        <rect x="196" y="200" width="290" height="120" rx="26" fill="url(#fl-paper)" stroke="#E8D8C4" />
      </g>
      <rect x="220" y="232" width="46" height="46" rx="16" fill="#F4ECDF" />
      <rect x="234" y="243" width="18" height="24" rx="4" fill="#6D2932" />
      <path d="M238.5 250h9M238.5 255h9M238.5 260h5" stroke="#F4ECDF" strokeWidth="1.6" strokeLinecap="round" />
      <text x="282" y="248" fontSize="16" fontWeight="700" letterSpacing="-0.3" fill="#561C24">
        Deliver work
      </text>
      <text x="282" y="268" fontSize="11.5" fill="#A9917A">
        Attach the proof that shows it
      </text>
      <rect x="282" y="280" width="164" height="26" rx="13" fill="#F4ECDF" stroke="#E8D8C4" />
      <rect x="292" y="286" width="14" height="14" rx="4" fill="#9A4B55" />
      <text x="314" y="298" fontSize="10" fill="#6D2932">
        logo-final.pdf
      </text>
      <path d="M424 293l4 4 7-8" stroke="#6D2932" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="462" cy="224" r="18" fill="#9A4B55" />
      <text x="462" y="229" fontSize="11" fontWeight="700" fill="#F4ECDF" textAnchor="middle">
        02
      </text>

      {/* step 3 */}
      <g filter="url(#fl-card)">
        <rect x="34" y="372" width="298" height="112" rx="26" fill="url(#fl-wine)" />
      </g>
      <rect x="58" y="404" width="46" height="46" rx="16" fill="#F4ECDF" fillOpacity="0.16" />
      <path
        d="M81 413l10 4v7.4c0 6.1-4.2 11.4-10 12.9-5.8-1.5-10-6.8-10-12.9V417l10-4Z"
        fill="#F4ECDF"
      />
      <path d="M76.5 426.4l3.4 3.4 6.6-7" stroke="#6D2932" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <text x="120" y="420" fontSize="16" fontWeight="700" letterSpacing="-0.3" fill="#F4ECDF">
        Keep the proof
      </text>
      <text x="120" y="440" fontSize="11.5" fill="#F4ECDF" fillOpacity="0.65">
        One trail, always ready
      </text>
      <rect x="120" y="450" width="104" height="20" rx="10" fill="#F4ECDF" fillOpacity="0.16" />
      <text x="132" y="464" fontSize="9" fontWeight="700" letterSpacing="1.4" fill="#F4ECDF">
        AUDIT READY
      </text>
      <circle cx="308" cy="396" r="18" fill="#F4ECDF" />
      <text x="308" y="401" fontSize="11" fontWeight="700" fill="#6D2932" textAnchor="middle">
        03
      </text>

      <g transform="rotate(-12 410 424)">
        <circle cx="410" cy="424" r="54" fill="#6D2932" opacity="0.1" />
        <circle cx="410" cy="424" r="46" stroke="#6D2932" strokeWidth="3" />
        <circle cx="410" cy="424" r="37" stroke="#6D2932" strokeWidth="1.4" strokeDasharray="3 5" />
        <path d="M398 424.5l7.5 7.5 15-16" stroke="#6D2932" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="410" y="456" fontSize="10" fontWeight="700" letterSpacing="2" fill="#6D2932" textAnchor="middle">
          VERIFIED
        </text>
      </g>
    </svg>
  );
}

export function RecordIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 460 470"
      fill="none"
      role="img"
      aria-label="A delivery record listing completed items, attached files and a verified seal"
      className={className}
    >
      <defs>
        <linearGradient id="rc-wine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#561C24" />
          <stop offset="1" stopColor="#82313D" />
        </linearGradient>
        <linearGradient id="rc-paper" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FFFDFA" />
          <stop offset="1" stopColor="#F4ECDF" />
        </linearGradient>
        <filter id="rc-shadow" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#561C24" floodOpacity="0.18" />
        </filter>
        <clipPath id="rc-clip">
          <rect x="86" y="34" width="284" height="366" rx="28" />
        </clipPath>
      </defs>

      <circle cx="392" cy="72" r="70" fill="#C7B7A3" opacity="0.34" />
      <circle cx="62" cy="392" r="56" fill="#9A4B55" opacity="0.14" />

      <rect x="98" y="52" width="264" height="336" rx="26" fill="#E8D8C4" transform="rotate(-7 230 220)" />
      <rect x="94" y="44" width="272" height="346" rx="27" fill="#F4ECDF" stroke="#D8C4A9" transform="rotate(-3 230 217)" />

      <g filter="url(#rc-shadow)">
        <rect x="86" y="34" width="284" height="366" rx="28" fill="url(#rc-paper)" stroke="#E8D8C4" />
      </g>

      <g clipPath="url(#rc-clip)">
        <rect x="86" y="34" width="284" height="92" fill="url(#rc-wine)" />
        <text x="112" y="68" fontSize="9.5" fontWeight="700" letterSpacing="2.2" fill="#F4ECDF" fillOpacity="0.7">
          DELIVERY RECORD
        </text>
        <text x="112" y="94" fontSize="17" fontWeight="700" letterSpacing="-0.3" fill="#F4ECDF">
          Northline Studio
        </text>
        <text x="112" y="112" fontSize="10.5" fill="#F4ECDF" fillOpacity="0.6">
          Mar 04 — Apr 18
        </text>
        <circle cx="326" cy="80" r="22" fill="#F4ECDF" fillOpacity="0.16" />
        <path d="M317 80.5l6 6 12-13" stroke="#F4ECDF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        <circle cx="122" cy="164" r="10" fill="#6D2932" />
        <path d="M117.5 164.2l3 3 5.6-6" stroke="#F4ECDF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="142" y="168" fontSize="12.5" fontWeight="600" fill="#561C24">
          Logo concepts
        </text>

        <circle cx="122" cy="200" r="10" fill="#6D2932" />
        <path d="M117.5 200.2l3 3 5.6-6" stroke="#F4ECDF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="142" y="204" fontSize="12.5" fontWeight="600" fill="#561C24">
          Homepage copy
        </text>

        <circle cx="122" cy="236" r="10" fill="#6D2932" />
        <path d="M117.5 236.2l3 3 5.6-6" stroke="#F4ECDF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="142" y="240" fontSize="12.5" fontWeight="600" fill="#561C24">
          Final asset pack
        </text>

        <rect x="112" y="270" width="104" height="30" rx="15" fill="#F4ECDF" stroke="#E8D8C4" />
        <rect x="124" y="278" width="14" height="14" rx="4" fill="#9A4B55" />
        <text x="146" y="290" fontSize="10" fill="#6D2932">
          PDF · 2.4 MB
        </text>
        <rect x="224" y="270" width="104" height="30" rx="15" fill="#F4ECDF" stroke="#E8D8C4" />
        <rect x="236" y="278" width="14" height="14" rx="4" fill="#C7B7A3" />
        <text x="258" y="290" fontSize="10" fill="#6D2932">
          ZIP · 46 MB
        </text>

        <path d="M112 326h232" stroke="#D8C4A9" strokeDasharray="5 6" />
        <text x="112" y="356" fontSize="10.5" fill="#A9917A">
          Logged 12
        </text>
        <text x="112" y="374" fontSize="10.5" fill="#A9917A">
          Disputes 0
        </text>
      </g>

      <g transform="rotate(-13 340 356)">
        <circle cx="340" cy="356" r="56" fill="#6D2932" opacity="0.1" />
        <circle cx="340" cy="356" r="48" fill="#FFFDFA" fillOpacity="0.5" stroke="#6D2932" strokeWidth="3" />
        <circle cx="340" cy="356" r="38" stroke="#6D2932" strokeWidth="1.4" strokeDasharray="3 5" />
        <path d="M328 356.5l7.5 7.5 15-16" stroke="#6D2932" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="340" y="388" fontSize="10" fontWeight="700" letterSpacing="2" fill="#6D2932" textAnchor="middle">
          VERIFIED
        </text>
      </g>
    </svg>
  );
}
