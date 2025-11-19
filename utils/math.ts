import { Dimensions, ShapeType, GeometricProperties, CustomPart } from '../types';
import { getShapeStrategy } from '../shapes';

export const initialDimensions = (type: ShapeType): Dimensions => {
  return getShapeStrategy(type).initialDimensions;
};

export const calculateProperties = (type: ShapeType, d: Dimensions, customParts: CustomPart[] = []): GeometricProperties => {
  const strategy = getShapeStrategy(type);
  return strategy.calculate(d, customParts);
};