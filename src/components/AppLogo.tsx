export function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg
        width={compact ? 38 : 44}
        height={compact ? 38 : 44}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-label="Tabula Rassa logo"
      >
        <defs>
          <linearGradient id="elephant" x1="5" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2D5BFF" />
            <stop offset="1" stopColor="#4BC2FF" />
          </linearGradient>
        </defs>
        <path
          d="M8 24c0-10 8-17 17-17 8 0 15 5 17 13 1 4 0 8-2 12-2 3-5 5-9 5h-4v2c0 2-2 4-4 4s-4-2-4-4v-4c-6-2-11-7-11-11z"
          fill="url(#elephant)"
        />
        <path
          d="M16 18c1-2 3-3 5-3h6c3 0 5 2 6 5-1 0-2 1-3 2-1-2-2-3-4-3h-5c-1 0-2 1-3 2l-2-3z"
          fill="#F5FBFF"
          opacity="0.95"
        />
        <path
          d="M18 24c1-1 2-2 4-2h5c2 0 3 1 4 2"
          stroke="#F5FBFF"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M19 28c1-1 2-1 3-1h6c1 0 2 0 3 1"
          stroke="#F5FBFF"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.92"
        />
        <path
          d="M25 33c2 0 4 2 4 4v2c0 1-1 2-2 2h-2"
          stroke="#F5FBFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M31 21c1 0 2 1 2 2s-1 2-2 2"
          stroke="#F5FBFF"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.95"
        />
        <circle cx="32" cy="20" r="1.8" fill="#F5FBFF" />
      </svg>
      {!compact ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Tabula Rassa</p>
          <p className="text-lg font-semibold text-ink">Clinic & Research OS</p>
        </div>
      ) : (
        <div>
          <p className="wordmark-script text-xl leading-none text-ink">Tabula Rassa</p>
        </div>
      )}
    </div>
  );
}
