import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { FRUITS, FruitDefs, type FruitId } from "../fruits";
import { Stage } from "../components/Layers";
import { Burst, FRUIT_SHADOW, GroundShadow, SceneFrame, useBreathe, useEnter } from "../components/Motion";

/**
 * Manger : le fruit entre ; quatre bouchées le grignotent par la droite, des
 * miettes s'envolent à chacune ; la dernière emporte le reste dans un éclat.
 */
const FRUIT_SIZE = 460;
const CX = 640, CY = 380;
const FIRST_BITE = 30, BITE_EVERY = 14;
/** Bouchées, dans la boîte 400 × 400 du fruit : centre et rayon. */
const BITES: [number, number, number][] = [[340, 190, 78], [290, 110, 74], [310, 300, 80], [225, 210, 88]];
const GONE_AT = FIRST_BITE + BITES.length * BITE_EVERY + 6;

export const Manger: React.FC<{ fruit: FruitId }> = ({ fruit }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { Shape, palette } = FRUITS[fruit];
  const enter = useEnter(0);
  const breathe = useBreathe();

  const bites = BITES.map(([x, y, r], i) => {
    const at = FIRST_BITE + i * BITE_EVERY;
    const p = spring({ frame: frame - at, fps, config: theme.spring.snappy });
    return { x, y, r: r * p, at, p };
  });
  // Le fruit se tasse à chaque bouchée, puis reprend sa forme.
  const chomp = bites.reduce((acc, b) => acc + Math.sin(Math.min(1, b.p) * Math.PI) * 0.06, 0);
  const gone = spring({ frame: frame - GONE_AT, fps, config: theme.spring.snappy });
  const scale = (interpolate(enter, [0, 1], [0.6, 1]) - chomp) * breathe.scale * (1 - gone);

  return (
    <Stage>
      <SceneFrame>
        <GroundShadow x={CX} y={CY + FRUIT_SIZE * 0.37} width={FRUIT_SIZE * 0.66 * Math.max(0, scale)} opacity={enter * (1 - gone)} lift={1 - enter} />
        <div
          style={{
            position: "absolute", left: CX - FRUIT_SIZE / 2, top: CY - FRUIT_SIZE / 2 + breathe.y,
            width: FRUIT_SIZE, height: FRUIT_SIZE, opacity: enter,
            transform: `scale(${scale}) translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
            transformOrigin: "50% 60%",
          }}
        >
          <svg width={FRUIT_SIZE} height={FRUIT_SIZE} viewBox="0 0 400 400" style={{ overflow: "visible", filter: FRUIT_SHADOW }}>
            <FruitDefs />
            {/* La morsure enlève la peau sur tout son rayon, et la chair un peu moins : la chair apparaît en bordure. */}
            <mask id="bitesSkin">
              <rect x="-50" y="-50" width="500" height="500" fill="white" />
              {bites.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="black" />)}
            </mask>
            <mask id="bitesFlesh">
              <rect x="-50" y="-50" width="500" height="500" fill="white" />
              {bites.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r * 0.72} fill="black" />)}
            </mask>
            <g mask="url(#bitesFlesh)">
              <Shape mode="flesh" />
            </g>
            <g mask="url(#bitesSkin)">
              <Shape mode="skin" />
            </g>
          </svg>
        </div>

        {/* Miettes : trois par bouchée, projetées vers le haut à droite puis retombant. */}
        {bites.flatMap((b, i) =>
          [0, 1, 2].map((k) => {
            const t = frame - b.at - k * 2;
            if (t < 0 || t > 26) return null;
            const angle = -0.4 - k * 0.5;
            const dist = interpolate(t, [0, 26], [0, 140 + k * 30], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const fall = interpolate(t, [0, 26], [0, 90], { easing: theme.ease.in, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const fade = interpolate(t, [16, 26], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const px = CX - FRUIT_SIZE / 2 + (b.x / 400) * FRUIT_SIZE + Math.cos(angle) * dist;
            const py = CY - FRUIT_SIZE / 2 + (b.y / 400) * FRUIT_SIZE + Math.sin(angle) * dist + fall;
            return (
              <div
                key={`${i}-${k}`}
                style={{ position: "absolute", left: px, top: py, width: 12 + k * 3, height: 12 + k * 3, borderRadius: 4, background: k === 1 ? palette.flesh : palette.skin, opacity: fade, transform: `rotate(${t * 12}deg)` }}
              />
            );
          }),
        )}

        <Burst x={CX} y={CY} start={GONE_AT} color={palette.juice} size={260} />
      </SceneFrame>
    </Stage>
  );
};
