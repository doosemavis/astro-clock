/*
 * ephemeris.js — geocentric ecliptic longitudes of the Sun, Moon and planets.
 *
 * Based on Paul Schlyter's "Computing planetary positions" low-precision method
 * (accurate to roughly an arc-minute for the Sun/Moon and ~0.01-0.05 deg for the
 * planets over 1900-2100 — far finer than a 30-degree zodiac sign needs).
 *
 * Works in Node (module.exports) and the browser (window.Ephemeris).
 * Pure math: no I/O, no dependencies. Input is a JS Date; output is a map of
 * body -> ecliptic longitude in degrees [0, 360).
 */
(function (global) {
  "use strict";

  var DEG = Math.PI / 180;
  function rev(x) { return ((x % 360) + 360) % 360; }
  function sind(x) { return Math.sin(x * DEG); }
  function cosd(x) { return Math.cos(x * DEG); }
  function atan2d(y, x) { return Math.atan2(y, x) / DEG; }
  function asind(x) { return Math.asin(Math.max(-1, Math.min(1, x))) / DEG; }
  function tand(x) { return Math.tan(x * DEG); }

  // Schlyter day number: 0.0 at 1999-12-31 00:00 UT, plus UT fraction of day.
  function dayNumber(date) {
    var Y = date.getUTCFullYear();
    var M = date.getUTCMonth() + 1;
    var D = date.getUTCDate();
    var ut = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    var d = 367 * Y
          - Math.floor(7 * (Y + Math.floor((M + 9) / 12)) / 4)
          + Math.floor(275 * M / 9)
          + D - 730530;
    return d + ut / 24;
  }

  // Solve Kepler's equation, return eccentric anomaly E (deg).
  function eccentricAnomaly(M, e) {
    M = rev(M);
    var E = M + e / DEG * sind(M) * (1 + e * cosd(M));
    for (var k = 0; k < 8; k++) {
      var dE = (E - e / DEG * sind(E) - M) / (1 - e * cosd(E));
      E -= dE;
      if (Math.abs(dE) < 1e-7) break;
    }
    return E;
  }

  // Sun: returns geocentric ecliptic longitude + rectangular coords (for planet conversion).
  function sun(d) {
    var w = 282.9404 + 4.70935e-5 * d;
    var e = 0.016709 - 1.151e-9 * d;
    var M = rev(356.0470 + 0.9856002585 * d);
    var E = eccentricAnomaly(M, e);
    var xv = cosd(E) - e;
    var yv = Math.sqrt(1 - e * e) * sind(E);
    var v = atan2d(yv, xv);
    var r = Math.sqrt(xv * xv + yv * yv);
    var lon = rev(v + w);
    return { lon: lon, x: r * cosd(lon), y: r * sind(lon), M: M, w: w };
  }

  // Heliocentric ecliptic rectangular coords of a major planet from its elements.
  function planetHelio(d, el) {
    var N = el.N(d), i = el.i(d), w = el.w(d), a = el.a(d), e = el.e(d), M = rev(el.M(d));
    var E = eccentricAnomaly(M, e);
    var xv = a * (cosd(E) - e);
    var yv = a * Math.sqrt(1 - e * e) * sind(E);
    var v = atan2d(yv, xv);
    var r = Math.sqrt(xv * xv + yv * yv);
    var xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
    var yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
    return { x: xh, y: yh };
  }

  // Moon: geocentric ecliptic longitude with the major periodic perturbations.
  function moon(d, s) {
    var N = rev(125.1228 - 0.0529538083 * d);
    var i = 5.1454;
    var w = rev(318.0634 + 0.1643573223 * d);
    var a = 60.2666, e = 0.054900;
    var M = rev(115.3654 + 13.0649929509 * d);
    var E = eccentricAnomaly(M, e);
    var xv = a * (cosd(E) - e);
    var yv = a * Math.sqrt(1 - e * e) * sind(E);
    var v = atan2d(yv, xv);
    var r = Math.sqrt(xv * xv + yv * yv);
    var xh = r * (cosd(N) * cosd(v + w) - sind(N) * sind(v + w) * cosd(i));
    var yh = r * (sind(N) * cosd(v + w) + cosd(N) * sind(v + w) * cosd(i));
    var lon = atan2d(yh, xh);

    var Ms = s.M, ws = s.w;
    var Ls = rev(Ms + ws);     // Sun's mean longitude
    var Lm = rev(N + w + M);   // Moon's mean longitude
    var Dm = rev(Lm - Ls);     // mean elongation
    var F = rev(Lm - N);       // argument of latitude
    lon += -1.274 * sind(M - 2 * Dm)
         +  0.658 * sind(2 * Dm)
         -  0.186 * sind(Ms)
         -  0.059 * sind(2 * M - 2 * Dm)
         -  0.057 * sind(M - 2 * Dm + Ms)
         +  0.053 * sind(M + 2 * Dm)
         +  0.046 * sind(2 * Dm - Ms)
         +  0.041 * sind(M - Ms)
         -  0.035 * sind(Dm)
         -  0.031 * sind(M + Ms)
         -  0.015 * sind(2 * F - 2 * Dm)
         +  0.011 * sind(M - 4 * Dm);
    return rev(lon);
  }

  // Pluto: Schlyter's special series (valid ~1800-2100), converted to geocentric.
  function pluto(d, s) {
    var S = rev(50.03 + 0.033459652 * d);
    var P = rev(238.95 + 0.003968789 * d);
    var lon = 238.9508 + 0.00400703 * d
      - 19.799 * sind(P)     + 19.848 * cosd(P)
      +  0.897 * sind(2 * P) -  4.956 * cosd(2 * P)
      +  0.610 * sind(3 * P) +  1.211 * cosd(3 * P)
      -  0.341 * sind(4 * P) -  0.190 * cosd(4 * P)
      +  0.128 * sind(5 * P) -  0.034 * cosd(5 * P)
      -  0.038 * sind(6 * P) +  0.031 * cosd(6 * P)
      +  0.020 * sind(S - P) -  0.010 * cosd(S - P);
    var lat = -3.9082
      -  5.453 * sind(P)     - 14.975 * cosd(P)
      +  3.527 * sind(2 * P) +  1.673 * cosd(2 * P)
      -  1.051 * sind(3 * P) +  0.328 * cosd(3 * P)
      +  0.179 * sind(4 * P) -  0.292 * cosd(4 * P)
      +  0.019 * sind(5 * P) +  0.100 * cosd(5 * P)
      -  0.031 * sind(6 * P) -  0.026 * cosd(6 * P)
      +  0.011 * cosd(S - P);
    var r = 40.72
      +  6.68 * sind(P) +  6.90 * cosd(P)
      -  1.18 * sind(2 * P) - 0.03 * cosd(2 * P)
      +  0.15 * sind(3 * P) - 0.14 * cosd(3 * P);
    var xh = r * cosd(lon) * cosd(lat);
    var yh = r * sind(lon) * cosd(lat);
    return rev(atan2d(yh + s.y, xh + s.x));
  }

  // Orbital elements as functions of the day number d (Schlyter).
  var ELEMENTS = {
    mercury: { N: function (d) { return 48.3313 + 3.24587e-5 * d; }, i: function (d) { return 7.0047 + 5.00e-8 * d; }, w: function (d) { return 29.1241 + 1.01444e-5 * d; }, a: function () { return 0.387098; }, e: function (d) { return 0.205635 + 5.59e-10 * d; }, M: function (d) { return 168.6562 + 4.0923344368 * d; } },
    venus:   { N: function (d) { return 76.6799 + 2.46590e-5 * d; }, i: function (d) { return 3.3946 + 2.75e-8 * d; }, w: function (d) { return 54.8910 + 1.38374e-5 * d; }, a: function () { return 0.723330; }, e: function (d) { return 0.006773 - 1.302e-9 * d; }, M: function (d) { return 48.0052 + 1.6021302244 * d; } },
    mars:    { N: function (d) { return 49.5574 + 2.11081e-5 * d; }, i: function (d) { return 1.8497 - 1.78e-8 * d; }, w: function (d) { return 286.5016 + 2.92961e-5 * d; }, a: function () { return 1.523688; }, e: function (d) { return 0.093405 + 2.516e-9 * d; }, M: function (d) { return 18.6021 + 0.5240207766 * d; } },
    jupiter: { N: function (d) { return 100.4542 + 2.76854e-5 * d; }, i: function (d) { return 1.3030 - 1.557e-7 * d; }, w: function (d) { return 273.8777 + 1.64505e-5 * d; }, a: function () { return 5.20256; }, e: function (d) { return 0.048498 + 4.469e-9 * d; }, M: function (d) { return 19.8950 + 0.0830853001 * d; } },
    saturn:  { N: function (d) { return 113.6634 + 2.38980e-5 * d; }, i: function (d) { return 2.4886 - 1.081e-7 * d; }, w: function (d) { return 339.3939 + 2.97661e-5 * d; }, a: function () { return 9.55475; }, e: function (d) { return 0.055546 - 9.499e-9 * d; }, M: function (d) { return 316.9670 + 0.0334442282 * d; } },
    uranus:  { N: function (d) { return 74.0005 + 1.3978e-5 * d; }, i: function (d) { return 0.7733 + 1.9e-8 * d; }, w: function (d) { return 96.6612 + 3.0565e-5 * d; }, a: function (d) { return 19.18171 - 1.55e-8 * d; }, e: function (d) { return 0.047318 + 7.45e-9 * d; }, M: function (d) { return 142.5905 + 0.011725806 * d; } },
    neptune: { N: function (d) { return 131.7806 + 3.0173e-5 * d; }, i: function (d) { return 1.7700 - 2.55e-7 * d; }, w: function (d) { return 272.8461 - 6.027e-6 * d; }, a: function (d) { return 30.05826 + 3.313e-8 * d; }, e: function (d) { return 0.008606 + 2.15e-9 * d; }, M: function (d) { return 260.2471 + 0.005995147 * d; } }
  };

  var PLANET_ORDER = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"];

  // Main entry: geocentric ecliptic longitude (deg) of every body for a JS Date.
  function positions(date) {
    var d = dayNumber(date);
    var s = sun(d);
    var out = { sun: rev(s.lon), moon: moon(d, s), pluto: pluto(d, s) };
    PLANET_ORDER.forEach(function (name) {
      var h = planetHelio(d, ELEMENTS[name]);
      out[name] = rev(atan2d(h.y + s.y, h.x + s.x));
    });
    return out;
  }

  // Obliquity of the ecliptic (deg) for day number d.
  function obliquity(d) { return 23.4393 - 3.563e-7 * d; }

  // Local sidereal time (deg) at an east-positive longitude for a moment.
  function localSiderealDeg(date, lonEastDeg) {
    var d = dayNumber(date);
    var s = sun(d);
    var Ls = rev(s.M + s.w);
    var ut = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    var gmst = rev(Ls + 180 + ut * 15);
    return rev(gmst + lonEastDeg);
  }

  // Solar altitude in degrees above the horizon at a location & moment.
  // Positive = Sun is up (day), negative = below the horizon (night). Drives the auto theme.
  function sunAltitude(date, latDeg, lonEastDeg) {
    var d = dayNumber(date);
    var s = sun(d);
    var lon = s.lon;
    var ecl = obliquity(d);
    var ra = rev(atan2d(cosd(ecl) * sind(lon), cosd(lon)));
    var dec = asind(sind(ecl) * sind(lon));
    var ha = rev(localSiderealDeg(date, lonEastDeg) - ra);
    return asind(sind(latDeg) * sind(dec) + cosd(latDeg) * cosd(dec) * cosd(ha));
  }

  // Ascendant: the ecliptic longitude rising on the eastern horizon (deg).
  // Depends on date/time AND geographic location — this is what makes the rising sign change.
  function ascendant(date, latDeg, lonEastDeg) {
    var d = dayNumber(date);
    var ecl = obliquity(d);
    var lst = localSiderealDeg(date, lonEastDeg);
    var asc = atan2d(cosd(lst), -(sind(lst) * cosd(ecl) + tand(latDeg) * sind(ecl)));
    return rev(asc);
  }

  var api = { positions: positions, dayNumber: dayNumber, sunAltitude: sunAltitude, ascendant: ascendant };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Ephemeris = api;
})(typeof window !== "undefined" ? window : this);
