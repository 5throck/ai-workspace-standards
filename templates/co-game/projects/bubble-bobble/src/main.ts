import './style.css';
import { GameEngine } from './engine/GameEngine';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Game canvas element not found!');
    return;
  }

  // Create game engine instance
  const engine = new GameEngine(canvas);

  // Boot the RAF update loop
  engine.run();

  console.log('Bubble Bobble game engine initialized successfully!');
});
