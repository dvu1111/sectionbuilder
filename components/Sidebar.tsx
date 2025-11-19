import React from 'react';
import { SHAPES } from '../constants';
import { ShapeType } from '../types';
import { Square, Circle, BoxSelect, Type, Triangle, PenTool, PanelTop, PanelLeft, Baseline, Magnet } from 'lucide-react';

interface SidebarProps {
  selectedShape: ShapeType;
  onSelectShape: (s: ShapeType) => void;
}

const IconMap: Record<string, React.ElementType> = {
  Square,
  Circle,
  BoxSelect,
  Type,
  Triangle,
  PenTool,
  PanelTop,
  PanelLeft,
  Baseline,
  Magnet
};

export const Sidebar: React.FC<SidebarProps> = ({ selectedShape, onSelectShape }) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
      <div className="p-4 border-b border-gray-200 bg-slate-800 text-white">
        <h1 className="font-bold text-lg flex items-center gap-2">
          <span className="text-blue-400">◆</span> SectionBuilder
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 pl-2 mt-2">
          Shape Templates
        </div>
        <div className="space-y-1">
          {SHAPES.map((shape) => {
            const Icon = IconMap[shape.icon] || Square;
            return (
              <button
                key={shape.id}
                onClick={() => onSelectShape(shape.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  selectedShape === shape.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {shape.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8 px-4">
          <div className="bg-blue-50 p-3 rounded border border-blue-100 text-xs text-blue-800">
            <strong>Pro Tip:</strong> Select a shape to begin analysis. All dimensions are in mm.
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
         v2.4.0 &copy; 2024
      </div>
    </div>
  );
};