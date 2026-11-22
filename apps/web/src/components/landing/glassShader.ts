/**
 * Raymarched glass sculpture for the hero.
 * - Two smooth-unioned SDF bodies (a breathing main form + a pebble) that rotate
 *   with the cursor and ripple on click (uPulse).
 * - Glass shading: Fresnel-mixed reflection/refraction of a procedural studio
 *   environment, thin-film iridescence on the rim, two specular lights.
 * - Floor: soft shadow, reflection of the sculpture, beam pool of light.
 * - Screen-space volumetric beam from the top-right with drifting dust.
 */
export const VERT = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;    // -1..1, smoothed
uniform float uPulse;    // 0..1 click ripple, decays
uniform vec2  uOffset;   // world-space placement of the sculpture
uniform float uScale;

#define FLOOR_Y -1.12

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float map(vec3 p) {
  vec3 q = (p - vec3(uOffset, 0.0)) / uScale;
  q.xz *= rot(0.35 + uTime * 0.12 + uMouse.x * 0.55);
  q.yz *= rot(-0.08 + uMouse.y * 0.25);

  float t = uTime * 0.55;
  // main form: soft, slightly asymmetric "drop"
  vec3 b = q - vec3(-0.12, 0.08, 0.0);
  b.y += 0.16 * b.x * b.x - 0.06 * b.x;
  float d1 = sdEllipsoid(b, vec3(1.1, 0.94, 0.84));
  // soft lobe on top-left gives the drop an asymmetric, sculpted silhouette
  float lobe = sdEllipsoid(b - vec3(-0.42, 0.42, 0.05), vec3(0.62, 0.55, 0.6));
  d1 = smin(d1, lobe, 0.35);
  d1 += 0.055 * sin(2.7 * b.x + t) * sin(2.3 * b.y + t * 1.31) * sin(2.1 * b.z - t * 0.73);
  // click ripple travelling outward
  float r = length(b);
  d1 -= uPulse * 0.07 * sin(9.0 * r - uTime * 9.0) * exp(-1.2 * r);

  // pebble resting beside it
  vec3 c = q - vec3(1.02, -0.78, 0.38);
  c.xz *= rot(0.5);
  float d2 = sdEllipsoid(c, vec3(0.78, 0.31, 0.56));

  return smin(d1, d2, 0.22) * uScale;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)));
}

float march(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 80; i++) {
    float d = map(ro + rd * t);
    if (d < 0.0012) return t;
    t += d * 0.92;
    if (t > 14.0) break;
  }
  return -1.0;
}

float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.05;
  for (int i = 0; i < 28; i++) {
    float h = map(ro + rd * t);
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.04, 0.3);
    if (res < 0.01 || t > 6.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 keyDir()  { return normalize(vec3(0.62 + uMouse.x * 0.18, 0.95, 0.28 - uMouse.y * 0.1)); }
vec3 kickDir() { return normalize(vec3(1.0, -0.15, 0.45)); }

// Procedural studio: dark room, one soft-box beam, violet kicker, floor bounce.
vec3 env(vec3 rd) {
  float k = max(dot(rd, keyDir()), 0.0);
  vec3 col = vec3(0.018, 0.02, 0.032);
  col += vec3(1.0, 0.98, 1.0) * pow(k, 28.0) * 3.4;
  col += vec3(0.62, 0.58, 0.95) * pow(k, 6.0) * 0.1;
  float kk = max(dot(rd, kickDir()), 0.0);
  col += vec3(0.55, 0.32, 1.0) * pow(kk, 10.0) * 1.8;
  col += vec3(0.2, 0.75, 0.8) * pow(max(dot(rd, normalize(vec3(-1.0, 0.1, 0.6))), 0.0), 14.0) * 0.45;
  col += vec3(0.035, 0.035, 0.045) * smoothstep(0.02, -0.25, rd.y);
  return col;
}

vec3 shadeGlass(vec3 p, vec3 rd) {
  vec3 n = calcNormal(p);
  float cosI = max(dot(-rd, n), 0.0);
  float fr = 0.04 + 0.96 * pow(1.0 - cosI, 4.0);

  vec3 refl = env(reflect(rd, n));
  vec3 rdIn = refract(rd, n, 0.69);
  // fake thickness: look through with a slight bend + absorption tint
  vec3 refr = env(normalize(rdIn + n * 0.25)) * vec3(0.34, 0.36, 0.46);
  vec3 col = mix(refr, refl, fr);

  // thin-film iridescence on grazing angles
  float film = pow(1.0 - cosI, 3.6);
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (film * 1.3 + vec3(0.0, 0.33, 0.67)) + uTime * 0.35);
  // iridescence mostly where the key or kicker light grazes the rim
  float litRim = 0.35 + 0.65 * max(dot(n, kickDir()), max(dot(n, keyDir()), 0.0));
  col += irid * film * 0.3 * litRim;
  // dark body: glass absorbs, the room is dark
  col *= mix(0.38, 1.0, fr);

  // speculars
  vec3 h1 = normalize(keyDir() - rd);
  col += vec3(1.0) * pow(max(dot(n, h1), 0.0), 120.0) * 3.0;
  vec3 h2 = normalize(kickDir() - rd);
  col += vec3(0.7, 0.5, 1.0) * pow(max(dot(n, h2), 0.0), 50.0) * 1.4;

  // interior caustic glow where the beam enters
  col += vec3(0.75, 0.72, 1.0) * pow(max(dot(n, keyDir()), 0.0), 3.0) * 0.06;
  return col;
}

vec3 floorColor(vec3 p, vec3 rd) {
  vec3 base = vec3(0.028, 0.03, 0.042);
  // pool of light where the beam lands
  vec2 pool = p.xz - vec2(uOffset.x + 0.6, -0.2);
  float lit = exp(-dot(pool * vec2(0.35, 0.9), pool * vec2(0.35, 0.9)));
  base += vec3(0.09, 0.09, 0.11) * lit;
  // horizon falloff
  base *= smoothstep(-9.0, -1.0, p.z);

  float sh = softShadow(p + vec3(0.0, 0.002, 0.0), keyDir());
  // contact darkening
  float ao = clamp(map(p) * 1.6 + 0.25, 0.0, 1.0);
  base *= mix(0.25, 1.0, sh) * ao;

  // reflection of the sculpture
  vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));
  float t = march(p + rr * 0.01, rr);
  if (t > 0.0) {
    vec3 hp = p + rr * t;
    base += shadeGlass(hp, rr) * 0.22 * exp(-t * 0.6);
  }
  return base;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;
  vec2 suv = frag / uRes; // 0..1 screen space

  vec3 ro = vec3(0.0, 0.42, 6.0);
  vec3 ta = vec3(0.0, -0.18, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.75 * ww);

  vec3 col = vec3(0.016, 0.017, 0.027);
  // backdrop gradient (studio sweep)
  vec3 backdrop = col + vec3(0.014, 0.014, 0.024) * smoothstep(-0.4, 0.6, uv.y) * smoothstep(1.4, 0.0, abs(uv.x - 0.5));
  col = backdrop;

  float tObj = march(ro, rd);
  float tFloor = rd.y < 0.0 ? (FLOOR_Y - ro.y) / rd.y : -1.0;

  if (tObj > 0.0 && (tFloor < 0.0 || tObj < tFloor)) {
    col = shadeGlass(ro + rd * tObj, rd);
  } else if (tFloor > 0.0) {
    vec3 fc = floorColor(ro + rd * tFloor, rd);
    col = mix(fc, backdrop, smoothstep(9.0, 22.0, tFloor));
  }

  // volumetric beam (screen space) from the top-right corner toward the sculpture
  vec2 a = vec2(1.08, 1.1);
  vec2 dir = normalize(vec2(-0.55, -1.0) + vec2(uMouse.x * 0.08, 0.0));
  vec2 pa = suv - a;
  float along = dot(pa, dir);
  float across = length(pa - dir * along);
  float width = 0.045 + along * 0.15;
  float beam = exp(-pow(across / max(width, 0.001), 2.0)) * smoothstep(0.0, 0.25, along) * smoothstep(1.5, 0.35, along);
  float flicker = 0.9 + 0.1 * sin(uTime * 0.7) * sin(uTime * 1.3 + 1.0);
  // drifting dust in the beam
  vec2 g = floor(frag / 3.0);
  float dust = step(0.9965, hash(g + floor(uTime * 0.5))) * beam;
  col += vec3(0.82, 0.82, 0.95) * beam * 0.17 * flicker + vec3(dust) * 0.45;

  // grade
  col = aces(col * 1.15);
  col = pow(col, vec3(0.4545));
  // vignette + grain
  col *= 1.0 - 0.38 * dot(uv * 0.9, uv * 0.9);
  col += (hash(frag + fract(uTime)) - 0.5) * 0.018;

  gl_FragColor = vec4(col, 1.0);
}
`;
