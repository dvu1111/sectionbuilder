import React, { useMemo } from 'react';
import { Dimensions, ShapeType, CustomPart, CustomPartType } from '../types';
import { Play, Info, RotateCcw, PenTool, Circle, Undo, Trash2, BoxSelect, Square, MousePointer2, RotateCw, FlipHorizontal, FlipVertical, Plus, Spline } from 'lucide-react';
import { getShapeStrategy } from '../shapes';
import { getCircleFromThreePoints } from '../shapes/utils';

interface ControlPanelProps {
  shapeType: ShapeType;
  dimensions: Dimensions;
  customParts?: CustomPart[];
  onCustomPartsChange?: (parts: CustomPart[]) => void;
  onDimensionsChange: (d: Dimensions) => void;
  onSolve: () => void;
  onReset: () => void;
  drawMode: 'select' | 'polygon' | 'circle' | 'add_node' | 'bend';
  setDrawMode: (m: 'select' | 'polygon' | 'circle' | 'add_node' | 'bend') => void;
  drawType: CustomPartType;
  setDrawType: (t: CustomPartType) => void;
  selectedPartId: string | null;
  setSelectedPartId: (id: string | null) => void;
  selectedCurveIndex: number | null;
  setSelectedCurveIndex: (index: number | null) => void;
  onRotate: (dir: 'cw' | 'ccw') => void;
  onMirror: (axis: 'horizontal' | 'vertical') => void;
}

interface InputFieldProps {
  label: string;
  value: number | undefined;
  onChange: (val: string) => void;
  unit?: string;
}

const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, unit = 'mm' }) => (
  <div className="mb-3">
    <label className="block text-xs font-semibold text-gray-300 mb-1">{label}</label>
    <div className="flex rounded-md shadow-sm">
      <input
        type="number"
        value={value !== undefined ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 block w-full rounded-l-md border-gray-600 bg-white text-gray-900 border p-1.5 text-sm focus:ring-blue-500 focus:border-blue-500"
      />
      <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-600 bg-slate-700 text-gray-300 text-xs">
        {unit}
      </span>
    </div>
  </div>
);

export const ControlPanel: React.FC<ControlPanelProps> = ({
  shapeType,
  dimensions,
  customParts = [],
  onCustomPartsChange,
  onDimensionsChange,
  onSolve,
  onReset,
  drawMode,
  setDrawMode,
  drawType,
  setDrawType,
  selectedPartId,
  setSelectedPartId,
  selectedCurveIndex,
  setSelectedCurveIndex,
  onRotate,
  onMirror
}) => {
  
  const handleChange = (key: keyof Dimensions, value: string) => {
    const num = parseFloat(value);
    if (value === '') {
      onDimensionsChange({ ...dimensions, [key]: 0 });
    } else if (!isNaN(num)) {
      onDimensionsChange({ ...dimensions, [key]: num });
    }
  };

  const handleUndo = () => {
    if (onCustomPartsChange && customParts.length > 0) {
        onCustomPartsChange(customParts.slice(0, -1));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPartId && onCustomPartsChange) {
        onCustomPartsChange(customParts.filter(p => p.id !== selectedPartId));
    }
  }
  
  // Handle Radius Change for Curved Segments
  const getSelectedCurveRadius = () => {
      if (!selectedPartId || selectedCurveIndex === null) return undefined;
      const part = customParts.find(p => p.id === selectedPartId);
      if (!part || !part.curves || !part.curves[selectedCurveIndex]) return undefined;
      
      const cp = part.curves[selectedCurveIndex].controlPoint;
      const p1 = part.points[selectedCurveIndex];
      const p2 = part.points[(selectedCurveIndex + 1) % part.points.length];
      
      const circle = getCircleFromThreePoints(p1, cp, p2);
      return circle ? Math.round(circle.r * 10) / 10 : undefined;
  };

  const handleCurveRadiusChange = (newR: number) => {
      if (!selectedPartId || selectedCurveIndex === null || !onCustomPartsChange) return;
      const part = customParts.find(p => p.id === selectedPartId);
      if (!part || !part.curves || !part.curves[selectedCurveIndex]) return;

      const p1 = part.points[selectedCurveIndex];
      const p2 = part.points[(selectedCurveIndex + 1) % part.points.length];
      const oldCp = part.curves[selectedCurveIndex].controlPoint;
      
      // Re-calculate control point based on new Radius
      // 1. Find chord midpoint
      const mid = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
      // 2. Chord length half
      const dX = p2.x - p1.x;
      const dY = p2.y - p1.y;
      const L = Math.sqrt(dX*dX + dY*dY);
      
      if (newR < L/2) newR = L/2 + 0.1; // Clamp minimum radius
      
      // 3. Sagitta (height)
      const h = newR - Math.sqrt(newR*newR - (L/2)*(L/2));
      
      // 4. Determine direction. Using oldCp.
      // Vector perpendicular to chord
      const norm = { x: -dY, y: dX };
      const lenNorm = Math.sqrt(norm.x*norm.x + norm.y*norm.y);
      const unitNorm = { x: norm.x/lenNorm, y: norm.y/lenNorm };
      
      // Check side of oldCp relative to chord
      // Cross product z component of (p2-p1) x (oldCp - p1)
      const crossOld = (p2.x - p1.x) * (oldCp.y - p1.y) - (p2.y - p1.y) * (oldCp.x - p1.x);
      // If crossOld > 0, "left" side.
      
      // Does this simple sagitta calculation assume arc < 180? Yes. 
      // For dragging/radius editing, assuming minor arc usually. 
      // However, if user dragged to major arc, this might flip it.
      // Let's just project along the perpendicular from mid towards oldCp direction.
      
      const vecMidToOld = { x: oldCp.x - mid.x, y: oldCp.y - mid.y };
      const dot = vecMidToOld.x * unitNorm.x + vecMidToOld.y * unitNorm.y;
      
      const sign = dot >= 0 ? 1 : -1;
      
      const newCp = {
          x: mid.x + unitNorm.x * h * sign,
          y: mid.y + unitNorm.y * h * sign
      };
      
      const newCurves = { ...part.curves };
      newCurves[selectedCurveIndex] = { controlPoint: newCp };
      
      onCustomPartsChange(customParts.map(p => p.id === part.id ? { ...p, curves: newCurves } : p));
  };

  // Get inputs from strategy
  const currentInputs = useMemo(() => getShapeStrategy(shapeType).inputs, [shapeType]);

  const renderCustomTools = () => (
    <div className="space-y-4">
        <div className="text-xs text-gray-400 bg-slate-800 p-2 rounded border border-slate-700">
            {drawMode === 'select' 
                ? selectedPartId ? "Drag corners or purple curve handles. Edit radius below." : "Click a shape to edit."
                : drawMode === 'add_node'
                    ? "Click on a line segment to add a new vertex."
                : drawMode === 'bend'
                    ? "Click a straight segment to convert to curve. Click again to straighten."
                : drawMode === 'polygon' 
                    ? "Click to add points. Double-click or click start to close." 
                    : "Click center, then click again to define radius."}
        </div>

        <div>
            <label className="block text-xs font-bold text-gray-300 mb-2">Tools</label>
            <div className="grid grid-cols-5 gap-2">
                <button
                    onClick={() => setDrawMode('select')}
                    className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded border text-xs font-medium transition-all ${
                        drawMode === 'select' 
                            ? 'bg-blue-600 border-blue-500 text-white shadow' 
                            : 'bg-slate-800 border-slate-600 text-gray-400 hover:bg-slate-700'
                    }`}
                    title="Select and Transform"
                >
                    <MousePointer2 size={16} /> <span className="scale-[0.8]">Select</span>
                </button>
                <button
                    onClick={() => setDrawMode('polygon')}
                    className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded border text-xs font-medium transition-all ${
                        drawMode === 'polygon' 
                            ? 'bg-blue-600 border-blue-500 text-white shadow' 
                            : 'bg-slate-800 border-slate-600 text-gray-400 hover:bg-slate-700'
                    }`}
                    title="Draw Polygon"
                >
                    <PenTool size={16} /> <span className="scale-[0.8]">Poly</span>
                </button>
                <button
                    onClick={() => setDrawMode('circle')}
                    className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded border text-xs font-medium transition-all ${
                        drawMode === 'circle' 
                            ? 'bg-blue-600 border-blue-500 text-white shadow' 
                            : 'bg-slate-800 border-slate-600 text-gray-400 hover:bg-slate-700'
                    }`}
                    title="Draw Circle"
                >
                    <Circle size={16} /> <span className="scale-[0.8]">Circle</span>
                </button>
                <button
                    onClick={() => setDrawMode('add_node')}
                    className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded border text-xs font-medium transition-all ${
                        drawMode === 'add_node' 
                            ? 'bg-blue-600 border-blue-500 text-white shadow' 
                            : 'bg-slate-800 border-slate-600 text-gray-400 hover:bg-slate-700'
                    }`}
                    title="Add Node to Segment"
                >
                    <Plus size={16} /> <span className="scale-[0.8]">Add</span>
                </button>
                <button
                    onClick={() => setDrawMode('bend')}
                    className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded border text-xs font-medium transition-all ${
                        drawMode === 'bend' 
                            ? 'bg-blue-600 border-blue-500 text-white shadow' 
                            : 'bg-slate-800 border-slate-600 text-gray-400 hover:bg-slate-700'
                    }`}
                    title="Bend Segment"
                >
                    <Spline size={16} /> <span className="scale-[0.8]">Bend</span>
                </button>
            </div>
        </div>

        {drawMode === 'select' && selectedPartId && (
          <div className="bg-slate-800 p-2 rounded border border-slate-700 animate-in fade-in">
             <label className="block text-xs font-bold text-gray-300 mb-2">Transform Selected</label>
             <div className="grid grid-cols-4 gap-2 mb-2">
                 <button onClick={() => onRotate('ccw')} title="Rotate -90°" className="p-1 bg-slate-700 rounded hover:bg-slate-600 flex justify-center text-white"><RotateCcw size={16} /></button>
                 <button onClick={() => onRotate('cw')} title="Rotate +90°" className="p-1 bg-slate-700 rounded hover:bg-slate-600 flex justify-center text-white"><RotateCw size={16} /></button>
                 <button onClick={() => onMirror('horizontal')} title="Flip Horizontal" className="p-1 bg-slate-700 rounded hover:bg-slate-600 flex justify-center text-white"><FlipHorizontal size={16} /></button>
                 <button onClick={() => onMirror('vertical')} title="Flip Vertical" className="p-1 bg-slate-700 rounded hover:bg-slate-600 flex justify-center text-white"><FlipVertical size={16} /></button>
             </div>
             
             {selectedCurveIndex !== null && (
                 <div className="mb-2 border-t border-slate-600 pt-2">
                     <label className="block text-xs font-bold text-purple-300 mb-1">Curve Radius</label>
                     <div className="flex rounded-md shadow-sm">
                      <input
                        type="number"
                        value={getSelectedCurveRadius() || ''}
                        onChange={(e) => handleCurveRadiusChange(parseFloat(e.target.value))}
                        className="flex-1 block w-full rounded-l-md border-gray-600 bg-white text-gray-900 border p-1.5 text-xs focus:ring-purple-500 focus:border-purple-500"
                      />
                      <span className="inline-flex items-center px-2 rounded-r-md border border-l-0 border-gray-600 bg-slate-700 text-gray-300 text-xs">
                        mm
                      </span>
                    </div>
                 </div>
             )}

             <button onClick={handleDeleteSelected} className="w-full py-1 bg-red-900/50 hover:bg-red-900 text-red-200 text-xs rounded flex items-center justify-center gap-2 mt-2">
               <Trash2 size={14}/> Delete Shape
             </button>
          </div>
        )}

        {drawMode !== 'select' && drawMode !== 'add_node' && drawMode !== 'bend' && (
          <div className="animate-in fade-in">
              <label className="block text-xs font-bold text-gray-300 mb-2">Operation Type</label>
              <div className="grid grid-cols-2 gap-2">
                  <button
                      onClick={() => setDrawType('solid')}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded border text-xs font-medium transition-all ${
                          drawType === 'solid' 
                              ? 'bg-green-600 border-green-500 text-white shadow' 
                              : 'bg-slate-800 border-slate-600 text-gray-400 hover:bg-slate-700'
                      }`}
                  >
                      <Square size={14} fill="currentColor" className="opacity-50"/> Solid
                  </button>
                  <button
                      onClick={() => setDrawType('hole')}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded border text-xs font-medium transition-all ${
                          drawType === 'hole' 
                              ? 'bg-red-600 border-red-500 text-white shadow' 
                              : 'bg-slate-800 border-slate-600 text-gray-400 hover:bg-slate-700'
                      }`}
                  >
                      <BoxSelect size={14} /> Hole
                  </button>
              </div>
          </div>
        )}

        <div className="border-t border-slate-700 pt-4">
            <h3 className="text-sm font-bold mb-2 text-gray-300">History ({customParts.length})</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                {customParts.map((part, i) => (
                    <div 
                      key={part.id} 
                      onClick={() => {
                        setDrawMode('select');
                        setSelectedPartId(part.id);
                      }}
                      className={`flex justify-between items-center text-xs p-2 rounded border cursor-pointer transition-colors ${
                        part.id === selectedPartId ? 'bg-blue-900/50 border-blue-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                        <span className={`flex items-center gap-2 ${part.type === 'solid' ? 'text-green-400' : 'text-red-400'}`}>
                            {part.type === 'solid' ? <Square size={10} fill="currentColor"/> : <BoxSelect size={10}/>}
                            {part.isCircle ? 'Circle' : 'Polygon'}
                        </span>
                        <span className="text-gray-500">#{i+1}</span>
                    </div>
                ))}
                {customParts.length === 0 && <span className="text-xs text-gray-500 italic">No parts drawn.</span>}
            </div>
        </div>

        <div className="flex gap-2 mt-2">
            <button 
                onClick={handleUndo}
                disabled={customParts.length === 0}
                className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs py-2 rounded flex items-center justify-center gap-1 transition-colors"
            >
                <Undo size={14}/> Undo
            </button>
             <button 
                onClick={onReset}
                className="flex-1 bg-red-900/50 hover:bg-red-900 disabled:opacity-50 text-red-200 text-xs py-2 rounded flex items-center justify-center gap-1 transition-colors"
            >
                <Trash2 size={14}/> Clear All
            </button>
        </div>
    </div>
  );

  return (
    <div className="w-80 bg-slate-900 border-l border-gray-700 flex flex-col h-full text-white">
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <h2 className="font-bold text-md">{shapeType}</h2>
        <button onClick={onReset} className="text-gray-400 hover:text-white transition-colors" title="Reset Parameters">
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="p-4 bg-slate-800/50">
        <button
          onClick={onSolve}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]"
        >
          <Play size={18} fill="currentColor" />
          SOLVE
        </button>
      </div>

      <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs font-bold text-blue-400 uppercase tracking-wider">
        {shapeType === ShapeType.CUSTOM ? 'Drawing Tools' : 'Dimensions'}
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-900 custom-scrollbar">
        {shapeType === ShapeType.CUSTOM ? (
            renderCustomTools()
        ) : (
            currentInputs?.map(field => (
              <InputField
                key={field.key}
                label={field.label}
                value={dimensions[field.key]}
                onChange={(v) => handleChange(field.key, v)}
                unit={field.unit}
              />
            ))
        )}
      </div>

       <div className="p-3 bg-slate-800 text-xs text-gray-400 border-t border-slate-700">
          <div className="flex gap-2 items-start">
             <Info size={14} className="mt-0.5 flex-shrink-0" />
             <span>{shapeType === ShapeType.CUSTOM ? 'Use the tool panel to switch modes.' : 'Input values in millimeters.'}</span>
          </div>
       </div>
    </div>
  );
};