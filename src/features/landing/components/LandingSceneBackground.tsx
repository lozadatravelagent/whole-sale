import { Canvas, useFrame } from "@react-three/fiber"
import { Line, Stars, useTexture } from "@react-three/drei"
import { MotionValue, useReducedMotion, useScroll, useSpring } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  AdditiveBlending,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  Points as ThreePoints,
  SRGBColorSpace,
  Vector3,
} from "three"
import { useIsMobile } from "@/hooks/use-mobile"

type RibbonConfig = {
  color: string
  width: number
  opacity: number
  position: [number, number, number]
  rotation: [number, number, number]
  radiusX: number
  radiusY: number
  startAngle: number
  endAngle: number
  wave: number
  drift: [number, number, number]
  spin: [number, number, number]
}

type ParticleLayerConfig = {
  count: number
  radius: number
  spread: number
  color: string
  size: number
  opacity: number
  drift: [number, number, number]
  spin: [number, number, number]
}

type VeilConfig = {
  color: string
  opacity: number
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  drift: [number, number, number]
  spin: [number, number, number]
}

type LandmarkConfig = {
  id: string
  stickerUrl: string
  position: [number, number, number]
  rotation: [number, number, number]
  size: [number, number]
  opacity: number
  drift: [number, number, number]
  spin: [number, number, number]
}

const ribbonConfigs: RibbonConfig[] = [
  {
    color: "#7dd3fc",
    width: 1.5,
    opacity: 0.42,
    position: [0.4, 1.8, -4.8],
    rotation: [0.92, 0.45, 0.24],
    radiusX: 8.2,
    radiusY: 3.4,
    startAngle: -2.1,
    endAngle: 1.2,
    wave: 0.38,
    drift: [1.6, -1.2, 1.3],
    spin: [0.02, 0.1, 0.08],
  },
  {
    color: "#38bdf8",
    width: 1.2,
    opacity: 0.28,
    position: [-1.6, -0.8, -7.6],
    rotation: [1.08, -0.35, -0.34],
    radiusX: 10.4,
    radiusY: 4.6,
    startAngle: -1.35,
    endAngle: 2.35,
    wave: 0.28,
    drift: [-1.1, 1.8, 1.8],
    spin: [0.04, -0.08, -0.05],
  },
  {
    color: "#fbbf24",
    width: 1.05,
    opacity: 0.24,
    position: [2.1, -2.2, -6.2],
    rotation: [0.8, 0.18, 0.54],
    radiusX: 7.1,
    radiusY: 2.8,
    startAngle: -2.7,
    endAngle: 0.65,
    wave: 0.44,
    drift: [1.2, 1.4, 0.7],
    spin: [0.06, 0.06, 0.09],
  },
  {
    color: "#bae6fd",
    width: 0.75,
    opacity: 0.18,
    position: [-2.6, 2.4, -9.2],
    rotation: [1.2, -0.62, 0.12],
    radiusX: 11.8,
    radiusY: 5.2,
    startAngle: -0.5,
    endAngle: 2.7,
    wave: 0.22,
    drift: [-1.8, -0.8, 2.1],
    spin: [0.02, -0.04, 0.03],
  },
]

const particleLayerConfigs: ParticleLayerConfig[] = [
  {
    count: 620,
    radius: 9.5,
    spread: 6.5,
    color: "#9be8ff",
    size: 0.04,
    opacity: 0.55,
    drift: [1.2, -1.4, 0.6],
    spin: [0.015, 0.05, 0.01],
  },
  {
    count: 360,
    radius: 7.2,
    spread: 5.2,
    color: "#67d7ff",
    size: 0.055,
    opacity: 0.38,
    drift: [-1.8, 1.8, 1.1],
    spin: [0.02, -0.07, 0.02],
  },
  {
    count: 180,
    radius: 5.8,
    spread: 4.1,
    color: "#fde68a",
    size: 0.08,
    opacity: 0.22,
    drift: [1.4, 1.1, 1.6],
    spin: [0.01, 0.04, -0.03],
  },
]

const veilConfigs: VeilConfig[] = [
  {
    color: "#38bdf8",
    opacity: 0.18,
    position: [-4.4, 2.2, -5.8],
    rotation: [0.55, 0.35, -0.22],
    scale: [8.5, 5.4, 1],
    drift: [1.8, -1.2, 0],
    spin: [0.01, 0.02, 0.03],
  },
  {
    color: "#0ea5e9",
    opacity: 0.14,
    position: [4.8, -1.6, -8.4],
    rotation: [0.4, -0.4, 0.2],
    scale: [10.5, 6.4, 1],
    drift: [-1.6, 1.3, 0],
    spin: [0.02, -0.02, 0.02],
  },
  {
    color: "#fbbf24",
    opacity: 0.09,
    position: [1.8, 3.6, -10.2],
    rotation: [0.72, 0.18, 0.4],
    scale: [7.2, 4.6, 1],
    drift: [1, 1.8, 0],
    spin: [0.01, 0.01, -0.02],
  },
]

const landmarkConfigs: LandmarkConfig[] = [
  {
    id: "big-ben",
    stickerUrl: "/stickers/big-ben.svg",
    position: [-7.1, 3.7, -7.3],
    rotation: [0.12, 0.36, -0.08],
    size: [1.45, 4.1],
    opacity: 0.97,
    drift: [0.9, 1.05, 1.1],
    spin: [0.018, 0.06, 0.018],
  },
  {
    id: "eiffel",
    stickerUrl: "/stickers/eiffel-tower.svg",
    position: [6.9, 3.1, -7.8],
    rotation: [-0.06, -0.46, 0.06],
    size: [2.2, 3.35],
    opacity: 0.96,
    drift: [-0.95, 1.05, 1.15],
    spin: [0.018, -0.06, 0.025],
  },
  {
    id: "statue",
    stickerUrl: "/stickers/statue-liberty.svg",
    position: [2.9, 4.7, -10.8],
    rotation: [0.16, 0.14, -0.05],
    size: [1.85, 1.85],
    opacity: 0.96,
    drift: [0.65, 0.95, 1.75],
    spin: [0.012, 0.038, -0.016],
  },
  {
    id: "airplane",
    stickerUrl: "/stickers/airplane.svg",
    position: [-5.5, -3.4, -5.1],
    rotation: [-0.2, -0.22, 0.24],
    size: [2.95, 2.95],
    opacity: 0.98,
    drift: [1.45, 0.85, 0.8],
    spin: [0.022, 0.075, -0.028],
  },
  {
    id: "suitcase",
    stickerUrl: "/stickers/suitcase.svg",
    position: [6.1, -2.9, -8.0],
    rotation: [0.08, 0.42, -0.05],
    size: [2.3, 2.3],
    opacity: 0.96,
    drift: [-1.05, 0.95, 1.2],
    spin: [0.018, 0.05, 0.024],
  },
  {
    id: "passport",
    stickerUrl: "/stickers/passport.svg",
    position: [-2.6, 3.6, -9.4],
    rotation: [0.16, -0.18, -0.1],
    size: [2.05, 2.05],
    opacity: 0.96,
    drift: [0.75, 1.2, 1.45],
    spin: [0.016, -0.042, 0.02],
  },
  {
    id: "camera",
    stickerUrl: "/stickers/camera.svg",
    position: [7.6, 0.2, -10.2],
    rotation: [0.04, -0.42, 0.12],
    size: [2.3, 2.3],
    opacity: 0.95,
    drift: [-1.1, 0.75, 1.75],
    spin: [0.014, -0.035, 0.018],
  },
  {
    id: "compass",
    stickerUrl: "/stickers/compass.svg",
    position: [-1.5, -4.2, -10.9],
    rotation: [0.2, 0.16, -0.16],
    size: [1.95, 1.95],
    opacity: 0.94,
    drift: [0.7, 1.05, 1.9],
    spin: [0.012, 0.026, -0.018],
  },
]

const orbitalArcPoints = (config: RibbonConfig) => {
  const points: Vector3[] = []
  const segments = 96

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments
    const angle = config.startAngle + (config.endAngle - config.startAngle) * t
    const x = Math.cos(angle) * config.radiusX
    const y = Math.sin(angle) * config.radiusY
    const z = Math.sin(angle * 2.2) * config.wave
    points.push(new Vector3(x, y, z))
  }

  return points
}

const buildParticlePositions = (config: ParticleLayerConfig) => {
  const positions = new Float32Array(config.count * 3)

  for (let index = 0; index < config.count; index += 1) {
    const stride = index * 3
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const radius = config.radius * (0.36 + Math.random() * 0.84)

    positions[stride] =
      Math.sin(phi) * Math.cos(theta) * radius + (Math.random() - 0.5) * config.spread
    positions[stride + 1] =
      Math.cos(phi) * radius * 0.72 + (Math.random() - 0.5) * (config.spread * 0.45)
    positions[stride + 2] =
      Math.sin(phi) * Math.sin(theta) * radius + (Math.random() - 0.5) * config.spread
  }

  return positions
}

const createVeilTexture = () => {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 512

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Could not create orbital veil texture")
  }

  const gradient = context.createRadialGradient(256, 256, 30, 256, 256, 256)
  gradient.addColorStop(0, "rgba(255,255,255,0.95)")
  gradient.addColorStop(0.35, "rgba(255,255,255,0.55)")
  gradient.addColorStop(0.7, "rgba(255,255,255,0.08)")
  gradient.addColorStop(1, "rgba(255,255,255,0)")

  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const supportsWebGL = () => {
  const canvas = document.createElement("canvas")
  return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
}

function LandmarkFloat({
  config,
  scrollYProgress,
}: {
  config: LandmarkConfig
  scrollYProgress: MotionValue<number>
}) {
  const groupRef = useRef<Group>(null)
  const texture = useTexture(config.stickerUrl)

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])

  useFrame((state) => {
    if (!groupRef.current) {
      return
    }

    const progress = scrollYProgress.get()
    const elapsed = state.clock.getElapsedTime()
    const bob = Math.sin(elapsed * 1.25 + config.position[0]) * 0.16
    const pulse = 1 + Math.sin(elapsed * 0.9 + config.position[1]) * 0.035

    groupRef.current.position.x = config.position[0] + (progress - 0.5) * config.drift[0]
    groupRef.current.position.y = config.position[1] + bob + (0.5 - progress) * config.drift[1]
    groupRef.current.position.z = config.position[2] + progress * config.drift[2]
    groupRef.current.rotation.x = config.rotation[0] + elapsed * config.spin[0]
    groupRef.current.rotation.y = config.rotation[1] + elapsed * config.spin[1] + progress * 0.28
    groupRef.current.rotation.z = config.rotation[2] + elapsed * config.spin[2]
    groupRef.current.scale.setScalar(pulse)
  })

  return (
    <group ref={groupRef} position={config.position} rotation={config.rotation}>
      <mesh position={[0, 0, 0.04]} scale={[config.size[0], config.size[1], 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={config.opacity}
          toneMapped={false}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
}

function ParticleLayer({
  config,
  scrollYProgress,
}: {
  config: ParticleLayerConfig
  scrollYProgress: MotionValue<number>
}) {
  const pointsRef = useRef<ThreePoints>(null)
  const positions = useMemo(() => buildParticlePositions(config), [config])

  useFrame((state, delta) => {
    if (!pointsRef.current) {
      return
    }

    const progress = scrollYProgress.get()
    const elapsed = state.clock.getElapsedTime()

    pointsRef.current.rotation.x = config.spin[0] * elapsed + progress * 0.24
    pointsRef.current.rotation.y = config.spin[1] * elapsed + progress * 0.42
    pointsRef.current.rotation.z = config.spin[2] * elapsed
    pointsRef.current.position.x = (progress - 0.5) * config.drift[0]
    pointsRef.current.position.y = (0.5 - progress) * config.drift[1]
    pointsRef.current.position.z = -7.5 + progress * config.drift[2]
    pointsRef.current.rotation.y += delta * config.spin[1] * 0.4
  })

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={config.color}
        size={config.size}
        sizeAttenuation
        transparent
        opacity={config.opacity}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  )
}

function OrbitalRibbon({
  config,
  scrollYProgress,
}: {
  config: RibbonConfig
  scrollYProgress: MotionValue<number>
}) {
  const groupRef = useRef<Group>(null)
  const points = useMemo(() => orbitalArcPoints(config), [config])

  useFrame((state) => {
    if (!groupRef.current) {
      return
    }

    const progress = scrollYProgress.get()
    const elapsed = state.clock.getElapsedTime()

    groupRef.current.position.x = config.position[0] + (progress - 0.5) * config.drift[0]
    groupRef.current.position.y = config.position[1] + (0.5 - progress) * config.drift[1]
    groupRef.current.position.z = config.position[2] + progress * config.drift[2]
    groupRef.current.rotation.x = config.rotation[0] + elapsed * config.spin[0] + progress * 0.22
    groupRef.current.rotation.y = config.rotation[1] + elapsed * config.spin[1] - progress * 0.32
    groupRef.current.rotation.z = config.rotation[2] + elapsed * config.spin[2] + progress * 0.18
  })

  return (
    <group ref={groupRef}>
      <Line points={points} color={config.color} lineWidth={config.width} transparent opacity={config.opacity} />
    </group>
  )
}

function VeilPlane({
  config,
  texture,
  scrollYProgress,
}: {
  config: VeilConfig
  texture: CanvasTexture
  scrollYProgress: MotionValue<number>
}) {
  const meshRef = useRef<Mesh>(null)

  useFrame((state) => {
    if (!meshRef.current) {
      return
    }

    const progress = scrollYProgress.get()
    const elapsed = state.clock.getElapsedTime()

    meshRef.current.position.x = config.position[0] + (progress - 0.5) * config.drift[0]
    meshRef.current.position.y = config.position[1] + (0.5 - progress) * config.drift[1]
    meshRef.current.position.z = config.position[2]
    meshRef.current.rotation.x = config.rotation[0] + elapsed * config.spin[0]
    meshRef.current.rotation.y = config.rotation[1] + elapsed * config.spin[1]
    meshRef.current.rotation.z = config.rotation[2] + elapsed * config.spin[2] + progress * 0.14
  })

  return (
    <mesh ref={meshRef} position={config.position} rotation={config.rotation} scale={config.scale}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshBasicMaterial
        map={texture}
        color={config.color}
        transparent
        opacity={config.opacity}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

function OrbitalBackgroundScene({ scrollYProgress }: { scrollYProgress: MotionValue<number> }) {
  const rigRef = useRef<Group>(null)
  const veilTexture = useMemo(() => createVeilTexture(), [])

  useFrame((state) => {
    const progress = scrollYProgress.get()
    const elapsed = state.clock.getElapsedTime()

    state.camera.position.x = Math.sin(elapsed * 0.13) * 0.45 + (progress - 0.5) * 1.8
    state.camera.position.y = Math.cos(elapsed * 0.11) * 0.24 + (0.5 - progress) * 1.3
    state.camera.position.z = 10.8 - progress * 1.9
    state.camera.lookAt(0, 0, -6)

    if (rigRef.current) {
      rigRef.current.rotation.z = Math.sin(elapsed * 0.08) * 0.03 + progress * 0.08
    }
  })

  return (
    <>
      <color attach="background" args={["#02040b"]} />
      <fog attach="fog" args={["#02040b", 10, 28]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 5, 6]} intensity={1.1} color="#dff9ff" />
      <pointLight position={[-6, 2, 3]} intensity={1.3} color="#38bdf8" />
      <pointLight position={[5, -2, 4]} intensity={0.8} color="#fbbf24" />
      <Stars radius={38} depth={18} count={1400} factor={4} saturation={0} fade speed={0.2} />

      <group ref={rigRef}>
        {veilConfigs.map((config) => (
          <VeilPlane
            key={`${config.color}-${config.position.join("-")}`}
            config={config}
            texture={veilTexture}
            scrollYProgress={scrollYProgress}
          />
        ))}

        {ribbonConfigs.map((config) => (
          <OrbitalRibbon
            key={`${config.color}-${config.position.join("-")}`}
            config={config}
            scrollYProgress={scrollYProgress}
          />
        ))}

        {particleLayerConfigs.map((config, index) => (
          <ParticleLayer key={`${config.color}-${index}`} config={config} scrollYProgress={scrollYProgress} />
        ))}

        {landmarkConfigs.map((config) => (
          <LandmarkFloat key={config.id} config={config} scrollYProgress={scrollYProgress} />
        ))}
      </group>
    </>
  )
}

function LandingSceneFallback() {
  return (
    <div className="landing-page-backdrop absolute inset-0">
      <div className="landing-orbital-fallback absolute inset-0" />
      <div className="absolute left-[-14%] top-[12%] h-[34rem] w-[34rem] rounded-full border border-sky-300/10 bg-sky-400/[0.08] blur-3xl" />
      <div className="absolute right-[-12%] top-[26%] h-[28rem] w-[28rem] rounded-full border border-cyan-300/10 bg-cyan-400/[0.08] blur-3xl" />
      <div className="absolute left-[18%] top-[8%] h-[80vh] w-[80vh] rounded-full border border-sky-300/[0.12] opacity-30" />
      <div className="absolute left-[10%] top-[22%] h-[92vh] w-[92vh] rounded-full border border-white/[0.06] opacity-20" />
      <div className="absolute right-[4%] top-[40%] h-[72vh] w-[72vh] rounded-full border border-amber-200/[0.08] opacity-[0.15]" />
    </div>
  )
}

export function LandingSceneBackground() {
  const isMobile = useIsMobile()
  const prefersReducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 28,
    mass: 0.35,
  })
  const [canRenderWebGL, setCanRenderWebGL] = useState(true)

  useEffect(() => {
    setCanRenderWebGL(supportsWebGL())
  }, [])

  if (isMobile || prefersReducedMotion || !canRenderWebGL) {
    return (
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <LandingSceneFallback />
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#02040b]" />
      <Canvas
        className="absolute inset-0"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 10.8], fov: 54 }}
        gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
      >
        <OrbitalBackgroundScene scrollYProgress={smoothProgress} />
      </Canvas>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(110,231,255,0.12),transparent_28%),radial-gradient(circle_at_78%_24%,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(251,191,36,0.08),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.12)_0%,rgba(2,6,23,0.08)_35%,rgba(2,6,23,0.46)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08)_0%,transparent_18%,transparent_78%,rgba(2,6,23,0.64)_100%)]" />
    </div>
  )
}
