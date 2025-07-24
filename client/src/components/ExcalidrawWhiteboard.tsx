import dynamic from "next/dynamic";
import React from "react";
import { FiDownload } from "react-icons/fi";

const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then(mod => mod.Excalidraw), { ssr: false });
