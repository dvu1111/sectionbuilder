import { ShapeType } from '../types';
import { ShapeStrategy } from './types';
import { RectangularStrategy } from './definitions/Rectangular';
import { HollowRectangularStrategy } from './definitions/HollowRectangular';
import { CircularStrategy } from './definitions/Circular';
import { IShapeStrategy } from './definitions/IShape';
import { CustomStrategy } from './definitions/Custom';
import { TShapeStrategy } from './definitions/TShape';
import { ChannelStrategy } from './definitions/Channel';
import { AngleStrategy } from './definitions/Angle';

export const SHAPE_REGISTRY: Record<ShapeType, ShapeStrategy> = {
  [ShapeType.RECTANGULAR]: RectangularStrategy,
  [ShapeType.HOLLOW_RECTANGULAR]: HollowRectangularStrategy,
  [ShapeType.CIRCULAR]: CircularStrategy,
  [ShapeType.I_SHAPE]: IShapeStrategy,
  [ShapeType.CUSTOM]: CustomStrategy,
  [ShapeType.T_SHAPE]: TShapeStrategy,
  [ShapeType.CHANNEL]: ChannelStrategy,
  [ShapeType.ANGLE]: AngleStrategy
};

export const getShapeStrategy = (type: ShapeType): ShapeStrategy => {
  return SHAPE_REGISTRY[type] || RectangularStrategy;
};