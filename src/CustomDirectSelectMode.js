import * as MapboxDraw from "@mapbox/mapbox-gl-draw";

//See https://github.com/mapbox/mapbox-gl-draw/issues/808#issuecomment-458337963

const DirectSelectMode = MapboxDraw.modes.direct_select;

const _dragFeature = DirectSelectMode.dragFeature;
const _dragVertex = DirectSelectMode.dragVertex;

DirectSelectMode.dragFeature = function (state, e, delta) {
  const result = _dragFeature.apply(this, [state, e, delta]);

  const feature = state.feature.toGeoJSON();

  this.map.fire("draw.liveUpdate", {
    features: [feature],
  });

  return result;
};

DirectSelectMode.dragVertex = function (state, e, delta) {
  const result = _dragVertex.apply(this, [state, e, delta]);

  const feature = state.feature.toGeoJSON();

  this.map.fire("draw.liveUpdate", {
    features: [feature],
  });

  return result;
};

export default DirectSelectMode;
