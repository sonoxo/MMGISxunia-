(() => {
  const C = window.Cesium;
  if (!C?.Viewer || window.__XUNIA_VIEWER_BRIDGE__) return;
  const OriginalViewer = C.Viewer;
  function BridgedViewer(...args) {
    const viewer = new OriginalViewer(...args);
    window.__XUNIA_VIEWER__ = viewer;
    window.dispatchEvent(new CustomEvent('xunia:viewer-ready', { detail: viewer }));
    return viewer;
  }
  Object.setPrototypeOf(BridgedViewer, OriginalViewer);
  BridgedViewer.prototype = OriginalViewer.prototype;
  try {
    C.Viewer = BridgedViewer;
    window.__XUNIA_VIEWER_BRIDGE__ = true;
  } catch (error) {
    console.warn('[XUNIA] Viewer bridge unavailable', error);
  }
})();
