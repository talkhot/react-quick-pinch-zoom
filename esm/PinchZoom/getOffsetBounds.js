const { min, max } = Math;
export function getOffsetBounds({
  containerDimension,
  childDimension,
  padding,
  centerContained,
}) {
  const diff = childDimension - containerDimension;
  if (diff + 2 * padding <= 0 && centerContained) {
    return [diff / 2, diff / 2];
  } else {
    return [min(diff + padding, 0) - padding, max(0, diff + padding)];
  }
}
