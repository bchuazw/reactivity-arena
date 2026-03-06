import { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import type { TacticalTile } from '../../hooks/useGameState';
import type { ChestData, DestructibleData } from '../../hooks/useGameServer';

interface EnvironmentProps {
  tiles: TacticalTile[];
  destructibles: DestructibleData[];
  chests: ChestData[];
  width: number;
  height: number;
}

function worldPos(x: number, y: number, width: number, height: number) {
  return [x - width / 2 + 0.5, y - height / 2 + 0.5] as const;
}

export function Environment({ tiles, destructibles, chests, width, height }: EnvironmentProps) {
  const craterTiles = useMemo(() => tiles.filter((tile) => tile.structureType === 'crater'), [tiles]);
  const bushTiles = useMemo(() => tiles.filter((tile) => tile.concealment), [tiles]);
  const ladderTiles = useMemo(() => tiles.filter((tile) => tile.interactive === 'ladder'), [tiles]);
  const doorTiles = useMemo(() => tiles.filter((tile) => tile.interactive === 'door'), [tiles]);
  const ziplineTiles = useMemo(() => tiles.filter((tile) => tile.interactive === 'zipline'), [tiles]);

  return (
    <group>
      <Instances limit={Math.max(1, craterTiles.length)} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.52, 0.12, 18]} />
        <meshStandardMaterial color="#43352b" roughness={1} />
        {craterTiles.map((tile) => {
          const [x, z] = worldPos(tile.position.x, tile.position.y, width, height);
          return <Instance key={`crater-${tile.position.x}-${tile.position.y}`} position={[x, 0.03, z]} scale={[1.2, 1, 1.05]} />;
        })}
      </Instances>

      <Instances limit={Math.max(1, bushTiles.length)} castShadow receiveShadow>
        <sphereGeometry args={[0.26, 10, 10]} />
        <meshStandardMaterial color="#667d45" roughness={1} />
        {bushTiles.map((tile) => {
          const [x, z] = worldPos(tile.position.x, tile.position.y, width, height);
          return <Instance key={`bush-${tile.position.x}-${tile.position.y}`} position={[x, 0.26, z]} scale={[1.1, 0.8, 1.1]} />;
        })}
      </Instances>

      {destructibles.map((prop) => {
        const [x, z] = worldPos(prop.position.x, prop.position.y, width, height);
        if (prop.type === 'vehicle') {
          return (
            <group key={prop.id} position={[x, 0.12, z]}>
              <mesh castShadow>
                <boxGeometry args={prop.id.includes('tank') ? [1.4, 0.42, 0.9] : [1.25, 0.34, 0.78]} />
                <meshStandardMaterial color="#546055" roughness={0.82} metalness={0.22} />
              </mesh>
            </group>
          );
        }
        if (prop.type === 'wire') {
          return (
            <group key={prop.id} position={[x, 0.08, z]}>
              {[-0.26, 0, 0.26].map((dx) => (
                <mesh key={dx} castShadow position={[dx, 0, 0]}>
                  <torusGeometry args={[0.11, 0.025, 6, 10]} />
                  <meshStandardMaterial color="#4d4d4d" metalness={0.35} roughness={0.7} />
                </mesh>
              ))}
            </group>
          );
        }
        if (prop.type === 'barrier') {
          return (
            <group key={prop.id} position={[x, 0.1, z]}>
              {[-0.24, 0, 0.24].map((dx) => (
                <mesh key={dx} castShadow position={[dx, 0, 0]}>
                  <capsuleGeometry args={[0.09, 0.22, 5, 8]} />
                  <meshStandardMaterial color="#bea886" roughness={1} />
                </mesh>
              ))}
            </group>
          );
        }
        if (prop.type === 'crate') {
          return (
            <group key={prop.id} position={[x, 0.16, z]}>
              <mesh castShadow>
                <boxGeometry args={[0.52, 0.32, 0.52]} />
                <meshStandardMaterial color="#90653f" roughness={0.9} />
              </mesh>
            </group>
          );
        }
        return (
          <group key={prop.id} position={[x, 0.24, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.15, 0.17, 0.46, 12]} />
              <meshStandardMaterial color="#7a3e30" metalness={0.25} roughness={0.6} />
            </mesh>
          </group>
        );
      })}

      {chests.map((chest) => {
        const [x, z] = worldPos(chest.position.x, chest.position.y, width, height);
        return (
          <group key={chest.id} position={[x, 0.18, z]}>
            <mesh castShadow>
              <boxGeometry args={[0.66, 0.34, 0.66]} />
              <meshStandardMaterial color="#6a7d58" roughness={0.85} />
            </mesh>
          </group>
        );
      })}

      {ladderTiles.map((tile) => {
        const [x, z] = worldPos(tile.position.x, tile.position.y, width, height);
        return <mesh key={`ladder-${tile.position.x}-${tile.position.y}`} castShadow position={[x, 0.78, z]}><boxGeometry args={[0.08, 1.4, 0.08]} /><meshStandardMaterial color="#8a775f" roughness={0.86} /></mesh>;
      })}
      {doorTiles.map((tile) => {
        const [x, z] = worldPos(tile.position.x, tile.position.y, width, height);
        return <mesh key={`door-${tile.position.x}-${tile.position.y}`} castShadow position={[x, 0.62, z]}><boxGeometry args={[0.12, 1.24, 0.66]} /><meshStandardMaterial color="#74583c" roughness={0.86} /></mesh>;
      })}
      {ziplineTiles.length >= 2 && <mesh position={[0, 3.1, 0]}><boxGeometry args={[18, 0.03, 0.03]} /><meshStandardMaterial color="#2b2f34" metalness={0.8} roughness={0.3} /></mesh>}
    </group>
  );
}
