# Level Design

All stages render on the classic 224×256 arcade framebuffer (scaled ×3).

## 25m — GIRDER
Seven girder floors; bottom floor has two slopes toward the center. Ladders
(including one broken ladder) connect adjacent floors. DK top-left, Pauline
top-right, two hammers (y=176, y=80). Time limit 60s.

## 50m — ELEVATORS
Left/right girder columns with a central shaft of three patrolling elevators
(speeds 20–28 px/s, phase-offset). One hammer mid-left. Fireballs patrol.
Time limit 60s.

## 75m — SLOPES
Long alternating sloped girders plus two lifts. Ladders at the girder ends.
Two hammers. Time limit 70s.

## 100m — ROOFTOP
Short offset floors with ladder shafts on both sides; DK sits center-top with
Pauline beside him. Reaching Pauline completes the round. No barrels; one
fireball and one hammer. Time limit 60s.

## Data model
Stages are declarative (`src/maps/stage-*.ts`): platforms (`{x,y,w,slope?}`),
ladders (`{x,y,h,broken?}`), elevator defs, plus spawn points. New stages only
require a new data file and registration in `src/maps/index.ts`.
