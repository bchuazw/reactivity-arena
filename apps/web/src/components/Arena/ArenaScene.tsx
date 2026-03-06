import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Float, Html, OrbitControls, Sky, Sparkles, Text } from '@react-three/drei';
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
  showGrid?: boolean;
}

const TILE_STYLE: Record<string, { top: string; side: string; roughness: number; metalness?: number; emissive?: string; height?: number }> = {
  road: { top: '#6c655d', side: '#4b463f', roughness: 0.98, height: 0.08 },
  ground: { top: '#8f7356', side: '#69533c', roughness: 1, height: 0.08 },
  cover: { top: '#878a78', side: '#646957', roughness: 0.9, height: 0.14 },
  elevation: { top: '#817056', side: '#5b4f3c', roughness: 0.92, height: 0.34 },
  water: { top: '#355c63', side: '#27454a', roughness: 0.35, metalness: 0.2, emissive: '#18373c', height: 0.03 },
  mud: { top: '#69513c', side: '#4d3929', roughness: 1, height: 0.05 },
  bush: { top: '#60713f', side: '#4a5a2f', roughness: 0.96, height: 0.12 },
  bridge: { top: '#8a7653', side: '#64563c', roughness: 0.88, height: 0.09 },
  healing: { top: '#7a8a57', side: '#5f6841', roughness: 0.92, height: 0.1 },
  spawn: { top: '#83705a', side: '#625343', roughness: 0.9, height: 0.1 },
};

function tileHeight(tile?: TileData) {
  const style = TILE_STYLE[tile?.terrain || 'ground'] || TILE_STYLE.ground;
  return (style.height ?? 0.08) + (tile?.elevation ?? 0) * 0.16;
}

function CrateStack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.18, 0]}>
        <boxGeometry args={[0.46, 0.36, 0.46]} />
        <meshStandardMaterial color="#8d6338" roughness={0.92} />
      </mesh>
      <mesh castShadow position={[0.02, 0.43, 0.03]}>
        <boxGeometry args={[0.38, 0.18, 0.38]} />
        <meshStandardMaterial color="#a67444" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.18, 0.231]}>
        <boxGeometry args={[0.34, 0.03, 0.02]} />
        <meshStandardMaterial color="#5b3f22" />
      </mesh>
    </group>
  );
}

function MetalBarrel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.17, 0.19, 0.48, 14]} />
        <meshStandardMaterial color="#6b7f86" metalness={0.35} roughness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.195, 0.195, 0.06, 14]} />
        <meshStandardMaterial color="#b14b3e" metalness={0.28} roughness={0.65} />
      </mesh>
    </group>
  );
}

function Sandbags({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-0.22, 0, 0.22].map((x, i) => (
        <mesh key={i} castShadow position={[x, 0.12 + (i === 1 ? 0.03 : 0), 0]} rotation={[0, 0, x === 0 ? 0 : 0.08 * Math.sign(x)]}>
          <capsuleGeometry args={[0.08, 0.22, 6, 10]} />
          <meshStandardMaterial color="#c7b08c" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function PalmTree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.9, 0]} rotation={[0.08, 0, -0.06]}>
        <cylinderGeometry args={[0.06, 0.09, 1.8, 8]} />
        <meshStandardMaterial color="#6d4f2d" roughness={0.95} />
      </mesh>
      {[0, 1.2, 2.3, 3.5, 4.6].map((rot) => (
        <mesh key={rot} castShadow position={[0, 1.82, 0]} rotation={[0.15, rot, 0.35]}>
          <boxGeometry args={[0.12, 0.03, 0.85]} />
          <meshStandardMaterial color="#4f7f38" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function RuinedWall({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.42, 0]}>
        <boxGeometry args={[1.3, 0.84, 0.18]} />
        <meshStandardMaterial color="#847969" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[-0.28, 0.75, 0]}>
        <boxGeometry args={[0.22, 0.24, 0.2]} />
        <meshStandardMaterial color="#6f6557" roughness={1} />
      </mesh>
      <mesh castShadow position={[0.38, 0.14, 0.12]} rotation={[0.2, 0.4, 0]}>
        <boxGeometry args={[0.24, 0.1, 0.22]} />
        <meshStandardMaterial color="#5c5349" roughness={1} />
      </mesh>
    </group>
  );
}

function DestroyedVehicle({ position, kind }: { position: [number, number, number]; kind: 'jeep' | 'tank' }) {
  const isTank = kind === 'tank';
  return (
    <group position={position} rotation={[0, isTank ? -0.45 : 0.35, isTank ? -0.06 : 0.05]}>
      <mesh castShadow position={[0, isTank ? 0.26 : 0.18, 0]}>
        <boxGeometry args={isTank ? [1.05, 0.34, 0.72] : [0.96, 0.28, 0.58]} />
        <meshStandardMaterial color="#4e5b50" roughness={0.88} metalness={0.18} />
      </mesh>
      {isTank ? (
        <>
          <mesh castShadow position={[0.05, 0.48, 0]}>
            <cylinderGeometry args={[0.22, 0.24, 0.22, 14]} />
            <meshStandardMaterial color="#5e6b5d" roughness={0.82} metalness={0.2} />
          </mesh>
          <mesh castShadow position={[0.34, 0.48, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.62, 10]} />
            <meshStandardMaterial color="#373f39" metalness={0.5} roughness={0.45} />
          </mesh>
        </>
      ) : (
        <>
          <mesh castShadow position={[0.12, 0.38, 0]}>
            <boxGeometry args={[0.44, 0.16, 0.44]} />
            <meshStandardMaterial color="#687268" roughness={0.84} metalness={0.18} />
          </mesh>
          <mesh castShadow position={[-0.28, 0.38, 0.14]} rotation={[0.4, 0.2, 0.2]}>
            <boxGeometry args={[0.34, 0.06, 0.08]} />
            <meshStandardMaterial color="#2f3430" roughness={0.7} />
          </mesh>
        </>
      )}
      {[-0.32, 0.32].flatMap((x) => [-0.22, 0.22].map((z) => (
        <mesh key={`${x}-${z}`} castShadow position={[x, 0.06, z]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.05, 8, 14]} />
          <meshStandardMaterial color="#1e1e1e" roughness={1} />
        </mesh>
      )))}
      <Sparkles count={6} scale={0.8} size={1.6} color="#f5a35c" position={[0, 0.55, 0]} />
    </group>
  );
}

function PulsingChest({ chest, y }: { chest: ChestData; y: number }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.y = y + Math.sin(t * 2.6) * 0.04;
    ref.current.rotation.y = Math.sin(t * 0.8) * 0.3;
  });

  if (chest.opened) return null;

  return (
    <group ref={ref} position={[chest.position.x - 4.5, y, chest.position.y - 4.5]}>
      <Float speed={1.8} rotationIntensity={0.16} floatIntensity={0.2}>
        <mesh castShadow>
          <boxGeometry args={[0.46, 0.28, 0.34]} />
          <meshStandardMaterial color="#8a5a2e" roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.38]} />
          <meshStandardMaterial color="#c89b44" metalness={0.28} roughness={0.42} emissive="#7d5b12" emissiveIntensity={0.2} />
        </mesh>
        <Sparkles count={10} scale={0.9} size={2} color="#ffe17c" />
      </Float>
    </group>
  );
}

function DestructibleProp({ prop }: { prop: DestructibleData }) {
  const pos: [number, number, number] = [prop.position.x - 4.5, 0.01, prop.position.y - 4.5];

  if (prop.hp <= 0) {
    return (
      <group position={pos}>
        <mesh castShadow position={[0, 0.06, 0]} rotation={[0.2, 0.3, 0]}>
          <boxGeometry args={[0.5, 0.08, 0.36]} />
          <meshStandardMaterial color="#2f2b28" roughness={1} />
        </mesh>
        <Sparkles count={5} scale={0.55} size={1.5} color="#f59a57" position={[0, 0.1, 0]} />
      </group>
    );
  }

  if (prop.type === 'barrel') return <MetalBarrel position={[pos[0], 0, pos[2]]} />;
  if (prop.type === 'barrier') return <Sandbags position={[pos[0], 0.02, pos[2]]} />;
  return <CrateStack position={[pos[0], 0.02, pos[2]]} />;
}

function TerrainTile({ tile }: { tile: TileData }) {
  const style = TILE_STYLE[tile.terrain] || TILE_STYLE.ground;
  const height = tileHeight(tile);
  const y = height / 2 - 0.04;

  return (
    <group position={[tile.position.x - 4.5, 0, tile.position.y - 4.5]}>
      <mesh receiveShadow castShadow position={[0, y, 0]}>
        <boxGeometry args={[0.98, height, 0.98]} />
        <meshStandardMaterial color={style.top} emissive={style.emissive || '#000000'} emissiveIntensity={tile.healing ? 0.18 : 0} roughness={style.roughness} metalness={style.metalness ?? 0.02} />
      </mesh>
      <mesh receiveShadow position={[0, y - height / 2 + 0.01, 0]}>
        <boxGeometry args={[0.96, 0.02, 0.96]} />
        <meshStandardMaterial color={style.side} roughness={1} />
      </mesh>

      {tile.terrain === 'road' && (
        <>
          <mesh position={[0, height + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.82, 0.06]} />
            <meshBasicMaterial color="#dbd0ae" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, height + 0.003, 0.24]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.12, 0.1]} />
            <meshBasicMaterial color="#bda171" transparent opacity={0.25} />
          </mesh>
        </>
      )}

      {tile.concealment && (
        <group position={[0, height + 0.05, 0]}>
          <mesh castShadow position={[-0.14, 0.08, 0.06]}>
            <sphereGeometry args={[0.18, 10, 10]} />
            <meshStandardMaterial color="#5f7a39" roughness={1} />
          </mesh>
          <mesh castShadow position={[0.09, 0.1, -0.1]}>
            <sphereGeometry args={[0.22, 10, 10]} />
            <meshStandardMaterial color="#6c8746" roughness={1} />
          </mesh>
        </group>
      )}

      {tile.healing && (
        <group position={[0, height + 0.02, 0]}>
          <mesh>
            <cylinderGeometry args={[0.15, 0.15, 0.04, 16]} />
            <meshStandardMaterial color="#a3d27f" emissive="#7cb457" emissiveIntensity={0.45} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.12, 0.03, 0.03]} />
            <meshStandardMaterial color="#f4f0dd" />
          </mesh>
          <mesh position={[0, 0.04, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.12, 0.03, 0.03]} />
            <meshStandardMaterial color="#f4f0dd" />
          </mesh>
        </group>
      )}
    </group>
  );
}

function EnvironmentProps() {
  return (
    <group>
      <DestroyedVehicle position={[-3.7, 0.02, -2.5]} kind="jeep" />
      <DestroyedVehicle position={[2.95, 0.02, 2.8]} kind="tank" />
      <RuinedWall position={[-4.2, 0.02, 1.3]} rotation={0.28} />
      <RuinedWall position={[4.1, 0.02, -1.9]} rotation={-0.52} />
      <CrateStack position={[-1.7, 0.02, 3.9]} />
      <CrateStack position={[3.6, 0.02, -4.05]} />
      <MetalBarrel position={[-0.5, 0.02, -3.9]} />
      <MetalBarrel position={[1.25, 0.02, 4.15]} />
      <Sandbags position={[-4.1, 0.02, -0.2]} />
      <Sandbags position={[4.15, 0.02, 0.65]} />
      <PalmTree position={[-5.1, 0.02, -4.3]} />
      <PalmTree position={[5.1, 0.02, 4.45]} />
      <mesh receiveShadow position={[0.6, 0.03, -1.1]} rotation={[-Math.PI / 2, 0.28, 0]}>
        <planeGeometry args={[1.3, 0.9]} />
        <meshStandardMaterial color="#3c332d" roughness={1} />
      </mesh>
    </group>
  );
}

function ArenaFloor({ tiles = [], destructibles = [], chests = [], showGrid = true }: Pick<ArenaSceneProps, 'tiles' | 'destructibles' | 'chests' | 'showGrid'>) {
  const tileLookup = useMemo(() => new Map(tiles.map((tile) => [`${tile.position.x},${tile.position.y}`, tile])), [tiles]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} receiveShadow>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#6a573d" roughness={1} />
      </mesh>

      {showGrid && (
        <group>
          {Array.from({ length: 11 }, (_, i) => i - 5).map((line) => (
            <group key={`grid-${line}`}>
              <mesh position={[line, 0.012, 0]}>
                <boxGeometry args={[0.02, 0.005, 10]} />
                <meshBasicMaterial color="#221b14" transparent opacity={0.25} />
              </mesh>
              <mesh position={[0, 0.012, line]}>
                <boxGeometry args={[10, 0.005, 0.02]} />
                <meshBasicMaterial color="#221b14" transparent opacity={0.25} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {tiles.map((tile) => <TerrainTile key={`${tile.position.x}-${tile.position.y}`} tile={tile} />)}
      <EnvironmentProps />
      {destructibles.map((prop) => <DestructibleProp key={prop.id} prop={prop} />)}
      {chests.map((chest) => {
        const tile = tileLookup.get(`${chest.position.x},${chest.position.y}`);
        return <PulsingChest key={chest.id} chest={chest} y={tileHeight(tile) + 0.15} />;
      })}

      <ContactShadows position={[0, -0.12, 0]} opacity={0.55} scale={14} blur={1.9} far={10} resolution={1024} color="#000000" />
    </group>
  );
}

function ArenaLights() {
  return (
    <>
      <color attach="background" args={['#d3b585']} />
      <fog attach="fog" args={['#d3b585', 10, 24]} />
      <ambientLight intensity={0.75} color="#ffe9c4" />
      <hemisphereLight intensity={0.55} color="#fff0c7" groundColor="#6b5133" />
      <directionalLight position={[6, 10, 5]} intensity={1.8} color="#fff1cf" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} />
      <directionalLight position={[-4, 5, -3]} intensity={0.5} color="#ffd9ab" />
    </>
  );
}

export function ArenaScene({ agents, currentAgentId, phase, tiles = [], destructibles = [], chests = [], mapTheme = 'warzone_outskirts', showGrid = true }: ArenaSceneProps) {
  const agentArray = Array.from(agents.values());
  const tileLookup = useMemo(() => new Map(tiles.map((tile) => [`${tile.position.x},${tile.position.y}`, tile])), [tiles]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {phase === 'lobby' && (
        <Html center style={{ pointerEvents: 'none' }}>
          <div />
        </Html>
      )}

      <Canvas shadows camera={{ position: [8.2, 8.4, 8.2], fov: 42 }}>
        <ArenaLights />
        <Sky distance={450000} sunPosition={[4, 1, 8]} inclination={0.55} azimuth={0.2} turbidity={10} rayleigh={2} mieCoefficient={0.012} mieDirectionalG={0.82} />
        <Environment preset="sunset" />
        <ArenaFloor tiles={tiles} destructibles={destructibles} chests={chests} showGrid={showGrid} />

        {agentArray.map((agent) => {
          const tile = tileLookup.get(`${agent.position.x},${agent.position.y}`);
          const yOffset = tileHeight(tile) - 0.02;
          return (
            <group key={agent.id} position={[0, yOffset, 0]}>
              <AgentModel
                id={agent.id}
                name={agent.name}
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
                  position={[agent.position.x - 4.5, 2.15, agent.position.y - 4.5]}
                  fontSize={0.15}
                  color={agent.revealTurns > 0 ? '#89d5ff' : '#d6d2c9'}
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.012}
                  outlineColor="#352a1f"
                >
                  {agent.revealTurns > 0 ? 'RECON' : 'SMOKE'}
                </Text>
              )}
            </group>
          );
        })}

        <OrbitControls makeDefault enablePan={false} enableZoom enableRotate minDistance={7} maxDistance={18} minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI / 2.6} minAzimuthAngle={-Math.PI / 3} maxAzimuthAngle={Math.PI / 3} target={[0, 0.7, 0]} />
      </Canvas>

      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(54,38,26,0.88), rgba(28,19,13,0.78))',
        border: '1px solid rgba(240,210,160,0.35)',
        color: '#fff1d6',
        padding: '10px 12px',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
      }}>
        <div style={{ fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.7 }}>Operation</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{mapTheme === 'cyber_ruins' ? 'Dust District' : 'Warzone Outskirts'}</div>
        <div style={{ fontSize: 12, opacity: 0.82 }}>{phase === 'ended' ? 'Extraction complete' : 'Hot zone active'}</div>
      </div>
    </div>
  );
}
