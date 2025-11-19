import { SHAPE_REGISTRY } from './shapes';
import { ShapeType } from './types';

export const SHAPES = Object.values(SHAPE_REGISTRY).map(strategy => ({
  id: strategy.type,
  label: strategy.label,
  icon: strategy.icon
}));