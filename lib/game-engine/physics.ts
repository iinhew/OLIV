export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PhysicsEngine {
  /**
   * Fast Axis-Aligned Bounding Box (AABB) collision detection
   * Avaliações matemáticas diretas para alta performance.
   */
  public static checkCollision(rect1: Rect, rect2: Rect): boolean {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }
}
