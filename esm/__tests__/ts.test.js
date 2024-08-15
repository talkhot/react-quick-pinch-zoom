import { jsx as _jsx } from 'react/jsx-runtime';
import { createRef } from 'react';
import PinchZoom from '../PinchZoom/component';
export const test1 = _jsx(PinchZoom, {
  onUpdate: (a) => {
    const s = a.scale;
    const x = a.x;
    const y = a.y;
    // @ts-expect-error: string is not a number
    const s2 = a.scale;
    // @ts-expect-error: string is not a number
    const x2 = a.x;
    // @ts-expect-error: string is not a number
    const y2 = a.y;
    return { s, x, y, s2, x2, y2 };
  },
  children: _jsx('img', {}),
});
const ref = createRef();
ref?.current?.alignCenter({
  scale: 1,
  x: 0,
  y: 0,
});
ref?.current?.alignCenter({
  // @ts-expect-error: string is not a number
  scale: '1',
  x: 0,
  y: 0,
});
ref?.current?.scaleTo({
  scale: 1,
  x: 0,
  y: 0,
});
ref?.current?.scaleTo({
  // @ts-expect-error: string is not a number
  scale: '1',
  x: 0,
  y: 0,
});
