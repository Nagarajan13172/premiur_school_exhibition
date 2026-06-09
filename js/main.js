/* =========================================================
   Premier Schools Exhibition — main script
   (Slider/interaction logic for later sections lives here.)
   ========================================================= */
"use strict";

(function () {
  /* ---------- Enquiry form: client-side handling ---------- */
  var form = document.querySelector(".enquiry");
  if (!form) return;

  var status = form.querySelector(".enquiry__status");
  var controls = form.querySelectorAll("input, textarea, select");

  function labelText(el) {
    if (el.labels && el.labels[0]) {
      return el.labels[0].textContent.replace(/\s*\(required\)\s*$/i, "").trim();
    }
    return "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var firstInvalid = null;
    Array.prototype.forEach.call(controls, function (el) {
      if (el.checkValidity()) {
        el.removeAttribute("aria-invalid");
      } else {
        el.setAttribute("aria-invalid", "true");
        if (!firstInvalid) firstInvalid = el;
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      var name = labelText(firstInvalid);
      if (status) {
        status.textContent =
          (name ? name + ": " : "") +
          (firstInvalid.validationMessage || "Please correct this field.");
      }
      return;
    }

    var parent = (form.elements.parent_name.value || "").trim();
    if (status) {
      status.textContent =
        "Thank you" + (parent ? ", " + parent : "") + "! We’ll be in touch shortly.";
    }
    form.reset();
  });

  /* Clear a field's error as soon as it becomes valid again */
  form.addEventListener("input", function (event) {
    var el = event.target;
    if (el.getAttribute("aria-invalid") === "true" && el.checkValidity()) {
      el.removeAttribute("aria-invalid");
    }
  });
})();

(function () {
  /* ---------- "Choose the School" mobile slider: pagination dots ---------- */
  var track = document.getElementById("schools-track");
  if (!track) return;

  var dots = Array.prototype.slice.call(document.querySelectorAll(".schools__dot"));
  var cards = Array.prototype.slice.call(track.querySelectorAll(".school-card"));
  if (!dots.length || !cards.length) return;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function setActive(index) {
    dots.forEach(function (dot, i) {
      if (i === index) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });
  }

  // Click a dot → centre its card (matches scroll-snap-align: center).
  // Negative/overflow targets are clamped by the browser, so the first and
  // last cards rest at the scroll extremes — the same place snap settles.
  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      var card = cards[i];
      if (!card) return;
      track.scrollTo({
        left:
          card.offsetLeft -
          track.offsetLeft -
          (track.clientWidth - card.clientWidth) / 2,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  });

  // On scroll, mark the most-centred card as active
  function updateActive() {
    var trackRect = track.getBoundingClientRect();
    var center = trackRect.left + trackRect.width / 2;
    var best = 0;
    var bestDistance = Infinity;
    cards.forEach(function (card, i) {
      var rect = card.getBoundingClientRect();
      var distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    setActive(best);
  }

  var ticking = false;
  track.addEventListener(
    "scroll",
    function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        updateActive();
        ticking = false;
      });
    },
    { passive: true }
  );

  updateActive();
})();

(function () {
  /* ---------- Logo strip: keyboard-operable when motion is reduced ----------
     With prefers-reduced-motion the marquee animation is removed and row 1
     becomes overflow-x:auto. Make that row a focusable scroll region so
     keyboard users (notably Safari/iOS, which don't focus plain scrollers)
     can pan it with arrow keys. The reverse row stays aria-hidden + inert. */
  var row = document.querySelector(".logos__row:not(.logos__row--reverse)");
  if (!row) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function sync() {
    if (reduced.matches) {
      row.setAttribute("tabindex", "0");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "Participating school logos — scrollable");
    } else {
      row.removeAttribute("tabindex");
      row.removeAttribute("role");
      row.removeAttribute("aria-label");
    }
  }

  sync();
  if (reduced.addEventListener) {
    reduced.addEventListener("change", sync);
  } else if (reduced.addListener) {
    reduced.addListener(sync); // older Safari
  }
})();

(function () {
  /* ---------- "Must-Visit" slider: infinite loop with prev / next arrows ---------- */
  var track = document.getElementById("must-track");
  if (!track) return;

  var prev = document.querySelector(".must__arrow--prev");
  var next = document.querySelector(".must__arrow--next");
  var originals = Array.prototype.slice.call(track.querySelectorAll(".must-card"));
  if (!prev || !next || originals.length < 2) return;

  var count = originals.length;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Clone the whole set before AND after the originals. The clones are identical
  // pixels, so jumping the scroll by exactly one set is invisible — that's what
  // makes the loop endless. Clones are hidden from assistive tech.
  var beforeFrag = document.createDocumentFragment();
  var afterFrag = document.createDocumentFragment();
  originals.forEach(function (card) {
    [beforeFrag, afterFrag].forEach(function (frag) {
      var clone = card.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.classList.add("must-card--clone");
      frag.appendChild(clone);
    });
  });
  track.insertBefore(beforeFrag, track.firstChild);
  track.appendChild(afterFrag);

  // Width of one full set = distance from a real card to its appended clone.
  function setWidth() {
    return track.children[count * 2].offsetLeft - track.children[count].offsetLeft;
  }

  function stepSize() {
    var styles = window.getComputedStyle(track);
    var gap = parseFloat(styles.columnGap || styles.gap) || 0;
    return track.children[count].getBoundingClientRect().width + gap;
  }

  // Park the scroll on the real (middle) set.
  var lastSetWidth = -1;
  function recenter() {
    lastSetWidth = setWidth();
    track.scrollLeft = lastSetWidth;
  }

  // After scrolling settles, if we've drifted into a clone set, jump back by a
  // whole set — identical pixels, so it's invisible — keeping the loop endless.
  function normalize() {
    var sw = setWidth();
    if (sw <= 0) return;
    if (track.scrollLeft >= sw * 2 - 1) {
      track.scrollLeft -= sw;
    } else if (track.scrollLeft <= sw - 1) {
      track.scrollLeft += sw;
    }
  }

  // Arrow navigation. If this step would leave the middle set, first jump a whole
  // (pixel-identical) set instantly — invisible — then smooth-scroll one card.
  // Deterministic, so the loop never depends on post-scroll timing.
  function go(direction) {
    var sw = setWidth();
    var step = stepSize();
    if (direction > 0 && track.scrollLeft + step >= sw * 2 - 1) {
      track.scrollLeft -= sw;
    } else if (direction < 0 && track.scrollLeft - step <= sw - 1) {
      track.scrollLeft += sw;
    }
    track.scrollBy({
      left: direction * step,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  prev.addEventListener("click", function () {
    go(-1);
  });
  next.addEventListener("click", function () {
    go(1);
  });

  var stopTimer;
  track.addEventListener(
    "scroll",
    function () {
      clearTimeout(stopTimer);
      stopTimer = setTimeout(normalize, 120);
    },
    { passive: true }
  );

  // Only re-park when the card geometry actually changes — width-driven, so a
  // mobile URL-bar show/hide (height-only resize) won't yank the carousel back.
  // Debounced so a drag-resize doesn't thrash layout.
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (setWidth() !== lastSetWidth) recenter();
    }, 150);
  });

  recenter();
  // Re-park once images/fonts settle so the start offset is exact.
  window.addEventListener("load", recenter);
})();
