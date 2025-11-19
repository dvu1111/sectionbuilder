import * as d3 from 'd3';
import { ShapeType } from '../../types';

export const setupGrid = (gridG: d3.Selection<SVGGElement, unknown, null, undefined>) => {
    const gridSize = 50;
    const gridRange = 5000;
    
    // Grid Lines
    for (let i = -gridRange; i <= gridRange; i += gridSize) {
        gridG.append("line")
            .attr("x1", i).attr("y1", -gridRange)
            .attr("x2", i).attr("y2", gridRange)
            .attr("stroke", "#ccc").attr("stroke-width", 1);
    }
    for (let i = -gridRange; i <= gridRange; i += gridSize) {
        gridG.append("line")
            .attr("x1", -gridRange).attr("y1", i)
            .attr("x2", gridRange).attr("y2", i)
            .attr("stroke", "#ccc").attr("stroke-width", 1);
    }
    
    // Axes
    gridG.append("line").attr("x1", -gridRange).attr("y1", 0).attr("x2", gridRange).attr("y2", 0).attr("stroke", "#666").attr("stroke-width", 2);
    gridG.append("line").attr("x1", 0).attr("y1", -gridRange).attr("x2", 0).attr("y2", gridRange).attr("stroke", "#666").attr("stroke-width", 2);
};

export const setupZoom = (
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    rootG: d3.Selection<SVGGElement, unknown, null, undefined>,
    transformRef: React.MutableRefObject<d3.ZoomTransform>,
    shapeType: ShapeType
) => {
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        rootG.attr("transform", event.transform.toString());
      });

    // For Custom shapes, only zoom on wheel/middle-click/ctrl-key to allow drag interactions
    if (shapeType === ShapeType.CUSTOM) {
        zoom.filter((event) => {
            return event.type === 'wheel' || event.button === 1 || event.ctrlKey || event.metaKey;
        });
    } else {
        zoom.filter(() => true);
    }

    svg.call(zoom).on("dblclick.zoom", null);
    // Sync state
    svg.call(zoom.transform, transformRef.current);
};