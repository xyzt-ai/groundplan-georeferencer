import React, {useCallback, useRef, useState} from "react";
import "./App.css";
import {MapboxLayer} from '@deck.gl/mapbox';
import {BitmapLayer} from '@deck.gl/layers';
import Map, {
  FullscreenControl,
  NavigationControl,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import GeocoderControl from "./geocoder-control";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import DrawControl from "./draw-control";
import {Feature, FeatureCollection, Polygon} from "geojson";
import Objectproperties from "./objectproperties";
import { FeatureProperties } from "./feature-properties";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import DirectSelectMode from "./CustomDirectSelectMode";
import SimpleSelectMode from "./CustomSimpleSelectMode";
import throttle from "lodash.throttle";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFloppyDisk, faFolderOpen, faMap,
  faQuestionCircle,
} from "@fortawesome/free-solid-svg-icons";
import HelpComponent from "./HelpComponent";
import { Position } from "@deck.gl/core/utils/positions";
import mapboxgl from "mapbox-gl";

const mapboxAccessToken =
  "pk.eyJ1IjoiZ2Vvcmdpb3MtdWJlciIsImEiOiJjanZidTZzczAwajMxNGVwOGZrd2E5NG90In0.gdsRu_UeU_uPi9IulBruXA";

function extractCoordinates(feature: Feature): [Position, Position, Position, Position] | null {
  const polygonFeature = feature as Feature<Polygon>;

  if (polygonFeature.geometry == null || polygonFeature.geometry.coordinates.length !== 1 || polygonFeature.geometry.coordinates[0].length !== 5) {
    return null;
  }
  const c =  polygonFeature.geometry.coordinates[0];
  return [[c[0][0], c[0][1]],
    [c[1][0], c[1][1]],
    [c[2][0], c[2][1]],
    [c[3][0], c[3][1]]];
}

const MAPBOX_STYLES = [
  "mapbox://styles/mapbox/light-v10",
  "mapbox://styles/mapbox/satellite-streets-v11",
  "mapbox://styles/mapbox/dark-v10",
  "mapbox://styles/mapbox/streets-v11"
]

function App() {
  const [viewState, setViewState] = useState({
    longitude: -122.4,
    latitude: 37.8,
    zoom: 14,
  });
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [mapboxDraw, setMapboxDraw] = useState<MapboxDraw | null>(null);
  const [mapBackgroundIndex, setMapBackgroundIndex] = useState(0);
  const [features, setFeatures] = useState<Record<string, Feature>>({});
  const [featureProperties, setFeatureProperties] = useState<
    Record<string, FeatureProperties>
  >({});
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const selectFileButton = (mapBoxDraw: MapboxDraw | null) => {
    const fileInput = useRef<HTMLInputElement>(null);
    if (mapBoxDraw==null) {
      return <></>;
    }
    const selectFile = () => {
      if (fileInput.current!=null) {
        // @ts-ignore
        fileInput.current.click();
      }
    }
    return (
        <>
          <input type="file" style={{ "display": "none" }} ref={fileInput} onChange={event => {
            var reader = new FileReader();
            reader.onload = ev => {
              if (ev.target!=null && ev.target.result!=null) {
                var obj : FeatureCollection = JSON.parse(ev.target.result.toString());
                const newFeatures : {[name: string] : Feature} = {};
                const newFeatureProperties : {[name: string] : FeatureProperties} = {};
                obj.features.forEach((f)=> {
                  const feature = f as Feature;
                  if (feature!=null && feature.id!=null && feature.properties!=null && feature.properties.name!=null) {
                    const id = feature.id;
                    const name = feature.properties.name;
                    const imageOpacity = feature.properties.imageOpacity ?? null;
                    newFeatureProperties[id] = {
                      name,
                      includeInGeoJSON: true,
                      fillImageUrl: null,
                      imageOpacity
                    }
                    newFeatures[id] = feature;
                    mapBoxDraw.add(feature);
                  }
                });
                setFeatures(newFeatures);
                setFeatureProperties(newFeatureProperties);
              }
            };
            if (event.target!=null && event.target.files!=null && event.target.files.length>0) {
              reader.readAsText(event.target.files[0]);
            }
          }}/>
          <button
              className={"mapbox-gl-draw_ctrl-draw-btn"}
              title={"Open GeoJSON"}
              onClick={selectFile}
          >
            <FontAwesomeIcon icon={faFolderOpen} size={"lg"} />
          </button>
        </>
    )
  }

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
    (e: { features: Feature[] }, map: mapboxgl.Map) => {
      setFeatures((currFeatures) => {
        const newFeatures = { ...currFeatures };
        for (const f of e.features) {
          if (f.id != null) {
            delete newFeatures[f.id];
            if (map.getLayer(f.id+"") != null) {
              map.removeLayer(f.id+"");
            }
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


  // Create bitmap layers
  if (map!=null && Object.values(features).length==Object.values(featureProperties).length) {
    Object.values(features)
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
              ? {sourceId, properties, coordinates}
              : null;
        })
        .filter(notNull)
        .forEach((extractedInfo) => {
              const sourceId = extractedInfo.sourceId;
              const properties = extractedInfo.properties;

              const props = {
                id: sourceId,
                // @ts-ignore
                type: BitmapLayer,
                bounds: extractedInfo.coordinates,
                image: properties.fillImageUrl,
                opacity: properties.imageOpacity,
              };

              if (map.getLayer(sourceId) != null) {
                // Need to call setProps for DeckGL bitmap geometry to update
                // @ts-ignore
                (((map.getLayer(sourceId))).implementation as MapboxLayer).setProps(props);
              } else {
                // @ts-ignore
                map.addLayer(new MapboxLayer(props));
              }
            }
        );
  }
  return (
      <>
      <Map
        {...viewState}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAPBOX_STYLES[mapBackgroundIndex]}
        mapboxAccessToken={mapboxAccessToken}
        onMove={(evt) => {setViewState(evt.viewState)}}
        onLoad={e => {setMap(e.target)}}
      >
        {map!=null && <DrawControl
          position="top-left"
          displayControlsDefault={false}
          controls={{
            polygon: true,
            trash: true,
          }}
          clickBuffer={10}
          onLoad={setMapboxDraw}
          defaultMode={"simple_select"}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={evt => {onDelete(evt, map)}}
          onSelectionChange={onSelectionChange}
          onLiveUpdate={onLiveUpdate}
          modes={modes}
        />}
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
            title={"Toggle background"}
            onClick={()=> {
              setMapBackgroundIndex((mapBackgroundIndex+1)%MAPBOX_STYLES.length);
            }}
          >
            <FontAwesomeIcon icon={faMap} size={"lg"} />
          </button>
          {selectFileButton(mapboxDraw)}
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
                    fillImageUrl: properties.fillImageUrl,
                    imageOpacity: properties.imageOpacity
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
      </>
  );

}

function notNull<TValue>(value: TValue | null | undefined): value is TValue {
  return value != null;
}

export default App;
