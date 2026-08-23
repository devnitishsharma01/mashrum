import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { ConfigProvider, App as AntApp } from "antd";
import store from "./store";
import { appTheme } from "./theme";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ConfigProvider theme={appTheme}>
          <AntApp>
            <App />
          </AntApp>
        </ConfigProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
