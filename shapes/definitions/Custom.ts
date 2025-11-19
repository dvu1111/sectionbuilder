
import { ShapeType, CustomPart, Point } from '../../types';
import { ShapeStrategy } from '../types';
import { discretizeArc, calculateNumericProperties, calculatePlasticModulus, calculatePrincipalMoments } from '../utils';

export const CustomStrategy: ShapeStrategy = {
  type: ShapeType.CUSTOM,
  label: 'Custom Shape',
  icon: 'PenTool',
  initialDimensions: { depth: 100, width: 100 },
  inputs: [], // Custom shape inputs are handled by custom tools in UI
  calculate: (d, customParts = []) => {
    
    // 1. Prepare Parts (Discretize curves into polygons)
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
                  const arcPoints = discretizeArc(p1, control, p2, 16); // Increased segments for better accuracy
                  calcPoints.push(...arcPoints);
              } else {
                  calcPoints.push(p1);
              }
          }
      }

      processedParts.push({ points: calcPoints, type: part.type });
    });

    // 2. Use Robust Numeric Integration Calculation
    // This handles: Disjoint holes (ignores them), Overlapping holes (correct subtraction), Complex Intersections
    const props = calculateNumericProperties(processedParts);

    const totalArea = props.area;
    const Cx_abs = props.Cx;
    const Cy_abs = props.Cy;

    // Calculate Moments of Inertia about the Centroid (Parallel Axis Theorem)
    // I_centroid = I_origin - A * d^2
    const Iz = props.Ixx - totalArea * Cy_abs * Cy_abs;
    const Iy = props.Iyy - totalArea * Cx_abs * Cx_abs;
    const Izy_raw = props.Ixy - totalArea * Cx_abs * Cy_abs;

    // Invert Izy to match Structural Engineering convention (Y-up) vs SVG (Y-down)
    const Izy = -Izy_raw;

    const rz = totalArea > 0 ? Math.sqrt(Math.abs(Iz) / totalArea) : 0;
    const ry = totalArea > 0 ? Math.sqrt(Math.abs(Iy) / totalArea) : 0;

    // Calculate Bounding Box distances from Centroid
    // Use the bounds returned from the numeric solver (which are derived from solids only)
    const { minX, maxX, minY, maxY } = props.bounds;
    const hasSolid = totalArea > 0; // Approximate check

    // Centroid Y (Distance from Bottom Fiber)
    const Cy_struct = hasSolid ? (maxY - Cy_abs) : 0;
    
    // Centroid Z (Distance from Left Fiber)
    const Cz_struct = hasSolid ? (Cx_abs - minX) : 0;

    // Section Moduli
    const y_top_dist = Math.abs(Cy_abs - minY);
    const y_bot_dist = Math.abs(maxY - Cy_abs);
    const z_right_dist = Math.abs(maxX - Cx_abs);
    const z_left_dist = Math.abs(Cx_abs - minX);

    // Plastic Modulus Calculation
    let Zz = 0;
    let Zy = 0;

    if (customParts.length > 0 && totalArea > 0) {
        const plasticProps = calculatePlasticModulus(processedParts, { minX, maxX, minY, maxY });
        Zz = plasticProps.Zz;
        Zy = plasticProps.Zy;
    }

    // Principal Properties
    const principal = calculatePrincipalMoments(Iz, Iy, Izy);

    return {
      area: totalArea,
      centroid: { y: Cy_struct, z: Cz_struct }, // Reporting relative to solid bounds
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
