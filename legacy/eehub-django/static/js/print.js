/* Printed documents: the toolbar's Print button. */
(function () {
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-print]");
    if (!b) return;
    e.preventDefault();
    window.print();
  });
})();
