import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

// ─── Archetype visual config ─────────────────────────────────────
const ARCHETYPE_CONFIG: Record<string, { color: string; emoji: string; shape: 'box' | 'cone' | 'sphere' | 'octahedron' | 'cylinder' }> = {
  vanguard:  { color: '#4488ff', emoji: '🗡️', shape: 'box' },
  sniper:    { color: '#ff4444', emoji: '🎯', shape: 'cone' },
  support:   { color: '#44ff88', emoji: '💚', shape: 'sphere' },
  assassin:  { color: '#aa44ff', emoji: '🥷', shape: 'octahedron' },
  tank:      { color: '#ffaa44', emoji: '🛡️', shape: 'cylinder' },
};

interface AgentModelProps {
  id: string;
  name: string;
  archetype: string;
  position: { x: number; y: number };
  hp: number;
  maxHp: number;
  isAlive: boolean;
  isDefending: boolean;
  hasShield: boolean;
  isCurrentTurn: boolean;
  damageBoostTurns: number;
}

export function AgentModel({
  name,
  archetype,
  position,
  hp,
  maxHp,
  isAlive,
  isDefending,
  hasShield,
  isCurrentTurn,
  damageBoostTurns,
}: AgentModelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const config = ARCHETYPE_CONFIG[archetype] || ARCHETYPE_CONFIG.vanguard;
  const hpPercent = maxHp > 0 ? hp / maxHp : 0;

  // Animate: pulse when it's this agent's turn, bob up and down
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    // Gentle bob
    meshRef.current.position.y = isAlive ? 0.5 + Math.sin(t * 2) * 0.05 : 0.1;

    // Pulse scale on current turn
    if (isCurrentTurn && isAlive) {
      const pulse = 1 + Math.sin(t * 4) * 0.08;
      meshRef.current.scale.setScalar(pulse);
    } else {
      meshRef.current.scale.setScalar(isAlive ? 1 : 0.5);
    }

    // Rotate slowly
    meshRef.current.rotation.y += 0.005;
  });

  // Convert grid position (0-9) to world position
  const worldX = (position.x - 4.5) * 1.2;
  const worldZ = (position.y - 4.5) * 1.2;

  const baseColor = useMemo(() => new THREE.Color(config.color), [config.color]);
  const deadColor = useMemo(() => new THREE.Color('#333333'), []);

  return (
    <group position={[worldX, 0, worldZ]}>
      {/* Main body */}
      <mesh ref={meshRef} castShadow>
        {config.shape === 'box' && <boxGeometry args={[0.5, 0.7, 0.5]} />}
        {config.shape === 'cone' && <coneGeometry args={[0.3, 0.8, 6]} />}
        {config.shape === 'sphere' && <sphereGeometry args={[0.35, 16, 16]} />}
        {config.shape === 'octahedron' && <octahedronGeometry args={[0.35]} />}
        {config.shape === 'cylinder' && <cylinderGeometry args={[0.35, 0.35, 0.6, 8]} />}
        <meshStandardMaterial
          color={isAlive ? baseColor : deadColor}
          emissive={isCurrentTurn ? baseColor : damageBoostTurns > 0 ? new THREE.Color('#ff8800') : new THREE.Color('#000000')}
          emissiveIntensity={isCurrentTurn ? 0.5 : damageBoostTurns > 0 ? 0.3 : 0}
          transparent={!isAlive}
          opacity={isAlive ? 1 : 0.3}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* Shield visual */}
      {hasShield && isAlive && (
        <mesh>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial
            color="#44aaff"
            transparent
            opacity={0.2}
            wireframe
          />
        </mesh>
      )}

      {/* Defending indicator */}
      {isDefending && isAlive && (
        <mesh position={[0, 0.5, 0.4]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshStandardMaterial color="#88ccff" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Current turn ring */}
      {isCurrentTurn && isAlive && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#ffff00" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Label billboard */}
      <Billboard position={[0, 1.3, 0]}>
        <Text
          fontSize={0.18}
          color={isAlive ? '#ffffff' : '#666666'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {config.emoji} {name}
        </Text>
      </Billboard>

      {/* HP bar */}
      {isAlive && (
        <Billboard position={[0, 1.05, 0]}>
          {/* Background */}
          <mesh>
            <planeGeometry args={[0.8, 0.08]} />
            <meshBasicMaterial color="#333333" />
          </mesh>
          {/* HP fill */}
          <mesh position={[(hpPercent - 1) * 0.38, 0, 0.001]}>
            <planeGeometry args={[0.76 * hpPercent, 0.06]} />
            <meshBasicMaterial
              color={hpPercent > 0.5 ? '#44ff44' : hpPercent > 0.25 ? '#ffaa00' : '#ff4444'}
            />
          </mesh>
        </Billboard>
      )}

      {/* Death marker */}
      {!isAlive && (
        <Billboard position={[0, 0.6, 0]}>
          <Text fontSize={0.3} color="#ff4444" anchorX="center" anchorY="middle">
            ☠️
          </Text>
        </Billboard>
      )}
    </group>
  );
}
