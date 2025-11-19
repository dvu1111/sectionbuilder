
import { ShapeType } from '../../types';
import { ShapeStrategy } from '../types';
import { drawDimensionLine } from '../utils';

export const CircularStrategy: ShapeStrategy = {
  type: ShapeType.CIRCULAR,
  label: 'Circular',
  icon: 'Circle',
  initialDimensions: { depth: 0, width: 0, radius: 50 },
  inputs: [
    { label: 'Radius (r)', key: 'radius' }
  ],
  calculate: (d) => {
    const r = d.radius || 10;
    const A = Math.PI * r * r;
    const I = (Math.PI * Math.pow(r, 4)) / 4;
    return {
        area: A,
        centroid: { y: r, z: r },
        momentInertia: { Iz: I, Iy: I, Izy: 0 },
        sectionModulus: { Szt: I/r, Szb: I/r, Syt: I/r, Syb: I/r },
        radiusGyration: { rz: r/2, ry: r/2 },
        plasticModulus: { Zz: (4/3)*Math.pow(r, 3), Zy: (4/3)*Math.pow(r, 3) }
    }
  },
  draw: (g, uiG, d) => {
    const r = d.radius || 50;
    g.append("circle")
        .attr("r", r)
        .attr("fill", "#94a3b8")
        .attr("stroke", "#1e293b")
        .attr("stroke-width", 2)
        .attr("opacity", 0.8);
        
    drawDimensionLine(uiG, 0, 0, r*0.707, -r*0.707, `R${r}`, -5, false);
  },
  getCustomParts: (d) => {
    const r = d.radius || 10;
    return [{
        id: 'circle',
        type: 'solid',
        points: [],
        isCircle: true,
        circleParams: { x: 0, y: 0, r }
    }];
  }
};
