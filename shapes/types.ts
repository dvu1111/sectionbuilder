
import { Dimensions, GeometricProperties, ShapeType, CustomPart } from '../types';
import * as d3 from 'd3';

export interface ShapeInputConfig {
  label: string;
  key: keyof Dimensions;
  unit?: string;
}

export interface ShapeStrategy {
  type: ShapeType;
  label: string;
  icon: string;
  
  // Default dimensions when shape is selected
  initialDimensions: Dimensions;
  
  // Inputs to render in ControlPanel
  inputs: ShapeInputConfig[];
  
  // Math: Calculate engineering properties
  calculate: (d: Dimensions, customParts?: CustomPart[]) => GeometricProperties;
  
  // Render: Draw the shape onto the D3 stage
  // g: The shape layer group
  // uiG: The UI/Dimension layer group
  // d: Dimensions
  draw?: (g: d3.Selection<SVGGElement, unknown, null, undefined>, uiG: d3.Selection<SVGGElement, unknown, null, undefined>, d: Dimensions) => void;

  // Export geometry as parts for rotation/custom analysis
  getCustomParts?: (d: Dimensions) => CustomPart[];
}
