/* Auto-expire "NEW" badges 14 days after a card's data-new date.
   Add data-new="YYYY-MM-DD" to any element containing a .badge-new. */
(function () {
  var WINDOW = 14 * 864e5; // 14 days in ms
  var now = Date.now();
  document.querySelectorAll("[data-new]").forEach(function (el) {
    // anchor the date to Malaysia time (bare YYYY-MM-DD would parse as UTC)
    var t = Date.parse(el.getAttribute("data-new") + "T00:00:00+08:00");
    if (isNaN(t) || now - t > WINDOW) {
      el.classList.remove("is-new");
      var b = el.querySelector(".badge-new");
      if (b) b.remove();
    }
  });
})();
