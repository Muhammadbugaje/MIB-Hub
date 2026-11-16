/**
 * What a character is really doing, measured from where it is placed each
 * frame: ground speed, turn rate and acceleration (lightly smoothed). NPCs,
 * crowds and cutscene actors are moved by other systems (the crowd walker,
 * NavAgent, the director); their feet are matched to this measured motion,
 * not to the speed they were asked for, so a person pushed aside or slowed
 * by the crowd never glides or moonwalks.
 */
export class MotionSense {
  speed = 0;
  turn = 0;
  accel = 0;
  private x = 0;
  private z = 0;
  private yaw = 0;
  private set = false;
  /** Raw movement since the last take(), in the body's own frame (x left, z forward; metres) and its turn (radians). */
  private moved = { x: 0, z: 0, yaw: 0 };

  /** Feed the latest placement (metres, radians) and the time since the last one. scale: the body's height scale. */
  update(x: number, z: number, yaw: number, dt: number, scale = 1): void {
    if (dt > 0 && this.set) {
      const d = Math.hypot(x - this.x, z - this.z);
      // A teleport (cut, respawn) is not movement.
      const sp = d > 3 ? 0 : d / dt / (scale || 1);
      let dy = yaw - this.yaw;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      if (d <= 3) {
        // Into the body frame at the previous facing (the frame the feet were planted in).
        const c = Math.cos(this.yaw), sn = Math.sin(this.yaw);
        const wx = (x - this.x) / (scale || 1), wz = (z - this.z) / (scale || 1);
        this.moved.x += wx * c - wz * sn;
        this.moved.z += wx * sn + wz * c;
        this.moved.yaw += dy;
      }
      const k = 1 - Math.exp(-dt / 0.08);
      const prev = this.speed;
      this.speed += (sp - this.speed) * k;
      this.turn += (dy / dt - this.turn) * k;
      this.accel += ((this.speed - prev) / dt - this.accel) * k * 0.5;
    }
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.set = true;
  }

  /** The exact movement since the last call (for foot locking), then reset. */
  take(): { x: number; z: number; yaw: number } {
    const m = { ...this.moved };
    this.moved.x = this.moved.z = this.moved.yaw = 0;
    return m;
  }
}
