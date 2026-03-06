import { useMemo } from 'react';
import type { FogCell } from '../../hooks/useGameState';

interface FogOfWarProps {
  fog: FogCell[];
  width: number;
  height: number;
  tileSize?: number;
}

export function FogOfWar({ fog, width, height, tileSize = 1 }: FogOfWarProps) {
  const visible = useMemo(() => fog.filter((cell) => !cell.visible && cell.explored), [fog]);
  const hidden = useMemo(() => fog.filter((cell) => !cell.explored), [fog]);

  return (
    <group>
      {visible.map((cell) => (
        <mesh
          key={`dim-${cell.x}-${cell.y}`}
          position={[(cell.x - width / 2 + 0.5) * tileSize, 0.52, (cell.y - height / 2 + 0.5) * tileSize]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={8}
        >
          <planeGeometry args={[tileSize * 0.98, tileSize * 0.98]} />
          <meshBasicMaterial color="#0b1118" transparent opacity={0.38} depthWrite={false} />
        </mesh>
      ))}
      {hidden.map((cell) => (
        <mesh
          key={`fog-${cell.x}-${cell.y}`}
          position={[(cell.x - width / 2 + 0.5) * tileSize, 0.55, (cell.y - height / 2 + 0.5) * tileSize]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={9}
        >
          <planeGeometry args={[tileSize, tileSize]} />
          <meshBasicMaterial color="#05070b" transparent opacity={0.82} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
