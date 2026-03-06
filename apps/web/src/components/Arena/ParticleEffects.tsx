import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { TacticalAgent } from '../../hooks/useGameState';
import type { DestructibleData } from '../../hooks/useGameServer';

interface ParticleEffectsProps {
  agents: Map<string, TacticalAgent>;
  destructibles: DestructibleData[];
  width: number;
  height: number;
}

function DustField({ width, height }: { width: number; height: number }) {
  return <Sparkles count={220} scale={[width, 8, height]} size={2.5} speed={0.25} color="#d6b37c" position={[0, 2.8, 0]} />;
}

function BarrelSmoke({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.5 + Math.sin(clock.getElapsedTime() * 1.4 + x) * 0.06;
  });
  return (
    <group ref={ref} position={[x, 0.5, z]}>
      <Sparkles count={10} scale={[0.9, 0.8, 0.9]} size={3} speed={0.2} color="#ff9b52" />
    </group>
  );
}

function AgentAura({ agent, offsetX, offsetZ }: { agent: TacticalAgent; offsetX: number; offsetZ: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 5 + offsetX) * 0.05);
  });

  const flash = agent.plannedAction === 'shoot' || agent.overwatch || agent.damageBoostTurns > 0;
  if (!flash) return null;

  return (
    <group position={[offsetX, 0.08, offsetZ]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.46, 32]} />
        <meshBasicMaterial color={agent.overwatch ? '#7fd2ff' : '#ffb05e'} transparent opacity={0.45} />
      </mesh>
      <Sparkles count={8} scale={[0.6, 0.4, 0.6]} size={2.8} speed={0.35} color={agent.overwatch ? '#9fe3ff' : '#ffd18c'} position={[0, 0.4, 0]} />
    </group>
  );
}

export function ParticleEffects({ agents, destructibles, width, height }: ParticleEffectsProps) {
  const barrelPositions = useMemo(
    () => destructibles.filter((prop) => prop.type === 'barrel' && prop.hp > 0).map((prop) => ({ x: prop.position.x - width / 2 + 0.5, z: prop.position.y - height / 2 + 0.5 })),
    [destructibles, width, height]
  );

  return (
    <group>
      <DustField width={width} height={height} />
      {barrelPositions.map((barrel) => <BarrelSmoke key={`${barrel.x}-${barrel.z}`} x={barrel.x} z={barrel.z} />)}
      {Array.from(agents.values()).map((agent) => (
        <AgentAura key={agent.id} agent={agent} offsetX={agent.position.x - width / 2 + 0.5} offsetZ={agent.position.y - height / 2 + 0.5} />
      ))}
    </group>
  );
}
