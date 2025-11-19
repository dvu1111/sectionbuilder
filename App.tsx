import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Stage } from './components/Stage';
import { ControlPanel } from './components/ControlPanel';
import { ResultsModal } from './components/ResultsModal';
import { ShapeType, Dimensions, CalculationResult, CustomPart, CustomPartType, Point } from './types';
import { initialDimensions, calculateProperties } from './utils/math';

const App: React.FC = () => {
  const [selectedShape, setSelectedShape] = useState<ShapeType>(ShapeType.I_SHAPE);
  const [dimensions, setDimensions] = useState<Dimensions>(initialDimensions(ShapeType.I_SHAPE));
  const [customParts, setCustomParts] = useState<CustomPart[]>([]);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Custom Shape Tool States
  const [drawMode, setDrawMode] = useState<'select' | 'polygon' | 'circle' | 'add_node' | 'bend'>('select');
  const [drawType, setDrawType] = useState<CustomPartType>('solid');
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [selectedCurveIndex, setSelectedCurveIndex] = useState<number | null>(null);

  // Reset dimensions when shape changes
  const handleShapeSelect = (shape: ShapeType) => {
    setSelectedShape(shape);
    if (shape !== ShapeType.CUSTOM) {
        setDimensions(initialDimensions(shape));
    }
    setResult(null);
    setShowResults(false);
    // Reset selection states
    setSelectedPartId(null);
    setSelectedCurveIndex(null);
    if (shape !== ShapeType.CUSTOM) {
      setDrawMode('select');
    }
  };

  const handleSolve = () => {
    const props = calculateProperties(selectedShape, dimensions, customParts);
    setResult({
      properties: props,
      timestamp: Date.now()
    });
    setShowResults(true);
  };

  // --- TRANSFORM HELPERS ---

  const getPartCenter = (part: CustomPart): Point => {
    if (part.isCircle && part.circleParams) {
      return { x: part.circleParams.x, y: part.circleParams.y };
    }
    // Polygon bounds center
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    part.points.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  };

  const handleRotate = (direction: 'cw' | 'ccw') => {
    if (!selectedPartId) return;
    const angle = direction === 'cw' ? 90 : -90;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    setCustomParts(parts => parts.map(part => {
      if (part.id !== selectedPartId) return part;
      
      const center = getPartCenter(part);
      
      if (part.isCircle && part.circleParams) {
        return part; 
      }

      // Rotate Polygon Points
      const newPoints = part.points.map(p => ({
        x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
        y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos
      }));
      
      // Rotate Curve Control Points
      let newCurves: Record<number, { controlPoint: Point }> | undefined = undefined;
      if (part.curves) {
          newCurves = {};
          for (const idx in part.curves) {
              const cp = part.curves[idx].controlPoint;
              newCurves[idx] = {
                  controlPoint: {
                      x: center.x + (cp.x - center.x) * cos - (cp.y - center.y) * sin,
                      y: center.y + (cp.x - center.x) * sin + (cp.y - center.y) * cos
                  }
              };
          }
      }

      return { ...part, points: newPoints, curves: newCurves };
    }));
  };

  const handleMirror = (axis: 'horizontal' | 'vertical') => {
    if (!selectedPartId) return;
    
    setCustomParts(parts => parts.map(part => {
      if (part.id !== selectedPartId) return part;
      
      const center = getPartCenter(part);

      if (part.isCircle) return part; // Mirroring a circle in place does nothing

      const mirrorPt = (p: Point) => ({
        x: axis === 'vertical' ? center.x - (p.x - center.x) : p.x, 
        y: axis === 'horizontal' ? center.y - (p.y - center.y) : p.y 
      });

      const newPoints = part.points.map(mirrorPt);

      // Mirror curves
      let newCurves: Record<number, { controlPoint: Point }> | undefined = undefined;
      if (part.curves) {
          newCurves = {};
          for (const idx in part.curves) {
              const cp = part.curves[idx].controlPoint;
              newCurves[idx] = { controlPoint: mirrorPt(cp) };
          }
      }

      return { ...part, points: newPoints, curves: newCurves };
    }));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar selectedShape={selectedShape} onSelectShape={handleShapeSelect} />

      <div className="flex-1 flex flex-col relative">
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 justify-between">
          <div className="text-sm text-gray-500">
             Unit System: <span className="font-semibold text-gray-800">Metric (mm)</span>
          </div>
        </div>

        <div className="flex-1 relative bg-slate-50">
          <Stage 
            shapeType={selectedShape} 
            dimensions={dimensions}
            customParts={customParts}
            onCustomPartsChange={setCustomParts}
            drawMode={drawMode}
            setDrawMode={setDrawMode}
            drawType={drawType}
            selectedPartId={selectedPartId}
            setSelectedPartId={setSelectedPartId}
            selectedCurveIndex={selectedCurveIndex}
            setSelectedCurveIndex={setSelectedCurveIndex}
          />
          
          <ResultsModal 
            isOpen={showResults} 
            onClose={() => setShowResults(false)} 
            data={result}
            shapeType={selectedShape}
            dimensions={dimensions}
          />
        </div>
      </div>

      <ControlPanel 
        shapeType={selectedShape}
        dimensions={dimensions}
        customParts={customParts}
        onCustomPartsChange={setCustomParts}
        onDimensionsChange={setDimensions}
        onSolve={handleSolve}
        onReset={() => {
             if (selectedShape === ShapeType.CUSTOM) {
                 setCustomParts([]);
                 setSelectedPartId(null);
                 setSelectedCurveIndex(null);
             } else {
                 setDimensions(initialDimensions(selectedShape));
             }
        }}
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        drawType={drawType}
        setDrawType={setDrawType}
        selectedPartId={selectedPartId}
        setSelectedPartId={setSelectedPartId}
        selectedCurveIndex={selectedCurveIndex}
        setSelectedCurveIndex={setSelectedCurveIndex}
        onRotate={handleRotate}
        onMirror={handleMirror}
      />
    </div>
  );
};

export default App;