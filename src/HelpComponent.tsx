import React from "react";

interface HelpComponentProps {
  onClose: () => void;
}

const HelpComponent: React.FC<HelpComponentProps> = (props) => {
  return (
    <>
      <h2>What is this ?</h2>
      <p>
        This tool allows you to draw polygons on the map, and save them to a
        GeoJSON file afterwards.
      </p>
      <p>
        It also offers the option to load an image and use it as fill for a
        polygon.
      </p>
      <h2>Example use-case</h2>
      <p>
        An example use-case of this tool is create GeoJSON shapes matching the
        areas indicating on a PNG image.{" "}
      </p>
      <p>
        Assume for example you have a{" "}
        <a
          href={
            "https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/sf-districts.png"
          }
          target={"_blank"}
          rel="noreferrer"
        >
          PNG image
        </a>{" "}
        containing all the districts of San Francisco, and you want to create
        GeoJSON shapes for those districts.
      </p>
      <ol>
        <li>Draw a rectangle shape that roughly covers San Francisco.</li>
        <li>
          Select the shape and in the object properties panel, select the PNG
          file.
        </li>
        <li>
          Move and adjust the shape until the roads in the PNG are located in
          the same spot as on the map.
        </li>
        <li>Draw new shapes over each of the districts you need.</li>
        <li>Press the save icon to save the shapes you've drawn.</li>
      </ol>
      <button onClick={props.onClose} title={"Close"}>
        Close
      </button>
    </>
  );
};

export default HelpComponent;
