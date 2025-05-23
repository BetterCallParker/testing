// main.js
// This file sets up and animates a 3D visualization of an "Ethereal Neural Network"
// using Three.js. It includes neurons with pulsing animations, emanating filaments,
// curved axon connections between neurons, and a bloom post-processing effect for a glowing look.
// Camera interactions are handled by OrbitControls.

//----------------------------------------------------------------------------------
// MODULE IMPORT PLACEHOLDERS (for reference if using a module system)
//----------------------------------------------------------------------------------
// import * as THREE from 'three'; // Or specific classes
// import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
// import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Note: Since this project uses a CDN, THREE.js and its addons are expected to be globally available.

//----------------------------------------------------------------------------------
// SCENE SETUP
//----------------------------------------------------------------------------------

// Scene: The container for all 3D objects.
const scene = new THREE.Scene();

// Camera: Defines the viewpoint for rendering the scene.
// PerspectiveCamera(fov, aspect, near, far)
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15); // Positioned to give a good overview of the central network.
camera.lookAt(0, 0, 0); // Camera looks at the center of the scene.

// Renderer: Renders the scene using WebGL.
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight); // Set to full window size.
document.body.appendChild(renderer.domElement); // Add the renderer's canvas to the HTML body.

// Background Color: A dark blue, almost black, for a space-like ethereal feel.
scene.background = new THREE.Color(0x000011);

//----------------------------------------------------------------------------------
// POST-PROCESSING (BLOOM EFFECT)
//----------------------------------------------------------------------------------
let composer; // EffectComposer to manage post-processing passes.

// Check if necessary Three.js addon classes are available (expected globally via CDN scripts)
if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
    composer = new THREE.EffectComposer(renderer);

    // RenderPass: Renders the base scene, this is the first pass.
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    // UnrealBloomPass: Creates a bloom (glow) effect for bright areas.
    // Adjusted parameters for a softer, more nuanced bloom with the new detailed shaders.
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), // resolution
        0.8, // strength: Reduced for a softer glow.
        0.7, // radius: Slightly increased for a bit more spill.
        0.85 // threshold: Increased to target mainly the brightest emissive parts.
    );
    composer.addPass(bloomPass);
} else {
    // Log a warning if post-processing components are not found.
    console.warn("EffectComposer or its passes are not available. Bloom effect will be disabled. Ensure EffectComposer.js, RenderPass.js, and UnrealBloomPass.js are loaded after three.min.js.");
}

//----------------------------------------------------------------------------------
// CAMERA CONTROLS (ORBITCONTROLS)
//----------------------------------------------------------------------------------
let controls; // OrbitControls for camera manipulation (zoom, pan, rotate).

//----------------------------------------------------------------------------------
// SHADER DEFINITIONS (GLSL)
//----------------------------------------------------------------------------------

// Noise function will be used by both core and aura shaders
const glslNoise = `
    precision mediump float; // Added precision
    // Classic Perlin 3D Noise (by Stefan Gustavson)
    // https://github.com/stegu/webgl-noise/blob/master/src/noise3D.glsl
    vec3 mod289(vec3 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
        return mod289(((x*34.0)+1.0)*x);
    }

    vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472090901 * r;
    }

    float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        // First corner
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 =   v - i + dot(i, C.xxx) ;

        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
        vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

        // Permutations
        i = mod289(i);
        vec4 p = permute( permute( permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        // Gradients: 7x7 points over a square, mapped onto an octahedron.
        float n_ = 0.142857142857; // 1.0/7.0
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        // Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        // Mix final noise value
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                        dot(p2,x2), dot(p3,x3) ) );
    }
`;

const particleVertexShader = `
    attribute float customAlpha;
    attribute float customSize;
    varying float vAlpha;

    void main() {
        vAlpha = customAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = customSize * (300.0 / -mvPosition.z); // Size attenuation // Ensure customSize is not zero
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const particleFragmentShader = `
    uniform vec3 u_particleColor;
    varying float vAlpha;

    void main() {
        precision mediump float; // Added precision
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.45) discard; // Create a slightly smaller circle than 0.5 to avoid hard edges

        gl_FragColor = vec4(u_particleColor, vAlpha * (1.0 - dist * 2.0)); // Fade towards edge
    }
`;


const neuronVertexShader = `
    uniform float u_time;
    uniform float u_frequency;
    uniform float u_amplitude;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vViewDirection; // Vector from vertex to camera in world space

    ${glslNoise} // Embed noise function

    void main() {
        // Standard model-view-projection transformation
        vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vWorldPosition = worldPosition.xyz;
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);

        // Calculate noise for displacement (same as before)
        float noiseValue = snoise(position * u_frequency + u_time * 0.2);
        vec3 displacedPosition = position + normal * noiseValue * u_amplitude;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
    }
`;

const neuronFragmentShader = `
    uniform vec3 u_coreColor;
    uniform float u_time;
    uniform float u_fresnelPower; // Power for Fresnel effect
    uniform float u_fresnelBias;
    uniform float u_noiseFrequencyCore;
    uniform float u_noiseSpeedCore;
    uniform float u_noiseImpactCore;

    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vViewDirection;

    ${glslNoise} // Embed noise function

    void main() {
        precision mediump float; // Added precision
        // Fresnel Effect
        // vNormal and vViewDirection are already normalized in vertex shader
        float fresnelTerm = dot(vNormal, vViewDirection); 
        float fresnel = pow(1.0 - fresnelTerm + u_fresnelBias, u_fresnelPower);
        fresnel = clamp(fresnel, 0.0, 1.0);

        // Roiling Energy Noise
        float energyNoise = snoise(vWorldPosition * u_noiseFrequencyCore + u_time * u_noiseSpeedCore);
        energyNoise = (energyNoise * 0.5 + 0.5); // Map from -1..1 to 0..1

        // Base color modulated by noise and Fresnel
        vec3 baseColor = u_coreColor;
        vec3 finalColor = baseColor + baseColor * energyNoise * u_noiseImpactCore; // Noise adds to brightness
        finalColor += fresnel * baseColor * 2.0; // Fresnel significantly brightens edges

        // Make the very center a bit brighter based on UVs (assuming UVs are somewhat spherical)
        // float distFromCenter = distance(vUv, vec2(0.5)); // This UV based center is not robust for 3D
        // A better way for sphere center would be to pass localPos from vertex shader if needed
        // For now, rely on displacement and fresnel for volumetric feel

        gl_FragColor = vec4(finalColor, 1.0); // Alpha is 1.0 for core
    }
`;

const auraVertexShader = `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vViewDirection;

    void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vWorldPosition = worldPosition.xyz;
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const auraFragmentShader = `
    uniform vec3 u_auraColor;
    uniform float u_time;
    uniform float u_auraBaseAlpha;
    uniform float u_auraFresnelPower;
    uniform float u_auraFresnelBias;
    uniform float u_noiseFrequencyAura;
    uniform float u_noiseSpeedAura;
    uniform float u_noiseImpactAuraAlpha;
    uniform float u_noiseImpactAuraEmissive;


    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vViewDirection;

    ${glslNoise} // Embed noise function

    void main() {
        precision mediump float; // Added precision
        // Fresnel for gaseous edge
        // vNormal and vViewDirection are already normalized in vertex shader
        float fresnelTerm = dot(vNormal, vViewDirection);
        float fresnel = pow(1.0 - fresnelTerm + u_auraFresnelBias, u_auraFresnelPower);
        fresnel = clamp(fresnel, 0.0, 1.0);

        // Shimmering Noise for opacity and emissivity
        float shimmerNoise = snoise(vWorldPosition * u_noiseFrequencyAura + u_time * u_noiseSpeedAura);
        shimmerNoise = (shimmerNoise * 0.5 + 0.5); // Map to 0..1

        // Modulate alpha
        float finalAlpha = u_auraBaseAlpha * (1.0 - u_noiseImpactAuraAlpha * (1.0 - shimmerNoise)); // Noise reduces alpha slightly to create shimmer
        finalAlpha += fresnel * 0.2; // Fresnel adds a bit to edge opacity
        finalAlpha = clamp(finalAlpha, 0.0, 1.0);
        
        // Modulate emissive intensity
        vec3 emissiveColor = u_auraColor * (0.5 + shimmerNoise * u_noiseImpactAuraEmissive); // Noise boosts emissive
        emissiveColor += fresnel * u_auraColor * 0.5; // Fresnel adds to edge emissiveness
        
        gl_FragColor = vec4(emissiveColor, finalAlpha);
    }
`;


if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooths out camera movement.
    controls.dampingFactor = 0.05; // Damping inertia.
    controls.screenSpacePanning = false; // True to pan parallel to screen, false to pan in camera's XY plane.
    controls.minDistance = 5; // Minimum zoom distance.
    controls.maxDistance = 50; // Maximum zoom distance.
    controls.autoRotate = true; // Automatically rotates the camera around the target.
    controls.autoRotateSpeed = 0.3; // Speed of auto-rotation.
} else {
    console.warn("OrbitControls is not available. Camera controls will be disabled. Ensure OrbitControls.js is loaded after three.min.js.");
}

//----------------------------------------------------------------------------------
// NEURON CLASS
//----------------------------------------------------------------------------------
/**
 * Represents a neuron in the 3D scene.
 * It consists of a central core and a surrounding aura, both of which pulse.
 * It also generates fine, emanating filaments.
 */
class Neuron extends THREE.Group {
    /**
     * Creates a Neuron instance.
     * @param {number} coreRadius Radius of the central core sphere.
     * @param {number} auraRadiusMultiplier Multiplier for coreRadius to determine aura sphere size.
     * @param {number} coreColor Color of the core.
     * @param {number} auraColor Color of the aura.
     * @param {number} auraOpacity Initial opacity of the aura.
     */
    constructor(coreRadius = 0.2, auraRadiusMultiplier = 2, coreColor = 0xFFFFAA, auraColor = 0x00AAFF, auraOpacity = 0.3) {
        super();

        // Shared time uniform for both core and aura shaders
        this.sharedUniforms = {
            u_time: { value: 0.0 }
        };

        // Core: Volumetric and roiling energy
        const coreGeometry = new THREE.SphereGeometry(coreRadius, 64, 64);
        this.coreMaterial = new THREE.ShaderMaterial({
            vertexShader: neuronVertexShader, // Will displace and provide varyings
            fragmentShader: neuronFragmentShader,
            uniforms: THREE.UniformsUtils.merge([
                this.sharedUniforms,
                {
                    u_coreColor: { value: new THREE.Color(coreColor) },
                    u_frequency: { value: 3.0 + Math.random() * 2.0 }, // For displacement
                    u_amplitude: { value: 0.08 + Math.random() * 0.07 }, // For displacement
                    u_fresnelPower: { value: 2.5 + Math.random() * 1.0 },
                    u_fresnelBias: { value: 0.1 + Math.random() * 0.1 },
                    u_noiseFrequencyCore: { value: 2.0 + Math.random() * 1.0 },
                    u_noiseSpeedCore: { value: 0.15 + Math.random() * 0.1 },
                    u_noiseImpactCore: { value: 0.3 + Math.random() * 0.2 }
                }
            ]),
            transparent: false // Core is generally opaque
        });
        this.coreMesh = new THREE.Mesh(coreGeometry, this.coreMaterial);
        this.add(this.coreMesh);

        // Aura: Shimmering and gaseous
        const auraGeometry = new THREE.SphereGeometry(coreRadius * auraRadiusMultiplier, 64, 64);
        this.auraMaterial = new THREE.ShaderMaterial({
            vertexShader: auraVertexShader, // Simple pass-through, provides varyings
            fragmentShader: auraFragmentShader,
            uniforms: THREE.UniformsUtils.merge([
                this.sharedUniforms,
                {
                    u_auraColor: { value: new THREE.Color(auraColor) },
                    u_auraBaseAlpha: { value: auraOpacity },
                    u_auraFresnelPower: { value: 3.0 + Math.random() * 1.5 },
                    u_auraFresnelBias: { value: 0.05 + Math.random() * 0.05 },
                    u_noiseFrequencyAura: { value: 1.5 + Math.random() * 0.8 },
                    u_noiseSpeedAura: { value: 0.25 + Math.random() * 0.1 },
                    u_noiseImpactAuraAlpha: { value: 0.4 + Math.random() * 0.2 },
                    u_noiseImpactAuraEmissive: { value: 0.5 + Math.random() * 0.3 }
                }
            ]),
            transparent: true,
            blending: THREE.AdditiveBlending, // Good for glowing gas
            depthWrite: false // Often good for transparent additive effects
        });
        this.auraMesh = new THREE.Mesh(auraGeometry, this.auraMaterial);
        this.add(this.auraMesh);

        this.pulseSpeed = 0.0015 + Math.random() * 0.001;
        this.createFilaments();
    }

    /**
     * Creates fine filaments that emanate from the neuron's center.
     * Filaments are not affected by the new core/aura shaders directly, but will scale with the neuron.
     * @param {number} numFilaments Number of filaments to generate.
     * @param {number} minLength Minimum length of a filament.
     * @param {number} maxLength Maximum length of a filament.
     * @param {number} filamentRadius Radius of the filament tube.
     * @param {number} color Color of the filaments.
     * @param {number} opacity Opacity of the filaments.
     */
    createFilaments(numFilaments = 10, minLength = 0.4, maxLength = 1.2, filamentRadius = 0.006, color = 0x00BBFF, opacity = 0.6) {
        for (let i = 0; i < numFilaments; i++) {
            // Generate a random direction vector.
            const randomDirection = new THREE.Vector3(
                Math.random() * 2 - 1, // -1 to 1
                Math.random() * 2 - 1, // -1 to 1
                Math.random() * 2 - 1  // -1 to 1
            ).normalize();

            // Determine a random length for the filament.
            const length = minLength + Math.random() * (maxLength - minLength);
            const endPoint = randomDirection.multiplyScalar(length);
            const startPoint = new THREE.Vector3(0, 0, 0); // Filaments start at the neuron's local origin.

            // Create a tube geometry for the filament.
            const curve = new THREE.LineCurve3(startPoint, endPoint);
            const geometry = new THREE.TubeGeometry(curve, 8, filamentRadius, 4, false); // (path, tubularSegments, radius, radialSegments, closed)
            const material = new THREE.MeshBasicMaterial({
                color: color,
                emissive: color, // Emissive for bloom.
                transparent: true,
                opacity: opacity
            });
            const filamentMesh = new THREE.Mesh(geometry, material);
            this.add(filamentMesh); // Add filament as a child of the Neuron group.
        }
    }

    /**
     * Updates the neuron's state, its pulsing animation, and shader uniforms.
     * Called in the main animation loop.
     * @param {number} deltaTime Time elapsed since the last frame.
     */
    update(deltaTime) {
        // Update shared time uniform for both core and aura shaders
        this.sharedUniforms.u_time.value += deltaTime * 0.8; // Consolidated time update, speed can be adjusted

        // Overall pulsing scale for the entire Neuron group
        const pulse = Math.sin(Date.now() * this.pulseSpeed);
        const scaleFactor = 1 + pulse * 0.08; // 0.08 determines the intensity of the size pulse.
        this.scale.set(scaleFactor, scaleFactor, scaleFactor);
    }
}

//----------------------------------------------------------------------------------
// NEURON INSTANTIATION
//----------------------------------------------------------------------------------
const neurons = []; // Array to hold all neuron instances.

// Define positions for the neurons in 3D space.
const neuronPositions = [
    new THREE.Vector3(0, 0, 0),       // Central neuron
    new THREE.Vector3(4, 2, -3),
    new THREE.Vector3(-3, -3, 2.5),
    new THREE.Vector3(3.5, -1.5, 3),
    new THREE.Vector3(-2, 3, -1.5),
    new THREE.Vector3(1, -2, 4.5)
];

// Define a palette of colors for neuron cores and auras.
const neuronColors = [
    { core: 0xFFFFAA, aura: 0x00AAFF }, // Yellow core, Blue aura
    { core: 0xFFD700, aura: 0x00FFFF }, // Gold core, Cyan aura
    { core: 0xFFA07A, aura: 0xAFEEEE }, // LightSalmon core, PaleTurquoise aura
    { core: 0xADD8E6, aura: 0xFFC0CB }, // LightBlue core, Pink aura
    { core: 0x98FB98, aura: 0xFFB6C1 }, // PaleGreen core, LightPink aura
    { core: 0xFFE4B5, aura: 0x9370DB }  // Moccasin core, MediumPurple aura
];

// Create and position neurons with varied properties.
neuronPositions.forEach((pos, index) => {
    const colors = neuronColors[index % neuronColors.length]; // Cycle through colors if more neurons than palettes.
    const neuron = new Neuron(
        0.2 + Math.random() * 0.1,  // Randomize core radius slightly.
        1.8 + Math.random() * 0.4,  // Randomize aura size multiplier.
        colors.core,
        colors.aura,
        0.3 + Math.random() * 0.1   // Randomize aura opacity.
    );
    neuron.position.copy(pos); // Set the neuron's position in the scene.
    scene.add(neuron);         // Add the neuron to the scene.
    neurons.push(neuron);      // Store neuron for later reference (e.g., animation, axon connections).
});

//----------------------------------------------------------------------------------
// AXON CREATION FUNCTION
//----------------------------------------------------------------------------------

// Particle System Configuration
const MAX_PARTICLES_PER_AXON = 30; // Reduced from 70 for performance
const PARTICLE_COLOR = new THREE.Color(0x00ffff); // Cyan particles
const PARTICLE_BASE_SIZE = 0.05; // Slightly reduced base size
const PARTICLE_SPEED = 0.12; // Slightly increased speed for visual compensation


/**
 * Creates a procedural texture for the axon signal.
 * @returns {THREE.DataTexture} A texture with a simple dash/pulse pattern.
 */
function createSignalTexture() {
    const width = 16; // Width of the texture (less important for a 1D-like scroll)
    const height = 64; // Height of the texture (this will be the length of our pattern)
    const size = width * height;
    const data = new Uint8Array(4 * size); // 4 for RGBA

    for (let i = 0; i < height; i++) {
        // Create a simple pulse shape: bright in the middle, fading at edges
        // The pulse will be along the V direction (height)
        let intensity = 0;
        const t = i / height; // Normalized position along the texture height

        // Example: A short, bright dash
        if (t > 0.4 && t < 0.6) {
            intensity = 255 * (1.0 - Math.abs(t - 0.5) * 10.0); // Peaking at t=0.5
        }
        intensity = Math.max(0, Math.min(255, intensity));


        for (let j = 0; j < width; j++) {
            const stride = (i * width + j) * 4;
            data[stride] = intensity;   // R
            data[stride + 1] = intensity; // G
            data[stride + 2] = intensity; // B
            data[stride + 3] = intensity > 0 ? 255 : 0; // Alpha: fully opaque if bright, else transparent
        }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping; // Important for scrolling
    texture.needsUpdate = true;
    return texture;
}

// Lazily create the texture once and reuse it for all axons
const globalSignalTexture = createSignalTexture();
const signalSpeed = -0.8; // Negative to scroll "down" the V axis if UVs are 0 at start, 1 at end

/**
 * Creates an axon (a tube connecting two neurons).
 * @param {Neuron} neuronA The starting neuron.
 * @param {Neuron} neuronB The ending neuron.
 * @param {number} color Color of the axon.
 * @param {number} radius Radius of the axon tube.
 * @param {boolean} useCurve If true, creates a curved axon; otherwise, a straight one.
 * @returns {THREE.Mesh} The axon mesh.
 */
function createAxon(neuronA, neuronB, color = 0x4488FF, radius = 0.025, useCurve = true) {
    const posA = neuronA.position;
    const posB = neuronB.position;

    // 1. Define the curve (path of the axon)
    let curve;
    if (useCurve) {
        const distance = posA.distanceTo(posB);
        const midPoint = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
        
        // Refined control point: offset perpendicular to the direct line between neurons, and somewhat upwards
        const dir = new THREE.Vector3().subVectors(posB, posA).normalize();
        const perpendicular = new THREE.Vector3();
        if (Math.abs(dir.x) > Math.abs(dir.z)) {
            perpendicular.set(-dir.y, dir.x, 0).normalize();
        } else {
            perpendicular.set(0, -dir.z, dir.y).normalize();
        }
        if (dir.y > 0.95 || dir.y < -0.95) { // if axon is mostly vertical, use a different perpendicular
             perpendicular.set(dir.y, -dir.x, 0).normalize();
        }

        const offsetMagnitude = distance * 0.25 * (0.5 + Math.random() * 0.5); // Control curve "bend"
        const controlPointOffset = perpendicular.multiplyScalar(offsetMagnitude * (Math.random() > 0.5 ? 1 : -1));
        // Add a slight upward bias to the control point to make curves feel more "grown"
        controlPointOffset.y += distance * 0.1 * Math.random(); 

        const controlPoint = midPoint.clone().add(controlPointOffset);
        curve = new THREE.QuadraticBezierCurve3(posA, controlPoint, posB);
    } else {
        curve = new THREE.LineCurve3(posA, posB);
    }

    // 2. Custom Geometry for Varying Radius
    const tubularSegments = 64; // Number of segments along the curve
    const radialSegments = 8;   // Number of segments around the radius
    const baseRadius = radius;  // Max radius, can be modulated

    const points = curve.getPoints(tubularSegments);
    const frames = curve.computeFrenetFrames(tubularSegments, false); // false for not closed

    const vertices = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    function getRadiusAt(t) { // t from 0 to 1
        // Simple sine envelope: thick in middle, thin at ends
        return baseRadius * (0.5 + Math.sin(Math.PI * t) * 0.5); 
        // Alternative: return baseRadius * (0.2 + (1.0 - Math.abs(t - 0.5) * 2.0) * 0.8); // Thicker towards middle
    }

    for (let i = 0; i <= tubularSegments; i++) {
        const point = points[i];
        const normal = frames.normals[i];
        const binormal = frames.binormals[i];
        const currentRadius = getRadiusAt(i / tubularSegments);

        for (let j = 0; j <= radialSegments; j++) {
            const angle = (j / radialSegments) * Math.PI * 2;
            
            // Calculate vertex position
            const x = currentRadius * Math.cos(angle);
            const y = currentRadius * Math.sin(angle);

            const P = new THREE.Vector3(x, y, 0).applyMatrix4(
                new THREE.Matrix4().makeBasis(binormal, normal, frames.tangents[i]) // Use tangent for Z-axis of local frame
            ).add(point);
            vertices.push(P.x, P.y, P.z);

            // Calculate normal for this vertex
            // The normal points from the curve point outwards along the radius of the segment
            const N = new THREE.Vector3(x, y, 0).normalize().applyMatrix4(
                 new THREE.Matrix4().makeBasis(binormal, normal, frames.tangents[i])
            ); // No need to normalize again as x,y was on unit circle, basis vectors are ortho.
            normals.push(N.x, N.y, N.z);
            
            // UVs
            uvs.push(j / radialSegments, i / tubularSegments);
        }
    }

    for (let i = 0; i < tubularSegments; i++) {
        for (let j = 0; j < radialSegments; j++) {
            const a = (radialSegments + 1) * i + j;
            const b = (radialSegments + 1) * i + j + 1;
            const c = (radialSegments + 1) * (i + 1) + j + 1;
            const d = (radialSegments + 1) * (i + 1) + j;

            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    // Material (still MeshBasicMaterial for now, focusing on geometry)
    const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(0.3), // Darker base color for the axon itself
        transparent: true,
        // opacity: 0.5, // Base opacity of the axon tube
        blending: THREE.AdditiveBlending, // Signals add light
        emissiveMap: globalSignalTexture,
        // emissive: 0xffffff, // Full white to let texture control color and intensity
        // emissiveIntensity: 1.0 // Modulate signal brightness if needed
    });
    
    // Ensure texture is cloned for each material if offsets are unique per axon (which they are)
    // However, if all signals pulse identically, one material with one texture is fine.
    // For independent animation (which is what we want via offset), each axon needs its own material instance
    // or at least its own texture instance if other material props are shared.
    // The simplest is to clone the material for safety, ensuring emissiveMap instance is unique.
    // This is not strictly necessary if we are only changing texture.offset, as that's per-texture.
    // Let's assume for now that manipulating globalSignalTexture.offset directly in the animate loop
    // for each axon's material will work because the offset is a property of the texture instance used by the material.
    // If not, we would do: material.emissiveMap = globalSignalTexture.clone(); material.emissiveMap.needsUpdate = true;

    const axonMesh = new THREE.Mesh(geometry, material);
    scene.add(axonMesh);

    // Create Particle System for this Axon
    const particlePositions = new Float32Array(MAX_PARTICLES_PER_AXON * 3);
    const particleAlphas = new Float32Array(MAX_PARTICLES_PER_AXON);
    const particleSizes = new Float32Array(MAX_PARTICLES_PER_AXON);
    const particleProgresses = new Float32Array(MAX_PARTICLES_PER_AXON); // Store progress here

    for (let i = 0; i < MAX_PARTICLES_PER_AXON; i++) {
        particleProgresses[i] = Math.random(); // Start at random points
        const currentPos = curve.getPointAt(particleProgresses[i]);
        particlePositions[i * 3] = currentPos.x;
        particlePositions[i * 3 + 1] = currentPos.y;
        particlePositions[i * 3 + 2] = currentPos.z;

        particleAlphas[i] = Math.random() * 0.8 + 0.2; // Random initial alpha
        particleSizes[i] = PARTICLE_BASE_SIZE + Math.random() * (PARTICLE_BASE_SIZE * 0.3);
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('customAlpha', new THREE.BufferAttribute(particleAlphas, 1));
    particleGeometry.setAttribute('customSize', new THREE.BufferAttribute(particleSizes, 1));

    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_particleColor: { value: PARTICLE_COLOR },
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false, // Important for additive blending
        // sizeAttenuation: true // Handled in shader
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Store particle system data with the axon mesh for easy access in animation loop
    axonMesh.particleSystem = {
        pointsMesh: particles,
        curve: curve, // Keep reference to the curve
        progresses: particleProgresses, // Array of progress values for each particle
        alphas: particleAlphas,         // Array of alpha values
        // Sizes are static per particle for now, but could be animated too
    };
    // Also add to global axons array for separate particle update if needed, but attaching to mesh is cleaner
    // It's already in the `axons` array which is iterated in `animate`.

    return axonMesh;
}

//----------------------------------------------------------------------------------
// AXON INSTANTIATION
//----------------------------------------------------------------------------------
const axons = []; // Array to hold axon meshes (currently not used after creation, but good for future manipulation).


//----------------------------------------------------------------------------------
// STAR DUST BACKGROUND
//----------------------------------------------------------------------------------
function createStarDust(count = 6000, color = 0xbbccff) { // Slightly reduced star count
    const positions = new Float32Array(count * 3);
    const alphas = new Float32Array(count); // For varied opacity

    const radiusRangeMin = 70;
    const radiusRangeMax = 150;

    for (let i = 0; i < count; i++) {
        // Distribute stars in a spherical shell
        const r = Math.random() * (radiusRangeMax - radiusRangeMin) + radiusRangeMin;
        const phi = Math.random() * Math.PI * 2; // Azimuthal angle
        const theta = Math.acos((Math.random() * 2) - 1); // Polar angle (from -1 to 1, then acos)

        positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
        positions[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
        positions[i * 3 + 2] = r * Math.cos(theta);

        alphas[i] = 0.2 + Math.random() * 0.4; // Random alpha between 0.2 and 0.6
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('customAlpha', new THREE.BufferAttribute(alphas, 1)); // Using a custom attribute for alpha

    // Custom shader material for stars to use customAlpha and have soft edges
    const starVertexShader = `
        attribute float customAlpha;
        varying float vAlpha;
        void main() {
            vAlpha = customAlpha;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 1.5 * (150.0 / -mvPosition.z); // Adjust size, with attenuation
            gl_Position = projectionMatrix * mvPosition;
        }
    `;

    const starFragmentShader = `
        uniform vec3 u_starColor;
        varying float vAlpha;
        void main() {
            precision mediump float; // Added precision
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            gl_FragColor = vec4(u_starColor, vAlpha * (1.0 - dist * 2.0)); // Soft edges
        }
    `;
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            u_starColor: { value: new THREE.Color(color) },
        },
        vertexShader: starVertexShader,
        fragmentShader: starFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const stars = new THREE.Points(geometry, material);
    scene.add(stars);
    return stars;
}

createStarDust(); // Add star dust to the scene

// Define connections between neurons.
if (neurons.length >= 6) { // Ensure enough neurons exist for these connections.
    axons.push(createAxon(neurons[0], neurons[1]));
    axons.push(createAxon(neurons[0], neurons[2]));
    axons.push(createAxon(neurons[1], neurons[3]));
    axons.push(createAxon(neurons[2], neurons[4]));
    axons.push(createAxon(neurons[3], neurons[5]));
    axons.push(createAxon(neurons[4], neurons[5]));
    // Example of creating axons with slightly different properties:
    axons.push(createAxon(neurons[1], neurons[4], 0x66AAFF, 0.02, true));
    axons.push(createAxon(neurons[0], neurons[5], 0x5599FF, 0.022, true));
}

//----------------------------------------------------------------------------------
// ANIMATION LOOP
//----------------------------------------------------------------------------------
const clock = new THREE.Clock(); // Clock for getting deltaTime
const tempParticlePosition = new THREE.Vector3(); // Pre-allocate for particle updates

function animate() {
    requestAnimationFrame(animate); // Request the next frame for smooth animation.

    const deltaTime = clock.getDelta(); // Get time elapsed since last frame

    // Update OrbitControls if enabled (e.g., for damping or auto-rotation).
    if (controls && controls.autoRotate) {
        controls.update(); // Required if controls.enableDamping or controls.autoRotate is true
    }

    // Update each neuron (handles their pulsing animation and shader updates).
    neurons.forEach(neuron => {
        neuron.update(deltaTime); // Pass deltaTime to neuron's update method
    });

    // Animate axon signals and particles
    axons.forEach(axon => {
        // Animate texture-based signal
        if (axon.material.emissiveMap && axon.material.emissiveMap.isTexture) {
            axon.material.emissiveMap.offset.y += signalSpeed * deltaTime;
        }

        // Animate particle system
        if (axon.particleSystem) {
            const ps = axon.particleSystem;
            const positionsAttribute = ps.pointsMesh.geometry.getAttribute('position');
            const alphaAttribute = ps.pointsMesh.geometry.getAttribute('customAlpha');
            // const sizeAttribute = ps.pointsMesh.geometry.getAttribute('customSize'); // If size needs animation

            for (let i = 0; i < MAX_PARTICLES_PER_AXON; i++) {
                // Update progress
                ps.progresses[i] += PARTICLE_SPEED * deltaTime;
                if (ps.progresses[i] >= 1.0) {
                    ps.progresses[i] = 0.001; // Reset to start (not exactly 0 to avoid potential getPointAt(0) issues if any)
                    // Optionally re-randomize alpha or size here if desired
                    // ps.alphas[i] = Math.random() * 0.5 + 0.1; 
                }
                const currentProgress = ps.progresses[i];

                // Update position - USE PRE-ALLOCATED VECTOR
                ps.curve.getPointAt(currentProgress, tempParticlePosition);
                positionsAttribute.setXYZ(i, tempParticlePosition.x, tempParticlePosition.y, tempParticlePosition.z);

                // Update alpha (e.g., fade in/out along the path or based on life)
                // Simple sine wave for fade in/out effect:
                alphaAttribute.setX(i, Math.sin(currentProgress * Math.PI) * 0.8 + 0.1); // Ensure some visibility
            }

            positionsAttribute.needsUpdate = true;
            alphaAttribute.needsUpdate = true;
            // sizeAttribute.needsUpdate = true; // If size is animated
        }
    });

    // Render the scene:
    // If post-processing (composer) is set up, use it. Otherwise, use the standard renderer.
    if (composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}
animate(); // Start the animation loop.

//----------------------------------------------------------------------------------
// WINDOW RESIZE HANDLING
//----------------------------------------------------------------------------------
window.addEventListener('resize', () => {
    // Update camera aspect ratio.
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); // Apply the new aspect ratio.

    // Update renderer size.
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Update composer (and its passes, like bloom) size if it's being used.
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
        // For some specific passes, explicit resolution update might be needed,
        // but composer.setSize usually handles underlying passes like UnrealBloomPass correctly.
        const bloomPass = composer.passes.find(pass => pass instanceof THREE.UnrealBloomPass || (pass.constructor && pass.constructor.name === 'UnrealBloomPass'));
        if (bloomPass && bloomPass.resolution) { // Check if bloomPass and its resolution property exist
             bloomPass.resolution.set(window.innerWidth, window.innerHeight);
        }
    }
});
