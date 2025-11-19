
import * as d3 from 'd3';
import { ShapeType } from '../../types';
import { ShapeStrategy } from '../types';
import { rectProps, drawDimensionLine } from '../utils';

export const TShapeStrategy: ShapeStrategy = {
  type: ShapeType.T_SHAPE,
  label: 'T-Shape',
  icon: 'Baseline',
  initialDimensions: { depth: 200, width: 200, thickness: 20, thicknessWeb: 20 },
  inputs: [
    { label: 'Depth (d)', key: 'depth' },
    { label: 'Flange Width (b)', key: 'width' },
    { label: 'Flange Thickness (tf)', key: 'thickness' },
    { label: 'Web Thickness (tw)', key: 'thicknessWeb' }
  ],
  calculate: (d) => {
    const b = d.width;
    const h = d.depth;
    const tf = d.thickness || 20;
    const tw = d.thicknessWeb || 20;

    // Parts relative to bottom-center of shape
    const h_web = h - tf;
    
    // Part 1: Web (centered at 0 horizontal)
    const web = rectProps(tw, h_web, h_web/2, 0);

    // Part 2: Flange
    const flange = rectProps(b, tf, h_web + tf/2, 0);

    const totalArea = web.area + flange.area;
    const Cy = totalArea > 0 ? (web.area * web.y + flange.area * flange.y) / totalArea : 0;
    // Cz is 0 (Symmetric)
    // But standard calculation interface expects origin at bottom-left usually if used generically,
    // but here we used 0 as center for Z. 
    // Let's shift result to match bounding box origin (Bottom-Left) so Stage can render centroid marker correctly.
    // Bounding box Left is -b/2.
    // So Cz relative to Left is b/2.
    
    const Cz_local = 0; 
    
    // Convert to Bottom-Left Origin for return
    const Cy_BL = Cy;
    const Cz_BL = Cz_local + b/2;

    // Inertias
    const Iz_web = web.Iz_local + web.area * Math.pow(web.y - Cy, 2);
    const Iz_flange = flange.Iz_local + flange.area * Math.pow(flange.y - Cy, 2);
    const Iz = Iz_web + Iz_flange;

    const Iy_web = web.Iy_local; 
    const Iy_flange = flange.Iy_local; 
    const Iy = Iy_web + Iy_flange;

    const rz = totalArea > 0 ? Math.sqrt(Iz / totalArea) : 0;
    const ry = totalArea > 0 ? Math.sqrt(Iy / totalArea) : 0;

    const yt = h - Cy;
    const yb = Cy;
    const xr = b/2;

    return {
        area: totalArea,
        centroid: { y: Cy_BL, z: Cz_BL },
        momentInertia: { Iz, Iy, Izy: 0 },
        sectionModulus: {
            Szt: yt > 0 ? Iz / yt : 0,
            Szb: yb > 0 ? Iz / yb : 0,
            Syt: xr > 0 ? Iy / xr : 0,
            Syb: xr > 0 ? Iy / xr : 0
        },
        radiusGyration: { rz, ry },
        plasticModulus: { Zz: 0, Zy: 0 }
    };
  },
  draw: (g, uiG, d) => {
    const b = d.width;
    const h = d.depth;
    const tf = d.thickness || 20;
    const tw = d.thicknessWeb || 20;

    const path = d3.path();
    // Draw centered at (0,0)
    path.moveTo(-b/2, -h/2);
    path.lineTo(b/2, -h/2);
    path.lineTo(b/2, -h/2 + tf);
    path.lineTo(tw/2, -h/2 + tf);
    path.lineTo(tw/2, h/2);
    path.lineTo(-tw/2, h/2);
    path.lineTo(-tw/2, -h/2 + tf);
    path.lineTo(-b/2, -h/2 + tf);
    path.closePath();

    g.append("path")
      .attr("d", path.toString())
      .attr("fill", "#94a3b8")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 2)
      .attr("opacity", 0.8);

     drawDimensionLine(uiG, b/2 + 20, -h/2, b/2 + 20, h/2, `${h} mm`, 10, true);
     drawDimensionLine(uiG, -b/2, -h/2 - 20, b/2, -h/2 - 20, `${b} mm`, -5, false);
  },
  getCustomParts: (d) => {
    const b = d.width;
    const h = d.depth;
    const tf = d.thickness || 20;
    const tw = d.thicknessWeb || 20;

    return [{
        id: 't-shape',
        type: 'solid',
        points: [
            { x: -b/2, y: -h/2 },
            { x: b/2, y: -h/2 },
            { x: b/2, y: -h/2 + tf },
            { x: tw/2, y: -h/2 + tf },
            { x: tw/2, y: h/2 },
            { x: -tw/2, y: h/2 },
            { x: -tw/2, y: -h/2 + tf },
            { x: -b/2, y: -h/2 + tf }
        ]
    }];
  }
};
