import React, { Fragment, useCallback, useState } from "react";
import "./App.css";
import Map, {
  FullscreenControl,
  Layer,
  NavigationControl,
  Source,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import GeocoderControl from "./geocoder-control";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import DrawControl from "./draw-control";
import { Feature, FeatureCollection, Polygon } from "geojson";
import Objectproperties from "./objectproperties";
import { FeatureProperties } from "./feature-properties";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import DirectSelectMode from "./CustomDirectSelectMode";
import SimpleSelectMode from "./CustomSimpleSelectMode";
import throttle from "lodash.throttle";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFloppyDisk,
  faQuestionCircle,
} from "@fortawesome/free-solid-svg-icons";
import HelpComponent from "./HelpComponent";

const mapboxAccessToken =
  "pk.eyJ1IjoiZ2Vvcmdpb3MtdWJlciIsImEiOiJjanZidTZzczAwajMxNGVwOGZrd2E5NG90In0.gdsRu_UeU_uPi9IulBruXA";

function extractCoordinates(feature: Feature): number[][] | null {
  const polygonFeature = feature as Feature<Polygon>;

  if (polygonFeature.geometry == null) {
    return null;
  }
  if (polygonFeature.geometry.coordinates.length !== 1) {
    return null;
  }
  if (polygonFeature.geometry.coordinates[0].length !== 5) {
    //In GeoJSON, the start and end coordinate are the same
    return null;
  }
  return polygonFeature.geometry.coordinates[0].slice(0, 4);
}

function App() {
  const [viewState, setViewState] = useState({
    longitude: -122.4,
    latitude: 37.8,
    zoom: 14,
  });
  const [features, setFeatures] = useState<Record<string, Feature>>({});
  const [featureProperties, setFeatureProperties] = useState<
    Record<string, FeatureProperties>
  >({});
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const onUpdate = useCallback((e: { features: Feature[] }) => {
    setFeatures((currFeatures) => {
      const newFeatures = { ...currFeatures };
      for (const f of e.features) {
        if (f.id != null) {
          newFeatures[f.id] = f;
        }
      }
      return newFeatures;
    });
    //We only support those background images when the polygon has exactly 4 coordinates
    setFeatureProperties((currProperties) => {
      const updatedProperties = { ...currProperties };
      let changed = false;
      e.features.forEach((feature) => {
        if (feature.id != null) {
          const properties = updatedProperties[feature.id];
          if (
            properties.fillImageUrl != null &&
            extractCoordinates(feature) == null
          ) {
            URL.revokeObjectURL(properties.fillImageUrl);
            updatedProperties[feature.id] = {
              ...properties,
              fillImageUrl: null,
            };
            changed = true;
          }
        }
      });
      return changed ? updatedProperties : currProperties;
    });
  }, []);

  const onCreate = useCallback(
    (e: { features: Feature[] }) => {
      setFeatureProperties((currentFeatureProperties) => {
        const newFeatureProperties = { ...currentFeatureProperties };
        let counter = Object.values(newFeatureProperties).length + 1;
        e.features.forEach((feature) => {
          if (feature.id != null) {
            newFeatureProperties[feature.id] = {
              name: `Area ${counter++}`,
              includeInGeoJSON: true,
              fillImageUrl: null,
              imageOpacity: 0.5,
            };
          }
        });
        return newFeatureProperties;
      });
      onUpdate(e);
    },
    [onUpdate]
  );

  const onDelete = useCallback(
    (e: { features: Feature[] }) => {
      setFeatures((currFeatures) => {
        const newFeatures = { ...currFeatures };
        for (const f of e.features) {
          if (f.id != null) {
            delete newFeatures[f.id];
          }
        }
        return newFeatures;
      });
      setFeatureProperties((currentFeatureProperties) => {
        const newFeatureProperties = { ...currentFeatureProperties };
        e.features.forEach((feature) => {
          if (feature.id != null) {
            delete newFeatureProperties[feature.id];
          }
        });
        return newFeatureProperties;
      });
      if (selectedFeature != null && e.features.includes(selectedFeature)) {
        setSelectedFeature(null);
      }
    },
    [selectedFeature]
  );

  const onSelectionChange = useCallback((e: { features: Feature[] }) => {
    if (e.features.length === 1) {
      setSelectedFeature(e.features[0]);
    } else {
      setSelectedFeature(null);
    }
  }, []);

  const nonThrottledOnLiveUpdateHandler = useCallback(
    (e: { features: Feature[] }) => {
      onUpdate(e);
    },
    [onUpdate]
  );
  const onLiveUpdate = useCallback(
    throttle(nonThrottledOnLiveUpdateHandler, 200),
    [nonThrottledOnLiveUpdateHandler]
  );

  const modes: {
    [modeKey: string]: MapboxDraw.DrawMode | MapboxDraw.DrawCustomMode;
  } = {};
  // @ts-ignore
  modes["draw_polygon"] = MapboxDraw.modes["draw_polygon"];
  modes["simple_select"] = SimpleSelectMode;
  modes["direct_select"] = DirectSelectMode;

  return (
    <>
      <Map
        {...viewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v9"
        mapboxAccessToken={mapboxAccessToken}
        onMove={(evt) => setViewState(evt.viewState)}
      >
        {Object.values(features)
          .filter(
            (feature) =>
              feature.id != null &&
              featureProperties[feature.id].fillImageUrl != null &&
              feature.geometry != null
          )
          .map((feature) => {
            const sourceId = `${feature.id ?? "doesn't happen"}`;
            const properties =
              featureProperties[feature.id ?? "doesn't happen"];
            const coordinates = extractCoordinates(feature);
            return coordinates != null
              ? { sourceId, properties, coordinates }
              : null;
          })
          .filter(notNull)
          .map((extractedInfo) => {
            const sourceId = extractedInfo.sourceId;
            const properties = extractedInfo.properties;
            const coordinates = extractedInfo.coordinates;
            return (
              <Fragment key={sourceId}>
                <Source
                  type={"image"}
                  id={sourceId}
                  coordinates={coordinates}
                  url={properties.fillImageUrl ?? "doesn't happen"}
                />
                <Layer
                  type={"raster"}
                  source={sourceId}
                  id={`${sourceId}-layer`}
                  paint={{
                    "raster-opacity": properties.imageOpacity,
                  }}
                />
              </Fragment>
            );
          })}
        <DrawControl
          position="top-left"
          displayControlsDefault={false}
          controls={{
            polygon: true,
            trash: true,
          }}
          clickBuffer={10}
          defaultMode={"draw_polygon"}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onSelectionChange={onSelectionChange}
          onLiveUpdate={onLiveUpdate}
          modes={modes}
        />
        <GeocoderControl
          mapboxAccessToken={mapboxAccessToken}
          position="top-right"
        />

        <FullscreenControl position={"bottom-left"} />
        <NavigationControl position={"bottom-left"} />
      </Map>
      <div className={"map-overlay object-properties"}>
        <div className={"map-overlay-inner"}>
          <Objectproperties
            feature={selectedFeature}
            featureProperties={
              selectedFeature != null && selectedFeature.id != null
                ? featureProperties[selectedFeature.id]
                : null
            }
            onFeaturePropertiesChange={(featureProperties, feature) => {
              setFeatureProperties((previous) => {
                const updatedProperties = { ...previous };
                if (feature.id != null) {
                  updatedProperties[feature.id] = featureProperties;
                }
                return updatedProperties;
              });
            }}
            supportsBackgroundImage={
              selectedFeature != null &&
              extractCoordinates(selectedFeature) != null
            }
          />
        </div>
      </div>
      <div className={"map-overlay additionalActionsToolbar"}>
        <div className={"mapboxgl-ctrl-group mapboxgl-ctrl"}>
          <button
            className={"mapbox-gl-draw_ctrl-draw-btn"}
            title={"Save as GeoJSON"}
            disabled={
              Object.values(featureProperties).filter(
                (property) => property.includeInGeoJSON
              ).length < 1
            }
            onClick={() => {
              const featuresToSave = Object.values(features)
                .map((feature) => {
                  if (feature.id == null) {
                    return null;
                  }
                  const properties = featureProperties[feature.id];
                  if (!properties.includeInGeoJSON) {
                    return null;
                  }
                  const updatedFeature: Feature = { ...feature };
                  updatedFeature.properties = {
                    name: properties.name,
                  };
                  return updatedFeature;
                })
                .filter(notNull);
              const featureCollection: FeatureCollection = {
                type: "FeatureCollection",
                features: featuresToSave,
              };

              const link = document.createElement("a");
              const objectUrl = URL.createObjectURL(
                new Blob(
                  [new TextEncoder().encode(JSON.stringify(featureCollection))],
                  {
                    type: "application/json;charset=utf-8",
                  }
                )
              );
              link.href = objectUrl;
              link.download = "areas.geojson";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(objectUrl);
            }}
          >
            <FontAwesomeIcon icon={faFloppyDisk} size={"lg"} />
          </button>
          <button
            className={"mapbox-gl-draw_ctrl-draw-btn"}
            title={"Help"}
            onClick={() => {
              console.log("Pressed");
              setShowHelp((old) => !old);
            }}
          >
            <FontAwesomeIcon icon={faQuestionCircle} size={"lg"} />
          </button>
        </div>
      </div>
      {showHelp && (
        <div className={"map-overlay helpDialog"}>
          <div className={"map-overlay-inner"}>
            <HelpComponent onClose={() => setShowHelp(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function notNull<TValue>(value: TValue | null | undefined): value is TValue {
  return value != null;
}

export default App;
