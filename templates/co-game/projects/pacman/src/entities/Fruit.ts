/**
 * Pac-Man - Fruit
 *
 * Bonus item that spawns at the fruit spawn point.
 * Appears for 10 seconds then disappears if not collected.
 * Points depend on the FruitType (stage-dependent).
 */
import { FruitType } from "../config/types";
import type { Position } from "../config/types";
import { FRUIT_DISPLAY_DURATION } from "../config/constants";

/** Points awarded for each fruit type. */
const FRUIT_POINTS: Record<FruitType, number> = {
  [FruitType.CHERRY]:     100,
  [FruitType.STRAWBERRY]: 300,
  [FruitType.ORANGE]:     500,
  [FruitType.APPLE]:      700,
  [FruitType.MELON]:      1000,
  [FruitType.GALAXIAN]:   2000,
  [FruitType.BELL]:       3000,
  [FruitType.KEY]:        5000,
};

export class Fruit {
  type: FruitType;
  position: Position = { x: 0, y: 0 };
  spawnTime: number = 0;
  active: boolean = false;

  constructor(type: FruitType) {
    this.type = type;
  }

  /** Activate the fruit at a given position and time. */
  spawn(position: Position, currentTime: number): void {
    this.position = position;
    this.spawnTime = currentTime;
    this.active = true;
  }

  /** Deactivate the fruit. */
  collect(): void {
    this.active = false;
  }

  /** Check if the fruit has expired (10 second lifetime). */
  isExpired(currentTime: number): boolean {
    return (currentTime - this.spawnTime) >= FRUIT_DISPLAY_DURATION;
  }

  /** Get the points value for this fruit type. */
  getPoints(): number {
    return FRUIT_POINTS[this.type] || 100;
  }
}
