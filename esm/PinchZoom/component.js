import {
  jsx as _jsx,
  Fragment as _Fragment,
  jsxs as _jsxs,
} from 'react/jsx-runtime';
import {
  Component,
  createRef,
  Children,
  cloneElement,
  createElement,
} from 'react';
import { styleRoot, styleChild, styles } from './styles.css';
import { isTouch } from '../utils';
import { getOffsetBounds } from './getOffsetBounds';
const classnames = (base, other) => (other ? `${base} ${other}` : base);
const { abs, min, sqrt } = Math;
const isSsr = typeof window === 'undefined';
const isMac = isSsr ? false : /(Mac)/i.test(navigator.platform);
const isDragInteraction = (i) => i === 'drag';
const isZoomInteraction = (i) => i === 'zoom';
const isZoomGesture = (wheelEvent) => isMac && wheelEvent.ctrlKey;
const cancelEvent = (event) => {
  event.stopPropagation();
  event.preventDefault();
};
const getDistance = (a, b) => {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return sqrt(x * x + y * y);
};
const calculateScale = (startTouches, endTouches) => {
  const startDistance = getDistance(startTouches[0], startTouches[1]);
  const endDistance = getDistance(endTouches[0], endTouches[1]);
  return endDistance / startDistance;
};
const isCloseTo = (value, expected) =>
  value > expected - 0.01 && value < expected + 0.01;
const swing = (p) => -Math.cos(p * Math.PI) / 2 + 0.5;
const getPointByPageCoordinates = (touch) => ({
  x: touch.pageX,
  y: touch.pageY,
});
const getPageCoordinatesByTouches = (touches) =>
  Array.from(touches).map(getPointByPageCoordinates);
const sum = (a, b) => a + b;
const getVectorAvg = (vectors) => ({
  x: vectors.map(({ x }) => x).reduce(sum, 0) / vectors.length,
  y: vectors.map(({ y }) => y).reduce(sum, 0) / vectors.length,
});
const clamp = (min, max, value) =>
  value < min ? min : value > max ? max : value;
const shouldInterceptWheel = (event) => !(event.ctrlKey || event.metaKey);
const getElementSize = (element) => {
  if (element) {
    const { offsetWidth, offsetHeight } = element;
    // Any DOMElement
    if (offsetWidth && offsetHeight) {
      return { width: offsetWidth, height: offsetHeight };
    }
    // Svg support
    const style = getComputedStyle(element);
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    if (height && width) {
      return { width, height };
    }
  }
  return { width: 0, height: 0 };
};
const calculateVelocity = (startPoint, endPoint) => ({
  x: endPoint.x - startPoint.x,
  y: endPoint.y - startPoint.y,
});
const comparePoints = (p1, p2) => p1.x === p2.x && p1.y === p2.y;
const findFirstImage = (element) => {
  if (element.tagName === 'IMG') {
    return element;
  }
  const children = element.children;
  for (let i = 0; i < children.length; i++) {
    const img = findFirstImage(children[i]);
    if (img) {
      return img;
    }
  }
  return null;
};
const noup = () => {};
const zeroPoint = { x: 0, y: 0 };
class PinchZoom extends Component {
  static defaultProps = {
    animationDuration: 250,
    draggableUnZoomed: true,
    enforceBoundsDuringZoom: false,
    centerContained: false,
    enabled: true,
    inertia: true,
    inertiaFriction: 0.96,
    horizontalPadding: 0,
    isTouch,
    lockDragAxis: false,
    maxZoom: 5,
    minZoom: 0.5,
    onDoubleTap: noup,
    onDragEnd: noup,
    onDragStart: noup,
    onDragUpdate: noup,
    onZoomEnd: noup,
    onZoomStart: noup,
    onZoomUpdate: noup,
    setOffsetsOnce: false,
    shouldInterceptWheel,
    shouldCancelHandledTouchEndEvents: false,
    tapZoomFactor: 1,
    verticalPadding: 0,
    wheelScaleFactor: 1500,
    zoomOutFactor: 1.3,
    doubleTapZoomOutOnMaxScale: false,
    doubleTapToggleZoom: false,
    _document: isSsr ? null : window.document,
  };
  _velocity;
  _prevDragMovePoint = null;
  _containerObserver = null;
  _fingers = 0;
  _firstMove = true;
  _hasInteraction;
  _inAnimation;
  _initialOffset = { ...zeroPoint };
  _interaction = null;
  _isDoubleTap = false;
  _isOffsetsSet = false;
  _lastDragPosition = null;
  _lastScale = 1;
  _lastTouchStart = 0;
  _lastZoomCenter = null;
  _listenMouseMove = false;
  _nthZoom = 0;
  _offset = { ...zeroPoint };
  _startOffset = { ...zeroPoint };
  _startTouches = null;
  _updatePlaned = false;
  _wheelTimeOut = null;
  _zoomFactor = 1;
  _initialZoomFactor = 1;
  _draggingPoint = { ...zeroPoint };
  // It help reduce behavior difference between touch and mouse events
  _ignoreNextClick = false;
  // @ts-ignore
  _containerRef = createRef();
  // test get _zoomFactor public
  get zoomFactor() {
    return this._zoomFactor;
  }
  _handleClick = (clickEvent) => {
    if (this._ignoreNextClick) {
      this._ignoreNextClick = false;
      clickEvent.stopPropagation();
    }
  };
  _handleDragStart(event) {
    this._ignoreNextClick = true;
    this.props.onDragStart();
    this._stopAnimation();
    this._resetInertia();
    this._lastDragPosition = null;
    this._hasInteraction = true;
    this._draggingPoint = this._offset;
    this._handleDrag(event);
  }
  _handleDrag(event) {
    const touch = this._getOffsetByFirstTouch(event);
    if (this._enoughToDrag()) {
      this._drag(touch, this._lastDragPosition);
    } else {
      this._virtualDrag(touch, this._lastDragPosition);
    }
    this._offset = this._sanitizeOffset(this._offset);
    this._lastDragPosition = touch;
  }
  _resetInertia() {
    this._velocity = null;
    this._prevDragMovePoint = null;
  }
  _realizeInertia() {
    const { inertiaFriction, inertia } = this.props;
    if (!inertia || !this._velocity) {
      return;
    }
    let { x, y } = this._velocity;
    if (x || y) {
      this._stopAnimation();
      this._resetInertia();
      const renderFrame = () => {
        x *= inertiaFriction;
        y *= inertiaFriction;
        if (!x && !y) {
          return this._stopAnimation();
        }
        const prevOffset = { ...this._offset };
        this._addOffset({ x, y });
        this._offset = this._sanitizeOffset(this._offset);
        if (comparePoints(prevOffset, this._offset)) {
          return this._stopAnimation();
        }
        this._update({ isAnimation: true });
      };
      this._animate(renderFrame, { duration: 9999 });
    }
  }
  _collectInertia({ touches }) {
    if (!this.props.inertia) {
      return;
    }
    const currentCoordinates = getPageCoordinatesByTouches(touches)[0];
    const prevPoint = this._prevDragMovePoint;
    if (prevPoint) {
      this._velocity = calculateVelocity(currentCoordinates, prevPoint);
    }
    this._prevDragMovePoint = currentCoordinates;
  }
  _handleDragEnd() {
    this.props.onDragEnd();
    this._end();
    this._realizeInertia();
  }
  _handleZoomStart() {
    this.props.onZoomStart();
    this._stopAnimation();
    this._lastScale = 1;
    this._nthZoom = 0;
    this._lastZoomCenter = null;
    this._hasInteraction = true;
  }
  _handleZoom(event, newScale) {
    const touchCenter = getVectorAvg(this._getOffsetTouches(event));
    const scale = newScale / this._lastScale;
    this._lastScale = newScale;
    // The first touch events are thrown away since they are not precise
    this._nthZoom += 1;
    if (this._nthZoom > 3) {
      this._scale(scale, touchCenter);
      this._drag(touchCenter, this._lastZoomCenter);
      if (this.props.enforceBoundsDuringZoom) {
        this._offset = this._sanitizeOffset(this._offset);
      }
    }
    this._lastZoomCenter = touchCenter;
  }
  _handleZoomEnd() {
    this.props.onZoomEnd();
    this._end();
  }
  _handleDoubleTap(event) {
    if (this._hasInteraction || this.props.tapZoomFactor === 0) {
      return;
    }
    const needZoomOut =
      (this.props.doubleTapZoomOutOnMaxScale &&
        this._zoomFactor === this.props.maxZoom) ||
      (this.props.doubleTapToggleZoom && this._zoomFactor > 1);
    this.props.onDoubleTap();
    this._ignoreNextClick = true;
    const zoomFactor = this._zoomFactor + this.props.tapZoomFactor;
    const startZoomFactor = this._zoomFactor;
    const updateProgress = (progress) => {
      this._scaleTo(
        startZoomFactor + progress * (zoomFactor - startZoomFactor),
        center,
      );
    };
    let center = this._getOffsetByFirstTouch(event);
    this._isDoubleTap = true;
    if (startZoomFactor > zoomFactor) {
      center = this._getCurrentZoomCenter();
    }
    needZoomOut ? this._zoomOutAnimation() : this._animate(updateProgress);
  }
  _computeInitialOffset() {
    const rect = this._getContainerRect();
    const { width, height } = this._getChildSize();
    const x = -abs(width * this._getInitialZoomFactor() - rect.width) / 2;
    const y = -abs(height * this._getInitialZoomFactor() - rect.height) / 2;
    this._initialOffset = { x, y };
  }
  _resetOffset() {
    this._offset = { ...this._initialOffset };
  }
  _setupOffsets() {
    if (this.props.setOffsetsOnce && this._isOffsetsSet) {
      return;
    }
    this._isOffsetsSet = true;
    this._computeInitialOffset();
    this._resetOffset();
  }
  _sanitizeOffset(offset) {
    const rect = this._getContainerRect();
    const { width, height } = this._getChildSize();
    const elWidth = width * this._getInitialZoomFactor() * this._zoomFactor;
    const elHeight = height * this._getInitialZoomFactor() * this._zoomFactor;
    const [minOffsetX, maxOffsetX] = getOffsetBounds({
      containerDimension: rect.width,
      childDimension: elWidth,
      padding: this.props.horizontalPadding,
      centerContained: this.props.centerContained,
    });
    const [minOffsetY, maxOffsetY] = getOffsetBounds({
      containerDimension: rect.height,
      childDimension: elHeight,
      padding: this.props.verticalPadding,
      centerContained: this.props.centerContained,
    });
    return {
      x: clamp(minOffsetX, maxOffsetX, offset.x),
      y: clamp(minOffsetY, maxOffsetY, offset.y),
    };
  }
  alignCenter(options) {
    const {
      x: __x,
      y: __y,
      scale,
      animated,
      duration,
    } = {
      duration: 250,
      animated: true,
      ...options,
    };
    // Bug-Fix: https://github.com/retyui/react-quick-pinch-zoom/issues/58
    const x = __x * this._initialZoomFactor;
    const y = __y * this._initialZoomFactor;
    const startZoomFactor = this._zoomFactor;
    const startOffset = { ...this._offset };
    const rect = this._getContainerRect();
    const containerCenter = { x: rect.width / 2, y: rect.height / 2 };
    this._zoomFactor = 1;
    this._offset = { x: -(containerCenter.x - x), y: -(containerCenter.y - y) };
    this._scaleTo(scale, containerCenter);
    this._stopAnimation();
    if (!animated) {
      return this._update();
    }
    const diffZoomFactor = this._zoomFactor - startZoomFactor;
    const diffOffset = {
      x: this._offset.x - startOffset.x,
      y: this._offset.y - startOffset.y,
    };
    this._zoomFactor = startZoomFactor;
    this._offset = { ...startOffset };
    const updateFrame = (progress) => {
      const x = startOffset.x + diffOffset.x * progress;
      const y = startOffset.y + diffOffset.y * progress;
      this._zoomFactor = startZoomFactor + diffZoomFactor * progress;
      this._offset = this._sanitizeOffset({ x, y });
      this._update();
    };
    this._animate(updateFrame, {
      callback: () => this._sanitize(),
      duration,
    });
  }
  scaleTo(options) {
    const { x, y, scale, animated, duration } = {
      duration: 250,
      animated: true,
      ...options,
    };
    const startZoomFactor = this._zoomFactor;
    const startOffset = { ...this._offset };
    this._zoomFactor = 1;
    this._offset = { x: 0, y: 0 };
    this._scaleTo(scale, { x, y });
    this._stopAnimation();
    if (!animated) {
      return this._update();
    }
    const diffZoomFactor = this._zoomFactor - startZoomFactor;
    const diffOffset = {
      x: this._offset.x - startOffset.x,
      y: this._offset.y - startOffset.y,
    };
    this._zoomFactor = startZoomFactor;
    this._offset = { ...startOffset };
    const updateFrame = (progress) => {
      const x = startOffset.x + diffOffset.x * progress;
      const y = startOffset.y + diffOffset.y * progress;
      this._zoomFactor = startZoomFactor + diffZoomFactor * progress;
      this._offset = { x, y };
      this._update();
    };
    this._animate(updateFrame, { callback: () => this._sanitize(), duration });
  }
  _scaleTo(zoomFactor, center) {
    this._scale(zoomFactor / this._zoomFactor, center);
    this._offset = this._sanitizeOffset(this._offset);
  }
  _scale(scale, center) {
    scale = this._scaleZoomFactor(scale);
    this._addOffset({
      x: (scale - 1) * (center.x + this._offset.x),
      y: (scale - 1) * (center.y + this._offset.y),
    });
    this.props.onZoomUpdate();
  }
  _scaleZoomFactor(scale) {
    const originalZoomFactor = this._zoomFactor;
    this._zoomFactor *= scale;
    this._zoomFactor = clamp(
      this.props.minZoom,
      this.props.maxZoom,
      this._zoomFactor,
    );
    return this._zoomFactor / originalZoomFactor;
  }
  _canDrag() {
    return this.props.draggableUnZoomed || !isCloseTo(this._zoomFactor, 1);
  }
  _drag(center, lastCenter) {
    if (lastCenter) {
      const y = -(center.y - lastCenter.y);
      const x = -(center.x - lastCenter.x);
      if (!this.props.lockDragAxis) {
        this._addOffset({
          x,
          y,
        });
      } else {
        // lock scroll to position that was changed the most
        if (abs(x) > abs(y)) {
          this._addOffset({
            x,
            y: 0,
          });
        } else {
          this._addOffset({
            y,
            x: 0,
          });
        }
      }
      this.props.onDragUpdate();
    }
  }
  _virtualDrag(center, lastCenter) {
    if (lastCenter) {
      const y = -(center.y - lastCenter.y);
      const x = -(center.x - lastCenter.x);
      this._draggingPoint = {
        x: x + this._draggingPoint.x,
        y: y + this._draggingPoint.y,
      };
    }
  }
  _addOffset(offset) {
    const { x, y } = this._offset;
    this._offset = {
      x: x + offset.x,
      y: y + offset.y,
    };
  }
  _sanitize() {
    if (this._zoomFactor < this.props.zoomOutFactor) {
      this._resetInertia();
      this._zoomOutAnimation();
    } else if (this._isInsaneOffset()) {
      this._sanitizeOffsetAnimation();
    }
  }
  _isInsaneOffset() {
    const offset = this._offset;
    const sanitizedOffset = this._sanitizeOffset(offset);
    return sanitizedOffset.x !== offset.x || sanitizedOffset.y !== offset.y;
  }
  _sanitizeOffsetAnimation() {
    const targetOffset = this._sanitizeOffset(this._offset);
    const startOffset = { ...this._offset };
    const updateProgress = (progress) => {
      const x = startOffset.x + progress * (targetOffset.x - startOffset.x);
      const y = startOffset.y + progress * (targetOffset.y - startOffset.y);
      this._offset = { x, y };
      this._update();
    };
    this._animate(updateProgress);
  }
  _zoomOutAnimation() {
    if (this._zoomFactor === 1) {
      return;
    }
    const startZoomFactor = this._zoomFactor;
    const zoomFactor = 1;
    const center = this._getCurrentZoomCenter();
    const updateProgress = (progress) => {
      const scaleFactor =
        startZoomFactor + progress * (zoomFactor - startZoomFactor);
      this._scaleTo(scaleFactor, center);
    };
    this._animate(updateProgress);
  }
  _getInitialZoomFactor() {
    return this._initialZoomFactor;
  }
  _getCurrentZoomCenter() {
    const { x, y } = this._offset;
    const offsetLeft = x - this._initialOffset.x;
    const offsetTop = y - this._initialOffset.y;
    return {
      x: -1 * x - offsetLeft / (1 / this._zoomFactor - 1),
      y: -1 * y - offsetTop / (1 / this._zoomFactor - 1),
    };
  }
  _getOffsetByFirstTouch(event) {
    return this._getOffsetTouches(event)[0];
  }
  _getOffsetTouches(event) {
    const { _document } = this.props;
    const _html = _document.documentElement;
    const _body = _document.body;
    const { top, left } = this._getContainerRect();
    const scrollTop = _html.scrollTop || _body.scrollTop;
    const scrollLeft = _html.scrollLeft || _body.scrollLeft;
    const posTop = top + scrollTop;
    const posLeft = left + scrollLeft;
    return getPageCoordinatesByTouches(event.touches).map(({ x, y }) => ({
      x: x - posLeft,
      y: y - posTop,
    }));
  }
  _animate(frameFn, options) {
    const startTime = new Date().getTime();
    const { timeFn, callback, duration } = {
      timeFn: swing,
      callback: () => {},
      duration: this.props.animationDuration,
      ...options,
    };
    const renderFrame = () => {
      if (!this._inAnimation) {
        return;
      }
      const frameTime = new Date().getTime() - startTime;
      let progress = frameTime / duration;
      if (frameTime >= duration) {
        frameFn(1);
        this._stopAnimation();
        callback();
        this._update();
      } else {
        progress = timeFn(progress);
        frameFn(progress);
        this._update({ isAnimation: true });
        requestAnimationFrame(renderFrame);
      }
    };
    this._inAnimation = true;
    requestAnimationFrame(renderFrame);
  }
  _stopAnimation() {
    this._inAnimation = false;
  }
  _end() {
    this._hasInteraction = false;
    this._sanitize();
    this._update();
  }
  _getContainerRect() {
    const { current: div } = this._containerRef;
    return div.getBoundingClientRect();
  }
  _getChildSize() {
    const { current: div } = this._containerRef;
    const firstImage = findFirstImage(div);
    return getElementSize(firstImage);
    // return getElementSize(div?.firstElementChild as HTMLElement | null);
  }
  _updateInitialZoomFactor() {
    const rect = this._getContainerRect();
    const size = this._getChildSize();
    const xZoomFactor = rect.width / size.width;
    const yZoomFactor = rect.height / size.height;
    this._initialZoomFactor = min(xZoomFactor, yZoomFactor);
  }
  _onResize = () => {
    if (this._containerRef?.current) {
      this._updateInitialZoomFactor();
      this._setupOffsets();
      this._update();
    }
  };
  _bindEvents() {
    const { current: div } = this._containerRef;
    if (window.ResizeObserver) {
      this._containerObserver = new ResizeObserver(this._onResize);
      this._containerObserver.observe(div);
    } else {
      window.addEventListener('resize', this._onResize);
    }
    this._handlers.forEach(([eventName, fn, target]) => {
      (target || div).addEventListener(eventName, fn, true);
    });
    const firstImage = findFirstImage(div);
    if (firstImage) {
      firstImage.addEventListener('load', this._onResize);
    }
  }
  _unSubscribe() {
    const { current: div } = this._containerRef;
    if (this._containerObserver) {
      this._containerObserver.disconnect();
      this._containerObserver = null;
    }
    window.removeEventListener('resize', this._onResize);
    this._handlers.forEach(([eventName, fn, target]) => {
      (target || div).removeEventListener(eventName, fn, true);
    });
    const firstImage = findFirstImage(div);
    if (firstImage) {
      firstImage.removeEventListener('load', this._onResize);
    }
  }
  _update(options) {
    if (this._updatePlaned) {
      return;
    }
    const updateFrame = () => {
      const scale = this._getInitialZoomFactor() * this._zoomFactor;
      const x = -this._offset.x / scale;
      const y = -this._offset.y / scale;
      this.props.onUpdate({ scale, x, y });
    };
    if (options?.isAnimation) {
      return updateFrame();
    }
    this._updatePlaned = true;
    requestAnimationFrame(() => {
      this._updatePlaned = false;
      updateFrame();
    });
  }
  _handlerIfEnable(fn) {
    return (...args) => {
      if (this.props.enabled) {
        fn(...args);
      }
    };
  }
  _setInteraction(newInteraction, event) {
    const interaction = this._interaction;
    if (interaction !== newInteraction) {
      if (interaction && !newInteraction) {
        if (isZoomInteraction(interaction)) {
          this._handleZoomEnd();
        } else if (isDragInteraction(interaction)) {
          this._handleDragEnd();
        }
      }
      if (isZoomInteraction(newInteraction)) {
        this._handleZoomStart();
      } else if (isDragInteraction(newInteraction)) {
        this._handleDragStart(event);
      }
    }
    this._interaction = newInteraction;
  }
  _distanceBetweenNumbers(a, b) {
    return a > b ? a - b : b - a;
  }
  _enoughToDrag() {
    if (
      this._distanceBetweenNumbers(this._startOffset.x, this._draggingPoint.x) >
        5 ||
      this._distanceBetweenNumbers(this._startOffset.y, this._draggingPoint.y) >
        5
    )
      return true;
    return false;
  }
  _updateInteraction(event) {
    const fingers = this._fingers;
    if (fingers === 2) {
      return this._setInteraction('zoom', event);
    }
    if (fingers === 1 && this._canDrag()) {
      return this._setInteraction('drag', event);
    }
    this._setInteraction(null, event);
  }
  _detectDoubleTap(event) {
    const time = new Date().getTime();
    if (this._fingers > 1) {
      this._lastTouchStart = 0;
    }
    if (time - this._lastTouchStart < 300) {
      cancelEvent(event);
      this._handleDoubleTap(event);
      if (isZoomInteraction(this._interaction)) {
        this._handleZoomEnd();
      } else if (isDragInteraction(this._interaction)) {
        this._handleDragEnd();
      }
    } else {
      this._isDoubleTap = false;
    }
    if (this._fingers === 1) {
      this._lastTouchStart = time;
    }
  }
  _handlerOnTouchEnd = this._handlerIfEnable((touchEndEvent) => {
    this._fingers = touchEndEvent.touches.length;
    if (
      this.props.shouldCancelHandledTouchEndEvents &&
      (isZoomInteraction(this._interaction) ||
        (isDragInteraction(this._interaction) &&
          (this._startOffset.x !== this._offset.x ||
            this._startOffset.y !== this._offset.y)))
    ) {
      cancelEvent(touchEndEvent);
    }
    if (isDragInteraction(this._interaction) && !this._enoughToDrag()) {
      this._handleClick(touchEndEvent);
    }
    this._updateInteraction(touchEndEvent);
  });
  _handlerOnTouchStart = this._handlerIfEnable((touchStartEvent) => {
    this._firstMove = true;
    this._fingers = touchStartEvent.touches.length;
    this._detectDoubleTap(touchStartEvent);
  });
  _handlerOnTouchMove = this._handlerIfEnable((touchMoveEvent) => {
    if (this._isDoubleTap) {
      return;
    }
    this._collectInertia(touchMoveEvent);
    if (this._firstMove) {
      this._updateInteraction(touchMoveEvent);
      if (this._interaction) {
        cancelEvent(touchMoveEvent);
      }
      this._startOffset = { ...this._offset };
      this._startTouches = getPageCoordinatesByTouches(touchMoveEvent.touches);
    } else {
      if (isZoomInteraction(this._interaction)) {
        if (
          this._startTouches &&
          this._startTouches.length === 2 &&
          touchMoveEvent.touches.length === 2
        ) {
          this._handleZoom(
            touchMoveEvent,
            calculateScale(
              this._startTouches,
              getPageCoordinatesByTouches(touchMoveEvent.touches),
            ),
          );
        }
      } else if (isDragInteraction(this._interaction)) {
        this._handleDrag(touchMoveEvent);
      }
      if (this._interaction) {
        cancelEvent(touchMoveEvent);
        this._update();
      }
    }
    this._firstMove = false;
  });
  simulate(fn) {
    return (mouseEvent) => {
      const { pageX, pageY, type } = mouseEvent;
      const isEnd = type === 'mouseup';
      const isStart = type === 'mousedown';
      if (isStart) {
        mouseEvent.preventDefault();
        this._listenMouseMove = true;
      }
      if (this._listenMouseMove) {
        // @ts-ignore
        mouseEvent.touches = isEnd ? [] : [{ pageX, pageY }];
        fn(
          // @ts-ignore
          mouseEvent,
        );
      }
      if (isEnd) {
        this._listenMouseMove = false;
      }
    };
  }
  _handlerWheel = (wheelEvent) => {
    if (this.props.shouldInterceptWheel(wheelEvent)) {
      return;
    }
    cancelEvent(wheelEvent);
    const { pageX, pageY, deltaY, deltaMode } = wheelEvent;
    let scaleDelta = 1;
    if (isZoomGesture(wheelEvent) || deltaMode === 1) {
      scaleDelta = 15;
    }
    const likeTouchEvent = {
      touches: [
        // @ts-ignore
        { pageX, pageY },
      ],
    };
    const center = this._getOffsetByFirstTouch(likeTouchEvent);
    const dScale = deltaY * scaleDelta;
    this._stopAnimation();
    this._scaleTo(
      this._zoomFactor - dScale / this.props.wheelScaleFactor,
      center,
    );
    this._update();
    clearTimeout(
      // @ts-ignore
      this._wheelTimeOut,
    );
    this._wheelTimeOut = setTimeout(() => this._sanitize(), 100);
  };
  // @ts-ignore
  _handlers = this.props.isTouch()
    ? [
        ['touchstart', this._handlerOnTouchStart],
        ['touchend', this._handlerOnTouchEnd],
        ['touchmove', this._handlerOnTouchMove],
      ]
    : [
        [
          'mousemove',
          this.simulate(this._handlerOnTouchMove),
          this.props._document,
        ],
        [
          'mouseup',
          this.simulate(this._handlerOnTouchEnd),
          this.props._document,
        ],
        ['mousedown', this.simulate(this._handlerOnTouchStart)],
        ['click', this._handleClick],
        ['wheel', this._handlerWheel],
      ];
  componentDidMount() {
    this._bindEvents();
    this._update();
  }
  componentWillUnmount() {
    this._stopAnimation();
    this._unSubscribe();
  }
  render() {
    const { children, containerProps, containerElementType, renderSources } =
      this.props;
    const child = Children.only(children);
    const props = containerProps || {};
    const ElementType = containerElementType || 'div';
    return _jsxs(_Fragment, {
      children: [
        _jsx('style', { children: styles }),
        createElement(
          ElementType,
          {
            ...props,
            ref: this._containerRef,
            className: classnames(styleRoot, props.className),
          },
          [
            ...(renderSources ? renderSources() : []),
            cloneElement(child, {
              key: 'pinch-zoom-img-child',
              className: classnames(styleChild, child.props.className),
            }),
          ],
        ),
      ],
    });
  }
}
export default PinchZoom;
