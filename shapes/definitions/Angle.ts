
import * as d3 from 'd3';
import { ShapeType } from '../../types';
import { ShapeStrategy } from '../types';
import { rectProps, drawDimensionLine } from '../utils';

export const AngleStrategy: ShapeStrategy = {
  type: ShapeType.ANGLE,
  label: 'Angle (L-Shape)',
  icon: 'Crop',
  initialDimensions: { depth: 150, width: 100, thickness: 10 },
  inputs: [
    { label: 'Leg A Length (d)', key: 'depth' }, // Vertical Leg
    { label: 'Leg B Length (b)', key: 'width' }, // Horizontal Leg
    { label: 'Thickness (t)', key: 'thickness' }
  ],
  calculate: (d) => {
    // AS/NZS 3679.1 Style Angle
    // Origin at the corner (Heel)
    const h = d.depth; // Vertical Leg Length
    const b = d.width; // Horizontal Leg Length
    const t = d.thickness || 10;

    // Decomposition:
    // 1. Vertical Rect (Top part): t wide, (h-t) high
    // 2. Horizontal Rect (Bottom part): b wide, t high
    // This split makes the bottom flange one continuous piece, common for calculations.

    const h_leg_top_h = h - t;
    
    // Part 1: Top Vertical
    // Centroid relative to bottom-left (0,0): z = t/2, y = t + (h-t)/2
    const p1 = rectProps(t, h_leg_top_h, t + h_leg_top_h/2, t/2);

    // Part 2: Bottom Horizontal
    // Centroid relative to bottom-left (0,0): z = b/2, y = t/2
    const p2 = rectProps(b, t, t/2, b/2);

    const totalArea = p1.area + p2.area;
    
    const Cy = totalArea > 0 ? (p1.area * p1.y + p2.area * p2.y) / totalArea : 0;
    const Cz = totalArea > 0 ? (p1.area * p1.z + p2.area * p2.z) / totalArea : 0;

    // Moments of Inertia about Centroid
    const Iz = (p1.Iz_local + p1.area * Math.pow(p1.y - Cy, 2)) +
               (p2.Iz_local + p2.area * Math.pow(p2.y - Cy, 2));

    const Iy = (p1.Iy_local + p1.area * Math.pow(p1.z - Cz, 2)) +
               (p2.Iy_local + p2.area * Math.pow(p2.z - Cz, 2));

    // Product of Inertia Izy (Important for Asymmetric shapes like Angles)
    // Izy_local for rectangles aligned with axes is 0.
    // Parallel axis theorem: Izy = Sum( Izy_local + A * dy * dz )
    const dy1 = p1.y - Cy;
    const dz1 = p1.z - Cz;
    const dy2 = p2.y - Cy;
    const dz2 = p2.z - Cz;

    const Izy = (p1.area * dy1 * dz1) + (p2.area * dy2 * dz2);

    const rz = totalArea > 0 ? Math.sqrt(Iz / totalArea) : 0;
    const ry = totalArea > 0 ? Math.sqrt(Iy / totalArea) : 0;

    // Section Moduli (Elastic)
    const y_top = h - Cy;
    const y_bot = Cy;
    const z_right = b - Cz;
    const z_left = Cz;

    return {
        area: totalArea,
        centroid: { y: Cy, z: Cz },
        momentInertia: { Iz, Iy, Izy },
        sectionModulus: {
            Szt: y_top > 0 ? Iz / y_top : 0,
            Szb: y_bot > 0 ? Iz / y_bot : 0,
            Syt: z_right > 0 ? Iy / z_right : 0,
            Syb: z_left > 0 ? Iy / z_left : 0
        },
        radiusGyration: { rz, ry },
        plasticModulus: { Zz: 0, Zy: 0 } // Not implemented analytically for L-shape here
    };
  },
  draw: (g, uiG, d) => {
    const h = d.depth;
    const b = d.width;
    const t = d.thickness || 10;
    
    // Draw centered on screen, but shape itself is asymmetric.
    // Bounding Box is b wide, h high.
    // Let's center the bounding box at (0,0).
    // Top-Left of bbox: -b/2, -h/2
    
    const x0 = -b/2;
    const y0 = h/2; 
    
    const path = d3.path();
    path.moveTo(-b/2, h/2);             // Bottom-Left (Heel)
    path.lineTo(b/2, h/2);              // Bottom-Right (Toe B)
    path.lineTo(b/2, h/2 - t);          // Thickness up
    path.lineTo(-b/2 + t, h/2 - t);     // Inner Corner
    path.lineTo(-b/2 + t, -h/2);        // Top Inner
    path.lineTo(-b/2, -h/2);            // Top-Left (Toe A)
    path.closePath();

    g.append("path")
      .attr("d", path.toString())
      .attr("fill", "#94a3b8")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 2)
      .attr("opacity", 0.8);

    // Dimensions
    // Vertical (Left side)
    drawDimensionLine(uiG, -b/2 - 20, -h/2, -b/2 - 20, h/2, `${h} mm`, -5, true);
    // Horizontal (Bottom side)
    drawDimensionLine(uiG, -b/2, h/2 + 20, b/2, h/2 + 20, `${b} mm`, 5, false);
  },
  getCustomParts: (d) => {
      const h = d.depth;
      const b = d.width;
      const t = d.thickness || 10;
      return [{
        id: 'angle',
        type: 'solid',
        points: [
            { x: -b/2, y: h/2 },
            { x: b/2, y: h/2 },
            { x: b/2, y: h/2 - t },
            { x: -b/2 + t, y: h/2 - t },
            { x: -b/2 + t, y: -h/2 },
            { x: -b/2, y: -h/2 }
        ]
      }];
  }
};
