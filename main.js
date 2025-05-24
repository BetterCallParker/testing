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
console.log("Renderer Capabilities WebGL2:", renderer.capabilities.isWebGL2); // Check WebGL2 status
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
        0.75, // strength: Further subtle reduction for less haze
        0.7,  // radius: Maintained
        0.88  // threshold: Slightly increased to ensure only very bright parts bloom strongly
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

const axonVertexShader = `
    varying vec2 vUv;
    // attribute vec3 normal; // Removed: 'normal' is a standard attribute provided by Three.js if geometry has normals.

    uniform float u_neuronPulseStateStart; // 0.0 to 1.0
    uniform float u_neuronPulseStateEnd;   // 0.0 to 1.0
    uniform float u_swellIntensity;        // Max factor for radial swell
    uniform float u_swellFalloff;          // How far the swell extends along the axon (0 to 1)
    uniform float u_stretchIntensity;      // Max factor for longitudinal stretch (currently unused but planned)
    uniform float u_startTension;          // Tension at the start of the axon
    uniform float u_endTension;            // Tension at the end of the axon
    uniform float u_tensionEffectScale;    // To control impact of tension
    uniform float u_pulseInfluenceScale;   // To control impact of original pulse

    void main() {
        vUv = uv;
        
        float distFromStart = vUv.y;
        float distFromEnd = 1.0 - vUv.y;
        float currentSwellFactor = 0.0;
        // float currentStretchFactor = 0.0; // For longitudinal stretch, if implemented

        // Enhanced Swelling/Stretching at the START of the axon (connected to neuronA)
        if (distFromStart < u_swellFalloff) {
            // Sharper falloff for a more "pulled" look at the immediate connection point
            float influence = pow(1.0 - smoothstep(0.0, u_swellFalloff, distFromStart), 2.0); 
            currentSwellFactor += (u_neuronPulseStateStart * u_pulseInfluenceScale + u_startTension * u_tensionEffectScale) * influence;
        }

        // Enhanced Swelling/Stretching at the END of the axon (connected to neuronB)
        if (distFromEnd < u_swellFalloff) {
            float influence = pow(1.0 - smoothstep(0.0, u_swellFalloff, distFromEnd), 2.0); // 'influence' is redefined here, which is fine.
            currentSwellFactor += (u_neuronPulseStateEnd * u_pulseInfluenceScale + u_endTension * u_tensionEffectScale) * influence;
        }
        
        currentSwellFactor = clamp(currentSwellFactor, 0.0, 1.0); // Ensure swell factor stays within reasonable bounds

        vec3 displacedPosition = position + normal * currentSwellFactor * u_swellIntensity;
        
        // Attempt at a "stretch" by moving points near neuron along the view vector (crude approximation of pulling)
        // This is highly experimental and might not look right and was previously part of the duplicate block.
        // if (distFromStart < u_swellFalloff) {
        //    displacedPosition += normalize(cameraPosition - (modelMatrix * vec4(position,1.0)).xyz) * u_neuronPulseStateStart * u_stretchIntensity * (1.0 - distFromStart/u_swellFalloff) ;
        // }
        // if (distFromEnd < u_swellFalloff) {
        //    displacedPosition += normalize(cameraPosition - (modelMatrix * vec4(position,1.0)).xyz) * u_neuronPulseStateEnd * u_stretchIntensity * (1.0 - distFromEnd/u_swellFalloff);
        // }
        // Sticking to enhanced radial swell for now.

        gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
            // The following comments were originally associated with the first gl_Position assignment.
            // This is a simplification; true tangent would be better but harder to get here without more attributes.
            // We'll use a simple heuristic: pull "away" from the neuron.
            // Since vUv.y = 0 is start, we want to displace in -Z direction of the tube segment IF Three.js orients tubes this way.
            // However, our custom tube is built along curve tangents. Displacement along 'normal' is radial.
            // For stretch, we'd ideally want to displace the *connection point itself* further from neuron center,
            // or displace vertices near connection point along axon tangent.
            // Given current setup, a simple radial swell is more robust. Let's enhance that.
    }
`;

const axonFragmentShader = `
    precision mediump float;

    uniform sampler2D u_baseTexture;
    uniform vec3 u_baseColorTint;
    uniform float u_baseOpacity;
    // uniform vec3 u_viewDirection_FS; // For Fresnel, if needed (Commented out as not used)

    uniform bool u_signalActive;
    uniform float u_signalProgress; // 0.0 to 1.0
    uniform float u_signalLength;   // e.g., 0.15
    uniform vec3 u_signalColor;
    uniform float u_signalIntensity;

    varying vec2 vUv;
    // varying vec3 vNormal_FS; // This varying is not being passed from the current axonVertexShader

    void main() {
        vec4 baseTexColor = texture2D(u_baseTexture, vUv * 2.0); // UV scaling for denser texture maintained
        vec3 finalColor = baseTexColor.rgb * u_baseColorTint;
        float finalAlpha = baseTexColor.a * u_baseOpacity;

        // Optional: Subtle Fresnel for base axon material
        // Requires vNormal_FS and view direction. For simplicity, this is omitted for now.
        // If added, axonVertexShader must pass worldNormal and viewDir.

        if (u_signalActive) {
            float halfSignalLength = u_signalLength * 0.5;
            // Calculate distance from the center of the signal band.
            // vUv.y is assumed to run from 0 (start of axon) to 1 (end of axon).
            float distFromSignalCenter = abs(vUv.y - u_signalProgress);

            if (distFromSignalCenter < halfSignalLength) {
                // Create a profile for the signal (e.g., smooth falloff)
                // float signalProfile = 1.0 - smoothstep(0.0, halfSignalLength, distFromSignalCenter); // Linear falloff
                float signalProfile = smoothstep(halfSignalLength, 0.0, distFromSignalCenter); // Smoother falloff

                // Mix base color with signal color
                finalColor = mix(finalColor, u_signalColor, signalProfile * u_signalIntensity);
                finalAlpha = mix(finalAlpha, 1.0, signalProfile * u_signalIntensity); // Signal is more opaque
            }
        }
        gl_FragColor = vec4(finalColor, finalAlpha);
    }
`;


//----------------------------------------------------------------------------------
// PROCEDURAL TEXTURE GENERATION (JavaScript)
//----------------------------------------------------------------------------------

/**
 * Generates a simple procedural noise texture (Value Noise).
 * @param {number} size - Width and height of the texture.
 * @param {number} initialFrequency - Initial frequency for the noise.
 * @param {number} octaves - Number of noise layers to blend.
 * @returns {THREE.DataTexture}
 */
function createProceduralNoiseTexture(size = 128, initialFrequency = 4.0, octaves = 3) {
    const data = new Uint8Array(size * size * 4); // RGBA

    // Simple value noise generation
    const R = Math.random;
    const M = 0xffffffff;
    let S = 2147483647 * R() | 0; // Seed
    const T = () => (S = S * 48271 % M) / M; // LCG for seeded random

    const p = new Array(512);
    const g = new Array(512);
    for(let i=0; i<256; ++i) p[i] = p[i+256] = i;
    for(let i=255; i>=0; --i) { const j = (T()*i)|0; const t = p[i]; p[i]=p[j]; p[j]=t; } // Shuffle p
    for(let i=0; i<256; ++i) g[i] = g[i+256] = T() * 2 - 1; // Random gradients/values between -1 and 1

    const fade = t => t*t*t*(t*(t*6-15)+10);
    const lerp = (a,b,t) => a + t*(b-a);

    function valueNoise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);

        const tl = g[p[X] + Y];
        const tr = g[p[X+1] + Y];
        const bl = g[p[X] + Y+1];
        const br = g[p[X+1] + Y+1];

        const u = fade(xf);
        const v = fade(yf);

        return lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
    }

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let total = 0;
            let frequency = initialFrequency;
            let amplitude = 1.0;
            let maxValue = 0; // For normalizing

            for (let i = 0; i < octaves; i++) {
                total += valueNoise(x * frequency / size, y * frequency / size) * amplitude;
                maxValue += amplitude;
                amplitude *= 0.5; // Lacunarity
                frequency *= 2.0; // Persistence
            }
            
            let normalizedValue = (total / maxValue) * 0.5 + 0.5; // Normalize to 0-1 range
            normalizedValue = Math.max(0, Math.min(1, normalizedValue)); // Clamp
            const intensity = Math.floor(normalizedValue * 255);

            const stride = (y * size + x) * 4;
            data[stride] = intensity;     // R
            data[stride + 1] = intensity; // G
            data[stride + 2] = intensity; // B
            data[stride + 3] = 255;       // A (fully opaque)
        }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

const organicTexture1 = createProceduralNoiseTexture(256, 4.0, 4); // For core
const organicTexture2 = createProceduralNoiseTexture(128, 8.0, 3); // For aura & axons (more fine-grained)


// Noise function will be used by both core and aura shaders
const glslNoise = `
    // Classic Perlin 3D Noise (by Stefan Gustavson)
    // https://github.com/stegu/webgl-noise/blob/master/src/noise3D.glsl
    // Precision is now set in individual shaders that use this.
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
        // precision mediump float; // Already set in previous turn, but ensuring it's here.
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.45) discard; // Create a slightly smaller circle than 0.5 to avoid hard edges

        gl_FragColor = vec4(u_particleColor, vAlpha * (1.0 - dist * 2.0)); // Fade towards edge
    }
`;


const neuronVertexShader = `
    precision highp float; // Required for vertex shaders if not default

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
    uniform float u_noiseFrequencyCore; // For 3D noise displacement/energy
    uniform float u_noiseSpeedCore;
    uniform float u_noiseImpactCore;
    uniform sampler2D u_organicTextureCore; // New organic texture
    uniform float u_textureInfluenceCore;   // How much texture affects base color/noise

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

        // Sample organic texture
        float organicPattern = texture2D(u_organicTextureCore, vUv * 2.0).r; // Scale UVs for more tiling
        
        // Base color modulated by noise, texture, and Fresnel
        vec3 baseColor = u_coreColor * (1.0 - u_textureInfluenceCore + organicPattern * u_textureInfluenceCore * 2.0); // Modulate base color by texture
        
        vec3 finalColor = baseColor + baseColor * energyNoise * u_noiseImpactCore * (0.5 + organicPattern * 0.5); // Noise adds to brightness, modulated by texture
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
    uniform float u_noiseFrequencyAura; // For 3D noise shimmer
    uniform float u_noiseSpeedAura;
    uniform float u_noiseImpactAuraAlpha;
    uniform float u_noiseImpactAuraEmissive;
    uniform sampler2D u_organicTextureAura; // New organic texture
    uniform float u_textureInfluenceAura;   // How much texture affects alpha/emissive


    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vViewDirection;

    ${glslNoise} // Embed noise function

    /*
    // Aura Fragment Shader - Commented Out
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

        // Sample organic texture
        float organicPattern = texture2D(u_organicTextureAura, vUv * 3.0).r; // Scale UVs for more tiling

        // Modulate alpha
        float baseAlphaModulated = u_auraBaseAlpha * (1.0 - u_textureInfluenceAura * (1.0 - organicPattern)); // Texture makes parts denser/more opaque
        float finalAlpha = baseAlphaModulated * (1.0 - u_noiseImpactAuraAlpha * (1.0 - shimmerNoise));
        finalAlpha += fresnel * 0.2;
        finalAlpha = clamp(finalAlpha, 0.0, 1.0);
        
        // Modulate emissive intensity
        vec3 emissiveColor = u_auraColor * (0.5 + shimmerNoise * u_noiseImpactAuraEmissive);
        emissiveColor *= (1.0 - u_textureInfluenceAura * 0.5 + organicPattern * u_textureInfluenceAura * 0.5); // Texture subtly modulates emissive brightness
        emissiveColor += fresnel * u_auraColor * 0.5;
        
        gl_FragColor = vec4(emissiveColor, finalAlpha);
    }
    */
`;

// const auraVertexShader = `...`; // Fully commented out
// const auraFragmentShader = `...`; // Fully commented out


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

        this.coreColor = new THREE.Color(coreColor); // Store for easy access
        this.auraColor = new THREE.Color(auraColor); // Store for easy access

        this.outgoingAxons = [];
        this.incomingAxons = []; // For receiving pulse state for swelling
        this.signalCooldown = 0.0;
        this.canFireSignal = true;
        this.peakPulseThreshold = 0.90; 
        this.lastPulseValue = 0.0;      

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
                    u_coreColor: { value: this.coreColor },
                    u_frequency: { value: 3.0 + Math.random() * 2.0 }, // For displacement
                    u_amplitude: { value: 0.08 + Math.random() * 0.07 }, // For displacement
                    u_fresnelPower: { value: 2.5 + Math.random() * 1.0 }, // Core Fresnel
                    u_fresnelBias: { value: 0.1 + Math.random() * 0.1 },
                    u_noiseFrequencyCore: { value: 2.0 + Math.random() * 1.0 }, // For 3D noise
                    u_noiseSpeedCore: { value: 0.15 + Math.random() * 0.1 },
                    u_noiseImpactCore: { value: 0.3 + Math.random() * 0.2 },
                    u_organicTextureCore: { value: organicTexture1 },
                    u_textureInfluenceCore: { value: 0.3 + Math.random() * 0.2 } // How much texture affects base color
                }
            ]),
            transparent: false // Core is generally opaque
        });
        this.coreMesh = new THREE.Mesh(coreGeometry, this.coreMaterial);
        this.add(this.coreMesh);

        // Aura: Shimmering and gaseous - REMOVED
        /*
        const auraGeometry = new THREE.SphereGeometry(coreRadius * auraRadiusMultiplier, 64, 64);
        this.auraMaterial = new THREE.ShaderMaterial({
            vertexShader: auraVertexShader, 
            fragmentShader: auraFragmentShader,
            uniforms: THREE.UniformsUtils.merge([
                this.sharedUniforms,
                {
                    u_auraColor: { value: this.auraColor },
                    u_auraBaseAlpha: { value: auraOpacity },
                    u_auraFresnelPower: { value: 3.0 + Math.random() * 1.5 }, 
                    u_auraFresnelBias: { value: 0.05 + Math.random() * 0.05 },
                    u_noiseFrequencyAura: { value: 1.5 + Math.random() * 0.8 }, 
                    u_noiseSpeedAura: { value: 0.25 + Math.random() * 0.1 },
                    u_noiseImpactAuraAlpha: { value: 0.4 + Math.random() * 0.2 },
                    u_noiseImpactAuraEmissive: { value: 0.5 + Math.random() * 0.3 },
                    u_organicTextureAura: { value: organicTexture2 },
                    u_textureInfluenceAura: { value: 0.4 + Math.random() * 0.3 } 
                }
            ]),
            transparent: true,
            blending: THREE.AdditiveBlending, 
            depthWrite: false 
        });
        this.auraMesh = new THREE.Mesh(auraGeometry, this.auraMaterial);
        // this.add(this.auraMesh); // Aura mesh is no longer added
        */

        this.pulseSpeed = 0.0015 + Math.random() * 0.001;
        // this.createFilaments(); // Call to createFilaments removed
    }

    // /**
    //  * Creates fine filaments that emanate from the neuron's center.
    //  * Filaments are not affected by the new core/aura shaders directly, but will scale with the neuron.
    //  * @param {number} numFilaments Number of filaments to generate.
    //  * @param {number} minLength Minimum length of a filament.
    //  * @param {number} maxLength Maximum length of a filament.
    //  * @param {number} filamentRadius Radius of the filament tube.
    //  * @param {number} color Color of the filaments.
    //  * @param {number} opacity Opacity of the filaments.
    //  */
    // createFilaments(numFilaments = 10, minLength = 0.4, maxLength = 1.2, filamentRadius = 0.006, opacity = 0.5) {
    //     // Derive filament color from neuron's core color now, as aura is removed.
    //     const baseFilamentColor = this.coreColor.clone().multiplyScalar(0.5).lerp(new THREE.Color(0xffffff), 0.4);
    //
    //
    //     for (let i = 0; i < numFilaments; i++) {
    //         const randomDirection = new THREE.Vector3(
    //             Math.random() * 2 - 1, // -1 to 1
    //             Math.random() * 2 - 1, // -1 to 1
    //             Math.random() * 2 - 1  // -1 to 1
    //         ).normalize();
    //
    //         // Determine a random length for the filament.
    //         const length = minLength + Math.random() * (maxLength - minLength);
    //         const endPoint = randomDirection.multiplyScalar(length);
    //         const startPoint = new THREE.Vector3(0, 0, 0); // Filaments start at the neuron's local origin.
    //
    //         // Create a tube geometry for the filament.
    //         const curve = new THREE.LineCurve3(startPoint, endPoint);
    //         const geometry = new THREE.TubeGeometry(curve, 8, filamentRadius, 4, false);
    //         const material = new THREE.MeshBasicMaterial({
    //             color: baseFilamentColor, // For MeshBasicMaterial, 'color' dictates the emissive appearance
    //             transparent: true,
    //             opacity: opacity * (0.7 + Math.random() * 0.3) // Add slight opacity variation
    //         });
    //         const filamentMesh = new THREE.Mesh(geometry, material);
    //         this.add(filamentMesh); // Add filament as a child of the Neuron group.
    //     }
    // }

    /**
     * Updates the neuron's state, its pulsing animation, and shader uniforms.
     * Called in the main animation loop.
     * @param {number} deltaTime Time elapsed since the last frame.
     */
    update(deltaTime) {
        // Update shared time uniform for both core and aura shaders
        this.sharedUniforms.u_time.value += deltaTime * 0.8; 

        // Overall pulsing scale for the entire Neuron group
        const currentPulseValue = Math.sin(Date.now() * this.pulseSpeed); // Ranges -1 to 1
        const scaleFactor = 1 + currentPulseValue * 0.08; 
        this.scale.set(scaleFactor, scaleFactor, scaleFactor);

        const normalizedPulseIntensity = (currentPulseValue + 1.0) * 0.5; // Map to 0-1 for shader uniform

        // Update outgoing axons for swelling at their start
        this.outgoingAxons.forEach(axon => {
            if (axon && axon.material.isShaderMaterial && axon.material.uniforms.u_neuronPulseStateStart) {
                axon.material.uniforms.u_neuronPulseStateStart.value = normalizedPulseIntensity;
            }
        });

        // Update incoming axons for swelling at their end
        this.incomingAxons.forEach(axon => {
            if (axon && axon.material.isShaderMaterial && axon.material.uniforms.u_neuronPulseStateEnd) {
                axon.material.uniforms.u_neuronPulseStateEnd.value = normalizedPulseIntensity;
            }
        });

        // Signal Firing Logic (remains the same)
        if (this.canFireSignal && this.lastPulseValue < this.peakPulseThreshold && currentPulseValue >= this.peakPulseThreshold) {
            this.outgoingAxons.forEach(axon => {
                if (axon && !axon.isSignalActive) { 
                    axon.isSignalActive = true;
                    axon.signalProgress = 0.0;
                    const coreColor = this.coreMaterial.uniforms.u_coreColor.value;
                    axon.signalColor.copy(coreColor).multiplyScalar(1.8); 
                    
                    if (axon.material.isShaderMaterial) {
                        axon.material.uniforms.u_signalActive.value = true;
                        axon.material.uniforms.u_signalProgress.value = 0.0;
                        axon.material.uniforms.u_signalColor.value.copy(axon.signalColor);
                    }
                }
            });
            this.canFireSignal = false;
            this.signalCooldown = 1.5 + Math.random() * 1.0; 
        }
        
        if (!this.canFireSignal) {
            this.signalCooldown -= deltaTime;
            if (this.signalCooldown <= 0) {
                this.canFireSignal = true;
            }
        }
        this.lastPulseValue = currentPulseValue;
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
const MAX_PARTICLES_PER_AXON = 30; 
// PARTICLE_COLOR is now set dynamically in createAxon based on signal color
const PARTICLE_BASE_SIZE = 0.05; 
const PARTICLE_SPEED = 0.16; // Increased slightly for better visual flow with signal orbs


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
// const globalSignalTexture = createSignalTexture(); // Keep for reference, but will be replaced by shader logic
const axonSignalSpeed = 0.7; // Speed of the orb along the axon (0 to 1 per second)


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
    let controlPoint; // Declare controlPoint here
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

        controlPoint = midPoint.clone().add(controlPointOffset); // Assign to the higher-scoped controlPoint
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

    // Material for axons - Now uses ShaderMaterial for the light orb effect
    const axonBaseColor = new THREE.Color(color); // Original color passed to createAxon
    const material = new THREE.ShaderMaterial({
        uniforms: {
            u_baseTexture: { value: organicTexture2 }, 
            u_baseColorTint: { value: axonBaseColor.clone().multiplyScalar(0.85) }, 
            u_baseOpacity: { value: 0.65 }, 
            
            u_signalActive: { value: false },
            u_signalProgress: { value: 0.0 },
            u_signalLength: { value: 0.18 + Math.random() * 0.1 }, 
            u_signalColor: { value: new THREE.Color(0xffffff) }, 
            u_signalIntensity: { value: 1.5 + Math.random() * 0.5 },

            // New uniforms for swelling effect
            u_neuronPulseStateStart: { value: 0.0 },
            u_neuronPulseStateEnd: { value: 0.0 },
            u_swellIntensity: { value: 0.22 }, 
            u_swellFalloff: { value: 0.20 },    
            u_stretchIntensity: { value: 0.05 },
            u_startTension: { value: 0.0 }, 
            u_endTension: { value: 0.0 },
            u_tensionEffectScale: { value: 0.5 }, 
            u_pulseInfluenceScale: { value: 1.0 }
        },
        vertexShader: axonVertexShader, 
        fragmentShader: axonFragmentShader, 
        transparent: true,
        blending: THREE.AdditiveBlending, 
        depthWrite: false 
    });

    const axonMesh = new THREE.Mesh(geometry, material);
    scene.add(axonMesh);

    // Initialize axon-specific signal properties (attached to the mesh object)
    axonMesh.isSignalActive = false;
    axonMesh.signalProgress = 0.0;
    axonMesh.signalColor = new THREE.Color(0xffffff); // This will be set by the neuron
    
    // Store references to connected neurons and initial curve properties for animation
    axonMesh.neuronA = neuronA;
    axonMesh.neuronB = neuronB;
    // Store the original offset direction and magnitude factor for consistent curve shape
    // The controlPointOffset vector itself is relative to the midpoint and captures the initial "bend" direction and strength
    if (useCurve && controlPoint) { // Check if controlPoint was defined
        const initialMidPoint = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
        axonMesh.initialControlPointOffset = controlPoint.clone().sub(initialMidPoint); // Store the calculated offset
    }
    axonMesh.swaySeed = Math.random() * 1000; // For desynchronized swaying

    // Store segments for geometry updates
    axonMesh.tubularSegments = tubularSegments;
    axonMesh.radialSegments = radialSegments;
    axonMesh.baseRadius = baseRadius; // Store baseRadius for getRadiusAt

    // Create Particle System for this Axon (remains the same)
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

    // Particle color will be derived from the axon's signal color (which comes from neuron core)
    // Make it related but less intense than the main signal orb.
    const particleColorForThisAxon = axonMesh.signalColor.clone().multiplyScalar(0.7).lerp(new THREE.Color(0xffffff), 0.1); 

    const particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_particleColor: { value: particleColorForThisAxon }, // Use the derived color
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
        // precision mediump float; // Already set in previous turn, but ensuring it's here.
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

// Helper function to find the closest vertex index on a neuron's core mesh to a reference position
function findClosestVertexIndex(targetNeuronCoreMesh, referencePositionVec3) {
    const geometry = targetNeuronCoreMesh.geometry;
    const positionAttribute = geometry.attributes.position;
    const worldMatrix = targetNeuronCoreMesh.matrixWorld; // Use the coreMesh's world matrix
    
    let closestIndex = -1;
    let minDistanceSq = Infinity;
    const tempVertexPos = new THREE.Vector3(); // For calculations

    for (let i = 0; i < positionAttribute.count; i++) {
        tempVertexPos.fromBufferAttribute(positionAttribute, i); // Get local vertex position
        tempVertexPos.applyMatrix4(worldMatrix); // Transform to world space
        
        const distanceSq = tempVertexPos.distanceToSquared(referencePositionVec3);
        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            closestIndex = i;
        }
    }
    return closestIndex;
}

// --- Start of New Axon Connection Logic ---

const NEIGHBOR_DISTANCE_THRESHOLD = 7.5; // You can tune this value

// Clear any existing axons from scene and memory
// (Assuming 'axons' is a global or accessible array holding axon meshes,
// and 'scene' is your THREE.Scene instance)
if (typeof axons !== 'undefined' && Array.isArray(axons)) {
    axons.forEach(axon => {
        if (axon.particleSystem) {
            if (axon.particleSystem.pointsMesh) { // Corrected from axon.particleSystem.mesh
                scene.remove(axon.particleSystem.pointsMesh);
            }
            if (axon.particleSystem.curve && axon.particleSystem.pointsMesh) { // Check if geometry and material exist on pointsMesh
               if (axon.particleSystem.pointsMesh.geometry) {
                   axon.particleSystem.pointsMesh.geometry.dispose();
               }
               if (axon.particleSystem.pointsMesh.material) {
                   axon.particleSystem.pointsMesh.material.dispose();
               }
            }
        }
        scene.remove(axon);
        if (axon.geometry) {
            axon.geometry.dispose();
        }
        if (axon.material) {
            // If axon.material is an array (multi-material), iterate and dispose
            if (Array.isArray(axon.material)) {
                axon.material.forEach(mat => mat.dispose());
            } else {
                axon.material.dispose();
            }
        }
    });
    axons.length = 0; // Reset the array
} else {
    // If 'axons' wasn't defined, define it now
    window.axons = []; // Or scope it appropriately if not global. The file already defines 'const axons = []' so this path might not be hit.
}

// Clear existing axon references from neurons
// (Assuming 'neurons' is an array of your Neuron objects)
if (typeof neurons !== 'undefined' && Array.isArray(neurons)) {
    neurons.forEach(neuron => {
        neuron.outgoingAxons = [];
        neuron.incomingAxons = [];
    });

    // Create new axons based on neighbors
    for (let i = 0; i < neurons.length; i++) {
        for (let j = i + 1; j < neurons.length; j++) { // j = i + 1 prevents self-conn & duplicates
            const neuronA = neurons[i];
            const neuronB = neurons[j];
            const distance = neuronA.position.distanceTo(neuronB.position);

            if (distance <= NEIGHBOR_DISTANCE_THRESHOLD) {
                // Assuming 'createAxon' is your existing function that returns an axon mesh
                const axonMesh = createAxon(neuronA, neuronB); // Using default color/radius for now
                if (axonMesh) {
                    axons.push(axonMesh); 
                    // Ensure createAxon or logic here correctly populates:
                    neuronA.outgoingAxons.push(axonMesh);
                    neuronB.incomingAxons.push(axonMesh);
                    // This was part of the 'swelling' effect setup and needs to be maintained.

                    // Calculate and store attachment vertex indices
                    // For Neuron A: Find vertex closest to Neuron B's center
                    axonMesh.neuronA_attachmentVertexIndex = findClosestVertexIndex(neuronA.coreMesh, neuronB.position);

                    // For Neuron B: Find vertex closest to Neuron A's center
                    axonMesh.neuronB_attachmentVertexIndex = findClosestVertexIndex(neuronB.coreMesh, neuronA.position);

                    // Optional log for verification
                    // console.log(`Axon between N${neuronA.uuid.substring(0,3)}... and N${neuronB.uuid.substring(0,3)}... attaches to v_idx ${axonMesh.neuronA_attachmentVertexIndex} on N_A and v_idx ${axonMesh.neuronB_attachmentVertexIndex} on N_B`);

                    // --- Store Initial Attachment Positions ---
                    const tempInitialPosVec3 = new THREE.Vector3(); // Helper Vector3

                    // For Neuron A's attachment point
                    // Ensure neuronA.coreMesh.matrixWorld is up to date for initial calculation
                    neuronA.coreMesh.updateMatrixWorld(true); 
                    tempInitialPosVec3.fromBufferAttribute(
                        neuronA.coreMesh.geometry.attributes.position, // Source: neuronA's geometry position attribute
                        axonMesh.neuronA_attachmentVertexIndex         // Index of the attachment vertex on neuronA
                    );
                    tempInitialPosVec3.applyMatrix4(neuronA.coreMesh.matrixWorld); // Transform to initial world space
                    axonMesh.initialAttachmentPosA = tempInitialPosVec3.clone(); // Store on axonMesh

                    // For Neuron B's attachment point
                    // Ensure neuronB.coreMesh.matrixWorld is up to date
                    neuronB.coreMesh.updateMatrixWorld(true); 
                    tempInitialPosVec3.fromBufferAttribute(
                        neuronB.coreMesh.geometry.attributes.position, // Source: neuronB's geometry position attribute
                        axonMesh.neuronB_attachmentVertexIndex         // Index of the attachment vertex on neuronB
                    );
                    tempInitialPosVec3.applyMatrix4(neuronB.coreMesh.matrixWorld); // Transform to initial world space
                    axonMesh.initialAttachmentPosB = tempInitialPosVec3.clone(); // Store on axonMesh

                    // Optional: Log for verification
                    // console.log(`Axon ${axonMesh.uuid.slice(0,3)}: InitPosA:`, axonMesh.initialAttachmentPosA, `InitPosB:`, axonMesh.initialAttachmentPosB);
                    // --- End of Store Initial Attachment Positions ---
                }
            }
        }
    }
}
// --- End of New Axon Connection Logic ---

//----------------------------------------------------------------------------------
// TRANSFORM FEEDBACK (TF) SETUP AND EXECUTION
//----------------------------------------------------------------------------------

// Global/persistent TF variables
let gl;
let tfProgram;
let tf_uTimeLocation, tf_uFrequencyLocation, tf_uAmplitudeLocation, tf_modelMatrixLocation;
let tf_positionAttributeLocation, tf_normalAttributeLocation;
let transformFeedbackObject; // Renamed from transformFeedback to avoid conflict
let tfOutputBuffer;
let neuronDisplacedVertexData = []; // Array to store Float32Array for each neuron

// Shader sources (kept here for clarity for now, could be externalized)
const tfNeuronVertexShaderSource = `#version 300 es
    precision highp float;
    uniform float u_time;
    uniform float u_frequency;
    uniform float u_amplitude;
    uniform mat4 modelMatrix;

    // GLSL Noise (snoise function)
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
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 =   v - i + dot(i, C.xxx) ;
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy; 
        vec3 x3 = x0 - D.yyy;      
        i = mod289(i);
        vec4 p = permute( permute( permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
        float n_ = 0.142857142857; 
        vec3  ns = n_ * D.wyz - D.xzx;
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );    
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
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                        dot(p2,x2), dot(p3,x3) ) );
    }

    in vec3 position;
    in vec3 normal;
    out vec3 out_displacedWorldPosition;

    void main() {
        float noiseValue = snoise(position * u_frequency + u_time * 0.2); 
        vec3 displacedLocalPosition = position + normal * noiseValue * u_amplitude;
        out_displacedWorldPosition = (modelMatrix * vec4(displacedLocalPosition, 1.0)).xyz;
        gl_Position = vec4(0.0, 0.0, 0.0, 1.0); // TF doesn't use gl_Position if RASTERIZER_DISCARD
    }
`;

const tfFragmentShaderMinimalSource = `#version 300 es
    precision mediump float;
    out vec4 fragColor;
    void main() {
        fragColor = vec4(0.0, 0.0, 0.0, 0.0);
        // Outputting transparent black, not strictly necessary with RASTERIZER_DISCARD
        // outColor is implicitly declared for WebGL2 fragment shaders if no other 'out' is present
        // For clarity, explicitly: out vec4 outColor; outColor = vec4(0.0,0.0,0.0,0.0);
    }
`;
// Helper function to create and compile a shader
function compileShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error for type ' + (type === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT") + ':', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}
function initTransformFeedback() {
    console.log("Initializing Transform Feedback...");
    gl = renderer.getContext();
    if (!renderer.capabilities.isWebGL2) {
        console.error("WebGL 2.0 is not available. Transform Feedback cannot be initialized.");
        return false;
    }
    console.log("WebGL 2.0 Context obtained for Transform Feedback initialization.");

    const tfVertexShader = compileShader(tfNeuronVertexShaderSource, gl.VERTEX_SHADER);
    const tfFragmentShader = compileShader(tfFragmentShaderMinimalSource, gl.FRAGMENT_SHADER);

    if (!tfVertexShader || !tfFragmentShader) {
        console.error("TF Shader compilation failed. Aborting TF initialization.");
        return false;
    }

    tfProgram = gl.createProgram();
    gl.attachShader(tfProgram, tfVertexShader);
    gl.attachShader(tfProgram, tfFragmentShader);

    const varyings = ['out_displacedWorldPosition'];
    gl.transformFeedbackVaryings(tfProgram, varyings, gl.SEPARATE_ATTRIBS);

    gl.linkProgram(tfProgram);
    if (!gl.getProgramParameter(tfProgram, gl.LINK_STATUS)) {
        console.error('TF Program link error:', gl.getProgramInfoLog(tfProgram));
        gl.deleteProgram(tfProgram);
        gl.deleteShader(tfVertexShader);
        gl.deleteShader(tfFragmentShader);
        tfProgram = null; // Ensure tfProgram is null if linking failed
        return false;
    }
    console.log("TF Program compiled and linked successfully.");

    // Get uniform and attribute locations
    tf_uTimeLocation = gl.getUniformLocation(tfProgram, "u_time");
    tf_uFrequencyLocation = gl.getUniformLocation(tfProgram, "u_frequency");
    tf_uAmplitudeLocation = gl.getUniformLocation(tfProgram, "u_amplitude");
    tf_modelMatrixLocation = gl.getUniformLocation(tfProgram, "modelMatrix");
    tf_positionAttributeLocation = gl.getAttribLocation(tfProgram, "position");
    tf_normalAttributeLocation = gl.getAttribLocation(tfProgram, "normal");

    // Create the Transform Feedback object
    transformFeedbackObject = gl.createTransformFeedback();

    // Create and allocate the output buffer (once)
    // Assuming all neuron core meshes have the same vertex count.
    // If not, this needs to be sized for the largest or dynamically resized (more complex).
    if (neurons.length > 0 && neurons[0].coreMesh) {
        const sampleGeometry = neurons[0].coreMesh.geometry;
        const vertexCount = sampleGeometry.attributes.position.count;
        const outputBufferSize = vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT; // 3 floats (vec3) per vertex
        
        tfOutputBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tfOutputBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outputBufferSize, gl.STATIC_READ); // Usage: STATIC_READ as we read from it
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        console.log(`TF Output Buffer created with size: ${outputBufferSize} bytes for ${vertexCount} vertices.`);
    } else {
        console.error("Cannot create TF output buffer: no neurons available or neuron has no coreMesh.");
        gl.deleteProgram(tfProgram); // Cleanup program if buffer init fails
        tfProgram = null;
        return false;
    }
    
    // Shader objects can be deleted after linking
    gl.deleteShader(tfVertexShader);
    gl.deleteShader(tfFragmentShader);
    
    console.log("Transform Feedback Initialized Successfully.");
    return true; // Indicate success
}

function updateAllNeuronTFData() {
    if (!tfProgram || !gl) {
        return;
    }

    scene.updateMatrixWorld(true);

    gl.useProgram(tfProgram);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedbackObject);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, tfOutputBuffer);

    gl.enable(gl.RASTERIZER_DISCARD);

    neurons.forEach((neuron, index) => {
        if (!neuron.coreMesh || !neuron.coreMesh.geometry) {
            console.warn(`Neuron at index ${index} has no coreMesh or geometry. Skipping.`);
            return;
        }

        const geometry = neuron.coreMesh.geometry;
        const positionAttribute = geometry.attributes.position;
        const normalAttribute = geometry.attributes.normal;
        const vertexCount = positionAttribute.count;

        const glPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, glPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positionAttribute.array, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(tf_positionAttributeLocation);
        gl.vertexAttribPointer(tf_positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

        const glNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, glNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normalAttribute.array, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(tf_normalAttributeLocation);
        gl.vertexAttribPointer(tf_normalAttributeLocation, 3, gl.FLOAT, false, 0, 0);

        const coreUniforms = neuron.coreMaterial.uniforms;
        gl.uniform1f(tf_uTimeLocation, coreUniforms.u_time.value);
        gl.uniform1f(tf_uFrequencyLocation, coreUniforms.u_frequency.value);
        gl.uniform1f(tf_uAmplitudeLocation, coreUniforms.u_amplitude.value);
        gl.uniformMatrix4fv(tf_modelMatrixLocation, false, neuron.coreMesh.matrixWorld.elements);
        
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, vertexCount);
        gl.endTransformFeedback();

        if (!neuronDisplacedVertexData[index] || neuronDisplacedVertexData[index].length !== vertexCount * 3) {
            neuronDisplacedVertexData[index] = new Float32Array(vertexCount * 3);
        }

        gl.deleteBuffer(glPositionBuffer);
        gl.deleteBuffer(glNormalBuffer);
        gl.disableVertexAttribArray(tf_positionAttributeLocation);
        gl.disableVertexAttribArray(tf_normalAttributeLocation);
    });

    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    
    // Create fence and wait with a reasonable timeout
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    
    // Wait up to 10ms for the GPU to complete (this will actually wait)
    const waitResult = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 10000000); // 10ms in nanoseconds
    
    if (waitResult === gl.TIMEOUT_EXPIRED) {
        console.warn("Transform Feedback sync timeout - continuing anyway");
    } else if (waitResult === gl.WAIT_FAILED) {
        console.warn("Transform Feedback sync wait failed");
    }
    
    // Now read the data
    neurons.forEach((neuron, index) => {
        if (neuronDisplacedVertexData[index]) {
            gl.bindBuffer(gl.COPY_READ_BUFFER, tfOutputBuffer);
            gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, neuronDisplacedVertexData[index]);
            gl.bindBuffer(gl.COPY_READ_BUFFER, null);
        }
    });
    
    gl.deleteSync(sync);
    gl.useProgram(null);
}


// Call the TF initialization function once after setup
// Ensure neurons are initialized before calling
if (neurons && neurons.length > 0) {
    // Initialize neuronDisplacedVertexData array structure
    for (let i = 0; i < neurons.length; i++) {
        if (neurons[i].coreMesh && neurons[i].coreMesh.geometry.attributes.position) {
            const numVertices = neurons[i].coreMesh.geometry.attributes.position.count;
            neuronDisplacedVertexData.push(new Float32Array(numVertices * 3));
        } else {
            // Push a placeholder or handle error if neuron geometry isn't ready
            neuronDisplacedVertexData.push(new Float32Array(0)); 
            console.warn(`Neuron ${i} has no coreMesh or position attribute for TF data array setup.`);
        }
    }
    initTransformFeedback(); // Initialize TF system
} else {
    console.warn("Neurons not initialized when TF init was scheduled.");
}


//----------------------------------------------------------------------------------
// ANIMATION LOOP
//----------------------------------------------------------------------------------
const clock = new THREE.Clock(); // Clock for getting deltaTime
const tempParticlePosition = new THREE.Vector3(); // Pre-allocate for particle updates
const tempAxonPosA = new THREE.Vector3(); // Used in animateAxons
const tempAxonPosB = new THREE.Vector3(); // Used in animateAxons
const tempMidPoint = new THREE.Vector3();
const tempDir = new THREE.Vector3();
const tempPerpendicular = new THREE.Vector3();
const tempBaseControlPoint = new THREE.Vector3();
const tempSwayOffset = new THREE.Vector3();
const tempAnimatedControlPoint = new THREE.Vector3();
const tempCurvePoint = new THREE.Vector3();
const tempNormal = new THREE.Vector3();
const tempBinormal = new THREE.Vector3();
const tempTangent = new THREE.Vector3();
const tempBasisMatrix = new THREE.Matrix4();
const tempCurrentAttachmentPosA = new THREE.Vector3(); // For tension calculation
const tempCurrentAttachmentPosB = new THREE.Vector3(); // For tension calculation


function animate() {
    requestAnimationFrame(animate); 
    const deltaTime = clock.getDelta(); 

    if (controls) {
        controls.update();
    }

    neurons.forEach(neuron => {
        neuron.update(deltaTime); 
    });

    // Update Transform Feedback Data for all neurons each frame
    if (renderer.capabilities.isWebGL2 && tfProgram) { // Ensure TF is initialized
        updateAllNeuronTFData();
    }
    
    // Example: Log data for the first axon's attachment points using the new TF data
    // This is for debugging and would typically be part of axon update logic.
    // if (axons.length > 0 && neuronDisplacedVertexData.length > 0) {
    //     const firstAxon = axons[0];
    //     const neuronAData = neuronDisplacedVertexData[neurons.indexOf(firstAxon.neuronA)];
    //     const neuronBData = neuronDisplacedVertexData[neurons.indexOf(firstAxon.neuronB)];

    //     if (neuronAData && neuronAData.length > firstAxon.neuronA_attachmentVertexIndex * 3) {
    //         const idxA = firstAxon.neuronA_attachmentVertexIndex * 3;
    //         // console.log(`Axon0 N_A attach point (world): ${neuronAData[idxA]}, ${neuronAData[idxA+1]}, ${neuronAData[idxA+2]}`);
    //     }
    //     if (neuronBData && neuronBData.length > firstAxon.neuronB_attachmentVertexIndex * 3) {
    //         const idxB = firstAxon.neuronB_attachmentVertexIndex * 3;
    //         // console.log(`Axon0 N_B attach point (world): ${neuronBData[idxB]}, ${neuronBData[idxB+1]}, ${neuronBData[idxB+2]}`);
    //     }
    // }


    const time = Date.now() * 0.0002; 
    const swayAmount = 0.5; // Max sway displacement

    // Animate axon signals and particles
    axons.forEach(axon => {
        // --- Axon Curve Update Logic based on TF Data ---
        const neuronA = axon.neuronA;
        const neuronB = axon.neuronB;
        let tfDataValidForA = false;
        let tfDataValidForB = false;

        // Use pre-allocated temp vectors for current attachment positions
        // tempCurrentAttachmentPosA and tempCurrentAttachmentPosB are declared globally

        if (neuronA && neuronB && neuronDisplacedVertexData) {
            const neuronADataIndex = neurons.indexOf(neuronA);
            const neuronBDataIndex = neurons.indexOf(neuronB);

            if (neuronADataIndex !== -1 && axon.neuronA_attachmentVertexIndex !== undefined) {
                const positionsA = neuronDisplacedVertexData[neuronADataIndex];
                if (positionsA && positionsA.length > axon.neuronA_attachmentVertexIndex * 3) {
                    tempCurrentAttachmentPosA.fromArray(positionsA, axon.neuronA_attachmentVertexIndex * 3);
                    tfDataValidForA = true;
                }
            }

            if (neuronBDataIndex !== -1 && axon.neuronB_attachmentVertexIndex !== undefined) {
                const positionsB = neuronDisplacedVertexData[neuronBDataIndex];
                if (positionsB && positionsB.length > axon.neuronB_attachmentVertexIndex * 3) {
                    tempCurrentAttachmentPosB.fromArray(positionsB, axon.neuronB_attachmentVertexIndex * 3);
                    tfDataValidForB = true;
                }
            }
        }
        
        // If TF data wasn't available, fall back to neuron center positions
        if (!tfDataValidForA) {
            tempCurrentAttachmentPosA.copy(neuronA.position); 
        }
        if (!tfDataValidForB) {
            tempCurrentAttachmentPosB.copy(neuronB.position); 
        }
        
        // --- Calculate Axon Tension ---
        if (axon.initialAttachmentPosA && axon.initialAttachmentPosB) {
            axon.startTension = tempCurrentAttachmentPosA.distanceTo(axon.initialAttachmentPosA);
            axon.endTension = tempCurrentAttachmentPosB.distanceTo(axon.initialAttachmentPosB);

            // Optional: Log for verification for one axon
            // if (axon === axons[0]) {
            //    console.log(`Axon ${axon.uuid.slice(0,3)}: StartTension: ${axon.startTension.toFixed(3)}, EndTension: ${axon.endTension.toFixed(3)}`);
            //    console.log("Initial A:", axon.initialAttachmentPosA, "Current A:", newStartPos);
            //    console.log("Initial B:", axon.initialAttachmentPosB, "Current B:", newEndPos);
            // }
        } else {
            // Initialize tension if initial attachment positions are missing (should not happen if setup is correct)
            axon.startTension = 0.0;
            axon.endTension = 0.0;
        }
        
        // Update shader uniforms with calculated tension
        if (axon.material && axon.material.isShaderMaterial) {
            if (axon.material.uniforms.u_startTension) {
                axon.material.uniforms.u_startTension.value = axon.startTension;
            }
            if (axon.material.uniforms.u_endTension) {
                axon.material.uniforms.u_endTension.value = axon.endTension;
            }
        }
        // --- End of Calculate Axon Tension ---

        // --- Animate Axon Sway (Option A: JS Curve Update) ---
        // The sway logic now uses tempCurrentAttachmentPosA and tempCurrentAttachmentPosB
        if (axon.neuronA && axon.neuronB && axon.initialControlPointOffset) { // Handles curved axons
            tempAxonPosA.copy(tempCurrentAttachmentPosA); // Use the (potentially TF-derived) current start
            tempAxonPosB.copy(tempCurrentAttachmentPosB); // Use the (potentially TF-derived) current end
            
            // Recalculate midpoint
            tempMidPoint.addVectors(tempAxonPosA, tempAxonPosB).multiplyScalar(0.5);
            
            // Use the stored initial offset to determine the base control point's position relative to current midpoint
            // This keeps the curve's fundamental shape consistent even if neurons move slightly
            tempBaseControlPoint.copy(tempMidPoint).add(axon.initialControlPointOffset);

            // Apply sway
            tempSwayOffset.x = Math.sin(time + axon.swaySeed) * swayAmount;
            tempSwayOffset.y = Math.cos(time * 0.7 + axon.swaySeed * 1.2) * swayAmount * 0.5;
            tempSwayOffset.z = Math.sin(time * 0.5 + axon.swaySeed * 1.5) * swayAmount * 0.7;
            tempAnimatedControlPoint.copy(tempBaseControlPoint).add(tempSwayOffset);

            // Create new curve for this frame
            const newCurve = new THREE.QuadraticBezierCurve3(tempAxonPosA, tempAnimatedControlPoint, tempAxonPosB);
            
            // Update axon.particleSystem.curve (used for particle pathing)
            if (axon.particleSystem && axon.particleSystem.curve instanceof THREE.QuadraticBezierCurve3) {
                axon.particleSystem.curve.v0.copy(newCurve.v0);
                axon.particleSystem.curve.v1.copy(newCurve.v1);
                axon.particleSystem.curve.v2.copy(newCurve.v2);
            } else if (axon.particleSystem && axon.particleSystem.curve instanceof THREE.LineCurve3) {
                // This case might occur if straight axons were created with LineCurve3,
                // though current createAxon uses QuadraticBezierCurve3 for all.
                axon.particleSystem.curve.v0.copy(newCurve.v0); // or tempAxonPosA
                axon.particleSystem.curve.v1.copy(newCurve.v2); // or tempAxonPosB (LineCurve3 has v0 and v1 as start/end)
            }


            // Update geometry attributes
            const positions = axon.geometry.attributes.position;
            const normals = axon.geometry.attributes.normal;
            const tubularSegments = axon.tubularSegments; // Retrieve stored value
            const radialSegments = axon.radialSegments;   // Retrieve stored value
            const baseRadiusFunc = t => axon.baseRadius * (0.5 + Math.sin(Math.PI * t) * 0.5);


            const newPoints = newCurve.getPoints(tubularSegments);
            const newFrames = newCurve.computeFrenetFrames(tubularSegments, false);

            for (let i = 0; i <= tubularSegments; i++) {
                tempCurvePoint.copy(newPoints[i]);
                tempNormal.copy(newFrames.normals[i]);
                tempBinormal.copy(newFrames.binormals[i]);
                tempTangent.copy(newFrames.tangents[i]);
                const currentRadius = baseRadiusFunc(i / tubularSegments);
                
                tempBasisMatrix.makeBasis(tempBinormal, tempNormal, tempTangent);

                for (let j = 0; j <= radialSegments; j++) {
                    const angle = (j / radialSegments) * Math.PI * 2;
                    const x = currentRadius * Math.cos(angle);
                    const y = currentRadius * Math.sin(angle);

                    const P = tempParticlePosition.set(x,y,0).applyMatrix4(tempBasisMatrix).add(tempCurvePoint); // Reuse tempParticlePosition for P
                    const vertexIndex = i * (radialSegments + 1) + j;
                    positions.setXYZ(vertexIndex, P.x, P.y, P.z);

                    const N = tempSwayOffset.set(x,y,0).normalize().applyMatrix4(tempBasisMatrix); // Reuse tempSwayOffset for N
                    normals.setXYZ(vertexIndex, N.x, N.y, N.z);
                }
            }
            positions.needsUpdate = true;
            normals.needsUpdate = true;
        }
        // --- End Axon Sway Animation ---


        // Animate new "light orb" signal
        if (axon.isSignalActive && axon.material.isShaderMaterial) {
            axon.signalProgress += axonSignalSpeed * deltaTime;
            axon.material.uniforms.u_signalProgress.value = axon.signalProgress;

            if (axon.signalProgress >= 1.0) {
                axon.isSignalActive = false;
                axon.signalProgress = 0.0;
                axon.material.uniforms.u_signalActive.value = false;
            }
        } else if (axon.material.isShaderMaterial && axon.material.uniforms.u_signalActive.value) {
            // Ensure shader uniform is false if signal is not active on JS side
            axon.material.uniforms.u_signalActive.value = false;
        }
        
        // The old texture-based signal (emissiveMap scroll) is no longer used for the main signal.
        // If you want to keep it as a subtle background effect on axons, it could be reinstated here,
        // but the primary signal is now the shader-driven orb.

            // Update particle system
        if (axon.particleSystem) {
                const ps = axon.particleSystem; // ps.curve is now updated above
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
