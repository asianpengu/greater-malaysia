/* Reusable newsletter signup — wires any <form class="gm-signup-form"> to Kit. */
(function () {
  var ENDPOINT = "https://app.kit.com/forms/9628406/subscriptions";
  var FIELD = "email_address";
  function wire(form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var email = (input && input.value || "").trim();
      if (!email) return;
      var btn = form.querySelector("button");
      var label = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Subscribing…"; }
      try {
        var res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email_address: email }),
        });
        if (!res.ok) throw new Error(res.status);
        if (typeof window.gtag === "function") window.gtag("event", "lead_capture", { source: form.getAttribute("data-src") || "site" });
        form.innerHTML = '<div class="gm-signup-ok">You\'re in! Check your inbox to confirm 🇲🇾</div>';
      } catch (err) {
        if (btn) { btn.disabled = false; btn.textContent = label; }
        alert("Hmm, that didn't work — please try again.");
      }
    });
  }
  document.querySelectorAll("form.gm-signup-form").forEach(wire);
})();
