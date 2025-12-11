import React, { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MagicState } from '../types';

interface MagicOrnamentsProps {
  state: MagicState;
}

const tempObject = new THREE.Object3D();
const tempPos = new THREE.Vector3();

export const MagicOrnaments: React.FC<MagicOrnamentsProps> = ({ state }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 15; // 5 outer upright, 5 outer inverted, 5 inner

  // Data storage for dual positions
  const data = useMemo(() => {
    const chaosPositions: THREE.Vector3[] = [];
    const targetPositions: THREE.Vector3[] = [];
    const rotationSpeeds: number[] = [];
    
    // Upright Star Tips (R=6.5)
    // Inverted Star Tips (R=6.5) - New layer
    // Inner Star Tips (R=3.2)
    
    for (let i = 0; i < count; i++) {
      // Chaos: Random scattering in 3D
      chaosPositions.push(new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20
      ));

      // Target: XY Plane
      let tx, ty, tz = 0;
      
      if (i < 5) {
        // Outer Upright Star Tips
        const angle = (i * 2 * Math.PI / 5) + (Math.PI / 2);
        tx = Math.cos(angle) * 6.5;
        ty = Math.sin(angle) * 6.5;
      } else if (i < 10) {
        // Outer Inverted Star Tips (The valleys of the 10-point star)
        const angle = ((i - 5) * 2 * Math.PI / 5) + (Math.PI / 2) + Math.PI; 
        tx = Math.cos(angle) * 6.5;
        ty = Math.sin(angle) * 6.5;
      } else {
        // Inner Star Tips
        const angle = ((i - 10) * 2 * Math.PI / 5) + (Math.PI / 2);
        tx = Math.cos(angle) * 3.2;
        ty = Math.sin(angle) * 3.2;
      }
      
      targetPositions.push(new THREE.Vector3(tx, ty, tz));
      rotationSpeeds.push(Math.random() * 0.02 + 0.01);
    }
    return { chaosPositions, targetPositions, rotationSpeeds };
  }, [count]);

  const currentMix = useRef(0);

  useLayoutEffect(() => {
     if(meshRef.current) {
         for(let i=0; i<count; i++) {
             tempObject.position.copy(data.chaosPositions[i]);
             tempObject.updateMatrix();
             meshRef.current.setMatrixAt(i, tempObject.matrix);
         }
         meshRef.current.instanceMatrix.needsUpdate = true;
     }
  }, [data]);

  useFrame((stateObj, delta) => {
    if (!meshRef.current) return;

    const targetVal = state === MagicState.FORMED ? 1.0 : 0.0;
    currentMix.current = THREE.MathUtils.lerp(currentMix.current, targetVal, delta * 1.2);
    
    const t = stateObj.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      tempPos.lerpVectors(data.chaosPositions[i], data.targetPositions[i], currentMix.current);
      
      // Floating motion (Perpendicular to plane, so Z axis)
      const floatZ = Math.sin(t * 2.0 + i) * 0.2 * (1 - currentMix.current * 0.5); 
      tempObject.position.set(tempPos.x, tempPos.y, tempPos.z + floatZ);
      
      // Rotation
      tempObject.rotation.x = Math.sin(t + i) * 0.5;
      tempObject.rotation.y += data.rotationSpeeds[i];
      
      // Scale
      const scaleBase = 0.5;
      const scalePulse = state === MagicState.FORMED ? (1 + Math.sin(t * 4 + i) * 0.1) : 1;
      const finalScale = scaleBase * scalePulse;
      
      tempObject.scale.set(finalScale, finalScale, finalScale);

      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    
    // Rotate with the magic circle
    if (currentMix.current > 0.9) {
         meshRef.current.rotation.z -= delta * 0.05; 
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      {/* OctahedronGeometry looks like a diamond/crystal */}
      <octahedronGeometry args={[0.5, 0]} />
      {/* White Crystal Material */}
      <meshStandardMaterial 
        color="#ffffff" 
        emissive="#ffccdd" 
        emissiveIntensity={1.2} 
        roughness={0.1} 
        metalness={0.9} 
      />
    </instancedMesh>
  );
};