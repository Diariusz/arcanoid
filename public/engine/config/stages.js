// engine/config/stages.js
export const STAGES = [
  { id: 1, type: "normal", asteroids: { big: 5 }, modifiers: [], boss: null },
  { id: 2, type: "normal", asteroids: { big: 6 }, modifiers: [], boss: null },
  { id: 3, type: "normal", asteroids: { big: 5 }, modifiers: ["FAST_FRAGMENTS"], boss: null },
  { id: 4, type: "normal", asteroids: { big: 6 }, modifiers: ["ERRATIC_MOVEMENT"], boss: null },
  { id: 5, type: "boss",   asteroids: null, modifiers: [], boss: { level: 1 } },

  { id: 6, type: "normal", asteroids: { big: 7 }, modifiers: [], boss: null },
  { id: 7, type: "normal", asteroids: { big: 8 }, modifiers: ["FAST_FRAGMENTS"], boss: null },
  { id: 8, type: "normal", asteroids: { big: 9 }, modifiers: ["ERRATIC_MOVEMENT"], boss: null },
  { id: 9, type: "normal", asteroids: { big:10 }, modifiers: ["FAST_FRAGMENTS","ERRATIC_MOVEMENT"], boss: null },
  { id:10, type: "boss",   asteroids: null, modifiers: [], boss: { level: 2 } }
];