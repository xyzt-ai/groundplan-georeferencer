import React, { useCallback, useRef } from "react";
import { Feature } from "geojson";
import { FeatureProperties } from "./feature-properties";

interface ObjectPropertiesProps {
  feature: Feature | null;
  featureProperties: FeatureProperties | null;
  supportsBackgroundImage: boolean;
  onFeaturePropertiesChange: (
    featureProperties: FeatureProperties,
    feature: Feature
  ) => void;
}

const ObjectProperties: React.FC<ObjectPropertiesProps> = (props) => {
  //https://reactjs.org/docs/uncontrolled-components.html#the-file-input-tag
  const fileInput = useRef<HTMLInputElement | null>(null);

  const { feature, featureProperties, onFeaturePropertiesChange } = props;
  const handleSubmit = useCallback(
    (event) => {
      if (event != null) {
        event.preventDefault();
      }
      const selectedFile = fileInput?.current?.files?.[0];
      if (
        selectedFile != null &&
        feature != null &&
        featureProperties != null
      ) {
        if (featureProperties.fillImageUrl != null) {
          URL.revokeObjectURL(featureProperties.fillImageUrl);
        }
        const objectURL = URL.createObjectURL(selectedFile);
        onFeaturePropertiesChange(
          { ...featureProperties, fillImageUrl: objectURL },
          feature
        );
      }
    },
    [feature, featureProperties, onFeaturePropertiesChange]
  );

  if (props.feature == null || props.featureProperties == null) {
    return (
      <>
        <h2>Object properties</h2>
        <p>Select a single shape on the map to edit its properties.</p>
      </>
    );
  }
  return (
    <>
      <h2>Object properties</h2>
      <fieldset>
        <label htmlFor={"featureName"}>Name</label>
        <input
          id={"featureName"}
          type={"text"}
          value={props.featureProperties?.name ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            if (props.featureProperties != null && props.feature != null) {
              props.onFeaturePropertiesChange(
                { ...props.featureProperties, name: value },
                props.feature
              );
            }
          }}
        />
      </fieldset>
      <fieldset>
        <input
          id={"includeInGeoJSON"}
          type={"checkbox"}
          checked={props.featureProperties.includeInGeoJSON}
          onChange={(event) => {
            const checked = event.target.checked;
            if (
              props.featureProperties != null &&
              props.feature != null &&
              props.featureProperties.includeInGeoJSON !== checked
            ) {
              props.onFeaturePropertiesChange(
                { ...props.featureProperties, includeInGeoJSON: checked },
                props.feature
              );
            }
          }}
        />
        <label htmlFor={"includeInGeoJSON"}>
          Include when saving to GeoJSON
        </label>
      </fieldset>
      {props.supportsBackgroundImage &&
        props.featureProperties.fillImageUrl == null && (
          <fieldset>
            <label htmlFor={"backgroundImage"}>Background image</label>
            <input
              type={"file"}
              id={"backgroundImage"}
              ref={fileInput}
              accept={"image/png, image/jpeg, image/gif"}
              onChange={handleSubmit}
            />
          </fieldset>
        )}
      {props.supportsBackgroundImage &&
        props.featureProperties.fillImageUrl != null && (
          <fieldset>
            <label htmlFor={"opacity"}>Image opacity</label>
            <input
              type={"range"}
              value={props.featureProperties.imageOpacity * 100}
              min={0}
              max={100}
              id={"opacity"}
              onChange={(event) => {
                const opacity = Number.parseFloat(event.target.value) / 100;
                if (props.featureProperties != null && props.feature != null) {
                  props.onFeaturePropertiesChange(
                    { ...props.featureProperties, imageOpacity: opacity },
                    props.feature
                  );
                }
              }}
            />
          </fieldset>
        )}
    </>
  );
};

export default ObjectProperties;
