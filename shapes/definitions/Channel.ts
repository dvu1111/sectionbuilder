
import * as d3 from 'd3';
import { ShapeType } from '../../types';
import { ShapeStrategy } from '../types';
import { rectProps, drawDimensionLine, calculatePlasticModulus, calculatePrincipalMoments } from '../utils';

export const ChannelStrategy: ShapeStrategy = {
  type: ShapeType.CHANNEL,
  label: 'Channel',
  icon: 'Magnet',
  initialDimensions: { depth: 200, width: 100, thickness: 10, thicknessWeb: 10 },
  inputs: [
    { label: 'Depth (d)', key: 'depth' },
    { label: 'Flange Width (bf)', key: 'width' },
    { label: 'Flange Thickness (tf)', key: 'thickness' },
    { label: 'Web Thickness (tw)', key: 'thicknessWeb' }
  ],
  calculate: (d) => {
    const h = d.depth;
    const b = d.width;
    const tf = d.thickness || 10;
    const tw = d.thicknessWeb || 10;

    // Reference: Bottom-Left corner (0,0) of bounding box
    // Web: tw x h. Centroid at (tw/2, h/2)
    const web = rectProps(tw, h, h/2, tw/2);
    
    const flangeW = b - tw;
    // Top Flange: flangeW x tf.
    const topFlange = rectProps(flangeW, tf, h - tf/2, tw + flangeW/2);
    
    // Bottom Flange: flangeW x tf.
    const botFlange = rectProps(flangeW, tf, tf/2, tw + flangeW/2);
    
    const totalArea = web.area + topFlange.area + botFlange.area;
    
    const Cy = totalArea > 0 ? (web.area * web.y + topFlange.area * topFlange.y + botFlange.area * botFlange.y) / totalArea : h/2;
    const Cz = totalArea > 0 ? (web.area * web.z + topFlange.area * topFlange.z + botFlange.area * botFlange.z) / totalArea : tw/2;

    // Inertia Iz (about horizontal centroidal axis)
    const Iz = (web.Iz_local + web.area * Math.pow(web.y - Cy, 2)) +
               (topFlange.Iz_local + topFlange.area * Math.pow(topFlange.y - Cy, 2)) +
               (botFlange.Iz_local + botFlange.area * Math.pow(botFlange.y - Cy, 2));

    // Inertia Iy (about vertical centroidal axis)
    const Iy = (web.Iy_local + web.area * Math.pow(web.z - Cz, 2)) +
               (topFlange.Iy_local + topFlange.area * Math.pow(topFlange.z - Cz, 2)) +
               (botFlange.Iy_local + botFlange.area * Math.pow(botFlange.z - Cz, 2));

    const rz = totalArea > 0 ? Math.sqrt(Iz / totalArea) : 0;
    const ry = totalArea > 0 ? Math.sqrt(Iy / totalArea) : 0;

    const yt = h - Cy;
    const yb = Cy;
    const zr = b - Cz;
    const zl = Cz;

    // Plastic Modulus
    let Zz = 0;
    let Zy = 0;
    if (ChannelStrategy.getCustomParts) {
         const polyParts = ChannelStrategy.getCustomParts(d);
         const bounds = { minX: -b/2, maxX: b/2, minY: -h/2, maxY: h/2 };
         const plastic = calculatePlasticModulus(polyParts, bounds);
         Zz = plastic.Zz;
         Zy = plastic.Zy;
    }

    return {
        area: totalArea,
        centroid: { y: Cy, z: Cz },
        momentInertia: { Iz, Iy, Izy: 0 },
        principalMoments: calculatePrincipalMoments(Iz, Iy, 0),
        sectionModulus: {
            Szt: yt > 0 ? Iz / yt : 0,
            Szb: yb > 0 ? Iz / yb : 0,
            Syt: zr > 0 ? Iy / zr : 0,
            Syb: zl > 0 ? Iy / zl : 0
        },
        radiusGyration: { rz, ry },
        plasticModulus: { Zz, Zy }
    };
  },
  draw: (g, uiG, d) => {
    const h = d.depth;
    const b = d.width;
    const tf = d.thickness || 10;
    const tw = d.thicknessWeb || 10;

    const path = d3.path();
    // Draw centered visually
    path.moveTo(b/2, -h/2);
    path.lineTo(-b/2, -h/2);
    path.lineTo(-b/2, h/2);
    path.lineTo(b/2, h/2);
    path.lineTo(b/2, h/2 - tf);
    path.lineTo(-b/2 + tw, h/2 - tf);
    path.lineTo(-b/2 + tw, -h/2 + tf);
    path.lineTo(b/2, -h/2 + tf);
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
    const h = d.depth;
    const b = d.width;
    const tf = d.thickness || 10;
    const tw = d.thicknessWeb || 10;
    
    return [{
        id: 'channel',
        type: 'solid',
        points: [
            { x: b/2, y: -h/2 },
            { x: -b/2, y: -h/2 },
            { x: -b/2, y: h/2 },
            { x: b/2, y: h/2 },
            { x: b/2, y: h/2 - tf },
            { x: -b/2 + tw, y: h/2 - tf },
            { x: -b/2 + tw, y: -h/2 + tf },
            { x: b/2, y: -h/2 + tf }
        ]
    }];
  }
};
