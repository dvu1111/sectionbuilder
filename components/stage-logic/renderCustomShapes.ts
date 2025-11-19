import * as d3 from 'd3';
import { CustomPart, Point, DragStartData } from '../../types';
import { getCircleFromThreePoints } from '../../shapes/utils';

interface RenderCustomShapesParams {
    shapeG: d3.Selection<SVGGElement, unknown, null, undefined>;
    uiG: d3.Selection<SVGGElement, unknown, null, undefined>;
    customParts: CustomPart[];
    selectedPartIds: string[];
    drawMode: 'select' | 'polygon' | 'circle' | 'add_node' | 'bend';
    dragStartMap: Map<string, DragStartData>;
    onCustomPartsChange?: (parts: CustomPart[]) => void;
    setSelectedPartIds: (ids: string[]) => void;
    setSelectedCurveIndex: (index: number | null) => void;
    selectedCurveIndex: number | null;
}

export const renderCustomShapes = ({
    shapeG,
    uiG,
    customParts,
    selectedPartIds,
    drawMode,
    dragStartMap,
    onCustomPartsChange,
    setSelectedPartIds,
    setSelectedCurveIndex,
    selectedCurveIndex
}: RenderCustomShapesParams) => {
    
    const fillStyle = "#94a3b8"; 
    const strokeStyle = "#1e293b";
    
    // 1. Render Parts
    customParts.forEach(part => {
        const isSelected = selectedPartIds.includes(part.id);
        // Allow pointer events in add_node or bend mode
        const pointerEvents = (drawMode === 'select' || drawMode === 'add_node' || drawMode === 'bend') ? 'all' : 'none';
        
        let el: d3.Selection<any, any, null, undefined>;

        if (part.isCircle && part.circleParams) {
            const { x, y, r } = part.circleParams;
            el = shapeG.append("circle")
                .attr("cx", x).attr("cy", y).attr("r", r);
        } else {
            // Manual Path Construction for Curves
            const path = d3.path();
            const pts = part.points;
            
            // We construct the D string manually to support Arcs properly
            let dStr = "";
            if (pts.length > 0) {
                dStr += `M ${pts[0].x},${pts[0].y}`;
                for (let i = 0; i < pts.length; i++) {
                    const p1 = pts[i];
                    const p2 = pts[(i + 1) % pts.length];
                    
                    if (part.curves && part.curves[i]) {
                        const cp = part.curves[i].controlPoint;
                        const circle = getCircleFromThreePoints(p1, cp, p2);
                        if (circle) {
                            const startAngle = Math.atan2(p1.y - circle.y, p1.x - circle.x);
                            const midAngle = Math.atan2(cp.y - circle.y, cp.x - circle.x);
                            const endAngle = Math.atan2(p2.y - circle.y, p2.x - circle.x);
                            let d1 = midAngle - startAngle;
                            while (d1 <= -Math.PI) d1 += 2*Math.PI;
                            while (d1 > Math.PI) d1 -= 2*Math.PI;
                            let d2 = endAngle - midAngle;
                            while (d2 <= -Math.PI) d2 += 2*Math.PI;
                            while (d2 > Math.PI) d2 -= 2*Math.PI;
                            const totalSweep = d1 + d2;
                            const sweepFlag = totalSweep >= 0 ? 1 : 0;
                            const largeArcFlag = Math.abs(totalSweep) > Math.PI ? 1 : 0;
                            
                            dStr += ` A ${circle.r} ${circle.r} 0 ${largeArcFlag} ${sweepFlag} ${p2.x},${p2.y}`;
                        } else {
                            dStr += ` L ${p2.x},${p2.y}`;
                        }
                    } else {
                        dStr += ` L ${p2.x},${p2.y}`;
                    }
                }
                dStr += " Z";
            }

            el = shapeG.append("path")
                .attr("d", dStr);
        }
        
        el.attr("fill", part.type === 'solid' ? fillStyle : 'white')
          .attr("stroke", isSelected ? "#3b82f6" : (part.type === 'solid' ? strokeStyle : 'red'))
          .attr("stroke-width", isSelected ? 3 : 2)
          .attr("stroke-dasharray", part.type === 'solid' ? null : "4,2")
          .attr("fill-opacity", part.type === 'solid' ? 0.8 : 1)
          .attr("cursor", drawMode === 'select' ? "move" : (drawMode === 'add_node' || drawMode === 'bend' ? "crosshair" : "default"))
          .attr("pointer-events", pointerEvents);
          
        // Attach Drag Behavior for Moving Shapes
        if (drawMode === 'select' && onCustomPartsChange) {
            const dragMove = d3.drag<any, any>()
                .filter(event => !event.button)
                .on("start", function(event) {
                    let newSelection = [...selectedPartIds];
                    const isAlreadySelected = newSelection.includes(part.id);
                    
                    if (event.sourceEvent.shiftKey) {
                         if (!isAlreadySelected) {
                             newSelection.push(part.id);
                         }
                    } else {
                         if (!isAlreadySelected) {
                             newSelection = [part.id];
                         }
                    }
                    
                    setSelectedPartIds(newSelection);
                    setSelectedCurveIndex(null);

                    // Capture initial state for ALL parts in the selection
                    dragStartMap.clear();
                    const partsToMove = customParts.filter(p => newSelection.includes(p.id));
                    partsToMove.forEach(p => {
                         dragStartMap.set(p.id, {
                             points: p.isCircle ? undefined : p.points.map(pt => ({...pt})),
                             circleParams: p.isCircle ? {...p.circleParams} : undefined,
                             curves: p.curves ? JSON.parse(JSON.stringify(p.curves)) : undefined
                         });
                    });
                    
                    (this as any)._startPos = { x: event.x, y: event.y };
                })
                .on("drag", function(event) {
                     const startPos = (this as any)._startPos;
                     const dx = event.x - startPos.x;
                     const dy = event.y - startPos.y;
                     
                     const newParts = customParts.map(p => {
                         if (!dragStartMap.has(p.id)) return p;
                         
                         const initial = dragStartMap.get(p.id)!;
                         
                         if (p.isCircle && initial.circleParams) {
                             return { 
                                 ...p, 
                                 circleParams: { 
                                     ...initial.circleParams, 
                                     x: initial.circleParams.x + dx, 
                                     y: initial.circleParams.y + dy 
                                 } 
                             };
                         } else if (initial.points) {
                             const newPoints = initial.points.map((pt: Point) => ({
                                 x: pt.x + dx,
                                 y: pt.y + dy
                             }));
                             
                             const newCurves: Record<number, any> = {};
                             if (initial.curves) {
                                 Object.keys(initial.curves).forEach(k => {
                                     const idx = parseInt(k);
                                     newCurves[idx] = {
                                         controlPoint: {
                                             x: initial.curves[idx].controlPoint.x + dx,
                                             y: initial.curves[idx].controlPoint.y + dy
                                         }
                                     };
                                 });
                             }
                             return { ...p, points: newPoints, curves: newCurves };
                         }
                         return p;
                     });
                     
                     onCustomPartsChange(newParts);
                });
            el.call(dragMove);
        }
    });

    // 2. Render Vertex & Curve Handles (Edit Mode) - Only if SINGLE selection
    const isSingleSelection = selectedPartIds.length === 1;
    const primaryPartId = isSingleSelection ? selectedPartIds[0] : null;

    if (drawMode === 'select' && primaryPartId && onCustomPartsChange) {
        const part = customParts.find(p => p.id === primaryPartId);
        
        if (part && !part.isCircle) {
            // A. Vertex Handles
            const dragVertex = d3.drag<SVGCircleElement, {x: number, y: number, index: number}>()
                .on("drag", (event, d) => {
                    const newX = Math.round(event.x / 10) * 10;
                    const newY = Math.round(event.y / 10) * 10;
                    const newPoints = [...part.points];
                    newPoints[d.index] = { x: newX, y: newY };
                    onCustomPartsChange(customParts.map(p => 
                        p.id === part.id ? { ...p, points: newPoints } : p
                    ));
                });

            const handleData = part.points.map((p, i) => ({ x: p.x, y: p.y, index: i }));
            
            uiG.selectAll(".vertex-handle")
                .data(handleData)
                .enter().append("circle")
                .attr("class", "vertex-handle")
                .attr("cx", d => d.x).attr("cy", d => d.y)
                .attr("r", 5)
                .attr("fill", "white")
                .attr("stroke", "#3b82f6")
                .attr("stroke-width", 2)
                .attr("cursor", "pointer")
                .call(dragVertex);

            // B. Curve Handles
            if (part.curves) {
                const curveData: {x: number, y: number, index: number}[] = [];
                Object.entries(part.curves).forEach(([idx, data]) => {
                    curveData.push({ x: data.controlPoint.x, y: data.controlPoint.y, index: parseInt(idx) });
                });

                const dragCurve = d3.drag<SVGCircleElement, {x: number, y: number, index: number}>()
                    .on("start", (e, d) => {
                         setSelectedCurveIndex(d.index);
                    })
                    .on("drag", (event, d) => {
                        const newX = Math.round(event.x / 10) * 10;
                        const newY = Math.round(event.y / 10) * 10;
                        
                        const newCurves = { ...part.curves };
                        newCurves[d.index] = { controlPoint: { x: newX, y: newY } };
                        
                        onCustomPartsChange(customParts.map(p => 
                            p.id === part.id ? { ...p, curves: newCurves } : p
                        ));
                    });

                uiG.selectAll(".curve-handle")
                    .data(curveData)
                    .enter().append("circle")
                    .attr("class", "curve-handle")
                    .attr("cx", d => d.x).attr("cy", d => d.y)
                    .attr("r", 4)
                    .attr("fill", "#8b5cf6")
                    .attr("stroke", "white")
                    .attr("stroke-width", 2)
                    .attr("cursor", "crosshair")
                    .call(dragCurve)
                    .on("click", (e, d) => {
                        e.stopPropagation();
                        setSelectedCurveIndex(d.index);
                    });
                    
                if (selectedCurveIndex !== null && part.curves[selectedCurveIndex]) {
                     const selCp = part.curves[selectedCurveIndex].controlPoint;
                     uiG.append("circle")
                         .attr("cx", selCp.x).attr("cy", selCp.y).attr("r", 8)
                         .attr("fill", "none").attr("stroke", "#8b5cf6").attr("stroke-width", 2);
                }
            }

        } else if (part && part.isCircle && part.circleParams) {
            const { x, y, r } = part.circleParams;
            
            const dragCenter = d3.drag<SVGCircleElement, any>()
                 .on("drag", (event) => {
                     const newX = Math.round(event.x / 10) * 10;
                     const newY = Math.round(event.y / 10) * 10;
                     onCustomPartsChange(customParts.map(p => 
                         p.id === part.id ? { ...p, circleParams: { ...part.circleParams!, x: newX, y: newY } } : p
                     ));
                 });

            uiG.append("circle")
                .attr("cx", x).attr("cy", y).attr("r", 5)
                .attr("fill", "white").attr("stroke", "#3b82f6").attr("stroke-width", 2)
                .attr("cursor", "move")
                .call(dragCenter);

            const dragRadius = d3.drag<SVGCircleElement, any>()
                .on("drag", (event) => {
                    const dx = event.x - x;
                    const dy = event.y - y;
                    const newR = Math.sqrt(dx*dx + dy*dy);
                    const snappedR = Math.max(10, Math.round(newR / 5) * 5);
                    
                    onCustomPartsChange(customParts.map(p => 
                        p.id === part.id ? { ...p, circleParams: { ...part.circleParams!, r: snappedR } } : p
                    ));
                });

            uiG.append("circle")
                .attr("cx", x + r).attr("cy", y).attr("r", 5)
                .attr("fill", "white").attr("stroke", "#3b82f6").attr("stroke-width", 2)
                .attr("cursor", "ew-resize")
                .call(dragRadius);
        }
    }
};
