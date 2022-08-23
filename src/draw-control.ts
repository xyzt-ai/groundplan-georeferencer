//https://github.com/visgl/react-map-gl/blob/7.0-release/examples/draw-polygon/src/draw-control.ts
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { ControlPosition, MapRef } from "react-map-gl";
import { useControl } from "react-map-gl";
import { Feature } from "geojson";

type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
  position?: ControlPosition;

  onCreate?: (evt: { features: Feature[] }) => void;
  onUpdate?: (evt: { features: Feature[]; action: string }) => void;
  onDelete?: (evt: { features: Feature[] }) => void;
  onSelectionChange?: (evt: { features: Feature[] }) => void;
  onLiveUpdate?: (evt: { features: Feature[] }) => void;
  onLoad?: (mapboxDraw: MapboxDraw) => void;
};

export default function DrawControl(props: DrawControlProps) {
  useControl<MapboxDraw>(
    () => {
      const result = new MapboxDraw(props);
      if (props.onLoad != null) {
        props.onLoad(result);
      }
      return result;
    },
    ({ map }: { map: MapRef }) => {
      //See https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md#events
      if (props.onCreate != null) {
        map.on("draw.create", props.onCreate);
      }
      if (props.onUpdate != null) {
        map.on("draw.update", props.onUpdate);
      }
      if (props.onDelete != null) {
        map.on("draw.delete", props.onDelete);
      }
      if (props.onSelectionChange != null) {
        map.on("draw.selectionchange", props.onSelectionChange);
      }
      if (props.onLiveUpdate != null) {
        map.on("draw.liveUpdate", props.onLiveUpdate);
      }
    },
    ({ map }: { map: MapRef }) => {
      if (props.onCreate != null) {
        map.off("draw.create", props.onCreate);
      }
      if (props.onUpdate != null) {
        map.off("draw.update", props.onUpdate);
      }
      if (props.onDelete != null) {
        map.off("draw.delete", props.onDelete);
      }
      if (props.onSelectionChange != null) {
        map.off("draw.selectionchange", props.onSelectionChange);
      }
      if (props.onLiveUpdate != null) {
        map.off("draw.liveUpdate", props.onLiveUpdate);
      }
    },
    {
      position: props.position,
    }
  );

  return null;
}

DrawControl.defaultProps = {
  onCreate: () => {},
  onUpdate: () => {},
  onDelete: () => {},
};
