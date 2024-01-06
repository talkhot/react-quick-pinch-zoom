var min = Math.min, max = Math.max;
export function getOffsetBounds(_a) {
    var containerDimension = _a.containerDimension, childDimension = _a.childDimension, padding = _a.padding, centerContained = _a.centerContained;
    var diff = childDimension - containerDimension;
    if (diff + 2 * padding <= 0 && centerContained) {
        return [diff / 2, diff / 2];
    }
    else {
        return [min(diff + padding, 0) - padding, max(0, diff + padding)];
    }
}
