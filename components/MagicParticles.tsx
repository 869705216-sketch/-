import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MagicState } from '../types';

const particleVertexShader = `
  uniform float uTime;
  uniform float uMix; // 0.0 = Chaos, 1.0 = Formed
  
  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute float aSize;
  attribute float aShapeType; // 0.0 = General, 1.0 = Moon
  
  varying vec3 vColor;
  
  void main() {
    // Interpolate position
    vec3 pos = mix(aChaosPos, aTargetPos, uMix);
    
    // Add some noise/floating movement based on time
    // Chaos has more noise, Formed has subtle "breathing"
    float noiseAmp = mix(0.5, 0.02, uMix); 
    
    pos.x += sin(uTime * 1.0 + pos.y * 0.5) * noiseAmp;
    pos.y += cos(uTime * 0.8 + pos.x * 0.5) * noiseAmp;
    pos.z += sin(uTime * 1.5 + pos.x) * noiseAmp; // Z-noise mostly for chaos
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation - fine particles
    // chaos: larger blobs, formed: fine dust
    float sizeMix = mix(1.2, 0.7, uMix);
    gl_PointSize = aSize * sizeMix * (120.0 / -mvPosition.z);
    
    // Twinkle effect
    float alpha = 0.5 + 0.5 * sin(uTime * 3.0 + aChaosPos.x * 10.0);
    
    // Color transition: Chaos (Cool White/Blue) -> Formed (Sakura Pink/Gold)
    vec3 colorChaos = vec3(0.8, 0.9, 1.0);
    
    vec3 colorFormed;
    
    if (aShapeType > 0.5) {
        // MOON COLOR: Pale Gold / Moon Yellow
        colorFormed = vec3(1.0, 0.85, 0.4); 
    } else {
        // STANDARD COLOR: Sakura Pink / White
        colorFormed = vec3(1.0, 0.7, 0.85); // Softer pink
        
        // Add golden/white hints to the formed state for "stars" (large particles)
        if (aSize > 0.3 && uMix > 0.8) {
            colorFormed = vec3(1.0, 0.95, 0.8); // Pale Gold/White
        }
    }
    
    vColor = mix(colorChaos, colorFormed, uMix) * alpha;
  }
`;

const particleFragmentShader = `
  varying vec3 vColor;
  
  void main() {
    // Circular particle
    vec2 circCoord = 2.0 * gl_PointCoord - 1.0;
    float dist = dot(circCoord, circCoord);
    if (dist > 1.0) {
      discard;
    }
    
    // Sharp core, soft glow
    float alpha = 1.0 - smoothstep(0.0, 1.0, dist); 
    // Boost alpha for brilliance
    alpha = pow(alpha, 1.5);
    
    gl_FragColor = vec4(vColor, alpha);
  }
`;

interface MagicParticlesProps {
  state: MagicState;
}

export const MagicParticles: React.FC<MagicParticlesProps> = ({ state }) => {
  const mesh = useRef<THREE.Points>(null);
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  
  // Lerp factor
  const currentMix = useRef(0);

  // Even finer particles for high density
  const count = 32000;
  
  const { chaos, target, sizes, types } = useMemo(() => {
    const chaosArray = new Float32Array(count * 3);
    const targetArray = new Float32Array(count * 3);
    const sizesArray = new Float32Array(count);
    const typesArray = new Float32Array(count); // 0 or 1

    // Helper: Point on a circle
    const getCirclePoint = (r: number, angle: number) => ({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        z: 0
    });

    // Helper: Point on a Star (Pentagram)
    // Upright Star: Top point is at PI/2
    const getPentagramPoint = (r: number, index: number, offsetAngle: number = 0) => {
        const angle = (index * 2 * Math.PI / 5) + (Math.PI / 2) + offsetAngle;
        return getCirclePoint(r, angle);
    };

    // Draw a line between two points
    const lerpPoint = (p1: {x:number, y:number}, p2: {x:number, y:number}, t: number) => ({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
        z: 0
    });
    
    // Random point in a specific annulus sector for the moon
    // Using Rejection Sampling for CSG (Constructive Solid Geometry)
    const getMoonPoint = () => {
        let valid = false;
        let x = 0, y = 0;
        let attempts = 0;
        
        // Define Moon Geometry
        // Body Circle: Center (-4.85, 0), Radius 1.65
        //   -> Leftmost: -6.5 (Touches Outer Ring)
        //   -> Rightmost: -3.2 (Touches Middle Ring)
        // Cutout Circle: Center (-3.6, 0), Radius 1.35
        //   -> Creates the crescent shape opening to the right
        
        const cxBody = -4.85;
        const rBody = 1.65;
        
        const cxCut = -3.6;
        const rCut = 1.35;
        
        while (!valid && attempts < 20) {
            attempts++;
            // Sample bounding box around the body circle
            x = cxBody + (Math.random() - 0.5) * (rBody * 2);
            y = (Math.random() - 0.5) * (rBody * 2);
            
            const distBody = Math.sqrt(Math.pow(x - cxBody, 2) + y*y);
            const distCut = Math.sqrt(Math.pow(x - cxCut, 2) + y*y);
            
            // INSIDE Body AND OUTSIDE Cutout
            if (distBody <= rBody && distCut >= rCut) {
                valid = true;
            }
        }
        
        // Fallback if rejection sampling takes too long (rare)
        if (!valid) {
            return { x: -6.5, y: 0, z: 0 }; 
        }
        
        return { x, y, z: 0 };
    };

    const starPath = [0, 2, 4, 1, 3, 0]; // Standard pentagram drawing order

    for (let i = 0; i < count; i++) {
      // --- CHAOS POSITION (Sphere Cloud) ---
      const r = 18 * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      
      chaosArray[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      chaosArray[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      chaosArray[i * 3 + 2] = r * Math.cos(phi);

      // --- TARGET POSITION (XY Plane Magic Circle) ---
      const p = Math.random();
      let tx = 0, ty = 0, tz = 0;
      let shapeType = 0; // Default Pink
      
      // Complex Magic Circle Composition
      
      if (p < 0.08) {
        // 1. Outer Circle (R=6.5)
        const angle = Math.random() * Math.PI * 2;
        const pt = getCirclePoint(6.5, angle);
        tx = pt.x; ty = pt.y; tz = pt.z;
      } 
      else if (p < 0.20) {
        // 2. Large Pentagram A (Upright, R=6.5)
        const segment = Math.floor(Math.random() * 5);
        const idxA = starPath[segment];
        const idxB = starPath[segment + 1];
        const ptA = getPentagramPoint(6.5, idxA);
        const ptB = getPentagramPoint(6.5, idxB);
        const t = Math.random();
        const pt = lerpPoint(ptA, ptB, t);
        tx = pt.x; ty = pt.y; tz = pt.z;
      }
      else if (p < 0.30) {
         // 3. Large Pentagram B (Inverted/Rotated, R=6.5)
         const segment = Math.floor(Math.random() * 5);
         const idxA = starPath[segment];
         const idxB = starPath[segment + 1];
         const offset = Math.PI / 1; 
         const ptA = getPentagramPoint(6.5, idxA, offset);
         const ptB = getPentagramPoint(6.5, idxB, offset);
         const t = Math.random();
         const pt = lerpPoint(ptA, ptB, t);
         tx = pt.x; ty = pt.y; tz = pt.z;
      }
      else if (p < 0.40) {
        // 4. Middle Circle (R=3.2)
        const angle = Math.random() * Math.PI * 2;
        const pt = getCirclePoint(3.2, angle);
        tx = pt.x; ty = pt.y; tz = pt.z;
      }
      else if (p < 0.60) {
        // 5. Crescent Moon (Left side, BIGGER & FIT)
        // Uses CSG Rejection Sampling
        shapeType = 1; // Gold Moon
        const pt = getMoonPoint();
        tx = pt.x; ty = pt.y; tz = pt.z;
      }
      else if (p < 0.72) {
        // 6. Inner Pentagram (Upright, R=3.2)
        const segment = Math.floor(Math.random() * 5);
        const idxA = starPath[segment];
        const idxB = starPath[segment + 1];
        const ptA = getPentagramPoint(3.2, idxA);
        const ptB = getPentagramPoint(3.2, idxB);
        const t = Math.random();
        const pt = lerpPoint(ptA, ptB, t);
        tx = pt.x; ty = pt.y; tz = pt.z;
      }
      else if (p < 0.82) {
        // 7. Inner Circle (R=1.2)
        const angle = Math.random() * Math.PI * 2;
        const pt = getCirclePoint(1.2, angle);
        tx = pt.x; ty = pt.y; tz = pt.z;
      }
      else if (p < 0.92) {
          // 8. Tiny Center Star (R=1.2)
        const segment = Math.floor(Math.random() * 5);
        const idxA = starPath[segment];
        const idxB = starPath[segment + 1];
        const ptA = getPentagramPoint(1.2, idxA, Math.PI); 
        const ptB = getPentagramPoint(1.2, idxB, Math.PI);
        const t = Math.random();
        const pt = lerpPoint(ptA, ptB, t);
        tx = pt.x; ty = pt.y; tz = pt.z;
      }
      else {
        // 9. Center Fill (Core)
        const rInner = Math.random() * 0.5;
        const angle = Math.random() * Math.PI * 2;
        tx = Math.cos(angle) * rInner;
        ty = Math.sin(angle) * rInner;
        tz = 0;
      }
      
      targetArray[i * 3] = tx;
      targetArray[i * 3 + 1] = ty;
      targetArray[i * 3 + 2] = tz;
      
      // Sizes: smaller generally
      sizesArray[i] = Math.random() * 0.3 + 0.05;
      typesArray[i] = shapeType;
    }

    return {
      chaos: chaosArray,
      target: targetArray,
      sizes: sizesArray,
      types: typesArray
    };
  }, []);

  useFrame((stateObj, delta) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uTime.value = stateObj.clock.elapsedTime;
      
      const targetVal = state === MagicState.FORMED ? 1.0 : 0.0;
      currentMix.current = THREE.MathUtils.lerp(currentMix.current, targetVal, delta * 1.5);
      
      shaderRef.current.uniforms.uMix.value = currentMix.current;
      
      // Slight rotation of the entire circle when formed
      if (mesh.current && currentMix.current > 0.5) {
          mesh.current.rotation.z -= delta * 0.05;
      }
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={chaos}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aChaosPos"
          count={count}
          array={chaos}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aTargetPos"
          count={count}
          array={target}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={count}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aShapeType"
          count={count}
          array={types}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderRef}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uMix: { value: 0 }
        }}
      />
    </points>
  );
};
