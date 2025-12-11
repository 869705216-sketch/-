import React, { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { MagicParticles } from './MagicParticles';
import { MagicOrnaments } from './MagicOrnaments';
import { MagicState, HandData } from '../types';

interface SceneProps {
  appState: MagicState;
  handData: HandData | null;
}

const CameraController: React.FC<{ handData: HandData | null }> = ({ handData }) => {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 18)); // Facing XY plane
  
  useFrame((state, delta) => {
    if (handData) {
        // Map hand X/Y to slight camera movement for parallax
        // X maps to horizontal, Y to vertical
        const xOffset = (handData.x - 0.5) * 8; 
        const yOffset = (handData.y - 0.5) * 6;
        
        targetPos.current.set(xOffset, -yOffset, 18);
    } else {
        targetPos.current.set(0, 0, 18);
    }
    
    camera.position.lerp(targetPos.current, delta * 1.5);
    camera.lookAt(0, 0, 0);
  });

  return null;
};

// Background shader for "surrounding glow"
const AtmosphereBackground = () => {
    return (
        <mesh position={[0, 0, -10]}>
            <planeGeometry args={[50, 50]} />
            <shaderMaterial
                transparent
                depthWrite={false}
                vertexShader={`
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `}
                fragmentShader={`
                    varying vec2 vUv;
                    void main() {
                        // Distance from center
                        vec2 center = vUv - 0.5;
                        float dist = length(center);
                        
                        // Radial glow: Black center -> Colored edges
                        // smoothstep(inner, outer, dist)
                        // We want center black (0.0), edges glowing
                        
                        float glow = smoothstep(0.2, 0.7, dist);
                        
                        // Pink/Purple glow
                        vec3 color = vec3(0.6, 0.0, 0.3) * 0.3; // subtle
                        
                        gl_FragColor = vec4(color * glow, 1.0);
                    }
                `}
            />
        </mesh>
    );
};

export const Scene: React.FC<SceneProps> = ({ appState, handData }) => {
  return (
    <Canvas>
      <PerspectiveCamera makeDefault position={[0, 0, 18]} fov={50} />
      <CameraController handData={handData} />
      
      {/* Lighting */}
      <ambientLight intensity={0.2} color="#442233" />
      <pointLight position={[0, 0, 10]} intensity={2} color="#ff33aa" distance={20} />
      {/* Environment for reflections on crystals, but keep it dark */}
      <Environment preset="city" background={false} environmentIntensity={0.5} />
      
      <AtmosphereBackground />

      {/* Content Group */}
      <group position={[0, 0, 0]}>
        <MagicParticles state={appState} />
        <MagicOrnaments state={appState} />
        
        {/* Central Glowing Core */}
        <mesh 
            scale={appState === MagicState.FORMED ? 1 : 0} 
            position={[0, 0, -0.5]} // Slightly behind particles
        >
             <circleGeometry args={[1.5, 64]} />
             <meshBasicMaterial 
                color="#ffddff" 
                transparent 
                opacity={0.3} 
                blending={THREE.AdditiveBlending} 
             />
        </mesh>
      </group>

      {/* Post Processing */}
      <EffectComposer disableNormalPass>
        <Bloom 
            luminanceThreshold={0.15} 
            mipmapBlur 
            intensity={1.5} 
            radius={0.5}
            levels={8}
        />
        <Vignette eskil={false} offset={0.2} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  );
};
