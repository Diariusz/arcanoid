// engine/FXManager.js
export class FXManager {
  constructor() {
    // SHAKE
    this.shakePower = 0;
    this.shakeDecay = 0.9;

    // FLASH
    this.flash = 0;
    this.flashDecay = 0.85;

    // OVERLAY
    this.overlay = {
      active: false,
      text: "",
      type: "STAGE",
      timer: 0,
      alpha: 1
    };
  }

  /* ================= EVENT HANDLER ================= */

  handleEvent(event) {
    switch (event.type) {

      case "ASTEROID_DESTROYED":
        this.triggerShake(4);
        this.triggerFlash(0.4);
        break;

      case "PLAYER_HIT":
        this.triggerShake(6);
        this.triggerFlash(0.5);
        break;

      case "OVERHEAT":
        this.triggerFlash(0.3);
        break;

      case "PURGE":
        this.triggerShake(5);
        this.triggerFlash(0.4);
        break;

      case "STAGE_START":
        this.showOverlay(`ETAP ${event.stageId}`, "STAGE", 120);
        break;

      case "BOSS_INCOMING":
        this.showOverlay("⚠ BOSS INCOMING ⚠", "BOSS_INCOMING", 160);
        break;

      case "BOSS_SPAWNED":
        this.showOverlay("BOSS ENCOUNTER", "BOSS_ENTRY", 100);
        break;

      case "BOSS_PHASE":
        this.showOverlay(event.text, "BOSS_PHASE", 100);
        break;

      case "BOSS_DEFEATED":
        this.showOverlay("💥 BOSS DEFEATED 💥", "BOSS_DEFEATED", 150);
        this.triggerShake(12);
        this.triggerFlash(0.6);
        break;
    }
  }

  /* ================= FX TRIGGERS ================= */

  triggerShake(power) {
    this.shakePower = Math.max(this.shakePower, power);
  }

  triggerFlash(power) {
    this.flash = Math.max(this.flash, power);
  }

  showOverlay(text, type, duration) {
    this.overlay = {
      active: true,
      text,
      type,
      timer: duration,
      alpha: 1
    };
  }

  /* ================= UPDATE ================= */

    update() {
    if (this.shakePower > 0.5) {
        this.shakePower *= this.shakeDecay;
    } else {
        this.shakePower = 0;
    }

    if (this.flash > 0) {
        this.flash *= this.flashDecay;
    }

    if (this.overlay.active) {
        this.overlay.timer--;
        if (this.overlay.timer < 40) {
        this.overlay.alpha -= 0.025;
        if (this.overlay.alpha <= 0) {
            this.overlay.active = false;
        }
        }
    }
    }
}