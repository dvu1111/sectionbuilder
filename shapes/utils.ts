
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

// --- NUMERICAL INTEGRATION UTILS (Range Algebra) ---

type Range = [number, number];

// Merges overlapping or adjacent intervals: [[0,10], [5,15]] -> [[0,15]]
const mergeRanges = (ranges: Range[]): Range[] => {
    if (ranges.length === 0) return [];
    ranges.sort((a, b) => a[0] - b[0]);
    const result: Range[] = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
        const last = result[result.length - 1];
        const current = ranges[i];
        if (current[0] <= last[1]) { // Overlap or touch
            last[1] = Math.max(last[1], current[1]);
        } else {
            result.push(current);
        }
    }
    return result;
};

// Subtracts holes from solids: [0,100] - [20, 40] -> [[0,20], [40,100]]
// Automatically handles holes outside solids (they are ignored)
const subtractRanges = (solids: Range[], holes: Range[]): Range[] => {
    let result = solids;
    // Optimize: Merge holes first to reduce fragmentation steps
    const mergedHoles = mergeRanges(holes);

    for (const hole of mergedHoles) {
        const nextResult: Range[] = [];
        for (const solid of result) {
            // Check overlap
            if (hole[1] <= solid[0] || hole[0] >= solid[1]) {
                // Disjoint
                nextResult.push(solid);
            } else {
                // Overlap
                if (hole[0] > solid[0]) {
                    nextResult.push([solid[0], hole[0]]);
                }
                if (hole[1] < solid[1]) {
                    nextResult.push([hole[1], solid[1]]);
                }
            }
        }
        result = nextResult;
    }
    return result;
};

// Gets valid material ranges along a scanline at 'pos' for a given axis
const getSliceRanges = (parts: {points: Point[], type: 'solid'|'hole'}[], pos: number, axis: 'x'|'y'): Range[] => {
    const solidRanges: Range[] = [];
    const holeRanges: Range[] = [];

    parts.forEach(part => {
        const poly = part.points;
        const intersections: number[] = [];
        for (let j = 0; j < poly.length; j++) {
            const p1 = poly[j];
            const p2 = poly[(j + 1) % poly.length];
            
            let val1, val2, other1, other2;
            if (axis === 'y') {
                val1 = p1.y; val2 = p2.y;
                other1 = p1.x; other2 = p2.x;
            } else {
                val1 = p1.x; val2 = p2.x;
                other1 = p1.y; other2 = p2.y;
            }

            // Check intersection with scanline
            if ((val1 <= pos && val2 > pos) || (val2 <= pos && val1 > pos)) {
                const t = (pos - val1) / (val2 - val1);
                const intersection = other1 + t * (other2 - other1);
                intersections.push(intersection);
            }
        }
        
        intersections.sort((a, b) => a - b);
        
        // Create segments from pairs of intersections
        for (let k = 0; k < intersections.length; k += 2) {
            if (k + 1 < intersections.length) {
                const r: Range = [intersections[k], intersections[k+1]];
                // Ignore zero-width segments
                if (r[1] - r[0] > 1e-9) {
                    if (part.type === 'solid') solidRanges.push(r);
                    else holeRanges.push(r);
                }
            }
        }
    });

    const mergedSolids = mergeRanges(solidRanges);
    const mergedHoles = mergeRanges(holeRanges);
    
    // Boolean Subtract: Solids - Holes
    return subtractRanges(mergedSolids, mergedHoles);
};

// --- ADVANCED CALCULATIONS ---

// Replaces Green's Theorem for robust boolean handling (Solid - Hole)
export const calculateNumericProperties = (parts: { points: Point[], type: 'solid'|'hole' }[]) => {
    // 1. Calculate Bounding Box of SOLIDS only
    // Holes outside solids should not affect bounds or processing
    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity;
    let hasSolids = false;

    parts.forEach(p => {
        if (p.type === 'solid') {
            hasSolids = true;
            p.points.forEach(pt => {
                minY = Math.min(minY, pt.y);
                maxY = Math.max(maxY, pt.y);
                minX = Math.min(minX, pt.x);
                maxX = Math.max(maxX, pt.x);
            });
        }
    });

    if (!hasSolids) {
         return { area: 0, Cx: 0, Cy: 0, Ixx: 0, Iyy: 0, Ixy: 0, bounds: { minX:0, maxX:0, minY:0, maxY:0 } };
    }

    // 2. Numerical Integration (Scanline Algorithm)
    // Increased precision for "Pro" quality results
    const STEPS = 2000;
    const dy = (maxY - minY) / STEPS;
    
    // Initialize Integrals
    let Area = 0;
    let Sy = 0; // Moment about X-axis (int y dA)
    let Sx = 0; // Moment about Y-axis (int x dA)
    let Ixx = 0; // Second moment about X-axis
    let Iyy = 0; // Second moment about Y-axis
    let Ixy = 0; // Product of inertia

    for (let i = 0; i < STEPS; i++) {
        const y = minY + (i + 0.5) * dy;
        
        // Get effective material ranges on this scanline
        const ranges = getSliceRanges(parts, y, 'y');
        
        for (const r of ranges) {
            const width = r[1] - r[0];
            const xMid = (r[0] + r[1]) / 2;
            const dA = width * dy;
            
            Area += dA;
            Sy += y * dA;
            Sx += xMid * dA;
            
            // Ixx contribution: y^2 * dA
            Ixx += y * y * dA; 
            
            // Iyy contribution: Integral of x^2 dx across the strip width
            // = dy * [x^3 / 3] from x1 to x2
            Iyy += (Math.pow(r[1], 3) - Math.pow(r[0], 3)) / 3 * dy;
            
            // Ixy contribution: y * Integral of x dx
            // = y * dy * [x^2 / 2] from x1 to x2
            // = y * dA * xMid
            Ixy += xMid * y * dA;
        }
    }

    // Prevent division by zero if area is negligible
    if (Area <= 1e-9) {
         return { area: 0, Cx: 0, Cy: 0, Ixx: 0, Iyy: 0, Ixy: 0, bounds: { minX, maxX, minY, maxY } };
    }

    const Cx = Area > 0 ? Sx / Area : 0;
    const Cy = Area > 0 ? Sy / Area : 0;

    return {
        area: Area,
        Cx,
        Cy,
        Ixx,
        Iyy,
        Ixy,
        bounds: { minX, maxX, minY, maxY }
    };
};

// Updated Plastic Modulus Calculation using the new robust range logic
export const calculatePlasticModulus = (parts: { points: Point[], type: 'solid'|'hole' }[], bounds: {minX:number, maxX:number, minY:number, maxY:number}) => {
    const STEPS = 2000; // Increased precision
    let Zz = 0;
    let Zy = 0;

    // Helper: Calculate total length of solid segments at a given position
    const getEffectiveLength = (pos: number, axis: 'x'|'y') => {
        const ranges = getSliceRanges(parts, pos, axis);
        return ranges.reduce((sum, r) => sum + (r[1] - r[0]), 0);
    };

    // 1. Calculate Zz (Bending about Horizontal Axis, scan Y)
    if (bounds.maxY > bounds.minY) {
        const dy = (bounds.maxY - bounds.minY) / STEPS;
        const strips: { pos: number, area: number }[] = [];
        let totalAreaCheck = 0;

        for (let i = 0; i < STEPS; i++) {
            const y = bounds.minY + (i + 0.5) * dy;
            const width = getEffectiveLength(y, 'y');
            
            const stripArea = width * dy;
            strips.push({ pos: y, area: stripArea });
            totalAreaCheck += stripArea;
        }

        // Find PNA
        let currentArea = 0;
        let pnaY = bounds.minY;
        for (const strip of strips) {
            currentArea += strip.area;
            if (currentArea >= totalAreaCheck / 2) {
                pnaY = strip.pos;
                break;
            }
        }
        // First moment about PNA
        for (const strip of strips) {
            Zz += strip.area * Math.abs(strip.pos - pnaY);
        }
    }

    // 2. Calculate Zy (Bending about Vertical Axis, scan X)
    if (bounds.maxX > bounds.minX) {
        const dx = (bounds.maxX - bounds.minX) / STEPS;
        const strips: { pos: number, area: number }[] = [];
        let totalAreaCheck = 0;

        for (let i = 0; i < STEPS; i++) {
            const x = bounds.minX + (i + 0.5) * dx;
            const height = getEffectiveLength(x, 'x');
            
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

// Helper to get centroid of multiple parts (Now uses numeric integration for accuracy if boolean logic needed)
export const calculateCentroidFromParts = (parts: CustomPart[]): { x: number, y: number } => {
    // Convert to polygon lists for the numeric solver
    const polyParts: { points: Point[], type: 'solid'|'hole' }[] = [];
    
    parts.forEach(part => {
        let calcPoints: Point[] = [];
        if (part.isCircle && part.circleParams) {
            const segments = 128; // Increased segments
            const { x, y, r } = part.circleParams;
            for (let i = 0; i < segments; i++) {
              const theta = (i / segments) * 2 * Math.PI;
              calcPoints.push({ x: x + r * Math.cos(theta), y: y + r * Math.sin(theta) });
            }
        } else {
             // Discretize curves
             const pts = part.points;
             for (let i = 0; i < pts.length; i++) {
                  const p1 = pts[i];
                  const p2 = pts[(i + 1) % pts.length];
                  if (part.curves && part.curves[i]) {
                      const control = part.curves[i].controlPoint;
                      calcPoints.push(...discretizeArc(p1, control, p2, 32)); // Increased from 8
                  } else {
                      calcPoints.push(p1);
                  }
             }
        }
        polyParts.push({ points: calcPoints, type: part.type });
    });

    // Use robust solver
    const props = calculateNumericProperties(polyParts);
    return { x: props.Cx, y: props.Cy };
};


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

// Keep for Legacy/Standard shape use if needed, but custom now uses numeric
export const calculatePolygonProperties = (points: Point[]) => {
    // ... Original Green's theorem logic kept as fallback/util ...
    // Simple Green's theorem implementation
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
    
      const Cx = A !== 0 ? Sy / A : 0;
      const Cy = A !== 0 ? Sx / A : 0;
    
      return { A, Cx, Cy, Ixx, Iyy, Ixy, bounds: {minX, maxX, minY, maxY} };
};

// Helper: Calculate Principal Moments
export const calculatePrincipalMoments = (Iz: number, Iy: number, Izy: number) => {
    const avg = (Iz + Iy) / 2;
    const diff = (Iz - Iy) / 2;
    const R = Math.sqrt(diff * diff + Izy * Izy);
    
    const I1 = avg + R;
    const I2 = avg - R;
    
    let angleRad = 0.5 * Math.atan2(-2 * Izy, Iz - Iy);
    let angleDeg = (angleRad * 180) / Math.PI;
    
    return { I1, I2, angle: angleDeg };
};
