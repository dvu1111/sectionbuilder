
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Dimensions, ShapeType, CustomPart, Point, CustomPartType, DragStartData } from '../types';
import { getShapeStrategy } from '../shapes';
import { findClosestPointOnSegment, calculateCentroidFromParts } from '../shapes/utils';
import { setupGrid, setupZoom } from './stage-logic/canvasSetup';
import { renderCustomShapes } from './stage-logic/renderCustomShapes';
import { renderPreviews } from './stage-logic/renderPreviews';

interface StageProps {
  shapeType: ShapeType;
  dimensions: Dimensions;
  customParts?: CustomPart[];
  onCustomPartsChange?: (parts: CustomPart[]) => void;
  drawMode: 'select' | 'polygon' | 'circle' | 'add_node' | 'bend';
  setDrawMode: (mode: 'select' | 'polygon' | 'circle' | 'add_node' | 'bend') => void;
  drawType: CustomPartType;
  selectedPartIds: string[];
  setSelectedPartIds: (ids: string[]) => void;
  selectedCurveIndex: number | null;
  setSelectedCurveIndex: (index: number | null) => void;
  rotation?: number;
}

export const Stage: React.FC<StageProps> = ({ 
  shapeType, 
  dimensions, 
  customParts = [], 
  onCustomPartsChange,
  drawMode,
  setDrawMode,
  drawType,
  selectedPartIds,
  setSelectedPartIds,
  selectedCurveIndex,
  setSelectedCurveIndex,
  rotation = 0
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const rootGRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity.translate(0,0).scale(1));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartMap = useRef<Map<string, DragStartData>>(new Map());
  
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
    setupZoom(d3.select(svgRef.current), rootGRef.current, transformRef, shapeType);
  }, [shapeType]);

  // 3. KEYBOARD HANDLERS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCurrentPoints([]);
        setCircleStart(null);
        setSelectedPartIds([]);
        setSelectedCurveIndex(null);
        setPreviewNode(null);
      }
      // Select All
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (shapeType === ShapeType.CUSTOM) {
            e.preventDefault();
            setSelectedPartIds(customParts.map(p => p.id));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedPartIds, setSelectedCurveIndex, customParts, shapeType]);

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
    setupGrid(gridG);

    // --- STRATEGY PATTERN: DELEGATE DRAWING (Standard Shapes) ---
    const strategy = getShapeStrategy(shapeType);
    if (strategy.draw && shapeType !== ShapeType.CUSTOM) {
       // For rotation to be intuitive, we must pivot around the Centroid, not the bounding box center.
       // 1. Calculate the centroid of the unrotated shape in drawing coordinates
       let pivotX = 0;
       let pivotY = 0;
       if (strategy.getCustomParts) {
           const parts = strategy.getCustomParts(dimensions);
           const c = calculateCentroidFromParts(parts);
           pivotX = c.x;
           pivotY = c.y;
       }

       // 2. Apply Rotation around this pivot point
       // SVG Rotate (deg, cx, cy) works exactly this way
       const rotatedG = shapeG.append("g")
           .attr("transform", `rotate(${-rotation}, ${pivotX}, ${pivotY})`); 
       
       const rotatedUIG = uiG.append("g")
           .attr("transform", `rotate(${-rotation}, ${pivotX}, ${pivotY})`);

       strategy.draw(rotatedG, rotatedUIG, dimensions);
    }

    // --- CUSTOM DRAWING RENDERER ---
    if (shapeType === ShapeType.CUSTOM) {
        renderCustomShapes({
            shapeG,
            uiG,
            customParts,
            selectedPartIds,
            drawMode,
            dragStartMap: dragStartMap.current,
            onCustomPartsChange,
            setSelectedPartIds,
            setSelectedCurveIndex,
            selectedCurveIndex
        });

        renderPreviews({
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
            rotation: 0
        });
    } else {
        // Render Centroid/Previews for standard shapes too
         renderPreviews({
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
            rotation
        });
    }

  }, [dimensions, shapeType, customParts, currentPoints, mousePos, circleStart, drawMode, selectedPartIds, previewNode, previewBend, selectedCurveIndex, rotation]);

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
    const cursor = { x: gridX, y: gridY };

    setMousePos({ x: snappedX, y: snappedY });

    if (drawMode === 'add_node' || drawMode === 'bend') {
        let bestNode = null;
        let bestSegment = null;
        let closestDist = Infinity;
        
        customParts.forEach(part => {
            if (part.isCircle) return;

            const pts = part.points;
            for (let i = 0; i < pts.length; i++) {
                const p1 = pts[i];
                const p2 = pts[(i + 1) % pts.length];
                
                const { projX, projY, dist } = findClosestPointOnSegment(p1, p2, cursor);
                
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
                setSelectedPartIds([targetPart.id]);
                setSelectedCurveIndex(idx);
                setDrawMode('select');
            }
        }
        return;
    }

    if (drawMode === 'select') {
        setSelectedPartIds([]);
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
          ? "Shift+Click to Multi-Select • Ctrl+A to Select All • Wheel to Zoom"
          : "Scroll to Zoom • Drag to Pan"
        }
      </div>
    </div>
  );
};
