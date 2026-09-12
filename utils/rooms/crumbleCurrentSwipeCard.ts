const CRUMBLE_DURATION_MS = 680;

const nextPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

export async function crumbleCurrentSwipeCard(): Promise<void> {
  if (typeof document === 'undefined') return;

  /*
   * Lo swipe viene salvato in modo ottimistico.
   * In caso MOVIE_ALREADY_MATCHED, stanza.tsx annulla prima
   * quel voto e aspetta che React rimetta a schermo la card.
   * Qui aspettiamo altre due frame per essere sicuri di animare
   * proprio la card ripristinata, non quella successiva.
   */
  await nextPaint();

  const card = document.querySelector(
    '.cdr-swipe-active'
  ) as HTMLElement | null;

  if (!card) return;

  const rect = card.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const overlay = document.createElement('div');

  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    zIndex: '16000',
    pointerEvents: 'none',
    overflow: 'visible',
  });

  const rows = 5;
  const cols = 4;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const piece = card.cloneNode(true) as HTMLElement;

      /*
       * Ogni clone mostra soltanto un frammento della card.
       * In questo modo l'immagine sembra realmente spezzarsi,
       * senza dover creare screenshot/canvas.
       */
      const top = (row / rows) * 100;
      const right =
        100 - ((col + 1) / cols) * 100;
      const bottom =
        100 - ((row + 1) / rows) * 100;
      const left = (col / cols) * 100;

      Object.assign(piece.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        margin: '0',
        pointerEvents: 'none',
        userSelect: 'none',
        clipPath:
          `inset(${top}% ${right}% ${bottom}% ${left}%)`,
        WebkitClipPath:
          `inset(${top}% ${right}% ${bottom}% ${left}%)`,
        transform:
          'translate3d(0,0,0) rotate(0deg) scale(1)',
        opacity: '1',
        filter: 'none',
        transition:
          `transform ${CRUMBLE_DURATION_MS}ms cubic-bezier(.2,.72,.2,1), ` +
          `opacity ${Math.round(
            CRUMBLE_DURATION_MS * 0.78
          )}ms ease, ` +
          `filter ${CRUMBLE_DURATION_MS}ms ease`,
        willChange: 'transform, opacity, filter',
      });

      overlay.appendChild(piece);

      const index = row * cols + col;

      const horizontal =
        (col - (cols - 1) / 2) * 38 +
        (index % 2 === 0 ? -18 : 18);

      const vertical =
        54 +
        row * 32 +
        (col % 2) * 14;

      const rotation =
        (index % 2 === 0 ? -1 : 1) *
        (8 + row * 5 + col * 3);

      window.setTimeout(() => {
        piece.style.transform =
          `translate3d(${horizontal}px, ${vertical}px, 0) ` +
          `rotate(${rotation}deg) scale(.86)`;

        piece.style.opacity = '0';
        piece.style.filter =
          'blur(3px) saturate(.45) brightness(.92)';
      }, 18 + index * 7);
    }
  }

  document.body.appendChild(overlay);

  const previousVisibility =
    card.style.visibility;

  card.style.visibility = 'hidden';

  await new Promise<void>((resolve) => {
    window.setTimeout(
      resolve,
      CRUMBLE_DURATION_MS
    );
  });

  overlay.remove();

  if (card.isConnected) {
    card.style.visibility =
      previousVisibility;
  }
}
