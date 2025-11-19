
import { ShapeType } from '../../types';
import { ShapeStrategy } from '../types';
import { rectProps, drawDimensionLine } from '../utils';

export const RectangularStrategy: ShapeStrategy = {
  type: ShapeType.RECTANGULAR,
  label: 'Rectangular',
  icon: 'Square',
  initialDimensions: { depth: 200, width: 100 },
  inputs: [
    { label: 'Depth (d)', key: 'depth' },
    { label: 'Width (b)', key: 'width' }
  ],
  calculate: (d) => {
    const props = rectProps(d.width, d.depth, d.depth / 2, d.width / 2);
    return {
      area: props.area,
      centroid: { y: d.depth / 2, z: d.width / 2 },
      momentInertia: { Iz: props.Iz_local, Iy: props.Iy_local, Izy: 0 },
      sectionModulus: {
        Szt: props.Iz_local / (d.depth / 2),
        Szb: props.Iz_local / (d.depth / 2),
        Syt: props.Iy_local / (d.width / 2),
        Syb: props.Iy_local / (d.width / 2)
      },
      radiusGyration: {
        rz: props.area > 0 ? Math.sqrt(props.Iz_local / props.area) : 0,
        ry: props.area > 0 ? Math.sqrt(props.Iy_local / props.area) : 0
      },
      plasticModulus: {
        Zz: (d.width * Math.pow(d.depth, 2)) / 4,
        Zy: (d.depth * Math.pow(d.width, 2)) / 4
      }
    };
  },
  draw: (g, uiG, d) => {
    const w = d.width;
    const h = d.depth;
    g.append("rect")
        .attr("x", -w/2).attr("y", -h/2)
        .attr("width", w).attr("height", h)
        .attr("fill", "#94a3b8").attr("stroke", "#1e293b").attr("stroke-width", 2).attr("opacity", 0.8);
    
    drawDimensionLine(uiG, w/2 + 20, -h/2, w/2 + 20, h/2, `${h} mm`, 10, true);
    drawDimensionLine(uiG, -w/2, -h/2 - 20, w/2, -h/2 - 20, `${w} mm`, -5, false);
  },
  getCustomParts: (d) => {
    const w = d.width;
    const h = d.depth;
    return [{
        id: 'rect-main',
        type: 'solid',
        points: [
            { x: -w/2, y: -h/2 },
            { x: w/2, y: -h/2 },
            { x: w/2, y: h/2 },
            { x: -w/2, y: h/2 }
        ]
    }];
  }
};
