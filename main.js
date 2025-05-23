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
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), // resolution
        1.2, // strength: The intensity of the bloom.
        0.6, // radius: The spread of the bloom.
        0.75 // threshold: Only pixels brighter than this threshold will bloom.
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
        super(); // Call THREE.Group constructor.

        // Core: The bright central part of the neuron.
        const coreGeometry = new THREE.SphereGeometry(coreRadius, 32, 32);
        const coreMaterial = new THREE.MeshBasicMaterial({ color: coreColor, emissive: coreColor }); // Emissive for bloom.
        this.coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
        this.add(this.coreMesh);

        // Aura: The semi-transparent glowing sphere surrounding the core.
        const auraGeometry = new THREE.SphereGeometry(coreRadius * auraRadiusMultiplier, 32, 32);
        const auraMaterial = new THREE.MeshBasicMaterial({
            color: auraColor,
            emissive: auraColor, // Emissive for bloom.
            transparent: true,
            opacity: auraOpacity
        });
        this.auraMesh = new THREE.Mesh(auraGeometry, auraMaterial);
        this.add(this.auraMesh);

        this.initialAuraOpacity = auraOpacity; // Store for potential future use (e.g., opacity pulsing).
        this.pulseSpeed = 0.0015 + Math.random() * 0.001; // Randomized pulse speed for variation.

        this.createFilaments(); // Generate and add filaments to the neuron.
    }

    /**
     * Creates fine filaments that emanate from the neuron's center.
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
     * Updates the neuron's state, primarily its pulsing animation.
     * Called in the main animation loop.
     */
    update() {
        // Calculate a pulse factor using a sine wave based on time.
        const pulse = Math.sin(Date.now() * this.pulseSpeed);
        // Apply the pulse to the neuron's scale (core, aura, and filaments).
        const scaleFactor = 1 + pulse * 0.08; // 0.08 determines the intensity of the pulse.
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
    let curve;
    const posA = neuronA.position;
    const posB = neuronB.position;

    if (useCurve) {
        // For curved axons, use QuadraticBezierCurve3.
        const distance = posA.distanceTo(posB);
        // Calculate a midpoint for the control point.
        const midPoint = new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5);
        // Offset the control point randomly from the midpoint to create a curve.
        // The offset is proportional to the distance between neurons, creating more pronounced curves for longer axons.
        const controlPointOffset = new THREE.Vector3(
            (Math.random() - 0.5) * distance * 0.6, // Random offset in X
            (Math.random() - 0.5) * distance * 0.6, // Random offset in Y
            (Math.random() - 0.5) * distance * 0.6  // Random offset in Z
        );
        const controlPoint = midPoint.clone().add(controlPointOffset);
        curve = new THREE.QuadraticBezierCurve3(posA, controlPoint, posB);
    } else {
        // For straight axons, use LineCurve3.
        curve = new THREE.LineCurve3(posA, posB);
    }

    // Create the tube geometry from the curve.
    const geometry = new THREE.TubeGeometry(curve, 20, radius, 8, false); // (path, tubularSegments, radius, radialSegments, closed)
    const material = new THREE.MeshBasicMaterial({
        color: color,
        emissive: color, // Emissive for bloom.
        transparent: true,
        opacity: 0.7     // Slightly transparent axons.
    });
    const axonMesh = new THREE.Mesh(geometry, material);
    scene.add(axonMesh); // Add axon to the main scene.
    return axonMesh;
}

//----------------------------------------------------------------------------------
// AXON INSTANTIATION
//----------------------------------------------------------------------------------
const axons = []; // Array to hold axon meshes (currently not used after creation, but good for future manipulation).

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
function animate() {
    requestAnimationFrame(animate); // Request the next frame for smooth animation.

    // Update OrbitControls if enabled (e.g., for damping or auto-rotation).
    if (controls && controls.autoRotate) {
        controls.update();
    }

    // Update each neuron (handles their pulsing animation).
    neurons.forEach(neuron => {
        neuron.update();
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
