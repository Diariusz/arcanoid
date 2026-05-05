// engine/InputManager.js
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = Object.create(null);
    this.firePressed = false;    
    this.isTouch =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0;

    this.touch = {
      thrust: false,
      fire: false,
      angleTarget: null
    };

    this.touchButtons = {
      thrust: { x: 80, y: 0, r: 45 },
      fire:   { x: 0,  y: 0, r: 45 }
    };

    this.bindKeyboard();
    if (this.isTouch) {
      this.bindTouch();
      this.updateTouchLayout();
      window.addEventListener("resize", () => this.updateTouchLayout());
    }
  }

  /* ================= KEYBOARD ================= */

  bindKeyboard() {
    window.addEventListener("keydown", e => {
      if (e.code === "Space") {
        this.firePressed = true; // ✅ impuls
      } else {
        this.keys[e.code] = true;
      }
    });

    window.addEventListener("keyup", e => {
      this.keys[e.code] = false;
    });
  }

  /* ================= TOUCH ================= */

  updateTouchLayout() {
    this.touchButtons.thrust.y = this.canvas.height - 80;
    this.touchButtons.fire.x = this.canvas.width - 80;
    this.touchButtons.fire.y = this.canvas.height - 80;
  }

  bindTouch() {
    this.canvas.addEventListener(
      "touchstart",
      e => {
        for (const t of e.changedTouches) {
          if (this.isInButton(t, this.touchButtons.thrust)) {
            this.touch.thrust = true;
            continue;
          }
          if (this.isInButton(t, this.touchButtons.fire)) {
            this.touch.fire = true;
            continue;
          }

          // tap w przestrzeń = obrót statku
          this.touch.angleTarget = {
            x: t.clientX,
            y: t.clientY
          };
        }
      },
      { passive: true }
    );

    this.canvas.addEventListener(
      "touchend",
      () => {
        this.touch.thrust = false;
        this.touch.fire = false;
        this.touch.angleTarget = null;
      },
      { passive: true }
    );
  }

  isInButton(t, btn) {
    const dx = t.clientX - btn.x;
    const dy = t.clientY - btn.y;
    return Math.hypot(dx, dy) < btn.r;
  }

  /* ================= PUBLIC API ================= */

  /**
   * Zwraca intencje gracza NA JEDNĄ KLATKĘ
   */
getInput() {
  const input = {
    rotateLeft:  this.keys["KeyA"],
    rotateRight: this.keys["KeyD"],
    thrustForward: this.keys["KeyW"] || this.touch?.thrust,
    thrustBackward: this.keys["KeyS"],
    fire: this.firePressed || this.touch?.fire,
    purge: this.keys["KeyE"],
    touchAngle: this.touch?.angleTarget
  };

  this.firePressed = false; // ✅ impuls!
  return input;
}

}