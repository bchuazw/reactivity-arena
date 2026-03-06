import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Stars } from '@react-three/drei';
import { AgentModel } from './AgentModel';
import type { AgentData } from '../../hooks/useGameServer';

interface ArenaSceneProps {
  agents: Map<string, AgentData>;
  currentAgentId: string;
  phase: string;
}

function ArenaFloor() {
  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#1a1a2e" transparent opacity={0.8} />
      </mesh>

      {/* Grid overlay */}
      <Grid
        args={[12, 12]}
        cellSize={1.2}
        cellThickness={0.5}
        cellColor="#334455"
        sectionSize={6}
        sectionThickness={1}
        sectionColor="#445566"
        fadeDistance={25}
        fadeStrength={1}
        position={[0, 0, 0]}
      />

      {/* Arena boundary markers */}
      {[
        [-6.5, 0, -6.5],
        [6.5, 0, -6.5],
        [-6.5, 0, 6.5],
        [6.5, 0, 6.5],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
          <meshStandardMaterial color="#ff4444" emissive="#ff2222" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ArenaLights() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#4488ff" />
      <pointLight position={[-5, 5, -5]} intensity={0.3} color="#ff4444" />
      <pointLight position={[5, 5, 5]} intensity={0.3} color="#44ff88" />
    </>
  );
}

export function ArenaScene({ agents, currentAgentId, phase }: ArenaSceneProps) {
  const agentArray = Array.from(agents.values());

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Phase overlay */}
      {phase === 'lobby' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          color: '#ffaa00',
          fontSize: '2rem',
          fontWeight: 'bold',
          textShadow: '0 0 20px rgba(255,170,0,0.5)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          ⏳ Waiting for match...
        </div>
      )}
      {phase === 'ended' && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          color: '#ff4444',
          fontSize: '2rem',
          fontWeight: 'bold',
          textShadow: '0 0 20px rgba(255,68,68,0.5)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          🏆 Match Over!
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [8, 10, 8], fov: 50 }}
        style={{ background: '#0a0a1a' }}
      >
        <ArenaLights />
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="night" />
        <ArenaFloor />

        {/* Render agents */}
        {agentArray.map((agent) => (
          <AgentModel
            key={agent.id}
            id={agent.id}
            name={agent.name}
            archetype={agent.archetype}
            position={agent.position}
            hp={agent.hp}
            maxHp={agent.maxHp}
            isAlive={agent.isAlive}
            isDefending={agent.isDefending}
            hasShield={agent.hasShield}
            isCurrentTurn={agent.id === currentAgentId}
            damageBoostTurns={agent.damageBoostTurns}
          />
        ))}

        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          minDistance={5}
          maxDistance={25}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.5}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
