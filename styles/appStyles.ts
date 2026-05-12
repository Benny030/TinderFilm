
// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  cream:     '#FAF3E0',
  rose:      '#F4B8C8',
  roseDeep:  '#E8869E',
  mint:      '#B8E4E8',
  mintDeep:  '#5BBEC8',
  green:     '#9EE6A4',
  greenDeep: '#3CA648',
  blush:     '#F9E0E6',
  fog:       '#EEE8D8',
  white:     '#FFFFFF',
  ink:       '#2E2A26',
  muted:     '#7A6F65',
  faint:     '#B0A899',
  border:    '#E0D6C8',
  shadow:    'rgba(46,42,38,0.08)',
  shadowMd:  'rgba(46,42,38,0.14)',
  shadowLg:  'rgba(46,42,38,0.22)',
};

const R = { sm: '8px', md: '12px', lg: '18px', xl: '24px', full: '999px', };

const FONT = "'DM Sans', 'Helvetica Neue', sans-serif";
const MONO = "'DM Mono', 'Courier New', monospace";

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  // Layout
  screen: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100vh',
    background: C.cream,
    fontFamily: FONT,
    color: C.ink,
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '13px 18px',
    borderBottom: `1px solid ${C.border}`,
    background: C.blush,
    boxShadow: `0 2px 8px ${C.shadow}`,
  },

   headerMain: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '13px 18px',
    borderBottom: `1px solid ${C.border}`,
  },

  headerBtn: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '6px',
    color: C.ink,
    lineHeight: 1,
  },
  headerTitle: {
    fontSize: '15px',
    fontWeight: '600' as const,
    color: C.ink,
    letterSpacing: '0.2px',
  },

  // Logo / welcome hero
  logo: {
    textAlign: 'center' as const,
    padding: '48px 24px 32px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
  },
  logoIcon: { fontSize: 'clamp(44px, 14vw, 64px)', lineHeight: 1 },
  logoName: {
    fontSize: 'clamp(26px, 8vw, 36px)',
    fontWeight: '800' as const,
    color: C.roseDeep,
    letterSpacing: '4px',
    textTransform: 'uppercase' as const,
  },
  logoSub: { fontSize: '14px', color: C.mintDeep, letterSpacing: '0.3px' },
  roomCode: {
    fontSize: '11px',
    color: C.muted,
    fontFamily: MONO,
    background: C.fog,
    padding: '5px 12px',
    borderRadius: R.full,
    letterSpacing: '1px',
  },
  shareBtn: {
    background: C.rose,
    color: C.ink,
    border: 'none',
    borderRadius: R.full,
    padding: '13px 24px',
    fontSize: '14px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    boxShadow: `0 3px 10px ${C.shadow}`,
    fontFamily: FONT,
  },
  copyInfo: { fontSize: '12px', color: C.muted },

  // Join form
  joinForm: { display: 'grid', gap: '12px', padding: '0 24px 24px' },
  input: {
    padding: '12px 14px',
    border: `1.5px solid ${C.border}`,
    borderRadius: R.md,
    fontSize: '14px',
    fontFamily: FONT,
    color: C.ink,
    background: C.white,
    outline: 'none',
    width: '100%'
  },
  submitBtn: {
    background: C.rose,
    color: C.ink,
    border: 'none',
    borderRadius: R.md,
    padding: '13px',
    fontSize: '14px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: FONT,
    boxShadow: `0 2px 8px ${C.shadow}`,
  },
  message: {
    padding: '12px 16px',
    background: C.green,
    border: `1px solid ${C.mintDeep}`,
    borderRadius: R.md,
    color: C.greenDeep,
    fontWeight: '500' as const,
    fontSize: '14px',
    marginBottom: '4px',
  },

  // Status / participants card
  statusCard: {
    background: C.blush,
    borderRadius: R.xl,
    padding: '18px 20px',
    border: `1.5px solid ${C.border}`,
    margin: '0 20px 28px',
    boxShadow: `0 4px 16px ${C.shadow}`,
  },
  statusTitle: {
    fontSize: '13px',
    fontWeight: '700' as const,
    color: C.muted,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    marginBottom: '10px',
  },
  statusText: { fontSize: '14px', lineHeight: '1.6', color: C.ink, padding: '2px 0' },
  pendingText: {
    fontSize: '13px',
    color: C.roseDeep,
    fontWeight: '500' as const,
    marginTop: '8px',
    fontStyle: 'italic' as const,
  },

  // Final match — full page wrapper
  matchFullWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '24px 20px',
    overflowY: 'auto' as const,
    gap: '4px',
  },
  matchBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: C.roseDeep,
    color: C.white,
    padding: '8px 18px',
    borderRadius: R.full,
    fontSize: '13px',
    fontWeight: '700' as const,
    marginBottom: '16px',
    letterSpacing: '1px',
  },
  matchImageLarge: {
    width: '100%',
    maxHeight: '300px',
    objectFit: 'cover' as const,
    borderRadius: R.lg,
    marginBottom: '16px',
    boxShadow: `0 8px 28px ${C.shadowMd}`,
  },
  matchTitleLarge: {
    fontSize: '22px',
    fontWeight: '800' as const,
    color: C.ink,
    marginBottom: '6px',
    textAlign: 'center' as const,
  },
  matchMeta: {
    fontSize: '13px',
    color: C.muted,
    marginBottom: '20px',
    textAlign: 'center' as const,
  },
  watchBtn: {
    background: C.mint,
    color: C.ink,
    border: 'none',
    borderRadius: R.md,
    padding: '13px 24px',
    fontSize: '14px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: FONT,
    boxShadow: `0 2px 8px ${C.shadow}`,
    marginBottom: '10px',
  },

  // Popup / modal
  popupOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(46,42,38,0.35)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 30,
  },
  popupCard: {
    background: C.cream,
    borderRadius: R.xl,
    padding: '28px 24px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: `0 32px 80px ${C.shadowLg}`,
    border: `1px solid ${C.border}`,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
  },
  popupTitle: {
    fontSize: '22px',
    fontWeight: '800' as const,
    color: C.roseDeep,
    marginBottom: '10px',
    letterSpacing: '1px',
  },
  popupMovie: { fontSize: '16px', color: C.ink, marginBottom: '20px', fontWeight: '500' as const },
  popupClose: {
    background: 'none',
    border: 'none',
    fontSize: '13px',
    color: C.faint,
    cursor: 'pointer',
    marginTop: '14px',
    textDecoration: 'underline',
    fontFamily: FONT,
  },

  // Match pill (header badge)
  matchPill: {
    background: C.green,
    color: C.greenDeep,
    border: 'none',
    borderRadius: R.full,
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '700' as const,
    cursor: 'pointer',
    fontFamily: FONT,
  },

    // addFilm (header badge)
  addFilm: {
    background: C.white,
    color: C.ink,
    border: 'none',
    borderRadius: R.full,
    padding: '10px 10px ',
    fontSize: '12px',
    fontWeight: '700' as const,
    cursor: 'pointer',
    borderBottom: `2px solid ${C.border}`,
  },


  // Empty state
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    textAlign: 'center' as const,
    padding: '40px 24px',
  },
  emptyIcon: { fontSize: '64px', opacity: 0.75 },
  emptyTitle: { fontSize: '20px', fontWeight: '700' as const, color: C.ink },
  emptySub: { fontSize: '14px', color: C.muted, lineHeight: '1.6' },
  addBtn: {
    background: C.green,
    color: C.greenDeep,
    border: 'none',
    borderRadius: R.md,
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600' as const,
    cursor: 'pointer',
    fontFamily: FONT,
    boxShadow: `0 2px 8px ${C.shadow}`,
  },

  // Swipe card zone
  cardZone: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  card: {
    position: 'relative' as const,
    width: 'min(300px, 88vw)',
    height: 'min(420px, 68vh)',
    borderRadius: R.xl,
    overflow: 'hidden',
    background: C.mint,
    boxShadow: `0 16px 48px ${C.shadowMd}`,
  },
  cardImage: { width: '100%', height: '100%', objectFit: 'cover' as const },
  cardGradient: {
    position: 'absolute' as const,
    inset: 0,
    background: 'linear-gradient(transparent 35%, rgba(0,0,0,0.88) 100%)',
  },
  cardInfo: {
    position: 'absolute' as const,
    background: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '10px 10px 0 0',
    bottom: 0, left: 0, right: 0,
    padding: '18px 16px',
    color: C.white,
  },
  cardTitle: {
    fontSize: 'clamp(17px, 5vw, 21px)',
    fontWeight: '700' as const,
    marginBottom: '4px',
    lineHeight: '1.3',
  },
  cardBtnInfo: {
    position: 'absolute',
    right: 0,
    padding: '15px 15px',
    border: 'none',
    borderRadius: '0 0 0 100px',
    background: 'rgba(0, 0, 0, 0.49)',
    color: C.white,
    fontSize: '20px',
    cursor: 'pointer',
  },
  // ─── Card flip ────────────────────────────────────────────────────────────────

// applicato a entrambe le facce
cardFace: {
  position: 'absolute' as const,
  width: '100%',
  height: '100%',
  backfaceVisibility: 'hidden' as const,
  WebkitBackfaceVisibility: 'hidden' as const,  // Safari
  borderRadius: R.xl,
  overflow: 'hidden',
},

// retro: già ruotato di 180° di default nello spazio 3D
cardFaceBack: {
  position: 'absolute' as const,
  width: '100%',
  height: '100%',
  backfaceVisibility: 'hidden' as const,
  WebkitBackfaceVisibility: 'hidden' as const,
  borderRadius: R.xl,
  overflow: 'hidden',
  transform: 'rotateY(180deg)',
  background: C.blush,
  border: `1.5px solid ${C.border}`,
  boxShadow: `0 16px 48px ${C.shadowMd}`,
  display: 'flex',
  flexDirection: 'column' as const,
},

// contenuto interno del retro
cardBackContent: {
  flex: 1,
  display: 'flex',
  flexDirection: 'column' as const,
  padding: '52px 20px 20px', // spazio per il bottone ✕
  gap: '8px',
  overflowY: 'auto' as const,
},
cardBackTitle: {
  fontSize: '20px',
  fontWeight: '800' as const,
  color: C.ink,
  lineHeight: '1.3',
},
cardBackMeta: {
  fontSize: '12px',
  color: C.muted,
  letterSpacing: '0.3px',
},
cardBackDivider: {
  borderTop: `1px solid ${C.border}`,
  margin: '8px 0',
},
cardBackPlot: {
  fontSize: '14px',
  color: C.ink,
  lineHeight: '1.7',
  flex: 1,
},
  cardMeta: { fontSize: '12px', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.3px' },

  // Swipe overlay
  swipeOverlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: R.xl,
  },
  swipeText: {
    fontSize: '36px',
    fontWeight: '800' as const,
    color: C.white,
    textShadow: '0 3px 8px rgba(0,0,0,0.45)',
    letterSpacing: '3px',
  },

  // Trailer overlay
  trailerOverlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.65)',
    borderRadius: R.xl,
    backdropFilter: 'blur(2px)',
  },
  trailerButton: {
    background: C.rose,
    color: C.ink,
    border: 'none',
    borderRadius: R.md,
    padding: '13px 22px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: '700' as const,
    fontFamily: FONT,
    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  },

  // Progress bar (long press)
  progressBar: {
    position: 'absolute' as const,
    bottom: 0, left: 0, right: 0,
    height: '3px',
    background: 'rgba(255,255,255,0.3)',
    borderRadius: `0 0 ${R.xl} ${R.xl}`,
  },
  progressFill: {
    height: '100%',
    background: C.rose,
    borderRadius: `0 0 ${R.xl} 0`,
    transition: 'width 0.3s ease',
  },

  // Action row (like / pass buttons)
  actionRow: {
    display: 'flex',
    gap: '36px',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 20px',
    borderTop: `1px solid ${C.border}`,
    background: C.white,
  },
  actionBtn: {
    width: '62px',
    height: '62px',
    borderRadius: '50%',
    border: '2px solid',
    fontSize: '22px',
    cursor: 'pointer',
    background: C.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 3px 12px ${C.shadow}`,
    fontFamily: FONT,
  },
  passBtn: { borderColor: C.rose, color: C.roseDeep },
  likeBtn: { borderColor: C.green, color: C.greenDeep },

  // Reset row
  resetRow: { display: 'flex', justifyContent: 'center', padding: '10px 20px' },
  resetBtn: {
    background: C.fog,
    color: C.muted,
    border: `1px solid ${C.border}`,
    borderRadius: R.md,
    padding: '8px 18px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: FONT,
  },
  prog: { textAlign: 'center' as const, fontSize: '12px', color: C.faint, padding: '8px', fontFamily: MONO },

  // Add film form body
  fbody: { padding: '22px', flex: 1, overflowY: 'auto' as const },
  form: { display: 'flex', flexDirection: 'column' as const, gap: '12px', marginBottom: '20px' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },

  // Divider & section title
  divider: { borderTop: `1px solid ${C.border}`, margin: '22px 0' },
  sectionTitle: {
    fontSize: '11px',
    color: C.mintDeep,
    marginBottom: '12px',
    fontWeight: '700' as const,
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },

  // Table
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '14px' },
  tableHeader: {
    textAlign: 'left' as const,
    padding: '10px 12px',
    borderBottom: `2px solid ${C.border}`,
    fontWeight: '700' as const,
    fontSize: '11px',
    color: C.muted,
    letterSpacing: '0.8px',
    textTransform: 'uppercase' as const,
  },
  tableCell: { padding: '11px 12px', borderBottom: `1px solid ${C.fog}`, color: C.ink },
  deleteBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
    color: C.roseDeep,
  },

  // Match grid
  matchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '14px',
    padding: '16px',
    flex: 1,
    overflowY: 'auto' as const,
  },
  matchCard: {
    borderRadius: R.lg,
    overflow: 'hidden',
    background: C.blush,
    border: `1px solid ${C.border}`,
    boxShadow: `0 4px 14px ${C.shadow}`,
  },
  matchImage: { width: '100%', aspectRatio: '2/3', objectFit: 'cover' as const },
  matchInfo: { padding: '10px 12px' },
  matchTitle: { fontSize: '13px', fontWeight: '600' as const, color: C.ink, lineHeight: '1.4' },
  matchSubtitle: { fontSize: '11px', color: C.muted, marginTop: '3px' },

  // Unused but kept for completeness
  partnerRow: { display: 'flex', gap: '14px', justifyContent: 'center', padding: '0 20px 44px', flexWrap: 'wrap' as const },
  partnerCard: {
    background: C.blush, border: `1.5px solid ${C.border}`, borderRadius: R.lg,
    padding: '28px 18px', cursor: 'pointer', textAlign: 'center' as const,
    flex: '1 1 140px', boxShadow: `0 2px 8px ${C.shadow}`,
  },
  partnerIcon: { fontSize: '38px', marginBottom: '10px' },
  partnerName: { fontSize: '15px', fontWeight: '600' as const, color: C.ink },
  partnerSub: { fontSize: '12px', color: C.faint, marginTop: '4px' },
  footer: { padding: '18px 24px', borderTop: `1px solid ${C.border}`, textAlign: 'center' as const, background: C.fog },
  footerBtn: { background: 'none', border: 'none', fontSize: '12px', color: C.muted, cursor: 'pointer', textDecoration: 'underline', fontFamily: FONT },
};

export {styles};