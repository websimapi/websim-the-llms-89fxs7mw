import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from './config.js';
import { cityData } from './cityData.js';
import { setupSceneLighting } from './advancedLighting.js';
import { createPlotOutline } from './plotConstructionElements.js';
import { createInfiniteTerrain } from './infiniteTerrain.js';
import { CameraBoundaryController } from './cameraBoundaryController.js';
import { createDistanceMist } from './terrainUtils.js';
import { setupUIInteractions, setupConsolePanel } from './citySceneUI.js';
import { initPlotHoverInfo } from './plotHoverInfo.js';
// Import the drone auto-navigation function
import { startAutoNavigation } from './llmDroneTransport.js';

// Expose main scene components globally or via getters for drone transport
let scene, camera, controls, renderer;
window.cityScene = scene; // Quick global access (consider a getter pattern later)
window.camera = camera;
window.controls = controls;

// --- Touch/Click State Tracking for Plot Interaction ---
let interactionStartX = 0;
let interactionStartY = 0;
let isDraggingInteraction = false;
const interactionDragThreshold = 10; // Pixels to count as drag
// --- End Touch/Click State Tracking ---

// Add fadeOutAudio function at global level
function fadeOutAudio(duration = 3000) {
    const audio = document.querySelector('audio');
    if (!audio) return;

    const startVolume = audio.volume;
    const fadeSteps = 50;
    const volumeStep = startVolume / fadeSteps;
    const intervalTime = duration / fadeSteps;

    const fadeInterval = setInterval(() => {
        if (audio.volume > volumeStep) {
            audio.volume -= volumeStep;
        } else {
            audio.volume = 0;
            audio.pause();
            clearInterval(fadeInterval);
        }
    }, intervalTime);
}

document.addEventListener('DOMContentLoaded', () => {
    // Make fadeOutAudio globally accessible
    window.fadeOutAudio = fadeOutAudio;

    // Wait for game container to be visible
    const gameContainer = document.getElementById('game-container');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (!gameContainer.classList.contains('hidden')) {
                    initCityScene();
                    observer.disconnect();
                }
            }
        });
    });

    observer.observe(gameContainer, { attributes: true });

    // Initialize directly if skip button was clicked
    if (!gameContainer.classList.contains('hidden')) {
        initCityScene();
        observer.disconnect();
    }
});

function initCityScene() {
    const cityViewElement = document.getElementById('city-view');

    // Initialize Three.js scene
    scene = new THREE.Scene(); // Assign to global variable
    scene.background = new THREE.Color(0xe0f5e0);
    window.cityScene = scene; // Update global reference

    // Create camera
    camera = new THREE.PerspectiveCamera( // Assign to global variable
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        5000 // Increased far plane for larger terrain/fog distance
    );
    window.camera = camera; // Update global reference

    // Set initial camera position further out for cinematic intro
    camera.position.set(50, 30, 50);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ // Assign to global variable
        antialias: true,
        powerPreference: "high-performance",
        // Logarithmic depth buffer might cause issues with fog/transparency, disable if needed
        // logarithmicDepthBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimized pixel ratio
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadow mapping
    renderer.outputColorSpace = THREE.SRGBColorSpace; // Correct property name for r152+
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // Improved tone mapping
    renderer.toneMappingExposure = 1.2; // Adjust exposure for better lighting
    cityViewElement.appendChild(renderer.domElement);

    // --- Add Unified Interaction Listeners ---
    const canvas = renderer.domElement;
    canvas.removeEventListener('mousedown', handleInteractionStart); // Clean up just in case
    canvas.removeEventListener('touchstart', handleInteractionStart);
    canvas.removeEventListener('mousemove', handleInteractionMove);
    canvas.removeEventListener('touchmove', handleInteractionMove);
    canvas.removeEventListener('mouseup', handleInteractionEnd);
    canvas.removeEventListener('touchend', handleInteractionEnd);

    canvas.addEventListener('mousedown', handleInteractionStart, { passive: false });
    canvas.addEventListener('touchstart', handleInteractionStart, { passive: false });
    canvas.addEventListener('mousemove', handleInteractionMove, { passive: false });
    canvas.addEventListener('touchmove', handleInteractionMove, { passive: false });
    canvas.addEventListener('mouseup', handleInteractionEnd);
    canvas.addEventListener('touchend', handleInteractionEnd);
    // --- End Unified Interaction Listeners ---


    // Add orbit controls
    controls = new OrbitControls(camera, renderer.domElement); // Assign to global variable
    window.controls = controls; // Update global reference

    // Create infinite terrain instead of just a ground plane
    const terrain = createInfiniteTerrain(scene, config.citySize || 500); // Use config size

    // Add distance mist for better horizon
    const mistLayers = createDistanceMist(scene, (config.citySize || 500) * 5, 60); // Adjust mist distance based on terrain

    // Create camera boundary controller using terrain bounds
    const boundaryController = new CameraBoundaryController(camera, controls, terrain.bounds);

    // Add grid for reference - 1m x 1m grid squares
    const gridHelper = new THREE.GridHelper(config.citySize || 500, (config.citySize || 500) / 10, 0x000000, 0x555555); // Adjust grid size
    gridHelper.position.y = 0.01; // Place slightly above ground
    scene.add(gridHelper);

    // Hide grid by default
    gridHelper.visible = false;

    // Store grid reference globally for console access
    window.cityGrid = gridHelper;

    // Create building lots from cityData
    createBuildingLots(scene);

    // Update orbit controls settings
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 5; // Adjusted min distance
    controls.maxDistance = (config.citySize || 500) * 0.7; // Limit max distance based on terrain size
    controls.maxPolarAngle = Math.PI / 2.1; // Allow slightly lower angle
    controls.enabled = false; // Disable controls during intro animation

    // Setup advanced lighting - use new function from dedicated file
    setupSceneLighting(scene, renderer);

    // Call imported setup functions
    setupUIInteractions();
    setupConsolePanel();

    // Setup camera intro animation
    let introDuration = 4000; // 4 seconds for intro
    let introStartTime = Date.now();
    let introComplete = false;
    let audioFadeStarted = false;

    // Initialize plot hover info after the scene is ready
    initPlotHoverInfo(camera, scene, renderer);

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- Main Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);

        // Check global drone state directly
        const isDroneActive = window.droneActive === true;

        // Handle intro camera animation
        if (!introComplete) {
            const elapsed = Date.now() - introStartTime;
            const progress = Math.min(elapsed / introDuration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

            if (progress < 1) {
                // Interpolate camera position for smooth pan
                const startPos = new THREE.Vector3(50, 30, 50);
                const endPos = new THREE.Vector3(15, 25, 30);
                camera.position.lerpVectors(startPos, endPos, easeProgress);
                camera.lookAt(0, 0, 0);
            } else {
                introComplete = true;
                if (!isDroneActive) controls.enabled = true; // Enable controls only if intro done AND drone inactive
            }
        } else if (!isDroneActive) { // Only update OrbitControls/boundaries if intro done AND drone inactive
            if (controls.enabled) { // Check if controls are enabled before updating
                controls.update();
                // Apply camera boundary restrictions
                boundaryController.update();
            }
        } else { // If drone is active, ensure OrbitControls are disabled
             // Camera is controlled by drone logic, but ensure OrbitControls internal state doesn't interfere
             controls.enabled = false;
             // Explicitly call update() maybe needed if drone logic relies on OrbitControls state? Test first.
             // controls.update(); // Might not be needed if drone directly manipulates camera/target
        }

        // Call animation functions for other components (like lighting)
        if (window.cityAnimateLightsFn) {
            window.cityAnimateLightsFn();
        }

        // Render the scene
        renderer.render(scene, camera);
    }

    animate(); // Start the main animation loop
}

// --- Unified Interaction Handling ---
function handleInteractionStart(event) {
    let clientX, clientY;
    if (event.type === 'touchstart') {
        if (event.touches.length === 0) return;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else { // mousedown
        clientX = event.clientX;
        clientY = event.clientY;
    }

    interactionStartX = clientX;
    interactionStartY = clientY;
    isDraggingInteraction = false;

    // Prevent default only if drone is active to avoid OrbitControls interference
    if (window.droneActive && event.cancelable) {
        // Check if the click is on a UI element outside the canvas
        const uiOverlay = document.getElementById('ui-overlay');
        const droneUI = document.getElementById('drone-transport-ui');
        const musicControls = document.querySelector('.music-control-container');
        if (
            (uiOverlay && uiOverlay.contains(event.target) && event.target !== renderer.domElement) ||
            (droneUI && droneUI.contains(event.target)) ||
            (musicControls && musicControls.contains(event.target))
        ) {
             // Don't prevent default if clicking on UI
        } else {
            event.preventDefault(); // Prevent OrbitControls activation
        }
    }
}

function handleInteractionMove(event) {
    if (isDraggingInteraction) return; // Already dragging, no need to check again

    let clientX, clientY;
    if (event.type === 'touchmove') {
        if (event.touches.length === 0) return;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else { // mousemove
        // Only check drag if mouse button is pressed (mousedown started)
        if (event.buttons !== 1) return;
        clientX = event.clientX;
        clientY = event.clientY;
    }

    const deltaX = Math.abs(clientX - interactionStartX);
    const deltaY = Math.abs(clientY - interactionStartY);

    if (deltaX > interactionDragThreshold || deltaY > interactionDragThreshold) {
        isDraggingInteraction = true;
    }
}

function handleInteractionEnd(event) {
    if (isDraggingInteraction) {
        // Reset drag flag for the next interaction
        isDraggingInteraction = false;
        return; // Do nothing if it was a drag
    }

    // Reset drag flag
    isDraggingInteraction = false;

    // Check if the interaction ended on a UI element outside the canvas
    const uiOverlay = document.getElementById('ui-overlay');
    const droneUI = document.getElementById('drone-transport-ui');
    const musicControls = document.querySelector('.music-control-container');
    if (
        (uiOverlay && uiOverlay.contains(event.target) && event.target !== renderer.domElement) ||
        (droneUI && droneUI.contains(event.target)) ||
        (musicControls && musicControls.contains(event.target))
    ) {
         console.log("Interaction ended on UI element, ignoring plot click.");
         return;
    }

    // If it wasn't a drag, proceed with plot click logic
    let clientX, clientY;
    if (event.type === 'touchend') {
        // Use the final touch position if available, otherwise fallback to start
        const touch = event.changedTouches[0];
        clientX = touch ? touch.clientX : interactionStartX;
        clientY = touch ? touch.clientY : interactionStartY;
    } else { // mouseup
        clientX = event.clientX;
        clientY = event.clientY;
    }
    handleCityClickLogic(clientX, clientY);
}
// --- End Unified Interaction Handling ---


// Renamed original function to handleCityClickLogic
function handleCityClickLogic(clientX, clientY) {
    // Only handle clicks if drone is active and not currently auto-navigating
    if (!window.droneActive || window.isAutoNavigating) return;

    // Get mouse/touch coordinates relative to the canvas
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast from the main camera
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Find all plot objects (outlines and click targets) in the scene
    const plotClickTargets = [];
    const plotOutlines = [];
    scene.traverse(obj => {
        if (obj.userData && obj.userData.type === 'lot_target' && obj.name === 'plot_click_target') {
            plotClickTargets.push(obj);
        } else if (obj.userData && obj.userData.type === 'lot' && obj.name === 'plot_outline') {
            plotOutlines.push(obj);
        }
    });

    // 1. Check intersections with invisible click targets first
    let intersects = raycaster.intersectObjects(plotClickTargets, false); // Don't check children

    let clickedPlotData = null;
    let clickedPlotId = null;

    if (intersects.length > 0) {
        // Found a hit on an invisible target plane
        clickedPlotId = intersects[0].object.userData.id;
        clickedPlotData = cityData.lots.find(lot => lot.id === clickedPlotId);
        console.log("Raycast hit invisible plot target:", clickedPlotData?.name);
    } else {
        // 2. Fallback: Check intersections with visible plot outlines (construction elements)
        intersects = raycaster.intersectObjects(plotOutlines, true); // recursive check
        if (intersects.length > 0) {
            let plotGroup = intersects[0].object;
            while (plotGroup && (!plotGroup.userData || plotGroup.userData.type !== 'lot')) {
                plotGroup = plotGroup.parent;
                if (!plotGroup) break;
            }

            if (plotGroup && plotGroup.userData && plotGroup.userData.id) {
                clickedPlotId = plotGroup.userData.id;
                clickedPlotData = cityData.lots.find(lot => lot.id === clickedPlotId);
                console.log("Raycast hit plot outline element:", clickedPlotData?.name);
            }
        }
    }


    // If a plot was clicked and it's available
    // Also check if plot is not full
    const isFull = clickedPlotData && (clickedPlotData.occupants || []).length >= (clickedPlotData.maxCapacity || 8);
    if (clickedPlotData && !isFull) {
        console.log(`Plot clicked: ${clickedPlotData.name} (ID: ${clickedPlotData.id})`);

        // Calculate target position (center of the plot, slightly above ground)
        const targetX = clickedPlotData.x;
        const targetZ = clickedPlotData.z;
        const targetY = 5; // Target altitude above the plot

        const targetPosition = new THREE.Vector3(targetX, targetY, targetZ);

        // Call the drone's auto-navigation function
        startAutoNavigation(targetPosition, clickedPlotData.id);
    } else if (clickedPlotData && isFull) {
        console.log(`Plot ${clickedPlotData.name} is full.`);
        // Optionally provide user feedback (e.g., temporary message)
    }
}

function createBuildingLots(scene) {
    const lots = cityData.lots;

    lots.forEach(lot => {
        // Ensure occupants array exists and is initialized
        if (!lot.occupants) lot.occupants = [];

        // Create plot outline with construction elements
        const plotOutline = createPlotOutline(lot, scene);
        plotOutline.userData = { type: 'lot', id: lot.id }; // Ensure userData is set here

        // Create an invisible plane for click detection covering the plot area
        const clickTargetGeometry = new THREE.PlaneGeometry(lot.width, lot.height);
        const clickTargetMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000, // Color doesn't matter as it's invisible
            side: THREE.DoubleSide,
            visible: false // Make it invisible
        });
        const clickTargetMesh = new THREE.Mesh(clickTargetGeometry, clickTargetMaterial);
        clickTargetMesh.rotation.x = -Math.PI / 2; // Lay flat on the ground
        clickTargetMesh.position.set(lot.x, 0.02, lot.z); // Position slightly above ground
        clickTargetMesh.name = 'plot_click_target';
        clickTargetMesh.userData = { type: 'lot_target', id: lot.id }; // Store plot ID

        scene.add(clickTargetMesh);

        // If plot is NOT available (has occupants), remove the click target initially
        if (!lot.available) {
             clickTargetMesh.visible = false; // Ensure it's invisible
             // Optional: Consider removing it from the scene entirely if persistence isn't needed
             // scene.remove(clickTargetMesh);
             console.log(`Plot ${lot.name} is occupied, removing click target initially.`);
        }
    });

    // Add city name text
    addCityNameText(scene);
}

function addCityNameText(scene) {
    // Create stone pillars
    const pillarGeometry = new THREE.BoxGeometry(1, 10, 1);
    const pillarMaterial = new THREE.MeshStandardMaterial({
        color: 0x808080,
        roughness: 0.8,
        metalness: 0.2
    });

    // Left pillar
    const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    leftPillar.position.set(-8, 5, -30);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    scene.add(leftPillar);

    // Right pillar
    const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
    rightPillar.position.set(8, 5, -30);
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    scene.add(rightPillar);

    // Create text canvas for front and back
    const canvasWithText = document.createElement('canvas');
    canvasWithText.width = 512;
    canvasWithText.height = 128;
    const contextWithText = canvasWithText.getContext('2d');

    // Create blank canvas for sides
    const canvasBlank = document.createElement('canvas');
    canvasBlank.width = 512;
    canvasBlank.height = 128;
    const contextBlank = canvasBlank.getContext('2d');

    // Wood texture background for both canvases
    [contextWithText, contextBlank].forEach(context => {
        // Wood background
        context.fillStyle = '#8B4513';
        context.fillRect(0, 0, canvasWithText.width, canvasWithText.height);

        // Add wood grain effect
        context.strokeStyle = '#6B3100';
        context.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
            context.beginPath();
            context.moveTo(0, i * 15);
            context.bezierCurveTo(
                canvasWithText.width * 0.3, i * 15 + (Math.random() * 10 - 5),
                canvasWithText.width * 0.7, i * 15 + (Math.random() * 10 - 5),
                canvasWithText.width, i * 15
            );
            context.stroke();
        }
    });

    // Text with border - only on the text canvas
    contextWithText.fillStyle = 'white';
    contextWithText.font = 'bold 60px Arial';
    contextWithText.textAlign = 'center';
    contextWithText.textBaseline = 'middle';
    contextWithText.strokeStyle = 'black';
    contextWithText.lineWidth = 4;
    contextWithText.strokeText(cityData.name, canvasWithText.width / 2, canvasWithText.height / 2);
    contextWithText.fillText(cityData.name, canvasWithText.width / 2, canvasWithText.height / 2);

    // Create textures
    const textureWithText = new THREE.CanvasTexture(canvasWithText);
    const textureBlank = new THREE.CanvasTexture(canvasBlank);

    // Create materials for different sides
    const frontBackMaterial = new THREE.MeshStandardMaterial({ // Use Standard for lighting
        map: textureWithText,
        side: THREE.FrontSide,
        roughness: 0.7,
        metalness: 0.1
    });

    const sideMaterial = new THREE.MeshStandardMaterial({ // Use Standard for lighting
        map: textureBlank,
        side: THREE.FrontSide,
        roughness: 0.7,
        metalness: 0.1
    });

    // Create materials array for BoxGeometry
    const materials = [
        sideMaterial,       // right side
        sideMaterial,       // left side
        sideMaterial,       // top side
        sideMaterial,       // bottom side
        frontBackMaterial,  // front side
        frontBackMaterial   // back side (same as front)
    ];

    // Create box with different materials per face
    const geometry = new THREE.BoxGeometry(20, 5, 0.5);
    const sign = new THREE.Mesh(geometry, materials);
    sign.position.set(0, 8.5, -30);
    sign.castShadow = true;
    scene.add(sign);
}

export function toggleConsolePanel() {
    const consolePanel = document.getElementById('console-panel');
    if (consolePanel.classList.contains('hidden')) {
        consolePanel.classList.remove('hidden');
    } else {
        consolePanel.classList.add('hidden');
    }
}