import Svg, { Polygon, Text } from "react-native-svg";

export default function HexLogo({ size = 32 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const ri = r * 0.82;

  const hexPoints = (radius) => {
    return [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const angle = (Math.PI / 180) * (60 * i - 30);
        return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
      })
      .join(" ");
  };

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Polygon
        points={hexPoints(r)}
        fill="#0A0A0A"
        stroke="#F15BB5"
        strokeWidth="1.5"
      />
      <Polygon
        points={hexPoints(ri)}
        fill="none"
        stroke="#00F5D4"
        strokeWidth="1"
      />
      <Text
        x={cx}
        y={cy + size * 0.18}
        fontSize={size * 0.5}
        fontWeight="900"
        fill="#FFFFFF"
        textAnchor="middle"
      >
        S
      </Text>
    </Svg>
  );
}
