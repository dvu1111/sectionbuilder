
import * as d3 from 'd3';
import { Point, ShapeType, Dimensions, CustomPart } from '../../types';
import { getShapeStrategy } from '../../shapes';
import { calculateCentroidFromParts } from '../../shapes/utils';

interface RenderPreviewsParams {
    uiG: d3.Selection<SVGGElement, unknown, null, undefined>;
    drawMode: string;
    currentPoints: Point[];
    mousePos: Point | null;
    circleStart: Point | null;
    previewNode: { x: number, y: number } | null;
    previewBend: { partId: string, segmentIndex: number } | null;
    customParts: CustomPart[];
    shapeType: ShapeType;
    dimensions: Dimensions;
    rotation?: number;
}

export const renderPreviews = ({
    uiG,
    drawMode,
    currentPoints,
    mousePos,
    circleStart,
    previewNode,
    previewBend,
    customParts,
    shapeType,
    dimensions,
    rotation = 0
}: RenderPreviewsParams) => {
    // 1. Previews for Add Node and Bend tools
    if (drawMode === 'add_node' && previewNode) {
       uiG.append("circle")
         .attr("cx", previewNode.x)
         .attr("cy", previewNode.y)
         .attr("r", 6)
         .attr("fill", "#3b82f6")
         .attr("stroke", "white")
         .attr("stroke-width", 2)
         .attr("pointer-events", "none");
    }
    
    if (drawMode === 'bend' && previewBend && previewBend.partId) {
        // Highlight the segment
        const part = customParts.find(p => p.id === previewBend!.partId);
        if (part && !part.isCircle) {
             const p1 = part.points[previewBend.segmentIndex];
             const p2 = part.points[(previewBend.segmentIndex + 1) % part.points.length];
             uiG.append("line")
                 .attr("x1", p1.x).attr("y1", p1.y)
                 .attr("x2", p2.x).attr("y2", p2.y)
                 .attr("stroke", "#8b5cf6")
                 .attr("stroke-width", 3)
                 .attr("pointer-events", "none");
        }
    }

    // 2. Render Active Drawing (Ghost Polygon)
    if (drawMode === 'polygon' && currentPoints.length > 0) {
        const line = d3.line<Point>().x(d => d.x).y(d => d.y);
        uiG.append("path")
            .datum(currentPoints)
            .attr("d", line)
            .attr("fill", "none")
            .attr("stroke", "blue")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "5,5")
            .attr("pointer-events", "none");

        uiG.selectAll(".node")
            .data(currentPoints)
            .enter().append("circle")
            .attr("class", "node")
            .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", 4)
            .attr("fill", "white").attr("stroke", "blue")
            .attr("pointer-events", "none");

        if (mousePos) {
            const lastPt = currentPoints[currentPoints.length - 1];
            uiG.append("line")
                .attr("x1", lastPt.x).attr("y1", lastPt.y)
                .attr("x2", mousePos.x).attr("y2", mousePos.y)
                .attr("stroke", "blue").attr("stroke-width", 1).attr("opacity", 0.5)
                .attr("pointer-events", "none");
        }
    }

    // 3. Render Active Drawing (Ghost Circle)
    if (drawMode === 'circle' && circleStart && mousePos) {
        const r = Math.sqrt(Math.pow(mousePos.x - circleStart.x, 2) + Math.pow(mousePos.y - circleStart.y, 2));
        uiG.append("circle")
            .attr("cx", circleStart.x).attr("cy", circleStart.y).attr("r", r)
            .attr("fill", "none").attr("stroke", "blue")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "5,5")
            .attr("pointer-events", "none");
        
        uiG.append("line")
            .attr("x1", circleStart.x).attr("y1", circleStart.y)
            .attr("x2", mousePos.x).attr("y2", mousePos.y)
            .attr("stroke", "blue").attr("opacity", 0.5)
            .attr("pointer-events", "none");

        uiG.append("circle")
            .attr("cx", circleStart.x).attr("cy", circleStart.y).attr("r", 3)
            .attr("fill", "blue")
            .attr("pointer-events", "none");
    }

    // 4. Centroid Marker
    let cx = 0;
    let cy = 0;
    let showMarker = true;

    // Determine parts to calculate centroid from
    let partsToCalc: CustomPart[] = [];

    if (shapeType === ShapeType.CUSTOM) {
        if (customParts.length > 0) {
            partsToCalc = customParts;
        } else {
            showMarker = false;
        }
    } else {
        // Standard Shape
        const strategy = getShapeStrategy(shapeType);
        if (strategy.getCustomParts) {
             partsToCalc = strategy.getCustomParts(dimensions);
        } else {
             showMarker = false;
        }
    }

    if (showMarker && partsToCalc.length > 0) {
        // Calculate absolute geometric centroid (Relative to (0,0) of the parts provided)
        // For Standard shapes, this is the centroid of the unrotated shape in the drawing coordinate system.
        // Since Stage rotates the group around this exact point (if rotation is active), 
        // plotting the marker at this unrotated coordinate is actually correct because the marker
        // will be part of the "uiG" which might NOT be rotated, but wait.
        // Stage.tsx passes `uiG`. In standard drawing, `uiG` is NOT rotated?
        // Let's look at Stage.tsx:
        // if (standard) { const rotatedUIG = uiG.append("g")... strategy.draw(..., rotatedUIG) }
        // But renderPreviews receives the ROOT `uiG`.
        // If we draw the marker in root `uiG`, we must apply rotation manually to the coordinates if we want it to follow.
        
        const c = calculateCentroidFromParts(partsToCalc);
        
        if (rotation !== 0 && shapeType !== ShapeType.CUSTOM) {
            // If rotation is active, standard shapes pivot around their centroid.
            // So the Visual Centroid LOCATION does not change!
            // The shape spins around it.
            // So we just use the unrotated centroid coordinates.
            cx = c.x;
            cy = c.y;
        } else {
            cx = c.x;
            cy = c.y;
        }

        const markerG = uiG.append("g")
            .attr("class", "centroid")
            .attr("transform", `translate(${cx}, ${cy})`)
            .attr("pointer-events", "none");

        markerG.append("circle")
            .attr("r", 4)
            .attr("fill", "rgba(255,0,0,0.8)")
            .attr("stroke", "white")
            .attr("stroke-width", 1);

        markerG.append("line")
            .attr("x1", -6).attr("y1", 0).attr("x2", 6).attr("y2", 0)
            .attr("stroke", "white").attr("stroke-width", 1);
            
        markerG.append("line")
            .attr("x1", 0).attr("y1", -6).attr("x2", 0).attr("y2", 6)
            .attr("stroke", "white").attr("stroke-width", 1);

        markerG.append("text")
            .attr("x", 6)
            .attr("y", -6)
            .text("C")
            .attr("fill", "red")
            .attr("font-size", "12px")
            .attr("font-weight", "bold");
    }
};
