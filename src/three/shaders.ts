// The morph runs entirely on the GPU: every point knows where it is in shape A and
// in shape B, and the vertex shader moves it between them with its own delay.

export const pointsVertex = /* glsl */ `
  uniform float uMorph;      // 0 → shape A, 1 → shape B
  uniform float uTime;
  uniform float uSize;
  uniform float uPR;
  uniform float uCalm;       // 0 when the user prefers reduced motion
  uniform float uIntro;      // 0 → scattered, 1 → assembled (first load)
  uniform vec2 uMetaA;       // alpha, size of shape A
  uniform vec2 uMetaB;
  uniform float uAlpha;
  uniform float uHeroW;      // 1 while shape A is the fresco
  uniform vec3 uGap;         // the fingertips' gap, shape space
  uniform float uReach;      // 0..1, the hands reach for each other
  uniform float uPulse;      // a burst from the gap
  uniform float uScale;      // world units per shape unit: keeps jitter the same size at any zoom

  attribute vec3 aTo;
  attribute vec3 aColA;
  attribute vec3 aColB;
  attribute vec4 aRnd;

  varying vec3 vCol;
  varying float vAlpha;

  void main() {
    // Each point leaves on its own schedule, so the shape dissolves rather than jumps.
    float S = 0.6;
    float t = clamp(uMorph * (1.0 + S) - aRnd.x * S, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    float mid = sin(3.14159265 * t);

    vec3 p = mix(position, aTo, t);

    // In flight the points swirl, like sand caught by wind.
    vec3 n = vec3(
      sin(aRnd.y * 6.2831 + uTime * 0.7 + p.y * 3.1),
      cos(aRnd.z * 6.2831 + uTime * 0.6 + p.x * 2.7),
      sin(aRnd.w * 6.2831 + uTime * 0.5 + p.z * 2.3)
    );
    p += n * mid * (0.28 + aRnd.y * 0.45) * (1.8 / uScale);
    p += n * (0.006 / uScale) * uCalm;

    // The fresco: hands reach for the gap, a click sends a ripple out of it.
    float hw = uHeroW * (1.0 - t);
    vec2 dg = p.xy - uGap.xy;
    float dx = uGap.x - p.x;
    float fall = smoothstep(0.7, 0.0, abs(dx)) * smoothstep(0.4, 0.0, abs(dg.y));
    p.x += sign(dx) * uReach * 0.0115 * fall * hw;
    float pd = length(dg);
    p.xy += normalize(dg + 1e-5) * uPulse * 0.05 * exp(-pd * 6.0) * hw;
    p.z += uPulse * 0.15 * exp(-pd * 5.0) * (aRnd.z - 0.5) * hw;

    // First load: points fall in from a wide cloud.
    float it = clamp(uIntro * 1.6 - aRnd.x * 0.6, 0.0, 1.0);
    it = 1.0 - pow(1.0 - it, 3.0);
    vec3 scatter = (aRnd.yzw - 0.5) * vec3(5.0, 3.0, 4.0);
    p = mix(scatter, p, it);

    vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    vec2 meta = mix(uMetaA, uMetaB, t);
    gl_PointSize = uSize * uPR * meta.y * (0.55 + aRnd.w * 0.9) * (1.0 + mid * 0.5) / -mv.z;

    vCol = mix(aColA, aColB, t);
    vAlpha = uAlpha * meta.x * (0.55 + aRnd.y * 0.45) * mix(0.35, 1.0, it);
  }
`

export const pointsFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vCol;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.12, r);
    gl_FragColor = vec4(vCol, a * vAlpha * uOpacity);
  }
`

// The spark between the fingertips: a small, flickering swarm of light.
export const sparkVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPR;
  uniform float uSize;
  uniform vec3 uGap;
  uniform float uI;          // intensity 0..1
  uniform float uPulse;

  attribute vec4 aRnd;
  varying float vA;

  void main() {
    float a = aRnd.x * 6.2831 + uTime * (0.6 + aRnd.y * 1.4);
    float b = aRnd.z * 3.1415;
    float r = (0.006 + aRnd.w * aRnd.w * (0.03 + 0.05 * uI)) * (1.0 + uPulse * 4.0);
    vec3 p = uGap + vec3(cos(a) * sin(b), cos(b) * 0.6, sin(a) * sin(b)) * r;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float flick = 0.5 + 0.5 * sin(uTime * (3.0 + aRnd.y * 9.0) + aRnd.x * 40.0);
    gl_PointSize = uSize * uPR * (0.6 + flick * 0.8) / -mv.z;
    vA = flick * (1.0 - aRnd.w * 0.6);
  }
`

export const sparkFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float a = pow(smoothstep(0.5, 0.0, r), 1.6);
    gl_FragColor = vec4(uColor, a * vA * uOpacity);
  }
`
