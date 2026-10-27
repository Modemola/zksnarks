// A host may serve a pre-rendered page's HTML for a different address. Clear
// it before it is drawn, so the app renders the right page instead.
(function () {
  var root = document.getElementById("root");
  var page = root && root.getAttribute("data-path");
  if (!page) return;
  var here = location.pathname.replace(/\/+$/, "") || "/";
  if (here !== page && here !== page + ".html") root.innerHTML = "";
})();
