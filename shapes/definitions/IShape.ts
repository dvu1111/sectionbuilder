
import * as d3 from 'd3';
import { ShapeType } from '../../types';
import { ShapeStrategy } from '../types';
import { rectProps, drawDimensionLine } from '../utils';

export const IShapeStrategy: ShapeStrategy = {
  type: ShapeType.I_SHAPE,
  label: 'I-Shape',
  icon: 'Type',
  initialDimensions: {
    depth: 203.2,
    width: 203.2, // Top Width
    widthBottom: 203.2,
    thicknessWeb: 7.32,
    thicknessFlangeTop: 11,
    thicknessFlangeBottom: 11,
    filletRadius: 10.2
  },
  inputs: [
    { label: 'Depth (d)', key: 'depth' },
    { label: 'Top Width (b_top)', key: 'width' },
    { label: 'Top Thickness (t_top)', key: 'thicknessFlangeTop' },
    { label: 'Bottom Width (b_bot)', key: 'widthBottom' },
    { label: 'Bottom Thickness (t_bot)', key: 'thicknessFlangeBottom' },
    { label: 'Web Thickness (t_w)', key: 'thicknessWeb' },
    { label: 'Fillet Radius (r)', key: 'filletRadius' }
  ],
  calculate: (d) => {
    // Simplified I-Beam (3 Rectangles), ignoring fillets for standard inertia calc
    const tf_top = d.thicknessFlangeTop || 10;
    const tf_bot = d.thicknessFlangeBottom || 10;
    const tw = d.thicknessWeb || 6;
    const w_top = d.width;
    const w_bot = d.widthBottom || d.width;
    const h = d.depth;

    let parts: ReturnType<typeof rectProps>[] = [];

    // Bottom Flange
    parts.push(rectProps(w_bot, tf_bot, tf_bot / 2, w_bot / 2)); 
    // Web
    const h_web = h - tf_top - tf_bot;
    const y_web = tf_bot + h_web / 2;
    const maxW = Math.max(w_top, w_bot);
    parts.push(rectProps(tw, h_web, y_web, maxW / 2)); 
    // Top Flange
    const y_top = h - tf_top / 2;
    parts.push(rectProps(w_top, tf_top, y_top, maxW / 2));

    // Parallel Axis Theorem Composite Calc
    let sumAy = 0;
    let sumAz = 0;
    let totalArea = 0;
    
    parts.forEach(p => {
        sumAy += p.area * p.y;
        sumAz += p.area * p.z;
        totalArea += p.area;
    });

    const cy = totalArea > 0 ? sumAy / totalArea : 0;
    const cz = totalArea > 0 ? sumAz / totalArea : 0;

    let Iz = 0;
    let Iy = 0;

    parts.forEach(p => {
        const dy = p.y - cy;
        const dz = p.z - cz;
        Iz += p.Iz_local + p.area * dy * dy;
        Iy += p.Iy_local + p.area * dz * dz;
    });

    const rz = totalArea > 0 ? Math.sqrt(Iz / totalArea) : 0;
    const ry = totalArea > 0 ? Math.sqrt(Iy / totalArea) : 0;

    // Section Modulus
    const yMax = d.depth; 
    const yMin = 0; 
    const zMax = Math.max(d.width, d.widthBottom || 0); 
    const zMin = 0;

    const cTop = yMax - cy;
    const cBot = cy - yMin;
    const cRight = zMax - cz;
    const cLeft = cz - zMin;

    // Plastic Modulus Approx
    let Zz = 0;
    let Zy = 0;
    parts.forEach(p => {
        Zz += p.area * Math.abs(p.y - cy);
        Zy += p.area * Math.abs(p.z - cz);
    });

    return {
      area: totalArea,
      centroid: { y: cy, z: cz },
      momentInertia: { Iz, Iy, Izy: 0 },
      sectionModulus: { 
          Szt: cTop !== 0 ? Iz / cTop : 0,
          Szb: cBot !== 0 ? Iz / cBot : 0,
          Syt: cRight !== 0 ? Iy / cRight : 0,
          Syb: cLeft !== 0 ? Iy / cLeft : 0
      },
      radiusGyration: { rz, ry },
      plasticModulus: { Zz, Zy }
    };
  },
  draw: (g, uiG, d) => {
    const wt = d.width; 
    const wb = d.widthBottom || wt;
    const depth = d.depth;
    const tw = d.thicknessWeb || 10;
    const tft = d.thicknessFlangeTop || 10;
    const tfb = d.thicknessFlangeBottom || 10;
    const halfD = depth/2;

    const path = d3.path();
    path.moveTo(wb/2, halfD); 
    path.lineTo(wb/2, halfD - tfb); 
    path.lineTo(tw/2, halfD - tfb); 
    path.lineTo(tw/2, -halfD + tft); 
    path.lineTo(wt/2, -halfD + tft); 
    path.lineTo(wt/2, -halfD); 
    path.lineTo(-wt/2, -halfD); 
    path.lineTo(-wt/2, -halfD + tft); 
    path.lineTo(-tw/2, -halfD + tft); 
    path.lineTo(-tw/2, halfD - tfb); 
    path.lineTo(-wb/2, halfD - tfb); 
    path.lineTo(-wb/2, halfD); 
    path.closePath();
    
    g.append("path")
        .attr("d", path.toString())
        .attr("fill", "#94a3b8")
        .attr("stroke", "#1e293b")
        .attr("stroke-width", 2)
        .attr("opacity", 0.8);
    
    const dimOffset = Math.max(wt, wb)/2 + 40;
    drawDimensionLine(uiG, dimOffset, -halfD, dimOffset, halfD, `${depth} mm`, 10, true);
    drawDimensionLine(uiG, -wt/2, -halfD - 20, wt/2, -halfD - 20, `${wt} mm`, -5, false);
  },
  getCustomParts: (d) => {
    const wt = d.width; 
    const wb = d.widthBottom || wt;
    const depth = d.depth;
    const tw = d.thicknessWeb || 10;
    const tft = d.thicknessFlangeTop || 10;
    const tfb = d.thicknessFlangeBottom || 10;
    const halfD = depth/2;

    return [{
        id: 'i-shape',
        type: 'solid',
        points: [
            { x: wb/2, y: halfD },
            { x: wb/2, y: halfD - tfb },
            { x: tw/2, y: halfD - tfb },
            { x: tw/2, y: -halfD + tft },
            { x: wt/2, y: -halfD + tft },
            { x: wt/2, y: -halfD },
            { x: -wt/2, y: -halfD },
            { x: -wt/2, y: -halfD + tft },
            { x: -tw/2, y: -halfD + tft },
            { x: -tw/2, y: halfD - tfb },
            { x: -wb/2, y: halfD - tfb },
            { x: -wb/2, y: halfD }
        ]
    }];
  }
};
