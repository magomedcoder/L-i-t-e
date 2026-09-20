# L-i-t-e

First-person web shooter.

## Controls

| Action                        | Control                              |
| ----------------------------- | ------------------------------------ |
| Capture mouse / start         | Click the game screen (Pointer Lock) |
| Look around                   | Mouse                                |
| Forward / back / left / right | `W` `A` `S` `D`                      |
| Shoot                         | LMB (hold)                           |
| Release mouse capture         | `Esc` (browser default)              |

After clicking, music starts (if the browser allows the audio context).

## Gameplay

### Objective
Complete the campaign levels: find the **key / goal**, open linked **doors**, reach the exit.

Clear time is shown at the end.

### Health
- HP bar at the bottom left (as a percentage)
- Damage from enemies and hazard zones reduces HP
- **Medkits** restore health
- At low HP the bar turns red and blinks
- On death - a short camera “fall” and respawn

### Weapons
First-person machine gun. LMB - fire.

The barrel spins while shooting.

### Light
There is a **flashlight** on the map.

Until it is picked up, the sector stays dark.

After pickup, the light follows the player (dynamic shadows).

### Enemies
| Type       | Description                                 |
| ---------- | ------------------------------------------- |
| **Enemy**  | Ground soldier in armor; patrols and shoots |
| **Flying** | Drone/helicopter with spinning rotors       |
| **Group**  | Several enemies at once                     |

Kills sometimes drop medkits.

On higher difficulty, enemies are more dangerous and spawn more often.

### Map objects
| Object       | Purpose                          |
| ------------ | -------------------------------- |
| `enemy`      | Ground enemy                     |
| `flying`     | Flying enemy                     |
| `many`       | Enemy group                      |
| `health`     | Medkit                           |
| `flashlight` | Flashlight                       |
| `goal`       | Level key / goal                 |
| `door`       | Door (opens with the linked key) |

### Difficulty
After the first campaign clear, a harder mode (`difficulty`) unlocks: more damage, more aggressive enemies, more spawns.

### Graphics
- WebGL2, procedural textures, shadows, bloom, anti-aliasing
- Resolution scales to the screen
- On FPS drops, quality may automatically reduce
