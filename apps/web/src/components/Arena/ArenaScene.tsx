import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Float, Grid, Sparkles, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import { AgentModel } from './AgentModel';
import type { AgentData, ChestData, DestructibleData, TileData } from '../../hooks/useGameServer';

interface ArenaSceneProps {
  agents: Map<string, AgentData>;
  currentAgentId: string;
  phase: string;
  tiles?: TileData[];
  destructibles?: DestructibleData[];
  chests?: ChestData[];
  mapTheme?: string;
}

const TERRAIN_STYLE: Record<string, { color: string; emissive?: string; metalness?: number; roughness?: number; height?: number }> = {
  road: { color: '#2d3348', roughness: 0.9, height: 0.06 },
  ground: { color: '#3a3f4b', roughness: 0.95, height: 0.06 },
  cover: { color: '#556070', emissive: '#1f2c40', roughness: 0.8, height: 0.1 },
  elevation: { color: '#6077a5', emissive: '#22335c', roughness: 0.7, height: 0.35 },
  water: { color: '#1f5778', emissive: '#0a4061', metalness: 0.4, roughness: 0.3, height: 0.02 },
  mud: { color: '#6b5238', roughness: 1, height: 0.03 },
  bush: { color: '#2f7d4f', emissive: '#0b381f', roughness: 0.95, height: 0.12 },
  bridge: { color: '#9a7d49', roughness: 0.8, height: 0.08 },
  healing: { color: '#4fd9a3', emissive: '#18a96d', roughness: 0.4, height: 0.08 },
  spawn: { color: '#7e5cff', emissive: '#5030f0', roughness: 0.5, height: 0.08 },
};

function PulsingChest({ chest, y }: { chest: ChestData; y: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.y = y + Math.sin(t * 2.5) * 0.08;
    groupRef.current.rotation.y += 0.02;
  });

  if (chest.opened) return null;

  return (
    <group ref={groupRef} position={[chest.position.x - 4.5, y, chest.position.y - 4.5]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh castShadow>
          <boxGeometry args={[0.55, 0.4, 0.55]} />
          <meshStandardMaterial color="#ffcf5a" emissive="#ff9e1a" emissiveIntensity={1.2} metalness={0.5} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <boxGeometry args={[0.6, 0.08, 0.6]} />
          <meshStandardMaterial color="#fff1b3" emissive="#ffea66" emissiveIntensity={1.3} />
        </mesh>
        <Sparkles count={12} scale={1.2} size={2.5} color="#ffd966" />
      </Float>
    </group>
  );
}

function DestructibleProp({ prop }: { prop: DestructibleData }) {
  const color = prop.type === 'barrel' ? '#ff6b4a' : prop.type === 'barrier' ? '#72c0ff' : '#8f6d4e';
  const emissive = prop.hp <= 0 ? '#111111' : prop.explosive ? '#8a1f0f' : '#1a2430';

  if (prop.hp <= 0) {
    return (
      <group position={[prop.position.x - 4.5, 0.08, prop.position.y - 4.5]}>
        <Sparkles count={6} scale={0.6} size={2} color="#ff8844" />
        <mesh rotation={[-0.3, 0.3, 0]}>
          <boxGeometry args={[0.4, 0.08, 0.4]} />
          <meshStandardMaterial color="#2a2a2a" roughness={1} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[prop.position.x - 4.5, 0.22, prop.position.y - 4.5]}>
      <mesh castShadow>
        {prop.type === 'barrel' ? <cylinderGeometry args={[0.18, 0.22, 0.48, 16]} /> : <boxGeometry args={[0.5, 0.45, 0.5]} />}
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.6} metalness={0.3} roughness={0.5} />
      </mesh>
      {prop.explosive && <Sparkles count={4} scale={0.5} size={1.5} color="#ff7b39" />}
    </group>
  );
}

function TerrainTile({ tile }: { tile: TileData }) {
  const style = TERRAIN_STYLE[tile.terrain] || TERRAIN_STYLE.ground;
  const tileHeight = (style.height ?? 0.05) + tile.elevation * 0.35;
  const y = tileHeight / 2 - 0.02;

  return (
    <group position={[tile.position.x - 4.5, 0, tile.position.y - 4.5]}>
      <mesh receiveShadow castShadow position={[0, y, 0]}>
        <boxGeometry args={[0.94, tileHeight, 0.94]} />
        <meshStandardMaterial
          color={style.color}
          emissive={style.emissive || '#000000'}
          emissiveIntensity={tile.healing || tile.terrain === 'spawn' ? 0.8 : tile.concealment ? 0.25 : 0.15}
          metalness={style.metalness ?? 0.1}
          roughness={style.roughness ?? 0.8}
        />
      </mesh>

      {tile.providesCover && (
        <mesh position={[0.28, tileHeight + 0.14, -0.18]} castShadow>
          <boxGeometry args={[0.2, 0.3, 0.6]} />
          <meshStandardMaterial color="#8fa6c5" emissive="#24364b" emissiveIntensity={0.25} />
        </mesh>
      )}

      {tile.concealment && (
        <group position={[0, tileHeight + 0.05, 0]}>
          <mesh castShadow position={[-0.15, 0.08, 0.08]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial color="#38a56a" emissive="#0d3d25" emissiveIntensity={0.4} roughness={1} />
          </mesh>
          <mesh castShadow position={[0.1, 0.1, -0.08]}>
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshStandardMaterial color="#2e8f58" emissive="#0d3d25" emissiveIntensity={0.4} roughness={1} />
          </mesh>
        </group>
      )}

      {tile.healing && (
        <group position={[0, tileHeight + 0.04, 0]}>
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 0.04, 24]} />
            <meshStandardMaterial color="#9dffe0" emissive="#48f0b0" emissiveIntensity={1.5} />
          </mesh>
          <Sparkles count={10} scale={0.9} size={2} color="#6affd0" />
        </group>
      )}
    </group>
  );
}

function ArenaFloor({ tiles = [], destructibles = [], chests = [] }: Pick<ArenaSceneProps, 'tiles' | 'destructibles' | 'chests'>) {
  const tileLookup = useMemo(() => new Map(tiles.map((tile) => [`${tile.position.x},${tile.position.y}`, tile])), [tiles]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#090b12" />
      </mesh>

      <Grid
        args={[12, 12]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#1f4f7f"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#6c3dff"
        fadeDistance={30}
        fadeStrength={1}
        position={[0, -0.015, 0]}
      />

      {tiles.map((tile) => <TerrainTile key={`${tile.position.x}-${tile.position.y}`} tile={tile} />)}
      {destructibles.map((prop) => <DestructibleProp key={prop.id} prop={prop} />)}
      {chests.map((chest) => {
        const tile = tileLookup.get(`${chest.position.x},${chest.position.y}`);
        const y = ((TERRAIN_STYLE[tile?.terrain || 'ground']?.height ?? 0.05) + (tile?.elevation ?? 0) * 0.35) + 0.16;
        return <PulsingChest key={chest.id} chest={chest} y={y} />;
      })}

      {[
        [-6.3, 0.3, -6.3],
        [6.3, 0.3, -6.3],
        [-6.3, 0.3, 6.3],
        [6.3, 0.3, 6.3],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
          <meshStandardMaterial color="#ff4ca8" emissive="#ff2f7f" emissiveIntensity={1.1} />
        </mesh>
      ))}
    </group>
  );
}

function ArenaLights() {
  return (
    <>
      <color attach="background" args={['#070814']} />
      <fog attach="fog" args={['#070814', 8, 24]} />
      <ambientLight intensity={0.45} color="#7ac5ff" />
      <directionalLight position={[8, 12, 6]} intensity={1.4} color="#ffd0a8" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[-5, 4, -4]} intensity={1.8} color="#00d1ff" distance={16} />
      <pointLight position={[5, 5, 5]} intensity={1.6} color="#ff3f8e" distance={16} />
      <pointLight position={[0, 6, 0]} intensity={1.2} color="#8f6bff" distance={18} />
    </>
  );
}

export function ArenaScene({ agents, currentAgentId, phase, tiles = [], destructibles = [], chests = [], mapTheme = 'cyber_ruins' }: ArenaSceneProps) {
  const agentArray = Array.from(agents.values());
  const tileLookup = useMemo(() => new Map(tiles.map((tile) => [`${tile.position.x},${tile.position.y}`, tile])), [tiles]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {phase === 'lobby' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10,
          color: '#ffd166', fontSize: '2rem', fontWeight: 'bold', textShadow: '0 0 20px rgba(255,209,102,0.55)', textAlign: 'center', pointerEvents: 'none',
        }}>
          ⏳ Loading the {mapTheme === 'cyber_ruins' ? 'Neon Ruins' : 'Arena'}...
        </div>
      )}
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10,
          color: '#ff77aa', fontSize: '2rem', fontWeight: 'bold', textShadow: '0 0 22px rgba(255,119,170,0.55)', textAlign: 'center', pointerEvents: 'none',
        }}>
          🏆 Match Over!
        </div>
      )}

      <Canvas shadows camera={{ position: [7.5, 9, 8], fov: 50 }}>
        <ArenaLights />
        <Stars radius={90} depth={40} count={1600} factor={3} fade speed={0.8} />
        <Environment preset="night" />
        <ArenaFloor tiles={tiles} destructibles={destructibles} chests={chests} />

        {agentArray.map((agent) => {
          const tile = tileLookup.get(`${agent.position.x},${agent.position.y}`);
          const yOffset = ((TERRAIN_STYLE[tile?.terrain || 'ground']?.height ?? 0.05) + (tile?.elevation ?? 0) * 0.35) / 2;
          return (
            <group key={agent.id} position={[0, yOffset, 0]}>
              <AgentModel
                id={agent.id}
                name={agent.name}
                archetype={agent.archetype}
                position={agent.position}
                hp={agent.hp + agent.temporaryHp}
                maxHp={agent.maxHp + Math.max(agent.temporaryHp, 0)}
                isAlive={agent.isAlive}
                isDefending={agent.isDefending}
                hasShield={agent.hasShield}
                isCurrentTurn={agent.id === currentAgentId}
                damageBoostTurns={agent.damageBoostTurns}
              />
              {(agent.revealTurns > 0 || agent.smokeTurns > 0) && (
                <Text
                  position={[agent.position.x - 4.5, 1.8 + yOffset, agent.position.y - 4.5]}
                  fontSize={0.18}
                  color={agent.revealTurns > 0 ? '#8ceaff' : '#d2d8df'}
                  anchorX="center"
                  anchorY="middle"
                >
                  {agent.revealTurns > 0 ? 'RECON' : 'SMOKE'}
                </Text>
              )}
            </group>
          );
        })}

        <OrbitControls makeDefault enablePan enableZoom enableRotate minDistance={5} maxDistance={22} minPolarAngle={Math.PI / 6} maxPolarAngle={Math.PI / 2.4} target={[0, 0.6, 0]} />
      </Canvas>
    </div>
  );
}
