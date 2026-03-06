import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment as DreiEnvironment, OrbitControls, Sky, Text } from '@react-three/drei';
import * as THREE from 'three';
import { AgentModel } from './AgentModel';
import { Environment } from './Environment';
import { FogOfWar } from './FogOfWar';
import { ParticleEffects } from './ParticleEffects';
import type { TacticalAgent, TacticalTile, FogCell } from '../../hooks/useGameState';
import type { ChestData, DestructibleData } from '../../hooks/useGameServer';

interface ArenaSceneProps {
  agents: Map<string, TacticalAgent>;
  currentAgentId: string;
  phase: string;
  tiles: TacticalTile[];
  destructibles: DestructibleData[];
  chests: ChestData[];
  fog: FogCell[];
  width: number;
  height: number;
  mapTheme?: string;
  showGrid?: boolean;
}

const MATERIALS: Record<string, { top: string; side: string; emissive?: string; roughness: number; metalness?: number }> = {
  road: { top: '#6f665c', side: '#4f473f', roughness: 0.96 },
  ground: { top: '#8f7559', side: '#64503d', roughness: 1 },
  cover: { top: '#8b8172', side: '#625b4f', roughness: 0.9 },
  elevation: { top: '#7e705d', side: '#554a3e', roughness: 0.92 },
  bush: { top: '#637543', side: '#4b5833', roughness: 1 },
  healing: { top: '#87a76c', side: '#637950', roughness: 0.92, emissive: '#8ac05c' },
  mud: { top: '#594438', side: '#422f25', roughness: 1 },
  bridge: { top: '#8d7959', side: '#5f503d', roughness: 0.88 },
};

function tileHeight(tile: TacticalTile) {
  const base = tile.terrain === 'bridge' ? 0.28 : tile.terrain === 'cover' ? 0.22 : tile.terrain === 'elevation' ? 0.32 : tile.terrain === 'mud' ? 0.08 : 0.14;
  return base + tile.heightTier * 0.55;
}

function TacticalTileMesh({ tile, width, height, showGrid }: { tile: TacticalTile; width: number; height: number; showGrid: boolean }) {
  const mat = MATERIALS[tile.terrain] || MATERIALS.ground;
  const h = tileHeight(tile);
  const x = tile.position.x - width / 2 + 0.5;
  const z = tile.position.y - height / 2 + 0.5;
  const exploredOpacity = tile.visible ? 1 : tile.explored ? 0.72 : 0.42;

  return (
    <group position={[x, 0, z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[0.98, h, 0.98]} />
        <meshStandardMaterial color={mat.top} emissive={mat.emissive || '#000'} emissiveIntensity={tile.healing ? 0.25 : 0} roughness={mat.roughness} metalness={mat.metalness ?? 0.04} transparent opacity={exploredOpacity} />
      </mesh>
      {showGrid && (
        <mesh position={[0, h + 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.98, 0.98]} />
          <meshBasicMaterial color="#17120d" transparent opacity={0.15} depthWrite={false} wireframe />
        </mesh>
      )}
    </group>
  );
}

function ArenaLights() {
  return (
    <>
      <color attach="background" args={['#d4b389']} />
      <fog attach="fog" args={['#d4b389', 28, 82]} />
      <ambientLight intensity={0.65} color="#ffe9c2" />
      <hemisphereLight intensity={0.6} color="#fff1cf" groundColor="#745637" />
      <directionalLight position={[18, 26, 14]} intensity={1.85} color="#fff3d1" castShadow />
      <directionalLight position={[-10, 16, -8]} intensity={0.5} color="#ffc78f" />
    </>
  );
}

export function ArenaScene({ agents, currentAgentId, phase, tiles, destructibles, chests, fog, width, height, mapTheme = 'warzone_outskirts', showGrid = true }: ArenaSceneProps) {
  const tileLookup = useMemo(() => new Map(tiles.map((tile) => [`${tile.position.x},${tile.position.y}`, tile])), [tiles]);
  const fogLookup = useMemo(() => new Map(fog.map((cell) => [`${cell.x},${cell.y}`, cell])), [fog]);
  const center = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas shadows camera={{ position: [26, 28, 26], fov: 38 }}>
        <ArenaLights />
        <Sky distance={450000} sunPosition={[6, 2, 8]} inclination={0.56} azimuth={0.18} turbidity={10} rayleigh={2.1} mieCoefficient={0.012} mieDirectionalG={0.82} />
        <DreiEnvironment preset="sunset" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[width + 14, height + 14]} />
          <meshStandardMaterial color="#614c3a" roughness={1} />
        </mesh>

        {tiles.map((tile) => <TacticalTileMesh key={`${tile.position.x}-${tile.position.y}`} tile={tile} width={width} height={height} showGrid={showGrid} />)}
        <Environment tiles={tiles} destructibles={destructibles} chests={chests} width={width} height={height} />
        <ParticleEffects agents={agents} destructibles={destructibles} width={width} height={height} />
        <FogOfWar fog={fog} width={width} height={height} />

        {Array.from(agents.values()).map((agent) => {
          const visibility = fogLookup.get(`${agent.position.x},${agent.position.y}`)?.visible ?? true;
          const tile = tileLookup.get(`${agent.position.x},${agent.position.y}`);
          const yLift = tile ? tileHeight(tile) : 0.1;
          return (
            <group key={agent.id} position={[0, yLift, 0]}>
              <AgentModel agent={agent} width={width} height={height} hidden={!visibility && phase === 'active'} />
            </group>
          );
        })}

        {Array.from(agents.values()).map((agent) => {
          const x = agent.position.x - width / 2 + 0.5;
          const z = agent.position.y - height / 2 + 0.5;
          return agent.id === currentAgentId ? (
            <Text key={`current-${agent.id}`} position={[x, 4.1, z]} fontSize={0.32} color="#ffe8a6" anchorX="center" anchorY="middle" outlineWidth={0.018} outlineColor="#3d2615">
              CURRENT TURN
            </Text>
          ) : null;
        })}

        <ContactShadows position={[0, -0.02, 0]} opacity={0.42} scale={Math.max(width, height)} blur={2.4} far={32} resolution={1024} color="#000" />
        <OrbitControls makeDefault enablePan={false} enableZoom enableRotate minDistance={18} maxDistance={46} minPolarAngle={Math.PI / 4.5} maxPolarAngle={Math.PI / 2.45} target={center} />
      </Canvas>

      <div style={{ position: 'absolute', top: 16, left: 16, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(58,38,24,0.88), rgba(22,16,12,0.74))', border: '1px solid rgba(250,220,170,0.28)', color: '#fff1d6', padding: '12px 14px', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.24)' }}>
        <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.72 }}>Operation</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{mapTheme === 'warzone_outskirts' ? 'Rusted Frontline' : 'Dust District'}</div>
        <div style={{ fontSize: 12, opacity: 0.82 }}>50×50 tactical grid • Fog of war active • {phase.toUpperCase()}</div>
      </div>
    </div>
  );
}
