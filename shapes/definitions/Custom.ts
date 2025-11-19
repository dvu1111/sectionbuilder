
import { ShapeType, CustomPart, Point } from '../../types';
import { ShapeStrategy } from '../types';
import { calculatePolygonProperties, discretizeArc, calculatePlasticModulus, calculatePrincipalMoments } from '../utils';

export const CustomStrategy: ShapeStrategy = {
  type: ShapeType.CUSTOM,
  label: 'Custom Shape',
  icon: 'PenTool',
  initialDimensions: { depth: 100, width: 100 },
  inputs: [], // Custom shape inputs are handled by custom tools in UI
  calculate: (d, customParts = []) => {
    let totalArea = 0;
    let sumAx = 0; // Sum of Area * Cx (Moment about Y-axis)
    let sumAy = 0; // Sum of Area * Cy (Moment about X-axis)
    
    let totalIxx_global = 0;
    let totalIyy_global = 0;
    let totalIxy_global = 0;

    let globalMinX = Infinity, globalMaxX = -Infinity, globalMinY = Infinity, globalMaxY = -Infinity;
    let hasSolid = false;

    const processedParts: { points: Point[], type: 'solid'|'hole' }[] = [];

    customParts.forEach(part => {
      let calcPoints: Point[] = [];
      
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

      processedParts.push({ points: calcPoints, type: part.type });

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
          hasSolid = true;
          globalMinX = Math.min(globalMinX, props.bounds.minX);
          globalMaxX = Math.max(globalMaxX, props.bounds.maxX);
          globalMinY = Math.min(globalMinY, props.bounds.minY);
          globalMaxY = Math.max(globalMaxY, props.bounds.maxY);
      }
    });

    // Avoid division by zero
    const Cx_abs = totalArea !== 0 ? sumAx / totalArea : 0;
    const Cy_abs = totalArea !== 0 ? sumAy / totalArea : 0;

    // Calculate Moments of Inertia about the Centroid (Parallel Axis Theorem)
    // I_centroid = I_origin - A * d^2
    const Iz = totalIxx_global - totalArea * Cy_abs * Cy_abs;
    const Iy = totalIyy_global - totalArea * Cx_abs * Cx_abs;
    const Izy_raw = totalIxy_global - totalArea * Cx_abs * Cy_abs;

    // Invert Izy to match Structural Engineering convention (Y-up) vs SVG (Y-down)
    const Izy = -Izy_raw;

    const rz = totalArea > 0 ? Math.sqrt(Math.abs(Iz) / totalArea) : 0;
    const ry = totalArea > 0 ? Math.sqrt(Math.abs(Iy) / totalArea) : 0;

    // Calculate Bounding Box distances from Centroid
    // Centroid Y (Distance from Bottom Fiber)
    const Cy_struct = (hasSolid && globalMaxY !== -Infinity) ? (globalMaxY - Cy_abs) : 0;
    
    // Centroid Z (Distance from Left Fiber)
    const Cz_struct = (hasSolid && globalMinX !== Infinity) ? (Cx_abs - globalMinX) : 0;

    // Section Moduli
    const y_top_dist = Math.abs(Cy_abs - globalMinY);
    const y_bot_dist = Math.abs(globalMaxY - Cy_abs);
    const z_right_dist = Math.abs(globalMaxX - Cx_abs);
    const z_left_dist = Math.abs(Cx_abs - globalMinX);

    // Plastic Modulus Calculation using Fiber Method
    let Zz = 0;
    let Zy = 0;

    if (customParts.length > 0 && totalArea > 0 && hasSolid) {
        const plasticProps = calculatePlasticModulus(processedParts, { minX: globalMinX, maxX: globalMaxX, minY: globalMinY, maxY: globalMaxY });
        Zz = plasticProps.Zz;
        Zy = plasticProps.Zy;
    }

    // Principal Properties
    const principal = calculatePrincipalMoments(Iz, Iy, Izy);

    return {
      area: totalArea,
      centroid: { y: Cy_struct, z: Cz_struct }, // Reporting relative to bounds
      momentInertia: { Iz, Iy, Izy },
      principalMoments: principal,
      sectionModulus: {
          Szt: y_top_dist > 0 ? Iz / y_top_dist : 0,
          Szb: y_bot_dist > 0 ? Iz / y_bot_dist : 0,
          Syt: z_right_dist > 0 ? Iy / z_right_dist : 0,
          Syb: z_left_dist > 0 ? Iy / z_left_dist : 0
      },
      radiusGyration: { rz, ry },
      plasticModulus: { Zz, Zy } 
    };
  },
};
