import * as MapboxDraw from "@mapbox/mapbox-gl-draw";

const SimpleSelectMode = MapboxDraw.modes.simple_select;

const _dragMove = SimpleSelectMode.dragMove;

SimpleSelectMode.dragMove = function (state, e) {
  const result = _dragMove.apply(this, [state, e]);

  const features = this.getSelected();
  if (features != null && features.length > 0) {
    this.map.fire("draw.liveUpdate", {
      features: features.map((feature) => feature.toGeoJSON()),
    });
  }
  return result;
};

export default SimpleSelectMode;
