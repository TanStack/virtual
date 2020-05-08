import React from "react";
import ReactDOM from "react-dom";

import "./styles.css";

import Fixed from "./Fixed";
import Variable from "./Variable";
import Dynamic from "./Dynamic";

function App() {
  const [mode, setMode] = React.useState("fixed"); // fixed | variable | dynamic

  return (
    <div>
      <select value={mode} onChange={e => setMode(e.target.value)}>
        <option value="fixed">Fixed</option>
        <option value="variable">Variable</option>
        <option value="dynamic">Dynamic</option>
      </select>

      <br />
      <br />

      {mode === "fixed" ? (
        <>
          <p>
            These components are using <strong>fixed</strong> sizes. This means
            that every element's dimensions are hard-coded to the same value and
            never change.
          </p>
          <br />
          <br />
          <Fixed />
        </>
      ) : mode === "variable" ? (
        <>
          <p>
            These components are using <strong>variable</strong> sizes. This
            means that each element has a unique, but knowable dimension at
            render time.
          </p>
          <br />
          <br />
          <Variable />
        </>
      ) : mode === "dynamic" ? (
        <>
          <p>
            These components are using <strong>dynamic</strong> sizes. This
            means that each element's exact dimensions are unknown when
            rendered. An estimated dimension is used to get an a initial
            measurement, then this measurement is readjusted on the fly as each
            element is rendered.
          </p>
          <br />
          <br />
          <Dynamic />
        </>
      ) : null}
      <br />
      <br />
      {process.env.NODE_ENV === "development" ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Rendering performance will be slightly degraded
          until this application is build for production.
        </p>
      ) : null}
    </div>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
