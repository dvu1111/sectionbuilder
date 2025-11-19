
import React from 'react';
import { CalculationResult, ShapeType, Dimensions } from '../types';
import { X } from 'lucide-react';

interface ResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CalculationResult | null;
  shapeType: ShapeType;
  dimensions: Dimensions;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({ isOpen, onClose, data, shapeType, dimensions }) => {

  if (!isOpen || !data) return null;

  const { properties } = data;
  
  // Helper for row formatting
  const Row = ({ label, value, unit, info }: { label: string, value: number, unit: string, info?: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0 hover:bg-slate-700/50 px-2 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-slate-300 text-sm font-medium">{label}</span>
        {info && <span className="text-xs text-slate-500 bg-slate-800 px-1 rounded cursor-help" title={info}>?</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white font-mono text-sm">{value.toExponential(3)}</span>
        <span className="text-xs text-slate-400 w-8 text-right">{unit}</span>
      </div>
    </div>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <h3 className="text-blue-400 text-xs uppercase font-bold tracking-wider mt-4 mb-2 pl-2">{title}</h3>
  );

  return (
    <div className="absolute inset-0 z-50 flex justify-end pointer-events-none">
      <div className="pointer-events-auto w-[400px] bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-700 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-4 bg-slate-800 flex justify-between items-center border-b border-slate-700">
          <h2 className="text-white font-bold text-lg">Analysis Results</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          
          {/* Geometric Properties */}
          <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
            <SectionHeader title="Geometric Properties" />
            <Row label="Area (A)" value={properties.area} unit="mm²" />
            <Row label="Centroid (Cy)" value={properties.centroid.y} unit="mm" />
            <Row label="Centroid (Cz)" value={properties.centroid.z} unit="mm" />
          
            <SectionHeader title="Moment of Inertia" />
            <Row label="Iz" value={properties.momentInertia.Iz} unit="mm⁴" info="About horizontal centroidal axis" />
            <Row label="Iy" value={properties.momentInertia.Iy} unit="mm⁴" info="About vertical centroidal axis" />
            <Row label="Izy" value={properties.momentInertia.Izy} unit="mm⁴" info="Product of inertia" />

            <SectionHeader title="Principal Properties" />
            <Row label="I₁ (Max)" value={properties.principalMoments.I1} unit="mm⁴" />
            <Row label="I₂ (Min)" value={properties.principalMoments.I2} unit="mm⁴" />
            <Row label="Angle (α)" value={properties.principalMoments.angle} unit="deg" info="Angle from Z-axis to I₁ axis" />
            
            <SectionHeader title="Elastic Section Moduli" />
            <Row label="Szt (Top)" value={properties.sectionModulus.Szt} unit="mm³" />
            <Row label="Szb (Bot)" value={properties.sectionModulus.Szb} unit="mm³" />
            <Row label="Syt (Right)" value={properties.sectionModulus.Syt} unit="mm³" />
            
            <SectionHeader title="Plastic Section Moduli" />
            <Row label="Zz" value={properties.plasticModulus.Zz} unit="mm³" />
            <Row label="Zy" value={properties.plasticModulus.Zy} unit="mm³" />

            <SectionHeader title="Radius of Gyration" />
            <Row label="rz" value={properties.radiusGyration.rz} unit="mm" />
            <Row label="ry" value={properties.radiusGyration.ry} unit="mm" />
          </div>
        </div>
      </div>
    </div>
  );
};
