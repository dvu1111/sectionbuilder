import * as d3 from 'd3';
import { ShapeType } from '../../types';
import { ShapeStrategy } from '../types';
import { rectProps, drawDimensionLine } from '../utils';

export const HollowRectangularStrategy: ShapeStrategy = {
  type: ShapeType.HOLLOW_RECTANGULAR,
  label: 'Hollow Rectangular',
  icon: 'BoxSelect',
  initialDimensions: { depth: 200, width: 100, thickness: 10 },
  inputs: [
    { label: 'Depth (d)', key: 'depth' },
    { label: 'Width (b)', key: 'width' },
    { label: 'Thickness (t)', key: 'thickness' }
  ],
  calculate: (d) => {
    const th = d.thickness || 0;
    const validTh = Math.min(th, d.width / 2, d.depth / 2);
    const innerW = d.width - 2 * validTh;
    const innerH = d.depth - 2 * validTh;
    
    const outer = rectProps(d.width, d.depth, d.depth/2, d.width/2);
    const inner = rectProps(innerW, innerH, d.depth/2, d.width/2);
    
    const totalArea = outer.area - inner.area;
    const Iz = outer.Iz_local - inner.Iz_local; 
    const Iy = outer.Iy_local - inner.Iy_local;
    
    return {
        area: totalArea,
        centroid: { y: d.depth/2, z: d.width/2 },
        momentInertia: { Iz, Iy, Izy: 0 },
        radiusGyration: { rz: totalArea > 0 ? Math.sqrt(Iz/totalArea) : 0, ry: totalArea > 0 ? Math.sqrt(Iy/totalArea) : 0 },
        sectionModulus: { 
            Szt: d.depth > 0 ? Iz / (d.depth/2) : 0, 
            Szb: d.depth > 0 ? Iz / (d.depth/2) : 0,
            Syt: d.width > 0 ? Iy / (d.width/2) : 0, 
            Syb: d.width > 0 ? Iy / (d.width/2) : 0
        },
        plasticModulus: { 
             Zz: (d.width * Math.pow(d.depth, 2) / 4) - (innerW * Math.pow(innerH, 2) / 4),
             Zy: (d.depth * Math.pow(d.width, 2) / 4) - (innerH * Math.pow(innerW, 2) / 4)
        }
    };
  },
  draw: (g, uiG, d) => {
    const w = d.width;
    const h = d.depth;
    const t = d.thickness || 0;
    
    const path = d3.path();
    path.moveTo(-w/2, -h/2); path.lineTo(w/2, -h/2); path.lineTo(w/2, h/2); path.lineTo(-w/2, h/2); path.closePath();
    
    const validTh = Math.min(t, w/2, h/2);
    const iw = w - 2 * validTh; 
    const ih = h - 2 * validTh;
    
    if (iw > 0 && ih > 0) {
         path.moveTo(-iw/2, -ih/2); path.lineTo(-iw/2, ih/2); path.lineTo(iw/2, ih/2); path.lineTo(iw/2, -ih/2); path.closePath();
    }
    
    g.append("path")
      .attr("d", path.toString())
      .attr("fill", "#94a3b8")
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 2)
      .attr("fill-rule", "evenodd")
      .attr("opacity", 0.8);

    drawDimensionLine(uiG, w/2 + 30, -h/2, w/2 + 30, h/2, `${h} mm`, 10, true);
    drawDimensionLine(uiG, -w/2, -h/2 - 30, w/2, -h/2 - 30, `${w} mm`, -5, false);
  }
};