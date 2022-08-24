import React, { useCallback, useRef, useState } from "react";
import "./App.css";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import Map, {
  FullscreenControl,
  NavigationControl,
  useControl,
} from "react-map-gl";
import GeocoderControl from "./geocoder-control";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFloppyDisk,
  faFolderOpen,
  faMap,
  faQuestionCircle,
} from "@fortawesome/free-solid-svg-icons";
import HelpComponent from "./HelpComponent";
import { Feature, FeatureCollection, Polygon } from "geojson";
import { FeatureProperties } from "./feature-properties";
import mapboxgl from "mapbox-gl";
import throttle from "lodash.throttle";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import SimpleSelectMode from "./CustomSimpleSelectMode";
import DirectSelectMode from "./CustomDirectSelectMode";
import DrawControl from "./draw-control";
import { Position } from "@deck.gl/core/utils/positions";
import Objectproperties from "./objectproperties";
import { MapboxOverlay } from "@deck.gl/mapbox/typed";
import { DeckProps, LayersList } from "@deck.gl/core/typed";
import { BitmapLayer } from "@deck.gl/layers";

const mapboxAccessToken =
  "pk.eyJ1IjoiZ2Vvcmdpb3MtdWJlciIsImEiOiJjanZidTZzczAwajMxNGVwOGZrd2E5NG90In0.gdsRu_UeU_uPi9IulBruXA";

const MAPBOX_STYLES = [
  "mapbox://styles/mapbox/light-v10",
  "mapbox://styles/mapbox/satellite-streets-v11",
  "mapbox://styles/mapbox/dark-v10",
  "mapbox://styles/mapbox/streets-v11",
];

function extractCoordinates(
  feature: Feature
): [Position, Position, Position, Position] | null {
  const polygonFeature = feature as Feature<Polygon>;

  if (
    polygonFeature.geometry == null ||
    polygonFeature.geometry.coordinates.length !== 1 ||
    polygonFeature.geometry.coordinates[0].length !== 5
  ) {
    return null;
  }
  const c = polygonFeature.geometry.coordinates[0];
  return [
    [c[0][0], c[0][1]],
    [c[1][0], c[1][1]],
    [c[2][0], c[2][1]],
    [c[3][0], c[3][1]],
  ];
}

interface FeatureWithProperties {
  feature: Feature;
  properties: FeatureProperties;
}

//See https://github.com/visgl/react-map-gl/blob/master/examples/deckgl-overlay/src/app.tsx
function DeckGLOverlay(props: DeckProps) {
  const deck = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  deck.setProps(props);
  return null;
}

function App2() {
  const [viewState, setViewState] = useState({
    longitude: -122.4,
    latitude: 37.8,
    zoom: 14,
  });
  const mapboxDraw = useRef<MapboxDraw | null>(null);
  const [mapBoxStyleIndex, setMapBoxStyleIndex] = useState(0);
  const [featuresWithProperties, setFeaturesWithProperties] = useState<
    Record<string, FeatureWithProperties>
  >({});

  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const onUpdate = useCallback((e: { features: Feature[] }) => {
    setFeaturesWithProperties((currFeaturesWithProperties) => {
      const newFeaturesWithProperties = { ...currFeaturesWithProperties };
      for (const f of e.features) {
        if (f.id != null) {
          const properties = currFeaturesWithProperties[f.id].properties;

          if (
            properties.fillImageUrl != null &&
            extractCoordinates(f) == null
          ) {
            newFeaturesWithProperties[f.id] = {
              feature: f,
              properties: {
                ...properties,
                fillImageUrl: null,
              },
            };
            URL.revokeObjectURL(properties.fillImageUrl);
          } else {
            newFeaturesWithProperties[f.id] = {
              ...newFeaturesWithProperties[f.id],
              feature: f,
            };
          }
        }
      }
      return newFeaturesWithProperties;
    });
  }, []);

  const onCreate = useCallback((e: { features: Feature[] }) => {
    setFeaturesWithProperties((currFeaturesWithProperties) => {
      const updatedFeaturesWithProperties = { ...currFeaturesWithProperties };
      let counter = Object.values(updatedFeaturesWithProperties).length + 1;
      e.features.forEach((feature) => {
        if (feature.id != null) {
          updatedFeaturesWithProperties[feature.id] = {
            feature: feature,
            properties: {
              name: `Area ${counter++}`,
              includeInGeoJSON: true,
              fillImageUrl: null,
              imageOpacity: 0.5,
            },
          };
        }
      });
      return updatedFeaturesWithProperties;
    });
  }, []);

  const onDelete = useCallback(
    (e: { features: Feature[] }) => {
      setFeaturesWithProperties((currFeaturesWithProperties) => {
        const newFeaturesWithProperties = { ...currFeaturesWithProperties };
        for (const f of e.features) {
          if (f.id != null) {
            const currentValue = newFeaturesWithProperties[f.id];
            if (
              currentValue != null &&
              currentValue.properties.fillImageUrl != null
            ) {
              URL.revokeObjectURL(currentValue.properties.fillImageUrl);
            }
            delete newFeaturesWithProperties[f.id];
          }
        }
        return newFeaturesWithProperties;
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
    throttle(nonThrottledOnLiveUpdateHandler, 50),
    [nonThrottledOnLiveUpdateHandler]
  );

  const modes: {
    [modeKey: string]: MapboxDraw.DrawMode | MapboxDraw.DrawCustomMode;
  } = {};
  // @ts-ignore
  modes["draw_polygon"] = MapboxDraw.modes["draw_polygon"];
  modes["simple_select"] = SimpleSelectMode;
  modes["direct_select"] = DirectSelectMode;

  // @ts-ignore
  const layers: LayersList = Object.values(featuresWithProperties)
    .map((feature) => {
      const fillImageUrl = feature.properties.fillImageUrl;
      const imageOpacity = feature.properties.imageOpacity;
      if (fillImageUrl == null) {
        return null;
      }
      const coordinates = extractCoordinates(feature.feature);
      if (coordinates == null) {
        return null;
      }

      return new BitmapLayer({
        id: `${feature.feature.id}-bitmaplayer`,
        bounds: coordinates,
        opacity: imageOpacity,
        image: fillImageUrl,
      });
    })
    .filter(notNull);
  return (
    <>
      <Map
        {...viewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAPBOX_STYLES[mapBoxStyleIndex]}
        mapboxAccessToken={mapboxAccessToken}
        onMove={(evt) => {
          setViewState(evt.viewState);
        }}
      >
        <DeckGLOverlay layers={layers} />
        <DrawControl
          position="top-left"
          displayControlsDefault={false}
          controls={{
            polygon: true,
            trash: true,
          }}
          clickBuffer={10}
          onLoad={(draw) => {
            mapboxDraw.current = draw;
          }}
          defaultMode={"simple_select"}
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
        <FullscreenControl position={"bottom-left"} style={{ zIndex: "1" }} />
        <NavigationControl position={"bottom-left"} style={{ zIndex: "1" }} />
      </Map>
      <div className={"map-overlay object-properties"}>
        <div className={"map-overlay-inner"}>
          <Objectproperties
            feature={selectedFeature}
            featureProperties={
              selectedFeature != null && selectedFeature.id != null
                ? featuresWithProperties[selectedFeature.id]?.properties ?? null
                : null
            }
            onFeaturePropertiesChange={(featureProperties, feature) => {
              setFeaturesWithProperties((previous) => {
                const updatedProperties = { ...previous };
                if (feature.id != null) {
                  updatedProperties[feature.id] = {
                    ...updatedProperties[feature.id],
                    properties: featureProperties,
                  };
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
            title={"Toggle background"}
            onClick={() => {
              setMapBoxStyleIndex((old) => (old + 1) % MAPBOX_STYLES.length);
            }}
          >
            <FontAwesomeIcon icon={faMap} size={"lg"} />
          </button>
          <button
            className={"mapbox-gl-draw_ctrl-draw-btn"}
            title={"Open GeoJSON"}
            disabled={mapboxDraw == null || fileInput.current == null}
            onClick={() => fileInput.current != null && fileInput.current.click}
          >
            <FontAwesomeIcon icon={faFolderOpen} size={"lg"} />
          </button>
          <button
            className={"mapbox-gl-draw_ctrl-draw-btn"}
            title={"Save as GeoJSON"}
            disabled={
              Object.values(featuresWithProperties).filter(
                (feature) => feature.properties.includeInGeoJSON
              ).length < 1
            }
            onClick={() => {
              const featuresToSave = Object.values(featuresWithProperties)
                .map((featureWithProperties) => {
                  const feature = featureWithProperties.feature;
                  const properties = featureWithProperties.properties;
                  if (feature.id == null) {
                    return null;
                  }
                  if (!properties.includeInGeoJSON) {
                    return null;
                  }
                  const updatedFeature: Feature = { ...feature };
                  updatedFeature.properties = {
                    name: properties.name,
                    fillImageUrl: properties.fillImageUrl,
                    imageOpacity: properties.imageOpacity,
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
              link.download = "areas";
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
      <input
        type="file"
        accept={"application/geo+json,application/JSON"}
        style={{ display: "none" }}
        ref={fileInput}
        onChange={(event) => {
          const draw = mapboxDraw.current;
          if (draw != null) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target != null && ev.target.result != null) {
                const decodedFeatureCollection: FeatureCollection = JSON.parse(
                  ev.target.result.toString()
                );

                //The user can load some random file, so do a sanity check
                if (decodedFeatureCollection.type !== "FeatureCollection") {
                  return;
                }
                let counter = Object.values(featuresWithProperties).length;

                const featuresToAdd: FeatureWithProperties[] =
                  decodedFeatureCollection.features
                    .map((feature) => {
                      const id = feature.id;
                      if (id == null) {
                        return null;
                      }
                      if (feature.geometry == null) {
                        return null;
                      }
                      if (feature.geometry.type != "Polygon") {
                        return null;
                      }
                      const featureProperties: FeatureProperties = {
                        name:
                          feature?.properties?.["name"] ?? `Area ${counter++}`,
                        includeInGeoJSON: true,
                        fillImageUrl: null,
                        imageOpacity: 0.5,
                      };

                      const featureWithoutProperties: Feature = {
                        type: "Feature",
                        geometry: feature.geometry,
                        id: feature.id,
                        properties: {},
                      };
                      return {
                        feature: featureWithoutProperties,
                        properties: featureProperties,
                      };
                    })
                    .filter(notNull);

                setFeaturesWithProperties((current) => {
                  const updatedFeaturesWithProperties = { ...current };
                  featuresToAdd.forEach((featureWithProperties) => {
                    const id = featureWithProperties.feature.id;
                    if (id != null) {
                      updatedFeaturesWithProperties[id] = featureWithProperties;
                    }
                  });
                  return updatedFeaturesWithProperties;
                });

                featuresToAdd.forEach((featureWithProperties) => {
                  draw.add(featureWithProperties.feature);
                });
              }
            };
            if (
              event.target != null &&
              event.target.files != null &&
              event.target.files.length > 0
            ) {
              reader.readAsText(event.target.files[0]);
            }
          }
        }}
      />
    </>
  );
}

function notNull<TValue>(value: TValue | null | undefined): value is TValue {
  return value != null;
}

export default App2;
