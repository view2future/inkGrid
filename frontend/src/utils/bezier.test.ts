import { describe, it, expect } from 'vitest';
import * as paper from 'paper';

describe('Bezier Logic', () => {
  it('creates a smooth path from points', () => {
    const canvas = document.createElement('canvas');
    const project = new paper.Project(canvas);
    project.activate();
    
    const path = new paper.Path();
    path.add(new paper.Point(100, 100));
    path.add(new paper.Point(200, 150));
    path.add(new paper.Point(300, 100));
    
    path.smooth();
    
    expect(path.segments.length).toBe(3);
    expect(path.segments[1].handleIn.x).not.toBe(0);
  });
});
