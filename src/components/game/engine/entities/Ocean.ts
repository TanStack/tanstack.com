import * as THREE from 'three'
import { COLORS } from '../../utils/colors'

// Simple fallback for debugging - set to true to use basic material
const USE_SIMPLE_OCEAN = false

export class Ocean {
  mesh: THREE.Mesh
  private material: THREE.ShaderMaterial | THREE.MeshStandardMaterial

  constructor() {
    const geometry = new THREE.PlaneGeometry(
      500,
      500,
      USE_SIMPLE_OCEAN ? 1 : 200,
      USE_SIMPLE_OCEAN ? 1 : 200,
    )
    geometry.rotateX(-Math.PI / 2)

    if (USE_SIMPLE_OCEAN) {
      this.material = new THREE.MeshStandardMaterial({
        color: COLORS.ocean.surface,
        transparent: true,
        opacity: 0.9,
      })
      this.mesh = new THREE.Mesh(geometry, this.material)
      this.mesh.position.y = -0.5
      this.mesh.receiveShadow = true
      return
    }

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color(COLORS.ocean.deep) },
        uMidColor: { value: new THREE.Color(COLORS.ocean.mid) },
        uSurfaceColor: { value: new THREE.Color(COLORS.ocean.surface) },
        uShallowColor: { value: new THREE.Color(COLORS.ocean.shallow) },
        uFoamColor: { value: new THREE.Color(COLORS.ocean.foam) },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vElevation;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                             -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          
          float wave1 = snoise(vec2(pos.x * 0.015 + uTime * 0.08, pos.z * 0.015 + uTime * 0.06)) * 0.1;
          float wave2 = snoise(vec2(pos.x * 0.04 - uTime * 0.1, pos.z * 0.04 + uTime * 0.08)) * 0.05;
          float wave3 = snoise(vec2(pos.x * 0.12 + uTime * 0.2, pos.z * 0.12 - uTime * 0.15)) * 0.03;
          float wave4 = snoise(vec2(pos.x * 0.25 + uTime * 0.3, pos.z * 0.25)) * 0.015;
          
          float elevation = wave1 + wave2 + wave3 + wave4;
          pos.y += elevation;
          
          vElevation = elevation;
          vWorldPos = pos;
          
          float eps = 0.5;
          float hL = snoise(vec2((pos.x - eps) * 0.015 + uTime * 0.08, pos.z * 0.015 + uTime * 0.06)) * 0.1;
          float hR = snoise(vec2((pos.x + eps) * 0.015 + uTime * 0.08, pos.z * 0.015 + uTime * 0.06)) * 0.1;
          float hD = snoise(vec2(pos.x * 0.015 + uTime * 0.08, (pos.z - eps) * 0.015 + uTime * 0.06)) * 0.1;
          float hU = snoise(vec2(pos.x * 0.015 + uTime * 0.08, (pos.z + eps) * 0.015 + uTime * 0.06)) * 0.1;
          vNormal = normalize(vec3(hL - hR, 2.0, hD - hU));
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeepColor;
        uniform vec3 uMidColor;
        uniform vec3 uSurfaceColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        varying vec2 vUv;
        varying float vElevation;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m; m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 a0 = x - floor(x + 0.5);
          m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
          vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        void main() {
          float distFromCenter = length(vWorldPos.xz);
          float depthFactor = clamp(distFromCenter / 80.0, 0.0, 1.0);
          
          float normElev = clamp((vElevation + 0.8) / 1.6, 0.0, 1.0);
          
          vec3 nearColor = mix(uSurfaceColor, uShallowColor, normElev);
          vec3 farColor = mix(uDeepColor, uMidColor, normElev * 0.5);
          vec3 color = mix(nearColor, farColor, depthFactor * 0.7);
          
          float colorNoise = snoise(vWorldPos.xz * 0.02) * 0.5 + 0.5;
          color = mix(color, color * 0.9, colorNoise * 0.15);
          
          float refractionNoise1 = snoise(vWorldPos.xz * 0.08 + uTime * 0.12);
          float refractionNoise2 = snoise(vWorldPos.xz * 0.12 - uTime * 0.08);
          vec3 tealTint = vec3(0.1, 0.6, 0.5);
          vec3 blueTint = vec3(0.1, 0.3, 0.7);
          float refractionAmount = (refractionNoise1 * 0.5 + 0.5) * 0.25;
          color = mix(color, mix(color, tealTint, 0.4), refractionAmount * (1.0 - depthFactor));
          color = mix(color, mix(color, blueTint, 0.3), refractionNoise2 * 0.15);
          
          vec3 lightDir = normalize(vec3(0.5, 0.8, 0.3));
          vec3 viewDir = normalize(vec3(0.0, 1.0, 0.5));
          vec3 halfDir = normalize(lightDir + viewDir);
          float spec = pow(max(dot(vNormal, halfDir), 0.0), 64.0);
          float shimmer = snoise(vWorldPos.xz * 0.5 + uTime * 0.8) * 0.3 + 0.7;
          color += vec3(1.0, 0.98, 0.9) * spec * 0.5 * shimmer;
          
          float foamNoise = snoise(vWorldPos.xz * 0.3 + uTime * 0.2) * 0.5 + 0.5;
          float foamThreshold = 0.3;
          if (vElevation > foamThreshold) {
            float foamStrength = (vElevation - foamThreshold) / 0.5;
            foamStrength = clamp(foamStrength * foamNoise * 1.5, 0.0, 1.0);
            color = mix(color, uFoamColor, foamStrength * 0.5);
          }
          
          float caustic1 = snoise(vWorldPos.xz * 0.15 + uTime * 0.15);
          float caustic2 = snoise(vWorldPos.xz * 0.25 - uTime * 0.1 + vec2(50.0, 30.0));
          float caustic3 = snoise(vWorldPos.xz * 0.08 + uTime * 0.05);
          float causticPattern = pow(abs(caustic1), 1.5) + pow(abs(caustic2), 2.0) * 0.5;
          causticPattern *= (caustic3 * 0.5 + 0.75);
          vec3 causticColor = vec3(0.15, 0.55, 0.6);
          color += causticColor * causticPattern * 0.2;
          
          gl_FragColor = vec4(color, 0.97);
        }
      `,
      transparent: true,
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.position.y = -0.5
    this.mesh.receiveShadow = true
  }

  update(time: number): void {
    if (this.material instanceof THREE.ShaderMaterial) {
      this.material.uniforms.uTime.value = time
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}

// Wave height function for boat bobbing (matches shader + ocean offset)
export function getWaveHeight(x: number, z: number, time: number): number {
  const wave1 =
    Math.sin(x * 0.015 + time * 0.08) * Math.cos(z * 0.015 + time * 0.06) * 0.1
  const wave2 =
    Math.sin(x * 0.04 - time * 0.1) * Math.cos(z * 0.04 + time * 0.08) * 0.05
  const wave3 =
    Math.sin(x * 0.12 + time * 0.2) * Math.cos(z * 0.12 - time * 0.15) * 0.03
  // Ocean mesh is at Y=-0.5, so subtract that offset
  return wave1 + wave2 + wave3 - 0.5
}
