export enum ShapeType {
  RECTANGULAR = 'Rectangular',
  HOLLOW_RECTANGULAR = 'Hollow Rectangular',
  CIRCULAR = 'Circular',
  I_SHAPE = 'I-Shape',
  T_SHAPE = 'T-Shape',
  CHANNEL = 'Channel',
  CUSTOM = 'Custom Shape'
}

export interface Dimensions {
  depth: number;
  width: number; // General width or Top Width for I-beam
  widthBottom?: number; // For I-beam/T-shape
  thickness?: number; // General thickness
  thicknessWeb?: number; // For I-beam/Channel
  thicknessFlangeTop?: number; // For I-beam
  thicknessFlangeBottom?: number; // For I-beam
  radius?: number; // For Circle
  filletRadius?: number; // For visual completeness (approx calc)
}

export interface Point {
  x: number;
  y: number;
}

export type CustomPartType = 'solid' | 'hole';

export interface CustomPart {
  id: string;
  type: CustomPartType;
  points: Point[]; // For polygons
  // Map of segment start index to control point.
  // Segment i connects points[i] to points[i+1] (or 0 if last)
  curves?: Record<number, { controlPoint: Point }>;
  isCircle?: boolean;
  circleParams?: { x: number; y: number; r: number };
}

export interface GeometricProperties {
  area: number;
  centroid: { y: number; z: number }; // y is vertical, z is horizontal in this context (2D)
  momentInertia: { Iz: number; Iy: number; Izy: number };
  sectionModulus: { Szt: number; Szb: number; Syt: number; Syb: number }; // Elastic
  radiusGyration: { rz: number; ry: number };
  plasticModulus: { Zz: number; Zy: number };
}

export interface CalculationResult {
  properties: GeometricProperties;
  timestamp: number;
}

export interface AIAnalysisResult {
  summary: string;
  recommendations: string[];
  suitability: string;
}