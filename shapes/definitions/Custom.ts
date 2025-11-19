import { ShapeType, CustomPart } from '../../types';
import { ShapeStrategy } from '../types';
import { calculatePolygonProperties, discretizeArc } from '../utils';

export const CustomStrategy: ShapeStrategy = {
  type: ShapeType.CUSTOM,
  label: 'Custom Shape',
  icon: 'PenTool',
  initialDimensions: { depth: 100, width: 100 },
  inputs: [], // Custom shape inputs are handled by custom tools in UI
  calculate: (d, customParts = []) => {
    let totalArea = 0;
    let sumAx = 0; // Sum of Area * Cx
    let sumAy = 0; // Sum of Area * Cy
    
    let totalIxx_global = 0;
    let totalIyy_global = 0;
    let totalIxy_global = 0;

    let globalMinX = Infinity, globalMaxX = -Infinity, globalMinY = Infinity, globalMaxY = -Infinity;

    customParts.forEach(part => {
      let calcPoints = [];
      
      if (part.isCircle && part.circleParams) {
        const segments = 64;
        const { x, y, r } = part.circleParams;
        for (let i = 0; i < segments; i++) {
          const theta = (i / segments) * 2 * Math.PI;
          calcPoints.push({
            x: x + r * Math.cos(theta),
            y: y + r * Math.sin(theta)
          });
        }
      } else {
          // Handle Polygons with potential curves
          const pts = part.points;
          for (let i = 0; i < pts.length; i++) {
              const p1 = pts[i];
              const p2 = pts[(i + 1) % pts.length];
              
              if (part.curves && part.curves[i]) {
                  const control = part.curves[i].controlPoint;
                  // Discretize arc
                  const arcPoints = discretizeArc(p1, control, p2, 10);
                  calcPoints.push(...arcPoints);
              } else {
                  calcPoints.push(p1);
              }
          }
      }

      const props = calculatePolygonProperties(calcPoints);
      
      // Apply sign based on Solid vs Hole
      const sign = part.type === 'solid' ? 1 : -1;
      
      totalArea += sign * props.A;
      sumAx += sign * props.A * props.Cx;
      sumAy += sign * props.A * props.Cy;
      
      totalIxx_global += sign * props.Ixx;
      totalIyy_global += sign * props.Iyy;
      totalIxy_global += sign * props.Ixy;

      if (part.type === 'solid') {
          globalMinX = Math.min(globalMinX, props.bounds.minX);
          globalMaxX = Math.max(globalMaxX, props.bounds.maxX);
          globalMinY = Math.min(globalMinY, props.bounds.minY);
          globalMaxY = Math.max(globalMaxY, props.bounds.maxY);
      }
    });

    const Cx = totalArea !== 0 ? sumAx / totalArea : 0;
    const Cy = totalArea !== 0 ? sumAy / totalArea : 0;

    // Shift to Centroid
    const Iz = totalIxx_global - totalArea * Cy * Cy;
    const Iy = totalIyy_global - totalArea * Cx * Cx;
    const Izy = totalIxy_global - totalArea * Cx * Cy;

    const rz = totalArea > 0 ? Math.sqrt(Math.abs(Iz) / totalArea) : 0;
    const ry = totalArea > 0 ? Math.sqrt(Math.abs(Iy) / totalArea) : 0;

    const y_top_dist = Math.abs(globalMinY - Cy); 
    const y_bot_dist = Math.abs(globalMaxY - Cy); 
    const z_right_dist = Math.abs(globalMaxX - Cx);
    const z_left_dist = Math.abs(globalMinX - Cx);

    return {
      area: totalArea,
      centroid: { y: Cy, z: Cx },
      momentInertia: { Iz, Iy, Izy },
      sectionModulus: {
          Szt: y_top_dist > 0 ? Iz / y_top_dist : 0,
          Szb: y_bot_dist > 0 ? Iz / y_bot_dist : 0,
          Syt: z_right_dist > 0 ? Iy / z_right_dist : 0,
          Syb: z_left_dist > 0 ? Iy / z_left_dist : 0
      },
      radiusGyration: { rz, ry },
      plasticModulus: { Zz: 0, Zy: 0 } 
    };
  },
  // Draw logic for Custom is handled interactively in Stage.tsx
};