import { Game } from './game';
import { GameLoop } from './engine/GameLoop';
import { InputManager } from './engine/InputManager';
import { Renderer } from './engine/Renderer';
import { SoundManager } from './systems/SoundManager';
import { VIEW_H, VIEW_W } from './maps/types';
import './style.css';

const SCALE = 3;

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('#game canvas missing');
canvas.width = VIEW_W * SCALE;
canvas.height = VIEW_H * SCALE;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context unavailable');

const game = new Game({
  onSfx: (name) => sound.play(name),
});
const sound = new SoundManager();
const input = new InputManager();
const renderer = new Renderer(ctx);
renderer.setScale(SCALE);

// Start / restart on any action key while not playing.
window.addEventListener('keydown', (e) => {
  if (game.phase === 'gameOver' && (e.code === 'Space' || e.code === 'KeyZ')) {
    game.restart();
  }
});

input.attach();
game.input.left = false;

const loop = new GameLoop(
  (dt) => {
    Object.assign(game.input, input.state);
    game.update(dt);
  },
  () => renderer.draw(game),
);
loop.start();
