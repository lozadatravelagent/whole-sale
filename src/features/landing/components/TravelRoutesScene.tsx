import { Canvas, useFrame } from "@react-three/fiber"
import { Line, Stars, useTexture } from "@react-three/drei"
import type { MotionValue } from "framer-motion"
import { useEffect, useMemo, useRef } from "react"
import {
  AdditiveBlending,
  BackSide,
  CatmullRomCurve3,
  Group,
  Mesh,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
} from "three"

type DestinationNode = {
  id: string
  lat: number
  lng: number
  importance: "primary" | "secondary" | "support"
}

type RouteConnection = {
  from: DestinationNode["id"]
  to: DestinationNode["id"]
  emphasis: "primary" | "secondary"
}

type TravelRoutesSceneProps = {
  progress?: MotionValue<number>
}

type RouteFlowLight = {
  id: string
  routeIndex: number
  offset: number
  speed: number
  size: number
  glowSize: number
  color: string
  glowColor: string
  opacity: number
}

const EARTH_RADIUS = 1.18
const CLOUD_RADIUS = 1.214
const ATMOSPHERE_RADIUS = 1.31
const CAMERA_FOV = 34
const EARTH_TEXTURE_PATHS = [
  "/earth/earth-day.jpg",
  "/earth/earth-normal.jpg",
  "/earth/earth-specular.jpg",
  "/earth/earth-clouds.png",
  "/earth/earth-night.jpg",
  "/earth/earth-bump.png",
] as const

const destinations: DestinationNode[] = [
  { id: "bue", lat: -34.6037, lng: -58.3816, importance: "primary" },
  { id: "cun", lat: 21.1619, lng: -86.8515, importance: "secondary" },
  { id: "puj", lat: 18.5601, lng: -68.3725, importance: "secondary" },
  { id: "mia", lat: 25.7617, lng: -80.1918, importance: "support" },
  { id: "nyc", lat: 40.7128, lng: -74.006, importance: "support" },
  { id: "lax", lat: 34.0522, lng: -118.2437, importance: "support" },
  { id: "mad", lat: 40.4168, lng: -3.7038, importance: "secondary" },
  { id: "rom", lat: 41.9028, lng: 12.4964, importance: "support" },
  { id: "rio", lat: -22.9068, lng: -43.1729, importance: "support" },
  { id: "dxb", lat: 25.2048, lng: 55.2708, importance: "secondary" },
  { id: "del", lat: 28.6139, lng: 77.209, importance: "support" },
  { id: "sin", lat: 1.3521, lng: 103.8198, importance: "secondary" },
  { id: "tyo", lat: 35.6762, lng: 139.6503, importance: "secondary" },
  { id: "syd", lat: -33.8688, lng: 151.2093, importance: "secondary" },
  { id: "jnb", lat: -26.2041, lng: 28.0473, importance: "support" },
]

const routeConnections: RouteConnection[] = [
  { from: "bue", to: "cun", emphasis: "primary" },
  { from: "bue", to: "puj", emphasis: "primary" },
  { from: "bue", to: "mia", emphasis: "secondary" },
  { from: "bue", to: "mad", emphasis: "secondary" },
  { from: "mad", to: "rom", emphasis: "secondary" },
  { from: "bue", to: "rio", emphasis: "secondary" },
  { from: "mia", to: "nyc", emphasis: "secondary" },
  { from: "mia", to: "lax", emphasis: "secondary" },
  { from: "nyc", to: "mad", emphasis: "secondary" },
  { from: "mia", to: "cun", emphasis: "secondary" },
  { from: "rio", to: "jnb", emphasis: "secondary" },
  { from: "bue", to: "jnb", emphasis: "secondary" },
  { from: "mad", to: "dxb", emphasis: "secondary" },
  { from: "rom", to: "dxb", emphasis: "secondary" },
  { from: "dxb", to: "del", emphasis: "secondary" },
  { from: "dxb", to: "sin", emphasis: "primary" },
  { from: "del", to: "sin", emphasis: "secondary" },
  { from: "sin", to: "tyo", emphasis: "secondary" },
  { from: "sin", to: "syd", emphasis: "primary" },
  { from: "tyo", to: "syd", emphasis: "secondary" },
  { from: "lax", to: "tyo", emphasis: "primary" },
  { from: "lax", to: "syd", emphasis: "secondary" },
  { from: "tyo", to: "dxb", emphasis: "secondary" },
  { from: "jnb", to: "dxb", emphasis: "secondary" },
]

const sunDirection = new Vector3(1.25, 0.28, 1).normalize()

const atmosphereVertexShader = `
  varying vec3 vNormalView;

  void main() {
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const atmosphereFragmentShader = `
  varying vec3 vNormalView;

  void main() {
    float fresnel = pow(0.86 - max(dot(vNormalView, vec3(0.0, 0.0, 1.0)), 0.0), 3.6);
    vec3 color = mix(vec3(0.02, 0.16, 0.4), vec3(0.31, 0.84, 1.0), fresnel);
    gl_FragColor = vec4(color, fresnel * 0.78);
  }
`

const nightLightsVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const nightLightsFragmentShader = `
  uniform sampler2D nightMap;
  uniform vec3 lightDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    vec3 nightColor = texture2D(nightMap, vUv).rgb;
    float nightMask = smoothstep(0.16, -0.34, dot(normalize(vWorldNormal), normalize(lightDirection)));
    float cityGlow = max(max(nightColor.r, nightColor.g), nightColor.b);
    float alpha = nightMask * cityGlow * 1.28;
    gl_FragColor = vec4(nightColor, alpha);
  }
`

const latLngToVector3 = (lat: number, lng: number, radius = EARTH_RADIUS + 0.01) => {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)

  return new Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

const createArc = (start: Vector3, end: Vector3) => {
  const midpoint = start.clone().add(end).normalize().multiplyScalar(EARTH_RADIUS * 1.28)
  const curve = new CatmullRomCurve3([start, midpoint, end])

  return {
    curve,
    points: curve.getPoints(64),
  }
}

const applyTextureSettings = (textures: Texture[]) => {
  const [dayMap, , , cloudsMap, nightMap] = textures
  dayMap.colorSpace = SRGBColorSpace
  cloudsMap.colorSpace = SRGBColorSpace
  nightMap.colorSpace = SRGBColorSpace
  textures.forEach((texture) => {
    texture.needsUpdate = true
  })
}

function EarthNightLights({
  texture,
  lightDirection,
}: {
  texture: Texture
  lightDirection: Vector3
}) {
  const uniforms = useMemo(
    () => ({
      nightMap: { value: texture },
      lightDirection: { value: lightDirection },
    }),
    [lightDirection, texture],
  )

  return (
    <mesh scale={1.003}>
      <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={nightLightsVertexShader}
        fragmentShader={nightLightsFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  )
}

function EarthAtmosphere() {
  return (
    <mesh scale={ATMOSPHERE_RADIUS / EARTH_RADIUS}>
      <sphereGeometry args={[EARTH_RADIUS, 72, 72]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        side={BackSide}
      />
    </mesh>
  )
}

function GlobeRoutes({ progress }: { progress?: MotionValue<number> }) {
  const globeRef = useRef<Group>(null)
  const cloudRef = useRef<Mesh>(null)
  const pulseRefs = useRef<(Group | null)[]>([])
  const [dayMap, normalMap, specularMap, cloudsMap, nightMap, bumpMap] = useTexture(
    EARTH_TEXTURE_PATHS,
  ) as Texture[]

  useEffect(() => {
    applyTextureSettings([dayMap, normalMap, specularMap, cloudsMap, nightMap, bumpMap])
  }, [bumpMap, cloudsMap, dayMap, nightMap, normalMap, specularMap])

  const nodes = useMemo(
    () =>
      destinations.map((destination) => ({
        ...destination,
        position: latLngToVector3(destination.lat, destination.lng),
      })),
    [],
  )

  const routes = useMemo(() => {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))

    return routeConnections.map((route) => {
      const fromNode = nodeMap.get(route.from)
      const toNode = nodeMap.get(route.to)

      if (!fromNode || !toNode) {
        throw new Error(`Missing destination node for route ${route.from}-${route.to}`)
      }

      const arc = createArc(fromNode.position, toNode.position)

      return {
        ...route,
        ...arc,
      }
    })
  }, [nodes])

  const routeFlowLights = useMemo<RouteFlowLight[]>(
    () =>
      routes.flatMap((route, routeIndex) => {
        const pulseCount = route.emphasis === "primary" ? 3 : 2

        return Array.from({ length: pulseCount }, (_, pulseIndex) => ({
          id: `${route.from}-${route.to}-${pulseIndex}`,
          routeIndex,
          offset: pulseIndex / pulseCount,
          speed: route.emphasis === "primary" ? 0.138 + pulseIndex * 0.004 : 0.106 + pulseIndex * 0.003,
          size: route.emphasis === "primary" ? 0.017 : 0.014,
          glowSize: route.emphasis === "primary" ? 0.038 : 0.032,
          color: route.emphasis === "primary" ? "#fef3c7" : "#dff7ff",
          glowColor: route.emphasis === "primary" ? "#fbbf24" : "#38bdf8",
          opacity: route.emphasis === "primary" ? 0.82 : 0.7,
        }))
      }),
    [routes],
  )

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime()
    const scroll = progress?.get() ?? 0

    state.camera.position.x = Math.sin(elapsed * 0.18) * 0.32 + state.pointer.x * 0.22 + scroll * 0.38
    state.camera.position.y = 0.08 + Math.cos(elapsed * 0.14) * 0.16 + state.pointer.y * 0.14 + scroll * 0.1
    state.camera.position.z = 4.4 - scroll * 0.72
    state.camera.lookAt(-0.06 + scroll * 0.1, 0.02 - scroll * 0.04, 0)

    if (globeRef.current) {
      globeRef.current.rotation.y = elapsed * 0.07 + scroll * 0.62 + state.pointer.x * 0.16
      globeRef.current.rotation.x = 0.2 + Math.sin(elapsed * 0.2) * 0.05 - scroll * 0.12 + state.pointer.y * 0.08
      globeRef.current.rotation.z = -0.05 + state.pointer.x * 0.05
    }

    if (cloudRef.current) {
      cloudRef.current.rotation.y += 0.0028
      cloudRef.current.rotation.z = Math.sin(elapsed * 0.08) * 0.012
    }

    routeFlowLights.forEach((flowLight, index) => {
      const pulse = pulseRefs.current[index]
      if (!pulse) {
        return
      }

      const route = routes[flowLight.routeIndex]
      const routeProgress =
        (elapsed * flowLight.speed + flowLight.offset + flowLight.routeIndex * 0.08 + scroll * 0.24) % 1
      const point = route.curve.getPoint(routeProgress)
      const scale = 0.96 + Math.sin(elapsed * 6 + index) * 0.12

      pulse.position.copy(point)
      pulse.scale.setScalar(scale)
    })
  })

  return (
    <>
      <color attach="background" args={["#01040b"]} />
      <fog attach="fog" args={["#01040b", 4.8, 10.8]} />
      <ambientLight intensity={0.36} />
      <hemisphereLight args={["#7dd3fc", "#020617", 0.52]} />
      <directionalLight position={[5.2, 1.8, 4.1]} intensity={2.35} color="#f8fdff" />
      <pointLight position={[-4.6, -1.8, 3.6]} intensity={0.92} color="#0ea5e9" />
      <pointLight position={[2.8, 1.4, -3.1]} intensity={0.55} color="#f59e0b" />

      <Stars radius={10} depth={5} count={1200} factor={4} saturation={0} fade speed={0.24} />

      <group ref={globeRef}>
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
          <meshPhongMaterial
            map={dayMap}
            normalMap={normalMap}
            normalScale={new Vector2(0.7, 0.7)}
            specularMap={specularMap}
            bumpMap={bumpMap}
            bumpScale={0.02}
            specular="#b8ecff"
            shininess={18}
            reflectivity={0.24}
          />
        </mesh>

        <EarthNightLights texture={nightMap} lightDirection={sunDirection} />

        <mesh ref={cloudRef} scale={CLOUD_RADIUS / EARTH_RADIUS}>
          <sphereGeometry args={[EARTH_RADIUS, 72, 72]} />
          <meshPhongMaterial
            map={cloudsMap}
            alphaMap={cloudsMap}
            color="#f8fdff"
            transparent
            opacity={0.34}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>

        <mesh scale={1.012}>
          <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
          <meshBasicMaterial color="#d6fbff" transparent opacity={0.055} />
        </mesh>

        <EarthAtmosphere />

        {routes.map((route) => (
          <group key={`${route.from}-${route.to}`}>
            <Line
              points={route.points}
              color={route.emphasis === "primary" ? "#dff7ff" : "#7dd3fc"}
              lineWidth={route.emphasis === "primary" ? 1.2 : 0.72}
              transparent
              opacity={route.emphasis === "primary" ? 0.82 : 0.46}
            />
            <Line
              points={route.points}
              color={route.emphasis === "primary" ? "#fbbf24" : "#38bdf8"}
              lineWidth={0.34}
              transparent
              opacity={route.emphasis === "primary" ? 0.58 : 0.32}
            />
          </group>
        ))}

        {nodes.map((node) => {
          const scale =
            node.importance === "primary" ? 1.35 : node.importance === "secondary" ? 1.12 : 0.96

          return (
            <group key={node.id} position={node.position.toArray()}>
              <mesh scale={0.038 * scale}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color="#f8fafc" />
              </mesh>
              <mesh scale={0.082 * scale}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.2} />
              </mesh>
            </group>
          )
        })}

        {routeFlowLights.map((flowLight, index) => (
          <group
            key={flowLight.id}
            ref={(mesh) => {
              pulseRefs.current[index] = mesh
            }}
          >
            <mesh>
              <sphereGeometry args={[flowLight.glowSize, 14, 14]} />
              <meshBasicMaterial
                color={flowLight.glowColor}
                transparent
                opacity={flowLight.opacity * 0.16}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[flowLight.size, 14, 14]} />
              <meshBasicMaterial color={flowLight.color} transparent opacity={flowLight.opacity} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  )
}

export function TravelRoutesScene({ progress }: TravelRoutesSceneProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0.1, 0.1, 4.4], fov: CAMERA_FOV }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <GlobeRoutes progress={progress} />
      </Canvas>
    </div>
  )
}
