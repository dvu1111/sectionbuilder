import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Dimensions, ShapeType, CustomPart, Point, CustomPartType } from '../types';
import { calculateProperties } from '../utils/math';
import { getShapeStrategy } from '../shapes';
import { getCircleFromThreePoints } from '../shapes/utils';

interface StageProps {
  shapeType: ShapeType;
  dimensions: Dimensions;
  customParts?: CustomPart[];
  onCustomPartsChange?: (parts: CustomPart[]) => void;
  drawMode: 'select' | 'polygon' | 'circle' | 'add_node' | 'bend';
  setDrawMode: (mode: 'select' | 'polygon' | 'circle' | 'add_node' | 'bend') => void;
  drawType: CustomPartType;
  selectedPartId: string | null;
  setSelectedPartId: (id: string | null) => void;
  selectedCurveIndex: number | null;
  setSelectedCurveIndex: (index: number | null) => void;
}

export const Stage: React.FC<StageProps> = ({ 
  shapeType, 
  dimensions, 
  customParts = [], 
  onCustomPartsChange,
  drawMode,
  setDrawMode,
  drawType,
  selectedPartId,
  setSelectedPartId,
  selectedCurveIndex,
  setSelectedCurveIndex
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const rootGRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity.translate(0,0).scale(1));
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [circleStart, setCircleStart] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [previewNode, setPreviewNode] = useState<{x: number, y: number, insertIndex: number, partId: string} | null>(null);
  const [previewBend, setPreviewBend] = useState<{partId: string, segmentIndex: number} | null>(null);

  useEffect(() => {
    setCurrentPoints([]);
    setCircleStart(null);
    setPreviewNode(null);
    setPreviewBend(null);
  }, [drawMode, shapeType]);

  // 1. INITIALIZATION EFFECT
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");
    rootGRef.current = g;
    
    g.append("g").attr("class", "grid-layer").attr("opacity", 0.2);
    g.append("g").attr("class", "shape-layer");
    g.append("g").attr("class", "ui-layer");

    // Delay initial zoom slightly to ensure container has size, 
    // though absolute positioning should fix the race condition mostly.
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && rect.width && rect.height) {
        const t = d3.zoomIdentity.translate(rect.width/2, rect.height/2).scale(0.8);
        transformRef.current = t;
        g.attr("transform", t.toString());
    }
  }, []);

  // 2. ZOOM BEHAVIOR EFFECT
  useEffect(() => {
    if (!svgRef.current || !rootGRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = rootGRef.current;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        transformRef.current = event.transform;
        g.attr("transform", event.transform.toString());
      });

    if (shapeType === ShapeType.CUSTOM) {
        zoom.filter((event) => {
            return event.type === 'wheel' || event.button === 1 || event.ctrlKey || event.metaKey;
        });
    } else {
        zoom.filter(() => true);
    }

    svg.call(zoom).on("dblclick.zoom", null);
    // Re-apply current transform to ensure sync
    svg.call(zoom.transform, transformRef.current);

  }, [shapeType]);

  // 3. KEYBOARD HANDLERS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCurrentPoints([]);
        setCircleStart(null);
        setSelectedPartId(null);
        setSelectedCurveIndex(null);
        setPreviewNode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedPartId, setSelectedCurveIndex]);

  // 4. RENDERING EFFECT
  useEffect(() => {
    if (!rootGRef.current) return;
    const g = rootGRef.current;
    
    const gridG = g.select<SVGGElement>(".grid-layer");
    const shapeG = g.select<SVGGElement>(".shape-layer");
    const uiG = g.select<SVGGElement>(".ui-layer");

    // Clear contents
    gridG.selectAll("*").remove();
    shapeG.selectAll("*").remove();
    uiG.selectAll("*").remove();

    // --- DRAW GRID ---
    const gridSize = 50;
    const gridRange = 5000;
    
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
    
    gridG.append("line").attr("x1", -gridRange).attr("y1", 0).attr("x2", gridRange).attr("y2", 0).attr("stroke", "#666").attr("stroke-width", 2);
    gridG.append("line").attr("x1", 0).attr("y1", -gridRange).attr("x2", 0).attr("y2", gridRange).attr("stroke", "#666").attr("stroke-width", 2);

    // --- STRATEGY PATTERN: DELEGATE DRAWING ---
    const strategy = getShapeStrategy(shapeType);

    if (strategy.draw && shapeType !== ShapeType.CUSTOM) {
       // Standard shapes use the draw method from strategy
       strategy.draw(shapeG, uiG, dimensions);
    }

    // --- CUSTOM DRAWING RENDERER (Handles Interaction) ---
    if (shapeType === ShapeType.CUSTOM) {
        const fillStyle = "#94a3b8"; 
        const strokeStyle = "#1e293b";
        
        // 1. Render Completed Parts
        customParts.forEach(part => {
            const isSelected = part.id === selectedPartId;
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
              
            el.on("click", (e) => {
                  if (drawMode === 'select') {
                      e.stopPropagation();
                      setSelectedPartId(part.id);
                      setSelectedCurveIndex(null);
                  }
            });

            if (drawMode === 'select' && onCustomPartsChange) {
                const dragMove = d3.drag<any, any>()
                    .filter(event => !event.ctrlKey && !event.button)
                    .on("start", function(event) {
                        (this as any)._startPos = { x: event.x, y: event.y };
                        (this as any)._initialPoints = part.isCircle ? null : part.points.map(p => ({...p}));
                        (this as any)._initialCircle = part.isCircle ? {...part.circleParams} : null;
                        (this as any)._initialCurves = part.curves ? JSON.parse(JSON.stringify(part.curves)) : {};
                        setSelectedPartId(part.id);
                        setSelectedCurveIndex(null);
                    })
                    .on("drag", function(event) {
                         const startPos = (this as any)._startPos;
                         const initialPoints = (this as any)._initialPoints;
                         const initialCircle = (this as any)._initialCircle;
                         const initialCurves = (this as any)._initialCurves;
                         
                         let dx = event.x - startPos.x;
                         let dy = event.y - startPos.y;
                         
                         if (initialCircle) {
                             const newCircle = { ...initialCircle, x: initialCircle.x + dx, y: initialCircle.y + dy };
                             onCustomPartsChange(customParts.map(p => p.id === part.id ? { ...p, circleParams: newCircle } : p));
                         } else if (initialPoints) {
                             const newPoints = initialPoints.map((p: Point) => ({
                                 x: p.x + dx,
                                 y: p.y + dy
                             }));
                             
                             const newCurves: Record<number, any> = {};
                             if (initialCurves) {
                                 Object.keys(initialCurves).forEach(k => {
                                     const idx = parseInt(k);
                                     newCurves[idx] = {
                                         controlPoint: {
                                             x: initialCurves[idx].controlPoint.x + dx,
                                             y: initialCurves[idx].controlPoint.y + dy
                                         }
                                     };
                                 });
                             }

                             onCustomPartsChange(customParts.map(p => p.id === part.id ? { ...p, points: newPoints, curves: newCurves } : p));
                         }
                    });
                el.call(dragMove);
            }
        });

        // 2. Vertex & Curve Handles (Edit Mode)
        if (drawMode === 'select' && selectedPartId && onCustomPartsChange) {
            const part = customParts.find(p => p.id === selectedPartId);
            
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

        // 3. Previews
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
            const part = customParts.find(p => p.id === previewBend.partId);
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

        // 4. Render Active Drawing (Ghost)
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
    }

    // --- CENTROID MARKER ---
    let cx = 0;
    let cy = 0;
    let showMarker = true;

    if (shapeType === ShapeType.CUSTOM) {
        if (customParts.length > 0) {
             const props = calculateProperties(ShapeType.CUSTOM, dimensions, customParts);
             cx = props.centroid.z; 
             cy = props.centroid.y;
        } else {
            showMarker = false;
        }
    } else {
        const props = calculateProperties(shapeType, dimensions);
        let maxW = Math.max(dimensions.width, dimensions.widthBottom || 0);
        let maxH = dimensions.depth;

        // FIX: Calculate correct bounding box for Circular shape to center centroid
        if (shapeType === ShapeType.CIRCULAR) {
            const r = dimensions.radius || 0;
            maxW = r * 2;
            maxH = r * 2;
        }

        cx = props.centroid.z - maxW/2;
        cy = -(props.centroid.y - maxH/2);
    }
    
    if (showMarker) {
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

  }, [dimensions, shapeType, customParts, currentPoints, mousePos, circleStart, drawMode, selectedPartId, previewNode, previewBend, selectedCurveIndex]);

  // --- INTERACTION HANDLERS ---
  const handleMouseMove = (e: React.MouseEvent) => {
    if (shapeType !== ShapeType.CUSTOM || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    const t = transformRef.current;
    const gridX = (rawX - t.x) / t.k;
    const gridY = (rawY - t.y) / t.k;

    const snap = 10;
    const snappedX = Math.round(gridX / snap) * snap;
    const snappedY = Math.round(gridY / snap) * snap;

    setMousePos({ x: snappedX, y: snappedY });

    if (drawMode === 'add_node' || drawMode === 'bend') {
        let bestNode = null;
        let bestSegment = null;
        let closestDist = Infinity;
        
        customParts.forEach(part => {
            if (part.isCircle) return;
            if (selectedPartId && part.id !== selectedPartId) return; 

            const pts = part.points;
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                
                const atob = { x: p2.x - p1.x, y: p2.y - p1.y };
                const atop = { x: gridX - p1.x, y: gridY - p1.y };
                const len2 = atob.x * atob.x + atob.y * atob.y;
                let tVal = 0;
                if (len2 !== 0) {
                    tVal = (atop.x * atob.x + atop.y * atob.y) / len2;
                }
                tVal = Math.max(0, Math.min(1, tVal));
                
                const projX = p1.x + tVal * atob.x;
                const projY = p1.y + tVal * atob.y;
                
                const dist = Math.sqrt((gridX - projX)**2 + (gridY - projY)**2);
                
                if (dist < 15 && dist < closestDist) {
                    closestDist = dist;
                    if (drawMode === 'add_node') {
                         bestNode = {
                            x: projX,
                            y: projY,
                            insertIndex: i + 1,
                            partId: part.id
                        };
                    } else {
                         bestSegment = {
                             partId: part.id,
                             segmentIndex: i
                         };
                    }
                }
            }
        });
        setPreviewNode(bestNode);
        setPreviewBend(bestSegment);
    } else {
        setPreviewNode(null);
        setPreviewBend(null);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (shapeType !== ShapeType.CUSTOM || !mousePos) return;

    if (drawMode === 'add_node' && previewNode && onCustomPartsChange) {
        const targetPart = customParts.find(p => p.id === previewNode.partId);
        if (targetPart) {
            const newPoints = [...targetPart.points];
            newPoints.splice(previewNode.insertIndex, 0, { x: previewNode.x, y: previewNode.y });
            
            const newCurves: Record<number, any> = {};
            if (targetPart.curves) {
                Object.keys(targetPart.curves).forEach(k => {
                    const idx = parseInt(k);
                    if (idx < previewNode.insertIndex - 1) {
                        newCurves[idx] = targetPart.curves![idx];
                    } else {
                        newCurves[idx + 1] = targetPart.curves![idx];
                    }
                });
            }

            const newParts = customParts.map(p => p.id === previewNode.partId ? { ...p, points: newPoints, curves: newCurves } : p);
            onCustomPartsChange(newParts);
            setPreviewNode(null);
        }
        return;
    }

    if (drawMode === 'bend' && previewBend && onCustomPartsChange) {
        const targetPart = customParts.find(p => p.id === previewBend.partId);
        if (targetPart && !targetPart.isCircle) {
            const idx = previewBend.segmentIndex;
            if (targetPart.curves && targetPart.curves[idx]) {
                const newCurves = { ...targetPart.curves };
                delete newCurves[idx];
                onCustomPartsChange(customParts.map(p => p.id === targetPart.id ? { ...p, curves: newCurves } : p));
            } else {
                const p1 = targetPart.points[idx];
                const p2 = targetPart.points[(idx + 1) % targetPart.points.length];
                const mid = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
                const normal = { x: -(p2.y - p1.y), y: (p2.x - p1.x) };
                const len = Math.sqrt(normal.x**2 + normal.y**2);
                const offset = 30;
                const cp = { 
                    x: mid.x + (normal.x / len) * offset,
                    y: mid.y + (normal.y / len) * offset
                };
                
                const newCurves = { ...(targetPart.curves || {}) };
                newCurves[idx] = { controlPoint: cp };
                
                onCustomPartsChange(customParts.map(p => p.id === targetPart.id ? { ...p, curves: newCurves } : p));
                setSelectedPartId(targetPart.id);
                setSelectedCurveIndex(idx);
                setDrawMode('select');
            }
        }
        return;
    }

    if (drawMode === 'select') {
        setSelectedPartId(null);
        setSelectedCurveIndex(null);
        return;
    }

    if (!onCustomPartsChange) return;

    const isHole = drawType === 'hole' || e.altKey;
    const isCircleMode = drawMode === 'circle' || e.shiftKey; 

    if (isCircleMode) {
        if (!circleStart) {
            setCircleStart(mousePos);
        } else {
            const r = Math.sqrt(Math.pow(mousePos.x - circleStart.x, 2) + Math.pow(mousePos.y - circleStart.y, 2));
            const newPart: CustomPart = {
                id: Date.now().toString(),
                type: isHole ? 'hole' : 'solid',
                points: [],
                isCircle: true,
                circleParams: { x: circleStart.x, y: circleStart.y, r }
            };
            onCustomPartsChange([...customParts, newPart]);
            setCircleStart(null);
        }
        return;
    }

    if (currentPoints.length > 2) {
        const start = currentPoints[0];
        const dist = Math.sqrt(Math.pow(mousePos.x - start.x, 2) + Math.pow(mousePos.y - start.y, 2));
        if (dist < 15) {
            const newPart: CustomPart = {
                id: Date.now().toString(),
                type: isHole ? 'hole' : 'solid',
                points: [...currentPoints]
            };
            onCustomPartsChange([...customParts, newPart]);
            setCurrentPoints([]);
            return;
        }
    }

    setCurrentPoints([...currentPoints, mousePos]);
  };

  const handleDoubleClick = () => {
      if (shapeType === ShapeType.CUSTOM && drawMode === 'polygon' && currentPoints.length > 2 && onCustomPartsChange) {
        const isHole = drawType === 'hole';
        const newPart: CustomPart = {
            id: Date.now().toString(),
            type: isHole ? 'hole' : 'solid',
            points: [...currentPoints]
        };
        onCustomPartsChange([...customParts, newPart]);
        setCurrentPoints([]);
      }
  };

  return (
    <div 
        ref={containerRef} 
        className={`absolute inset-0 w-full h-full bg-white overflow-hidden ${shapeType === ShapeType.CUSTOM ? (drawMode === 'select' ? 'cursor-default' : 'cursor-crosshair') : 'cursor-move'}`}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
    >
      <svg ref={svgRef} className="w-full h-full block" />
      <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur p-2 rounded shadow text-xs text-gray-500 pointer-events-none select-none">
        {shapeType === ShapeType.CUSTOM 
          ? "Use Control Panel to Switch Modes • Wheel/Middle-Click to Pan/Zoom • Esc to Cancel"
          : "Scroll to Zoom • Drag to Pan"
        }
      </div>
    </div>
  );
};