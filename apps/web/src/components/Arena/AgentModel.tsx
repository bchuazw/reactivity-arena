import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html, Text } from '@react-three/drei';
import * as THREE from 'three';

const AGENT_CONFIG: Record<
  string,
  {
    color: string;
    stripe: string;
    role: string;
    weapon: 'rifle' | 'minigun' | 'sniper' | 'medic' | 'rocket';
    silhouette: 'soldier' | 'heavy' | 'scout' | 'medic' | 'demo';
    accent: string;
  }
> = {
  'agent-1': { color: '#4b6cb7', stripe: '#7ec8ff', role: 'Soldier', weapon: 'rifle', silhouette: 'soldier', accent: '#c9d8ff' },
  'agent-2': { color: '#9d3d33', stripe: '#ff7863', role: 'Heavy', weapon: 'minigun', silhouette: 'heavy', accent: '#ffd0aa' },
  'agent-3': { color: '#4c8b53', stripe: '#8dff98', role: 'Scout', weapon: 'sniper', silhouette: 'scout', accent: '#dcffd4' },
  'agent-4': { color: '#7560a8', stripe: '#d4a7ff', role: 'Medic', weapon: 'medic', silhouette: 'medic', accent: '#f3e2ff' },
  'agent-5': { color: '#b76f32', stripe: '#ffb35b', role: 'Demo', weapon: 'rocket', silhouette: 'demo', accent: '#ffe0b2' },
};

const DEFAULT_CONFIG = {
  color: '#6c727f',
  stripe: '#ffffff',
  role: 'Operative',
  weapon: 'rifle' as const,
  silhouette: 'soldier' as const,
  accent: '#f2f2f2',
};

interface AgentModelProps {
  id: string;
  name: string;
  position: { x: number; y: number };
  hp: number;
  maxHp: number;
  isAlive: boolean;
  isDefending: boolean;
  hasShield: boolean;
  isCurrentTurn: boolean;
  damageBoostTurns: number;
}

function HealthBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const ratio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
  const barColor = ratio > 0.55 ? '#6dfc7a' : ratio > 0.3 ? '#ffcb4d' : '#ff6464';

  return (
    <Billboard position={[0, 1.75, 0]}>
      <group>
        <mesh>
          <planeGeometry args={[0.92, 0.12]} />
          <meshBasicMaterial color="#101010" transparent opacity={0.95} />
        </mesh>
        <mesh position={[-0.46 + ratio * 0.46, 0, 0.002]}>
          <planeGeometry args={[Math.max(0.02, 0.88 * ratio), 0.08]} />
          <meshBasicMaterial color={barColor} />
        </mesh>
      </group>
    </Billboard>
  );
}

function TeamStripe({ color }: { color: string }) {
  return (
    <mesh position={[0, 1.06, 0.16]}>
      <boxGeometry args={[0.26, 0.08, 0.06]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
    </mesh>
  );
}

function Weapon({ type, accent }: { type: 'rifle' | 'minigun' | 'sniper' | 'medic' | 'rocket'; accent: string }) {
  switch (type) {
    case 'minigun':
      return (
        <group position={[0.34, 0.78, 0.16]} rotation={[0, 0.1, -0.12]}>
          <mesh>
            <boxGeometry args={[0.38, 0.12, 0.14]} />
            <meshStandardMaterial color="#3f434b" metalness={0.6} roughness={0.45} />
          </mesh>
          {[ -0.07, -0.02, 0.03, 0.08 ].map((z) => (
            <mesh key={z} position={[0.22, 0, z]} rotation={[0, Math.PI / 2, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.32, 8]} />
              <meshStandardMaterial color={accent} metalness={0.8} roughness={0.35} />
            </mesh>
          ))}
        </group>
      );
    case 'sniper':
      return (
        <group position={[0.34, 0.84, 0.08]} rotation={[0, 0.1, -0.06]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.75, 10]} />
            <meshStandardMaterial color="#4a4a4a" metalness={0.55} roughness={0.4} />
          </mesh>
          <mesh position={[0.03, 0.07, 0]}>
            <boxGeometry args={[0.18, 0.05, 0.08]} />
            <meshStandardMaterial color={accent} roughness={0.5} />
          </mesh>
        </group>
      );
    case 'medic':
      return (
        <group position={[0.28, 0.76, 0.16]}>
          <mesh>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial color="#ece6e6" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.091]}>
            <boxGeometry args={[0.1, 0.03, 0.01]} />
            <meshStandardMaterial color="#d94949" emissive="#a22d2d" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.091]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.1, 0.03, 0.01]} />
            <meshStandardMaterial color="#d94949" emissive="#a22d2d" emissiveIntensity={0.25} />
          </mesh>
        </group>
      );
    case 'rocket':
      return (
        <group position={[0.3, 0.92, -0.16]} rotation={[0, 0.2, -0.2]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.58, 12]} />
            <meshStandardMaterial color="#59616a" metalness={0.65} roughness={0.38} />
          </mesh>
          <mesh position={[0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.08, 0.16, 8]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.1} />
          </mesh>
        </group>
      );
    case 'rifle':
    default:
      return (
        <group position={[0.26, 0.8, 0.14]} rotation={[0, 0.08, -0.1]}>
          <mesh>
            <boxGeometry args={[0.48, 0.06, 0.08]} />
            <meshStandardMaterial color="#424850" metalness={0.5} roughness={0.45} />
          </mesh>
          <mesh position={[-0.08, -0.08, 0]}>
            <boxGeometry args={[0.08, 0.18, 0.06]} />
            <meshStandardMaterial color={accent} roughness={0.55} />
          </mesh>
        </group>
      );
  }
}

export function AgentModel({
  id,
  name,
  position,
  hp,
  maxHp,
  isAlive,
  isDefending,
  hasShield,
  isCurrentTurn,
  damageBoostTurns,
}: AgentModelProps) {
  const rootRef = useRef<THREE.Group>(null);
  const weaponRef = useRef<THREE.Group>(null);
  const config = AGENT_CONFIG[id] || DEFAULT_CONFIG;

  useFrame((state) => {
    if (!rootRef.current) return;
    const t = state.clock.getElapsedTime();
    const idle = Math.sin(t * 2.4 + position.x * 0.5 + position.y * 0.2) * 0.035;

    rootRef.current.position.y = isAlive ? 0.12 + idle : 0.04;

    if (!isAlive) {
      rootRef.current.rotation.z = THREE.MathUtils.lerp(rootRef.current.rotation.z, -1.28, 0.08);
      rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, 0.15, 0.08);
      rootRef.current.scale.setScalar(THREE.MathUtils.lerp(rootRef.current.scale.x, 0.9, 0.08));
    } else {
      rootRef.current.rotation.z = THREE.MathUtils.lerp(rootRef.current.rotation.z, 0, 0.08);
      rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, 0, 0.08);
      const pulse = isCurrentTurn ? 1 + Math.sin(t * 6) * 0.04 : 1;
      rootRef.current.scale.setScalar(THREE.MathUtils.lerp(rootRef.current.scale.x, pulse, 0.12));
    }

    if (weaponRef.current && isAlive) {
      const recoil = damageBoostTurns > 0 ? Math.sin(t * 12) * 0.08 : 0;
      weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, recoil, 0.12);
      weaponRef.current.position.x = THREE.MathUtils.lerp(weaponRef.current.position.x, 0.02 + recoil * 0.1, 0.12);
    }
  });

  const worldX = position.x - 4.5;
  const worldZ = position.y - 4.5;
  const uniformColor = isAlive ? config.color : '#464646';

  const bodyScale = {
    soldier: { torso: [0.38, 0.58, 0.24], helmet: 0.2, pack: false, shoulders: 0.48 },
    heavy: { torso: [0.54, 0.66, 0.32], helmet: 0.22, pack: false, shoulders: 0.64 },
    scout: { torso: [0.34, 0.56, 0.22], helmet: 0.18, pack: false, shoulders: 0.4 },
    medic: { torso: [0.4, 0.58, 0.25], helmet: 0.19, pack: true, shoulders: 0.44 },
    demo: { torso: [0.48, 0.62, 0.28], helmet: 0.2, pack: true, shoulders: 0.54 },
  }[config.silhouette];

  return (
    <group position={[worldX, 0, worldZ]}>
      <group ref={rootRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <circleGeometry args={[0.38, 20]} />
          <meshBasicMaterial color={isCurrentTurn ? '#ffe36f' : '#000000'} transparent opacity={isCurrentTurn ? 0.7 : 0.28} />
        </mesh>

        <mesh castShadow position={[0, 0.46, 0]}>
          <boxGeometry args={bodyScale.torso as [number, number, number]} />
          <meshStandardMaterial color={uniformColor} roughness={0.82} metalness={0.12} />
        </mesh>

        <mesh castShadow position={[0, 0.88, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#e5c39c" roughness={0.9} />
        </mesh>

        <mesh castShadow position={[0, 1.03, 0]}>
          <sphereGeometry args={[bodyScale.helmet, 18, 18]} />
          <meshStandardMaterial color="#4c5b42" roughness={0.95} metalness={0.08} />
        </mesh>

        <mesh castShadow position={[0, 1.02, 0.05]}>
          <boxGeometry args={[0.16, 0.05, 0.08]} />
          <meshStandardMaterial color={config.stripe} emissive={config.stripe} emissiveIntensity={0.18} />
        </mesh>

        <mesh castShadow position={[0, 0.72, 0]}>
          <boxGeometry args={[bodyScale.shoulders, 0.14, 0.24]} />
          <meshStandardMaterial color={uniformColor} roughness={0.8} />
        </mesh>

        <mesh castShadow position={[0.18, 0.68, 0]}>
          <boxGeometry args={[0.08, 0.3, 0.12]} />
          <meshStandardMaterial color={config.stripe} roughness={0.6} />
        </mesh>

        {bodyScale.pack && (
          <mesh castShadow position={[-0.05, 0.62, -0.18]}>
            <boxGeometry args={[0.24, 0.34, 0.14]} />
            <meshStandardMaterial color="#5d5044" roughness={0.9} />
          </mesh>
        )}

        <mesh castShadow position={[-0.2, 0.64, 0.02]} rotation={[0, 0, 0.18]}>
          <boxGeometry args={[0.1, 0.34, 0.1]} />
          <meshStandardMaterial color="#d3b08a" roughness={0.85} />
        </mesh>
        <group ref={weaponRef} position={[0.02, 0, 0]}>
          <mesh castShadow position={[0.2, 0.62, 0.04]} rotation={[0, 0, -0.16]}>
            <boxGeometry args={[0.1, 0.34, 0.1]} />
            <meshStandardMaterial color="#d3b08a" roughness={0.85} />
          </mesh>
          <Weapon type={config.weapon} accent={config.accent} />
        </group>

        <mesh castShadow position={[-0.11, 0.15, 0]}>
          <boxGeometry args={[0.12, 0.34, 0.14]} />
          <meshStandardMaterial color="#3c3026" roughness={0.95} />
        </mesh>
        <mesh castShadow position={[0.11, 0.15, 0]}>
          <boxGeometry args={[0.12, 0.34, 0.14]} />
          <meshStandardMaterial color="#3c3026" roughness={0.95} />
        </mesh>

        <TeamStripe color={config.stripe} />

        {hasShield && isAlive && (
          <mesh>
            <sphereGeometry args={[0.72, 18, 18]} />
            <meshStandardMaterial color="#73d8ff" emissive="#4ea8d1" emissiveIntensity={0.25} transparent opacity={0.14} wireframe />
          </mesh>
        )}

        {isDefending && isAlive && (
          <mesh position={[0, 0.62, 0.38]}>
            <boxGeometry args={[0.34, 0.44, 0.06]} />
            <meshStandardMaterial color="#7d94a8" emissive="#34424f" emissiveIntensity={0.18} metalness={0.32} roughness={0.5} />
          </mesh>
        )}

        {damageBoostTurns > 0 && isAlive && (
          <Html position={[0, 1.45, 0]} center style={{ pointerEvents: 'none' }}>
            <div style={{
              padding: '2px 6px',
              borderRadius: '999px',
              background: 'rgba(255,120,60,0.88)',
              color: '#fff7ea',
              fontSize: '10px',
              fontWeight: 700,
              border: '1px solid rgba(255,220,180,0.6)',
              boxShadow: '0 0 12px rgba(255,120,60,0.35)',
              whiteSpace: 'nowrap',
            }}>
              DAMAGE UP
            </div>
          </Html>
        )}
      </group>

      <Billboard position={[0, 2.02, 0]}>
        <Text
          fontSize={0.16}
          color="#fff7e0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#1a130d"
        >
          {config.role.toUpperCase()} • {name}
        </Text>
      </Billboard>

      {isAlive ? (
        <HealthBar hp={hp} maxHp={maxHp} />
      ) : (
        <Billboard position={[0, 1.75, 0]}>
          <Text fontSize={0.28} color="#ff7e7e" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#200">
            KIA
          </Text>
        </Billboard>
      )}
    </group>
  );
}
