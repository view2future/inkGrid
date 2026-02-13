export interface Point {
  x: number;
  y: number;
}

/**
 * 书法临摹评分引擎
 */
export class TracingEngine {
  /**
   * 计算用户轨迹与标准路径的相似度 (0-100)
   * 采用简化版的点集距离匹配逻辑
   */
  static calculateScore(userPath: Point[], targetPath: Point[]): number {
    if (userPath.length < 2 || targetPath.length < 2) return 0;

    let totalDist = 0;
    const samples = 20; // 采样对比点数

    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1);
      const uPoint = this._getPointAtT(userPath, t);
      const tPoint = this._getPointAtT(targetPath, t);
      
      const dist = Math.sqrt(Math.pow(uPoint.x - tPoint.x, 2) + Math.pow(uPoint.y - tPoint.y, 2));
      totalDist += dist;
    }

    const avgDist = totalDist / samples;
    // 根据平均像素距离折算分数，假设 30px 为分水岭
    const score = Math.max(0, 100 - (avgDist * 2));
    return Math.round(score);
  }

  private static _getPointAtT(path: Point[], t: number): Point {
    const index = Math.floor(t * (path.length - 1));
    return path[index];
  }
}
