import React from "react";
import ReactDOM from "react-dom";

import "./styles.css";

import Fixed from "./Fixed";
import Variable from "./Variable";
import Dynamic from "./Dynamic";
import SmoothScroll from "./SmoothScroll";
import InfiniteScroll from "./InfiniteScroll";

function App() {
  const [mode, setMode] = React.useState("fixed"); // fixed | variable | dynamic

  return (
    <div>
      <select value={mode} onChange={e => setMode(e.target.value)}>
        <option value="fixed">Fixed</option>
        <option value="variable">Variable</option>
        <option value="dynamic">Dynamic</option>
        <option value="smooth-scroll">Smooth Scroll</option>
        <option value="infinite-scroll">Infinite Scroll</option>
      </select>

      <br />
      <br />

      {mode === "fixed" ? (
        <Fixed />
      ) : mode === "variable" ? (
        <Variable />
      ) : mode === "dynamic" ? (
        <Dynamic />
      ) : mode === "smooth-scroll" ? (
        <SmoothScroll />
      ) : mode === "infinite-scroll" ? (
        <InfiniteScroll />
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
