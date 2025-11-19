
import * as d3 from 'd3';
import { Point, CustomPart } from '../types';

// --- MATH UTILS ---

// Helper: Rectangle Properties (used by Rect, HollowRect, I-Shape)
export const rectProps = (b: number, h: number, yCentroid: number, zCentroid: number) => {
  const area = b * h;
  const Iz_local = (b * Math.pow(h, 3)) / 12;
  const Iy_local = (h * Math.pow(b, 3)) / 12;
  return { area, h, b, y: yCentroid, z: zCentroid, Iz_local, Iy_local };
};

// Helper: Rotate a point around origin (0,0)
export const rotatePoint = (p: Point, angleDeg: number): Point => {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos
    };
};

// Helper: Rotate Custom Parts
export const rotatePart = (part: CustomPart, angleDeg: number): CustomPart => {
    if (angleDeg === 0) return part;
    
    const newPoints = part.points.map(p => rotatePoint(p, angleDeg));
    
    let newCurves: Record<number, { controlPoint: Point }> | undefined = undefined;
    if (part.curves) {
        newCurves = {};
        for (const k in part.curves) {
            const cp = part.curves[k].controlPoint;
            newCurves[k] = { controlPoint: rotatePoint(cp, angleDeg) };
        }
    }
    
    let newCircleParams = undefined;
    if (part.isCircle && part.circleParams) {
        const { x, y, r } = part.circleParams;
        const center = rotatePoint({x, y}, angleDeg);
        newCircleParams = { x: center.x, y: center.y, r };
    }

    return {
        ...part,
        points: newPoints,
        curves: newCurves,
        circleParams: newCircleParams
    };
};

// Green's Theorem for Polygons
export const calculatePolygonProperties = (points: Point[]) => {
  let A = 0;
  let Sy = 0; 
  let Sx = 0; 
  let Ixx = 0;
  let Iyy = 0;
  let Ixy = 0;

  const n = points.length;
  if (n < 3) return { A:0, Cx:0, Cy:0, Ixx:0, Iyy:0, Ixy:0, bounds: {minX:0, maxX:0, minY:0, maxY:0} };

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    minX = Math.min(minX, p1.x);
    maxX = Math.max(maxX, p1.x);
    minY = Math.min(minY, p1.y);
    maxY = Math.max(maxY, p1.y);

    const common = p1.x * p2.y - p2.x * p1.y;
    
    A += common;
    Sx += (p1.y + p2.y) * common;
    Sy += (p1.x + p2.x) * common;
    Ixx += (p1.y * p1.y + p1.y * p2.y + p2.y * p2.y) * common;
    Iyy += (p1.x * p1.x + p1.x * p2.x + p2.x * p2.x) * common;
    Ixy += (p1.x * p2.y + 2 * p1.x * p1.y + 2 * p2.x * p2.y + p2.x * p1.y) * common;
  }

  A = A / 2;
  Sx = Sx / 6;
  Sy = Sy / 6;
  Ixx = Ixx / 12;
  Iyy = Iyy / 12;
  Ixy = Ixy / 24;

  // Adjust for winding order
  if (A < 0) {
    A = -A;
    Sx = -Sx;
    Sy = -Sy;
    Ixx = -Ixx;
    Iyy = -Iyy;
    Ixy = -Ixy;
  }

  const Cx = A !== 0 ? Sy / A : 0;
  const Cy = A !== 0 ? Sx / A : 0;

  return { A, Cx, Cy, Ixx, Iyy, Ixy, bounds: {minX, maxX, minY, maxY} };
};

// Helper to get centroid of multiple parts
export const calculateCentroidFromParts = (parts: CustomPart[]): { x: number, y: number } => {
    let totalArea = 0;
    let sumAx = 0; // Moment about Y (for Cx)
    let sumAy = 0; // Moment about X (for Cy)

    parts.forEach(part => {
        let calcPoints: Point[] = [];
        if (part.isCircle && part.circleParams) {
            // Circle centroid is just center
            const { x, y, r } = part.circleParams;
            const A = Math.PI * r * r;
            const sign = part.type === 'solid' ? 1 : -1;
            totalArea += sign * A;
            sumAx += sign * A * x;
            sumAy += sign * A * y;
            return;
        }

        // Polygon
        calcPoints = part.points; 
        if (part.curves && Object.keys(part.curves).length > 0) {
            calcPoints = [];
            const pts = part.points;
             for (let i = 0; i < pts.length; i++) {
                  const p1 = pts[i];
                  const p2 = pts[(i + 1) % pts.length];
                  if (part.curves && part.curves[i]) {
                      const control = part.curves[i].controlPoint;
                      calcPoints.push(...discretizeArc(p1, control, p2, 10));
                  } else {
                      calcPoints.push(p1);
                  }
             }
        }

        const props = calculatePolygonProperties(calcPoints);
        const sign = part.type === 'solid' ? 1 : -1;
        totalArea += sign * props.A;
        sumAx += sign * props.A * props.Cx;
        sumAy += sign * props.A * props.Cy;
    });

    if (totalArea === 0) return { x: 0, y: 0 };
    return { x: sumAx / totalArea, y: sumAy / totalArea };
};

// --- ADVANCED PROPERTIES ---

export const calculatePrincipalMoments = (Iz: number, Iy: number, Izy: number) => {
    const avg = (Iz + Iy) / 2;
    const diff = (Iz - Iy) / 2;
    const R = Math.sqrt(diff * diff + Izy * Izy);
    
    const I1 = avg + R;
    const I2 = avg - R;
    
    // Calculate angle of principal axis (alpha) relative to Z-axis (horizontal)
    // tan(2alpha) = -2*Izy / (Iz - Iy)
    // Math.atan2(y, x) -> atan2(-2*Izy, Iz - Iy)
    let angleRad = 0.5 * Math.atan2(-2 * Izy, Iz - Iy);
    let angleDeg = (angleRad * 180) / Math.PI;
    
    return { I1, I2, angle: angleDeg };
};

export const calculatePlasticModulus = (parts: { points: Point[], type: 'solid'|'hole' }[], bounds: {minX:number, maxX:number, minY:number, maxY:number}) => {
    const STEPS = 500; // Resolution for integration
    let Zz = 0;
    let Zy = 0;

    // 1. Calculate Zz (Bending about Horizontal Axis, scan Y, find PNA Y)
    if (bounds.maxY > bounds.minY) {
        const dy = (bounds.maxY - bounds.minY) / STEPS;
        const strips: { pos: number, area: number }[] = [];
        let totalAreaCheck = 0;

        for (let i = 0; i < STEPS; i++) {
            const y = bounds.minY + (i + 0.5) * dy;
            let width = 0;
            
            for (const part of parts) {
                const poly = part.points;
                const intersections: number[] = [];
                for (let j = 0; j < poly.length; j++) {
                    const p1 = poly[j];
                    const p2 = poly[(j + 1) % poly.length];
                    
                    // Check intersection with horizontal line Y = y
                    if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
                        const x = p1.x + (y - p1.y) * (p2.x - p1.x) / (p2.y - p1.y);
                        intersections.push(x);
                    }
                }
                intersections.sort((a, b) => a - b);
                
                let partW = 0;
                for (let k = 0; k < intersections.length; k += 2) {
                    if (k + 1 < intersections.length) {
                        partW += intersections[k+1] - intersections[k];
                    }
                }
                
                if (part.type === 'solid') width += partW;
                else width -= partW;
            }
            
            const stripArea = width * dy;
            strips.push({ pos: y, area: stripArea });
            totalAreaCheck += stripArea;
        }

        // Find PNA (Plastic Neutral Axis) - Axis of Equal Area
        let currentArea = 0;
        let pnaY = bounds.minY;
        
        for (const strip of strips) {
            currentArea += strip.area;
            if (currentArea >= totalAreaCheck / 2) {
                pnaY = strip.pos;
                break;
            }
        }

        // Calculate first moment of area about PNA
        for (const strip of strips) {
            Zz += strip.area * Math.abs(strip.pos - pnaY);
        }
    }

    // 2. Calculate Zy (Bending about Vertical Axis, scan X, find PNA X)
    if (bounds.maxX > bounds.minX) {
        const dx = (bounds.maxX - bounds.minX) / STEPS;
        const strips: { pos: number, area: number }[] = [];
        let totalAreaCheck = 0;

        for (let i = 0; i < STEPS; i++) {
            const x = bounds.minX + (i + 0.5) * dx;
            let height = 0;
            
            for (const part of parts) {
                const poly = part.points;
                const intersections: number[] = [];
                for (let j = 0; j < poly.length; j++) {
                    const p1 = poly[j];
                    const p2 = poly[(j + 1) % poly.length];
                    
                    // Check intersection with vertical line X = x
                    if ((p1.x <= x && p2.x > x) || (p2.x <= x && p1.x > x)) {
                        const y = p1.y + (x - p1.x) * (p2.y - p1.y) / (p2.x - p1.x);
                        intersections.push(y);
                    }
                }
                intersections.sort((a, b) => a - b);
                
                let partH = 0;
                for (let k = 0; k < intersections.length; k += 2) {
                    if (k + 1 < intersections.length) {
                        partH += intersections[k+1] - intersections[k];
                    }
                }
                
                if (part.type === 'solid') height += partH;
                else height -= partH;
            }
            
            const stripArea = height * dx;
            strips.push({ pos: x, area: stripArea });
            totalAreaCheck += stripArea;
        }

        // Find PNA
        let currentArea = 0;
        let pnaX = bounds.minX;
        
        for (const strip of strips) {
            currentArea += strip.area;
            if (currentArea >= totalAreaCheck / 2) {
                pnaX = strip.pos;
                break;
            }
        }

        for (const strip of strips) {
            Zy += strip.area * Math.abs(strip.pos - pnaX);
        }
    }

    return { Zz, Zy };
}


// --- GEOMETRY HELPERS ---

export const getCircleFromThreePoints = (p1: Point, p2: Point, p3: Point): { x: number, y: number, r: number } | null => {
    const x1 = p1.x, y1 = p1.y;
    const x2 = p2.x, y2 = p2.y;
    const x3 = p3.x, y3 = p3.y;

    const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(D) < 1e-5) return null; // Collinear

    const Ux = ((x1*x1 + y1*y1) * (y2 - y3) + (x2*x2 + y2*y2) * (y3 - y1) + (x3*x3 + y3*y3) * (y1 - y2)) / D;
    const Uy = ((x1*x1 + y1*y1) * (x3 - x2) + (x2*x2 + y2*y2) * (x1 - x3) + (x3*x3 + y3*y3) * (x2 - x1)) / D;
    
    const r = Math.sqrt((x1 - Ux)**2 + (y1 - Uy)**2);
    return { x: Ux, y: Uy, r };
};

export const discretizeArc = (p1: Point, p2: Point, p3: Point, segments: number = 20): Point[] => {
    const circle = getCircleFromThreePoints(p1, p2, p3);
    if (!circle) return [p1, p3]; // Fallback to line if collinear

    const startAngle = Math.atan2(p1.y - circle.y, p1.x - circle.x);
    const throughAngle = Math.atan2(p2.y - circle.y, p2.x - circle.x);
    const endAngle = Math.atan2(p3.y - circle.y, p3.x - circle.x);
    
    let da1 = throughAngle - startAngle;
    let da2 = endAngle - throughAngle;

    // Normalize to -PI to +PI
    while (da1 <= -Math.PI) da1 += 2*Math.PI;
    while (da1 > Math.PI) da1 -= 2*Math.PI;
    while (da2 <= -Math.PI) da2 += 2*Math.PI;
    while (da2 > Math.PI) da2 -= 2*Math.PI;

    // Total sweep
    const sweep = da1 + da2;

    const points: Point[] = [];
    for (let i = 0; i < segments; i++) {
        const t = i / segments; // exclude end point to avoid duplicates in polygon chain (except last)
        const theta = startAngle + t * sweep;
        points.push({
            x: circle.x + circle.r * Math.cos(theta),
            y: circle.y + circle.r * Math.sin(theta)
        });
    }
    return points;
};

export const findClosestPointOnSegment = (
    p1: Point, 
    p2: Point, 
    cursor: Point
): { projX: number, projY: number, dist: number } => {
    const atob = { x: p2.x - p1.x, y: p2.y - p1.y };
    const atop = { x: cursor.x - p1.x, y: cursor.y - p1.y };
    const len2 = atob.x * atob.x + atob.y * atob.y;
    let tVal = 0;
    if (len2 !== 0) {
        tVal = (atop.x * atob.x + atop.y * atob.y) / len2;
    }
    tVal = Math.max(0, Math.min(1, tVal));
    
    const projX = p1.x + tVal * atob.x;
    const projY = p1.y + tVal * atob.y;
    const dist = Math.sqrt((cursor.x - projX)**2 + (cursor.y - projY)**2);

    return { projX, projY, dist };
};

// --- D3 DRAWING UTILS ---

export const drawDimensionLine = (
  container: d3.Selection<SVGGElement, unknown, null, undefined>, 
  x1: number, y1: number, 
  x2: number, y2: number, 
  text: string, 
  offset: number, 
  isVert: boolean
) => {
    const dimG = container.append("g").attr("class", "dimension");
    dimG.append("line")
        .attr("x1", x1).attr("y1", y1)
        .attr("x2", x2).attr("y2", y2)
        .attr("stroke", "blue")
        .attr("stroke-width", 1);
    dimG.append("text")
        .attr("x", (x1+x2)/2 + (isVert ? offset : 0))
        .attr("y", (y1+y2)/2 + (isVert ? 0 : offset))
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("fill", "blue")
        .attr("font-size", "12px")
        .text(text);
};
