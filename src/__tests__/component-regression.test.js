import React, { createRef } from 'react';
import { act, render } from '@testing-library/react';

import QuickPinchZoom from '../index';

const defaultProps = () => ({
  onUpdate: jest.fn(),
  children: <img alt="" />,
});

describe('regression: passive touch listeners', () => {
  it('binds touchstart and touchmove as passive, touchend as non-passive', () => {
    const calls = [];
    const original = Element.prototype.addEventListener;
    Element.prototype.addEventListener = function (type, fn, opts) {
      if (typeof type === 'string' && type.startsWith('touch')) {
        calls.push({ type, opts });
      }
      return original.call(this, type, fn, opts);
    };

    try {
      // Force the touch code-path even when running in jsdom (no touch support).
      render(
        <QuickPinchZoom {...defaultProps()} isTouch={() => true}>
          <img alt="" />
        </QuickPinchZoom>,
      );
    } finally {
      Element.prototype.addEventListener = original;
    }

    const byType = Object.fromEntries(calls.map((c) => [c.type, c.opts]));

    expect(byType.touchstart).toMatchObject({ capture: true, passive: true });
    expect(byType.touchmove).toMatchObject({ capture: true, passive: true });
    // touchend MUST be non-passive so shouldCancelHandledTouchEndEvents can
    // still call preventDefault().
    expect(byType.touchend).toMatchObject({ capture: true, passive: false });
  });
});

describe('regression: wheel timeout cleared on unmount', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not fire sanitize / onUpdate after the component unmounts', () => {
    const onUpdate = jest.fn();
    const ref = createRef();

    const { unmount, container } = render(
      <QuickPinchZoom
        ref={ref}
        onUpdate={onUpdate}
        isTouch={() => false}
      >
        <img alt="" />
      </QuickPinchZoom>,
    );

    // Fire a wheel event so the 100ms sanitize timer is armed.
    const rootDiv = container.firstChild;
    const wheel = new Event('wheel', { bubbles: true });
    Object.defineProperties(wheel, {
      deltaY: { value: 10 },
      deltaMode: { value: 0 },
      pageX: { value: 10 },
      pageY: { value: 10 },
      ctrlKey: { value: false },
      metaKey: { value: false },
    });

    act(() => {
      rootDiv.dispatchEvent(wheel);
    });

    onUpdate.mockClear();

    act(() => {
      unmount();
    });

    // Run the 100ms wheel timer + any rAFs that would have followed.
    act(() => {
      jest.runAllTimers();
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('regression: gesture cache for layout reads', () => {
  it('populates and clears the gesture cache around touchstart/touchend', () => {
    const ref = createRef();
    render(
      <QuickPinchZoom
        ref={ref}
        onUpdate={() => {}}
        isTouch={() => true}
      >
        <img alt="" />
      </QuickPinchZoom>,
    );

    const inst = ref.current;
    expect(inst).toBeTruthy();

    // Direct private-field access via casting is fine in a regression test:
    // we are verifying internal caching contract.
    expect(inst._cachedRect).toBeNull();
    expect(inst._cachedChildSize).toBeNull();
    expect(inst._cachedImage).toBeNull();

    inst._populateGestureCache();

    expect(inst._cachedRect).not.toBeNull();
    expect(inst._cachedChildSize).not.toBeNull();
    // jsdom returns the image element even when its dimensions are zero.
    expect(inst._cachedImage).toBeInstanceOf(HTMLImageElement);

    inst._clearGestureCache();
    expect(inst._cachedRect).toBeNull();
    expect(inst._cachedChildSize).toBeNull();
    expect(inst._cachedImage).toBeNull();
  });

  it('serves _getContainerRect from cache without re-calling getBoundingClientRect', () => {
    const ref = createRef();
    render(
      <QuickPinchZoom
        ref={ref}
        onUpdate={() => {}}
        isTouch={() => true}
      >
        <img alt="" />
      </QuickPinchZoom>,
    );

    const inst = ref.current;
    const div = inst._containerRef.current;

    inst._populateGestureCache();
    const cachedRect = inst._cachedRect;

    const spy = jest.spyOn(div, 'getBoundingClientRect');

    // Multiple reads during the gesture should not force layout again.
    const a = inst._getContainerRect();
    const b = inst._getContainerRect();
    const c = inst._getContainerRect();

    expect(spy).not.toHaveBeenCalled();
    expect(a).toBe(cachedRect);
    expect(b).toBe(cachedRect);
    expect(c).toBe(cachedRect);

    // After clearing, the next read falls through to a fresh layout read.
    inst._clearGestureCache();
    inst._getContainerRect();
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('clears the cache on resize', () => {
    const ref = createRef();
    render(
      <QuickPinchZoom
        ref={ref}
        onUpdate={() => {}}
        isTouch={() => true}
      >
        <img alt="" />
      </QuickPinchZoom>,
    );

    const inst = ref.current;
    inst._populateGestureCache();
    expect(inst._cachedRect).not.toBeNull();

    inst._onResize();
    expect(inst._cachedRect).toBeNull();
    expect(inst._cachedChildSize).toBeNull();
    expect(inst._cachedImage).toBeNull();
  });
});
