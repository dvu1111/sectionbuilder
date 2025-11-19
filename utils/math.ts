
import { Dimensions, ShapeType, GeometricProperties, CustomPart } from '../types';
import { getShapeStrategy } from '../shapes';
import { CustomStrategy } from '../shapes/definitions/Custom';
import { rotatePart, calculateCentroidFromParts } from '../shapes/utils';

export const initialDimensions = (type: ShapeType): Dimensions => {
  return getShapeStrategy(type).initialDimensions;
};

export const calculateProperties = (
    type: ShapeType, 
    d: Dimensions, 
    customParts: CustomPart[] = [],
    rotation: number = 0
): GeometricProperties => {
  const strategy = getShapeStrategy(type);

  // If rotation is 0, use standard analytical formulas for speed/exactness (except Custom)
  if (rotation === 0 && type !== ShapeType.CUSTOM) {
      return strategy.calculate(d, customParts);
  }

  // If rotation is applied (or it's Custom), use the Generic Polygon method (Green's Theorem)
  let partsToCalc: CustomPart[] = [];

  if (type === ShapeType.CUSTOM) {
      partsToCalc = customParts;
  } else if (strategy.getCustomParts) {
      // Convert standard shape to polygon parts
      partsToCalc = strategy.getCustomParts(d);
  }

  // Apply Rotation
  if (rotation !== 0) {
      // 1. Recenter around centroid first to ensure proper "Rotation about Centroid" behavior
      // This prevents asymmetric shapes from "flying away" or changing their centroid coordinate during rotation
      const centroid = calculateCentroidFromParts(partsToCalc);
      
      // Shift parts so centroid is at (0,0)
      partsToCalc = partsToCalc.map(p => {
          const newPoints = p.points.map(pt => ({ x: pt.x - centroid.x, y: pt.y - centroid.y }));
          
          let newCurves = undefined;
          if (p.curves) {
              newCurves = {} as any;
              for (const k in p.curves) {
                  const cp = p.curves[k].controlPoint;
                  newCurves[k] = { controlPoint: { x: cp.x - centroid.x, y: cp.y - centroid.y } };
              }
          }
          
          let newCircle = undefined;
          if (p.isCircle && p.circleParams) {
              newCircle = { ...p.circleParams, x: p.circleParams.x - centroid.x, y: p.circleParams.y - centroid.y };
          }
          
          return { ...p, points: newPoints, curves: newCurves, circleParams: newCircle };
      });

      // 2. Apply Rotation
      partsToCalc = partsToCalc.map(p => rotatePart(p, rotation));
  }

  // Calculate using generic solver
  return CustomStrategy.calculate(d, partsToCalc);
};
