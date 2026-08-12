/** Illustrations SVG Quick Start (style plat / unDraw) — 48–64px. */

type IlluProps = { className?: string }

export function IlluSiteMap({ className = 'h-14 w-14' }: IlluProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Fond carte */}
      <rect x="6" y="10" width="52" height="42" rx="8" fill="#FFF7ED" />
      <rect x="6" y="10" width="52" height="42" rx="8" stroke="#FDBA74" strokeWidth="1.5" />
      {/* Routes */}
      <path
        d="M14 38h36M22 18v28M42 22v24"
        stroke="#FED7AA"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M12 28h18M36 44h14"
        stroke="#FDBA74"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Blocs bâtiments */}
      <rect x="12" y="20" width="8" height="6" rx="1.5" fill="#FB923C" opacity="0.35" />
      <rect x="44" y="30" width="7" height="7" rx="1.5" fill="#FB923C" opacity="0.3" />
      {/* Marqueur GPS */}
      <g style={{ transformOrigin: '32px 28px', transformBox: 'view-box' }} className="animate-[qs-pin_1.8s_ease-in-out_infinite]">
        <path
          d="M32 16c-5.2 0-9.4 4-9.4 9 0 6.8 9.4 15.5 9.4 15.5S41.4 31.8 41.4 25c0-5-4.2-9-9.4-9z"
          fill="#EA580C"
        />
        <circle cx="32" cy="25" r="3.2" fill="#FFF7ED" />
      </g>
      {/* Ombre marqueur */}
      <ellipse cx="32" cy="48" rx="5" ry="1.6" fill="#EA580C" opacity="0.18" />
    </svg>
  )
}

export function IlluClimUnit({ className = 'h-14 w-14' }: IlluProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Ombre sol */}
      <ellipse cx="32" cy="54" rx="18" ry="3" fill="#0F766E" opacity="0.12" />
      {/* Unité extérieure */}
      <rect x="14" y="16" width="36" height="34" rx="5" fill="#ECFDF5" />
      <rect x="14" y="16" width="36" height="34" rx="5" stroke="#5EEAD4" strokeWidth="1.5" />
      {/* Grille / ailettes */}
      <g stroke="#14B8A6" strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
        <path d="M20 24h24" />
        <path d="M20 28h24" />
        <path d="M20 32h24" />
        <path d="M20 36h24" />
        <path d="M20 40h24" />
      </g>
      {/* Ventilateur */}
      <circle cx="32" cy="33" r="8.5" fill="#CCFBF1" stroke="#0D9488" strokeWidth="1.4" />
      <g style={{ transformOrigin: '32px 33px', transformBox: 'view-box' }} className="animate-[qs-fan_3.2s_linear_infinite]">
        <path
          d="M32 27.5c1.8 1.2 2.6 3 2.2 5.2-.8-1-2-1.6-3.4-1.8.4-1.4.8-2.6 1.2-3.4z"
          fill="#0F766E"
        />
        <path
          d="M37.2 35.2c-1.6 1.4-3.6 1.8-5.6 1.2 1.2-.6 2-1.6 2.4-3 1.4.4 2.6.8 3.2 1.8z"
          fill="#0F766E"
        />
        <path
          d="M27 36.5c-1.5-1.5-1.8-3.6-1-5.6.5 1.2 1.5 2 2.8 2.4-.5 1.4-1 2.5-1.8 3.2z"
          fill="#0F766E"
        />
        <circle cx="32" cy="33" r="2" fill="#F0FDFA" />
      </g>
      {/* Pieds */}
      <rect x="18" y="50" width="5" height="3" rx="1" fill="#99F6E4" />
      <rect x="41" y="50" width="5" height="3" rx="1" fill="#99F6E4" />
      {/* Badge clim */}
      <rect x="40" y="18" width="8" height="5" rx="1.5" fill="#0F766E" />
    </svg>
  )
}

export function IlluCerfaSign({ className = 'h-14 w-14' }: IlluProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Feuille */}
      <path
        d="M18 8h22l12 12v34a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
        fill="#ECFDF5"
      />
      <path
        d="M18 8h22l12 12v34a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
        stroke="#86EFAC"
        strokeWidth="1.5"
      />
      {/* Coin plié */}
      <path d="M40 8v8a4 4 0 0 0 4 4h8" fill="#D1FAE5" stroke="#86EFAC" strokeWidth="1.5" />
      {/* Lignes texte */}
      <path
        d="M22 28h20M22 34h16M22 40h18"
        stroke="#4ADE80"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Tampon CERFA */}
      <rect x="22" y="44" width="14" height="6" rx="2" fill="#16A34A" opacity="0.9" />
      <path d="M25 47h8" stroke="#F0FDF4" strokeWidth="1.5" strokeLinecap="round" />
      {/* Stylo signature */}
      <g style={{ transformOrigin: '48px 38px', transformBox: 'view-box' }} className="animate-[qs-pen_2.4s_ease-in-out_infinite]">
        <path
          d="M38 42l14-14 4 4-14 14-5.5 1.5L38 42z"
          fill="#15803D"
        />
        <path d="M49 31l4 4" stroke="#BBF7D0" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M38 42l2.2 2.2" stroke="#14532D" strokeWidth="1" strokeLinecap="round" />
      </g>
      {/* Trait de signature */}
      <path
        d="M36 52c2.5-2 5-1.2 7 .4 1.5 1.2 3.2.8 4.5-.2"
        stroke="#166534"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  )
}
