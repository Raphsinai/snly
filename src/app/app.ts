import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('snly');

  protected readonly isFullscreen = signal(false);
  protected readonly fullscreenError = signal<string | null>(null);
  protected readonly canRenderApp = computed(() => this.isFullscreen());

  protected readonly expandedOptionId = signal<'heal' | 'spiral' | null>(null);

  protected readonly isOptionExpanded = computed(() => this.expandedOptionId() != null);

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const root = document.documentElement;

    // Cursor flashlight variables
    type TouchLikeEvent = Event & {
      touches?: ArrayLike<{ clientX: number; clientY: number }>;
      clientX?: number;
      clientY?: number;
    };

    const updateCursorVars = (event: Event) => {
      const e = event as TouchLikeEvent;
      const touch = e.touches?.[0];
      const x = e.clientX ?? touch?.clientX;
      const y = e.clientY ?? touch?.clientY;
      if (typeof x !== 'number' || typeof y !== 'number') return;
      root.style.setProperty('--cursorX', `${x}px`);
      root.style.setProperty('--cursorY', `${y}px`);
    };

    document.addEventListener('mousemove', updateCursorVars, { passive: true });
    document.addEventListener('touchmove', updateCursorVars, { passive: true });

    const updateFullscreenState = () => {
      this.isFullscreen.set(document.fullscreenElement != null);
    };

    document.addEventListener('fullscreenchange', updateFullscreenState, { passive: true });
    updateFullscreenState();

    // Gate cursor dot overlay (bigger + reacts to speed + grows over clickable elements)
    const dot = document.createElement('div');
    dot.className = 'gate-cursor-dot';
    dot.setAttribute('aria-hidden', 'true');

    const prefersReducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let dotMounted = false;
    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastT: number | null = null;
    let rafId = 0;

    let pendingX = 0;
    let pendingY = 0;
    let pendingScale = 1;

    const isClickable = (el: Element | null): boolean =>
      el?.closest(
        'a[href],button,[role="button"],input,select,textarea,label,summary,[tabindex]:not([tabindex="-1"])'
      ) != null;

    const renderDot = () => {
      rafId = 0;
      dot.style.transform = `translate3d(${pendingX}px, ${pendingY}px, 0) scale(${pendingScale})`;
    };

    const onPointerMove = (event: PointerEvent) => {
      const x = event.clientX;
      const y = event.clientY;

      // Default size
      pendingScale = 1;

      // Speed scaling (skipped for reduced motion)
      const t = event.timeStamp;
      if (!prefersReducedMotion && lastX != null && lastY != null && lastT != null) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dt = Math.max(1, t - lastT);
        const speed = Math.sqrt(dx * dx + dy * dy) / dt; // px per ms
        const speedScale = Math.min(0.9, speed * 2.2);
        pendingScale = 1 + speedScale;
      }

      lastX = x;
      lastY = y;
      lastT = t;

      // Make bigger on clickable targets.
      if (isClickable(event.target instanceof Element ? event.target : null)) {
        pendingScale *= 1.35;
      }

      pendingX = x;
      pendingY = y;

      if (prefersReducedMotion) {
        renderDot();
        return;
      }

      if (rafId === 0) {
        rafId = globalThis.requestAnimationFrame(renderDot);
      }
    };

    const mountDot = () => {
      if (dotMounted) return;
      document.body.appendChild(dot);
      dotMounted = true;
      window.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    };

    const unmountDot = () => {
      if (!dotMounted) return;
      window.removeEventListener('pointermove', onPointerMove, true);
      dot.remove();
      dotMounted = false;
      lastX = lastY = lastT = null;
      if (rafId !== 0) {
        globalThis.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.isOptionExpanded()) {
        event.preventDefault();
        this.closeOption();
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('keydown', onKeyDown);
    });

    // Ensure <body> exists before mounting.
    afterNextRender(() => {
      // Reactively mount/unmount based on whether the gate is visible.
      effect(() => {
        const gateActive = !this.canRenderApp();
        if (gateActive) {
          mountDot();
        } else {
          unmountDot();
        }
      });

      this.destroyRef.onDestroy(() => {
        unmountDot();
      });
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('mousemove', updateCursorVars);
      document.removeEventListener('touchmove', updateCursorVars);
      root.style.removeProperty('--cursorX');
      root.style.removeProperty('--cursorY');

      document.removeEventListener('fullscreenchange', updateFullscreenState);
    });
  }

  protected async enterFullscreen(): Promise<void> {
    this.fullscreenError.set(null);

    if (document.fullscreenElement != null) {
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      this.fullscreenError.set('Fullscreen was blocked by the browser. Please allow fullscreen and try again.');
    }
  }

  protected openOption(optionId: 'heal' | 'spiral') {
    this.expandedOptionId.set(optionId);
  }

  protected closeOption() {
    this.expandedOptionId.set(null);
  }
}
