/* ============================================================
 * Web Swinger 1.0 — input.js
 * One-button input: pointer (mouse/touch) + Space share a single
 * "held" state. The game layer decides what press/release mean.
 * ============================================================ */

class Input {
  constructor(canvas) {
    this.held = false;
    this.onPress = null;    // set by Game
    this.onRelease = null;
    this.onPause = null;
    this._spaceDown = false;
    this._pointerDown = false;

    const press = () => {
      const was = this.held;
      this.held = this._spaceDown || this._pointerDown;
      if (!was && this.held && this.onPress) this.onPress();
    };
    const release = () => {
      const was = this.held;
      this.held = this._spaceDown || this._pointerDown;
      if (was && !this.held && this.onRelease) this.onRelease();
    };

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      this._pointerDown = true; press();
    });
    const pointerUp = (e) => { this._pointerDown = false; release(); };
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        // Don't hijack space when a button/slider has focus in a menu.
        if (document.activeElement && document.activeElement.tagName === 'BUTTON') {
          document.activeElement.blur();
        }
        e.preventDefault();
        this._spaceDown = true; press();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.onPause) this.onPause();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        this._spaceDown = false; release();
      }
    });

    // Losing focus mid-hold should behave like a release.
    window.addEventListener('blur', () => {
      this._spaceDown = false; this._pointerDown = false; release();
    });
  }
}
