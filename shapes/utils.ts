import * as d3 from 'd3';
import { Point } from '../types';

// --- MATH UTILS ---

// Helper: Rectangle Properties (used by Rect, HollowRect, I-Shape)
export const rectProps = (b: number, h: number, yCentroid: number, zCentroid: number) => {
  const area = b * h;
  const Iz_local = (b * Math.pow(h, 3)) / 12;
  const Iy_local = (h * Math.pow(b, 3)) / 12;
  return { area, h, b, y: yCentroid, z: zCentroid, Iz_local, Iy_local };
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

    // Determine direction and range
    // Normalize angles to 0-2PI for easier comparison, or use delta
    // We want to go from start to end VIA through.
    
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
    // Note: The caller usually adds the final point (p3) or it's the start of next segment
    return points;
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