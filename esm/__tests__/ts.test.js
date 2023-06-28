var _a, _b, _c, _d;
import React, { createRef } from 'react';
import PinchZoom from '../PinchZoom/component';
export var test1 = React.createElement(
  PinchZoom,
  {
    onUpdate: function (a) {
      var s = a.scale;
      var x = a.x;
      var y = a.y;
      // @ts-expect-error: string is not a number
      var s2 = a.scale;
      // @ts-expect-error: string is not a number
      var x2 = a.x;
      // @ts-expect-error: string is not a number
      var y2 = a.y;
      return { s: s, x: x, y: y, s2: s2, x2: x2, y2: y2 };
    },
  },
  React.createElement('img', null),
);
var ref = createRef();
(_a = ref === null || ref === void 0 ? void 0 : ref.current) === null ||
_a === void 0
  ? void 0
  : _a.alignCenter({
      scale: 1,
      x: 0,
      y: 0,
    });
(_b = ref === null || ref === void 0 ? void 0 : ref.current) === null ||
_b === void 0
  ? void 0
  : _b.alignCenter({
      // @ts-expect-error: string is not a number
      scale: '1',
      x: 0,
      y: 0,
    });
(_c = ref === null || ref === void 0 ? void 0 : ref.current) === null ||
_c === void 0
  ? void 0
  : _c.scaleTo({
      scale: 1,
      x: 0,
      y: 0,
    });
(_d = ref === null || ref === void 0 ? void 0 : ref.current) === null ||
_d === void 0
  ? void 0
  : _d.scaleTo({
      // @ts-expect-error: string is not a number
      scale: '1',
      x: 0,
      y: 0,
    });
