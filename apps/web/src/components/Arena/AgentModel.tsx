import { Billboard, Text } from '@react-three/drei';
import type { TacticalAgent } from '../../hooks/useGameState';

const ROLE_CONFIG = {
  leader: { color: '#4f79d9', accent: '#9cd0ff', label: 'Leader' },
  heavy: { color: '#c44a43', accent: '#ff9a76', label: 'Heavy' },
  scout: { color: '#4e9f5b', accent: '#a5ffad', label: 'Scout' },
  medic: { color: '#8d67c8', accent: '#e2b8ff', label: 'Medic' },
  demo: { color: '#db8a3b', accent: '#ffd183', label: 'Demo' },
} as const;

interface AgentModelProps {
  agent: TacticalAgent;
  width: number;
  height: number;
  hidden?: boolean;
}

function Weapon({ role, accent }: { role: TacticalAgent['roleKey']; accent: string }) {
  if (role === 'heavy') {
    return (
      <group position={[0.38, 1.05, 0.12]}>
        <mesh castShadow>
          <boxGeometry args={[0.58, 0.16, 0.16]} />
          <meshStandardMaterial color="#41464e" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.28, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.46, 10]} />
          <meshStandardMaterial color={accent} metalness={0.75} roughness={0.25} />
        </mesh>
      </group>
    );
  }

  if (role === 'scout') {
    return (
      <group position={[0.38, 1.06, 0.08]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.82, 10]} />
          <meshStandardMaterial color="#45484a" metalness={0.62} roughness={0.35} />
        </mesh>
        <mesh position={[0.08, 0.08, 0]} castShadow>
          <boxGeometry args={[0.18, 0.05, 0.08]} />
          <meshStandardMaterial color={accent} roughness={0.55} />
        </mesh>
      </group>
    );
  }

  if (role === 'medic') {
    return (
      <group position={[0.34, 1.0, 0.14]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color="#f1e9ea" roughness={0.85} />
        </mesh>
      </group>
    );
  }

  if (role === 'demo') {
    return (
      <group position={[0.4, 1.08, -0.12]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 12]} />
          <meshStandardMaterial color="#59616a" metalness={0.65} roughness={0.35} />
        </mesh>
        <mesh position={[0.28, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <coneGeometry args={[0.08, 0.16, 10]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.1} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0.36, 1.0, 0.12]}>
      <mesh castShadow>
        <boxGeometry args={[0.56, 0.08, 0.1]} />
        <meshStandardMaterial color="#434951" metalness={0.5} roughness={0.45} />
      </mesh>
    </group>
  );
}

export function AgentModel({ agent, width, height, hidden = false }: AgentModelProps) {
  const config = ROLE_CONFIG[agent.roleKey];
  const x = agent.position.x - width / 2 + 0.5;
  const z = agent.position.y - height / 2 + 0.5;
  const hpRatio = Math.max(0, Math.min(1, (agent.hp + agent.temporaryHp) / Math.max(1, agent.maxHp + Math.max(agent.temporaryHp, 0))));
  const torso = agent.roleKey === 'heavy' ? [0.72, 0.84, 0.42] : agent.roleKey === 'scout' ? [0.42, 0.68, 0.28] : [0.54, 0.76, 0.32];

  return (
    <group position={[x, 0, z]} visible={!hidden}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.48, 24]} />
        <meshBasicMaterial color={agent.ap > 0 ? '#ffd76f' : '#28303d'} transparent opacity={agent.ap > 0 ? 0.75 : 0.35} />
      </mesh>

      <mesh castShadow position={[0, 0.98, 0]}>
        <boxGeometry args={torso as [number, number, number]} />
        <meshStandardMaterial color={config.color} roughness={0.84} metalness={0.14} />
      </mesh>
      <mesh castShadow position={[0, 1.58, 0.02]}>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshStandardMaterial color="#ebc59e" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.76, 0]}>
        <sphereGeometry args={[agent.roleKey === 'heavy' ? 0.27 : 0.22, 18, 18]} />
        <meshStandardMaterial color="#49565b" roughness={0.92} metalness={0.1} />
      </mesh>
      <mesh castShadow position={[0, 1.7, 0.12]}>
        <boxGeometry args={[0.18, 0.06, 0.1]} />
        <meshStandardMaterial color={config.accent} emissive={config.accent} emissiveIntensity={0.22} />
      </mesh>

      <mesh castShadow position={[-0.28, 1.02, 0.04]} rotation={[0, 0, 0.16]}>
        <boxGeometry args={[0.12, 0.48, 0.12]} />
        <meshStandardMaterial color="#d2af8c" roughness={0.85} />
      </mesh>
      <mesh castShadow position={[0.28, 1.02, 0.04]} rotation={[0, 0, -0.16]}>
        <boxGeometry args={[0.12, 0.48, 0.12]} />
        <meshStandardMaterial color="#d2af8c" roughness={0.85} />
      </mesh>
      <Weapon role={agent.roleKey} accent={config.accent} />

      <mesh castShadow position={[-0.14, 0.34, 0]}>
        <boxGeometry args={[0.14, 0.56, 0.18]} />
        <meshStandardMaterial color="#3d3129" roughness={0.94} />
      </mesh>
      <mesh castShadow position={[0.14, 0.34, 0]}>
        <boxGeometry args={[0.14, 0.56, 0.18]} />
        <meshStandardMaterial color="#3d3129" roughness={0.94} />
      </mesh>

      <Billboard position={[0, 2.58, 0]}>
        <Text fontSize={0.2} color="#fff7e0" anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#120d09">
          {config.label.toUpperCase()} • {agent.name}
        </Text>
      </Billboard>
      <Billboard position={[0, 2.86, 0]}>
        <Text fontSize={0.12} color="#d7e7ff" anchorX="center" anchorY="middle" outlineWidth={0.012} outlineColor="#0f1014">
          AP {agent.ap}/{agent.maxAp} • VIS {agent.sightRange} • RNG {agent.attackRange + agent.bonusRange}
        </Text>
      </Billboard>
      <Billboard position={[0, 2.25, 0]}>
        <group>
          <mesh>
            <planeGeometry args={[1.1, 0.14]} />
            <meshBasicMaterial color="#120f12" transparent opacity={0.92} />
          </mesh>
          <mesh position={[-0.54 + 0.54 * hpRatio, 0, 0.002]}>
            <planeGeometry args={[Math.max(0.02, 1.04 * hpRatio), 0.09]} />
            <meshBasicMaterial color={hpRatio > 0.55 ? '#6ff58c' : hpRatio > 0.3 ? '#ffcc52' : '#ff6666'} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}
