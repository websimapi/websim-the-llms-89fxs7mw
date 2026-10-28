import * as THREE from 'three';
import { renderLLMCharacter } from './llmCharacterRenderer.js';
import { llmDataManager } from './llmDataManager.js';
import { getModelTypeIcon } from './llmCollectionView.js';
import { config } from './config.js';
import { playTrack } from './musicPlayer.js'; // Import music player function
import { cityData } from './cityData.js'; // Import cityData for plot info

let droneActive = false;
let droneModel, llmModel;
let dronePosition = new THREE.Vector3(0, 15, 0);
let droneRotation = new THREE.Euler(0, 0, 0);
let droneVelocity = new THREE.Vector3();
let droneAngularVelocity = new THREE.Euler();
let droneAnimationId = null;
let cameraTransitionId = null;
let droneContainer;
let currentLLMTransporting = null;
let mainCityScene, mainCityCamera, mainCityControls;
let originalCameraPosition, originalCameraTarget;

// Auto-navigation state
let isAutoNavigating = false;
let autoNavTargetPosition = new THREE.Vector3();
let autoNavTargetPlotId = null;
let autoNavReachedTarget = false; // Flag to check if target reached
const AUTO_NAV_SPEED = 0.15; // Slightly slower than max manual speed
const AUTO_NAV_ROTATION_SPEED = 0.03;
const AUTO_NAV_ARRIVAL_THRESHOLD = 1.0; // Distance threshold to consider arrived
const AUTO_NAV_STOP_THRESHOLD = 0.5; // Distance threshold to fully stop
const AUTO_NAV_HOVER_ALTITUDE = 5.0; // Altitude to hover above plot center

let joystickActive = false;
let joystickThumb, joystickContainerElement;
let joystickOrigin = { x: 0, y: 0 };
let joystickRadius = 0;

const MAX_SPEED = 0.25;
const ACCELERATION = 0.02;
const DECELERATION = 0.95;
const ROTATION_SPEED = 0.01;
const MAX_ROTATION_SPEED = 0.05;
const ROTATION_DAMPING = 0.90;
const VERTICAL_SPEED = 0.15;
const MIN_ALTITUDE = 1.0;
const CAMERA_FOLLOW_DISTANCE = 8;
const CAMERA_FOLLOW_HEIGHT = 4;
const CAMERA_LERP_FACTOR = 0.05;
const DRONE_BASE_COLOR = 0xffffff;
const DRONE_ACCENT_COLOR = 0xcccccc;
const DRONE_DARK_ACCENT_COLOR = 0x888888;
const JOYSTICK_MAX_DISPLACEMENT = 35;

let droneControls = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    rotateLeft: false,
    rotateRight: false,
};
let touchActiveControls = {};

let isHoveringValidPlot = false; // New flag for placement readiness
let currentHoveredPlotId = null; // Track the ID of the plot being hovered over
let isPlacing = false; // New flag for placement sequence
let placementStartTime = 0; // Track placement animation time
const PLACEMENT_DURATION = 1500; // 1.5 seconds to lower and place
const PLACEMENT_GROUND_OFFSET = 0.02; // Small offset above ground

// Expose auto-navigating state globally
window.isAutoNavigating = isAutoNavigating;

export function activateDroneTransport(llmId) {
    if (droneActive) return;

    if (cameraTransitionId) {
        cancelAnimationFrame(cameraTransitionId);
        cameraTransitionId = null;
        console.log("Cancelled ongoing camera return transition.");
    }

    const llm = llmDataManager.getLLMById(llmId);
    if (!llm) return;

    // Assign global references *before* using them
    mainCityScene = window.cityScene;
    mainCityCamera = window.camera;
    mainCityControls = window.controls;

    if (!mainCityScene || !mainCityCamera || !mainCityControls) {
        console.error("Main city scene, camera, or controls not found. Cannot activate drone.");
        return;
    }

    currentLLMTransporting = llm;
    console.log(`Activating drone transport for LLM: ${llm.name}`);

    // --- Music Change ---
    playTrack('edge_of_time'); // Play edge of time during transport
    // --- End Music Change ---

    document.getElementById('llm-collection-ui').classList.remove('active');

    createDroneUI(llm);
    droneContainer.classList.add('active');

    originalCameraPosition = mainCityCamera.position.clone();
    originalCameraTarget = mainCityControls.target.clone();
    console.log("Stored original camera state:", originalCameraPosition, originalCameraTarget);

    const mapSize = config.citySize || 500;
    dronePosition.set(0, 50, mapSize / 2 + 50);
    droneRotation.set(0, Math.PI, 0);
    droneVelocity.set(0, 0, 0);
    droneAngularVelocity.set(0, 0, 0);
    resetControlState();

    initDroneScene(llm);
    positionCameraForDroneView(true);

    setupInputListeners();

    droneActive = true;
    window.droneActive = true;
    isAutoNavigating = false; // Ensure auto-nav is off initially
    window.isAutoNavigating = false;
    autoNavReachedTarget = false;
    isHoveringValidPlot = false; // Reset flag
    currentHoveredPlotId = null; // Reset hovered plot ID
    isPlacing = false; // Reset flag

    animateDrone();
}

// Function to start auto-navigation
export function startAutoNavigation(targetPosition, targetPlotId) {
    if (!droneActive || isAutoNavigating || isPlacing) return; // Prevent starting if already placing

    console.log("Starting auto-navigation to:", targetPosition, "Plot ID:", targetPlotId);
    isAutoNavigating = true;
    window.isAutoNavigating = true;
    autoNavTargetPosition.copy(targetPosition);
    // Adjust target Y position for hovering
    autoNavTargetPosition.y = AUTO_NAV_HOVER_ALTITUDE;
    autoNavTargetPlotId = targetPlotId;
    autoNavReachedTarget = false; // Reset reached flag
    isHoveringValidPlot = false; // Reset hovering flag
    currentHoveredPlotId = targetPlotId; // Assume we are hovering the target during auto-nav
    updatePlacementButtonState(); // Update button state

    // Disable manual controls visually and functionally
    disableManualControls();

    // Update UI
    updateDroneUIButtonText("Cancel Auto-Pilot");
    const landButton = droneContainer.querySelector('.drone-land-btn');
    if (landButton) {
        landButton.onclick = cancelAutoNavigation; // Change button action
    }
}

// Function to cancel auto-navigation
export function cancelAutoNavigation() {
    if (!isAutoNavigating) return;

    console.log("Cancelling auto-navigation.");
    isAutoNavigating = false;
    window.isAutoNavigating = false;
    autoNavTargetPlotId = null;
    autoNavReachedTarget = false;
    isHoveringValidPlot = false; // Reset hovering flag
    currentHoveredPlotId = null; // Clear hovered plot ID
    droneVelocity.multiplyScalar(0.5); // Reduce speed gently

    // Re-enable manual controls
    enableManualControls();

    // Reset UI
    updateDroneUIButtonText("Place LLM"); // Set back to Place
    updatePlacementButtonState(); // Update enabled/disabled state based on current hover
    const landButton = droneContainer.querySelector('.drone-land-btn');
    if (landButton) {
        landButton.onclick = handlePlaceAttempt; // Restore original action
    }
}

function disableManualControls() {
    resetControlState(); // Ensure all flags are false
    // Disable keyboard/touch input temporarily
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    disableTouchButtonListeners();
    disableJoystickListeners();
}

function enableManualControls() {
    // Re-enable keyboard/touch input
    setupInputListeners(); // This re-adds all listeners
}

function disableTouchButtonListeners() {
    droneContainer.querySelectorAll('.drone-touch-btn').forEach(btn => {
        // Remove listeners - requires named functions or tracking listeners
        // For simplicity, just visually disable for now
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
    });
}

function enableTouchButtonListeners() {
    droneContainer.querySelectorAll('.drone-touch-btn').forEach(btn => {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    });
    // Re-add listeners if they were fully removed
    setupTouchButtonListeners();
}

function disableJoystickListeners() {
    if (joystickContainerElement) {
        joystickContainerElement.removeEventListener('touchstart', handleJoystickStart);
        joystickContainerElement.removeEventListener('touchmove', handleJoystickMove);
        joystickContainerElement.removeEventListener('touchend', handleJoystickEnd);
        joystickContainerElement.removeEventListener('touchcancel', handleJoystickEnd);
        joystickContainerElement.removeEventListener('mousedown', handleJoystickStart);
        window.removeEventListener('mousemove', handleJoystickMove);
        window.removeEventListener('mouseup', handleJoystickEnd);
        joystickContainerElement.style.opacity = '0.5';
        joystickContainerElement.style.pointerEvents = 'none';
        if (joystickActive) handleJoystickEnd(); // Ensure joystick resets
    }
}

function enableJoystickListeners() {
    if (joystickContainerElement) {
        joystickContainerElement.style.opacity = '1';
        joystickContainerElement.style.pointerEvents = 'auto';
        // Re-add listeners if they were fully removed
        setupJoystickListeners();
    }
}

function updateDroneUIButtonText(text) {
    const landButton = droneContainer.querySelector('.drone-land-btn');
    if (landButton) {
        landButton.textContent = text;
    }
}

function createDroneUI(llm) {
    const existingContainer = document.getElementById('drone-transport-ui');
    if (existingContainer) existingContainer.remove();

    droneContainer = document.createElement('div');
    droneContainer.id = 'drone-transport-ui';
    droneContainer.className = 'drone-transport-ui';

    let profileImageHTML;
    if (llm.profileImageUrl) {
        profileImageHTML = `<img src="${llm.profileImageUrl}" alt="${llm.name}">`;
    } else {
        profileImageHTML = `<div class="placeholder-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12,2C9.8,2,8,3.8,8,6c0,1.1,0.4,2.1,1.2,2.8C7.3,9.5,6,11.4,6,13.5V16c0,1.1,0.9,2,2,2h1v3c0,0.6,0.4,1,1,1h6c0.6,0,1-0.4,1-1v-3h1c1.1,0,2-0.9,2-2v-2.5c0-2.1-1.3-4-3.2-4.7C17.6,8.1,18,7.1,18,6C18,3.8,16.2,2,14,2H12z M12,4h2c1.1,0,2,0.9,2,2s-0.9,2-2,2h-2C10.9,8,10,7.1,10,6S10.9,4,12,4z M9,13.5c0-1.4,1.1-2.5,2.5-2.5h3c1.4,0,2.5,1.1,2.5,2.5V16H9V13.5z" fill="currentColor"/></svg></div>`;
    }
    const modelIconSVG = getModelTypeIcon(llm.model);

    droneContainer.innerHTML = `
        <div class="drone-controls-info">
            <div class="drone-llm-info">
                <div class="drone-llm-profile-image">${profileImageHTML}</div>
                <div class="drone-llm-text-info">
                    <div class="llm-info-name">${llm.name}</div>
                    <div class="llm-info-model-container">
                        <div class="drone-llm-model-icon ${llm.model}">${modelIconSVG}</div>
                        <span class="llm-info-model">${llm.model}</span>
                        <div class="drone-llm-color-dot" style="background-color: ${llm.color || '#3cb371'};"></div>
                    </div>
                </div>
            </div>
            <div class="drone-instructions">
                <p><strong>Click/Tap</strong> an available plot to auto-fly</p>
                <p>Use <strong>WASD</strong> or <strong>Joystick</strong> to move</p>
                <p>Use <strong>E/Q</strong> or <strong>▲/▼</strong> to change altitude</p>
                <p>Use <strong>←/→</strong> or <strong>↺/↻</strong> to rotate</p>
                <p>Press <strong>P</strong> or <strong>Button Below</strong> to place LLM</p>
                <p>Press <strong>Esc</strong> or <strong>Cancel Button</strong> to cancel</p>
            </div>

            <div class="drone-touch-controls">
                <div class="drone-joystick-container">
                    <div class="drone-joystick-thumb"></div>
                </div>

                <div class="drone-action-buttons">
                    <button class="drone-touch-btn" data-control="up">▲</button>
                    <button class="drone-touch-btn" data-control="rotateLeft">↺</button>
                    <button class="drone-touch-btn" data-control="down">▼</button>
                    <button class="drone-touch-btn" data-control="rotateRight">↻</button>
                </div>

                <button class="drone-touch-btn" data-control="forward"></button>
                <button class="drone-touch-btn" data-control="backward"></button>
                <button class="drone-touch-btn" data-control="left"></button>
                <button class="drone-touch-btn" data-control="right"></button>
            </div>

            <button class="drone-land-btn">Place LLM</button>
        </div>
    `;
    document.body.appendChild(droneContainer);

    joystickContainerElement = droneContainer.querySelector('.drone-joystick-container');
    joystickThumb = droneContainer.querySelector('.drone-joystick-thumb');

    // Set initial handler for land button
    const landButton = droneContainer.querySelector('.drone-land-btn');
    if (landButton) {
        landButton.onclick = handlePlaceAttempt;
    }
}

function initDroneScene(llm) {
    createDroneWithLLM(llm);
}

function createDroneWithLLM(llm) {
    droneModel = new THREE.Group();
    droneModel.name = "DroneWithLLM";

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: DRONE_BASE_COLOR, metalness: 0.6, roughness: 0.4 });
    const armMaterial = new THREE.MeshStandardMaterial({ color: DRONE_ACCENT_COLOR, metalness: 0.5, roughness: 0.5 });
    const propellerHubMaterial = new THREE.MeshStandardMaterial({ color: DRONE_DARK_ACCENT_COLOR, metalness: 0.8, roughness: 0.2 });
    const propellerBladeMaterial = new THREE.MeshStandardMaterial({ color: DRONE_ACCENT_COLOR, metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide });

    const centralBodyRadius = 0.3;
    const centralBodyHeight = 0.2;
    const centralBody = new THREE.Mesh(
        new THREE.CylinderGeometry(centralBodyRadius * 0.8, centralBodyRadius, centralBodyHeight, 12),
        bodyMaterial
    );
    centralBody.castShadow = true;
    droneModel.add(centralBody);

    const propDistance = 1.0;
    const armWidth = 0.08;
    const armHeight = 0.08;
    const armLength = propDistance;

    const angleRad = Math.PI / 4;
    const propellerPositions = [
        { x: propDistance * Math.sin(angleRad), z: -propDistance * Math.cos(angleRad) },
        { x: -propDistance * Math.sin(angleRad), z: -propDistance * Math.cos(angleRad) },
        { x: -propDistance * Math.sin(angleRad), z: propDistance * Math.cos(angleRad) },
        { x: propDistance * Math.sin(angleRad), z: propDistance * Math.cos(angleRad) }
    ];

    propellerPositions.forEach((propPos, index) => {
        const armRotationY = Math.atan2(propPos.x, propPos.z);

        const armGeometry = new THREE.BoxGeometry(armWidth, armHeight, armLength);

        const arm = new THREE.Mesh(armGeometry, armMaterial);
        arm.position.set(propPos.x / 2, 0, propPos.z / 2);
        arm.rotation.y = armRotationY;
        arm.castShadow = true;
        droneModel.add(arm);

        const propeller = createPropeller(propellerHubMaterial, propellerBladeMaterial);
        propeller.position.set(propPos.x, armHeight / 2 + 0.05, propPos.z);
        droneModel.add(propeller);
    });

    // Render the LLM model at its default (full) scale
    llmModel = renderLLMCharacter(THREE, llm);

    // --- Calculate correct LLM attachment position ---
    // 1. Calculate the LLM's bounding box in its local coordinates
    const tempLLMForBox = llmModel.clone();
    tempLLMForBox.position.set(0, 0, 0);
    tempLLMForBox.rotation.set(0, 0, 0);
    tempLLMForBox.scale.set(1, 1, 1);
    tempLLMForBox.updateMatrixWorld(true); // Ensure world matrix is updated
    const llmBox = new THREE.Box3().setFromObject(tempLLMForBox);

    // Check if bounding box calculation was successful
    let modelTopYLocal = 0;
    if (!llmBox.isEmpty() && isFinite(llmBox.max.y)) {
        modelTopYLocal = llmBox.max.y; // Highest point of the LLM in its local space
    } else {
        console.warn("Could not compute valid bounding box for LLM model. Using default height estimate.");
        modelTopYLocal = 1.7; // Fallback height estimate
    }

    // 2. Determine the drone body's bottom position
    const droneBottomY = -centralBodyHeight / 2;

    // 3. Calculate the required Y offset for the LLM model's origin
    // We want modelTopYLocal (relative to LLM origin) to align slightly below droneBottomY (relative to drone origin)
    const attachmentGap = 0.15; // Gap between drone bottom and LLM top
    const llmOriginOffsetY = droneBottomY - modelTopYLocal - attachmentGap;

    // 4. Set the LLM model's position relative to the drone's origin
    llmModel.position.set(0, llmOriginOffsetY, 0);
    // --- End LLM attachment position calculation ---

    llmModel.castShadow = true;
    llmModel.receiveShadow = true;
    droneModel.add(llmModel);

    droneModel.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    if (droneModel && mainCityScene) {
        mainCityScene.add(droneModel);
        droneModel.position.copy(dronePosition);
        droneModel.rotation.copy(droneRotation);
    } else if (!droneModel) {
        console.error("Failed to create drone model.");
    } else {
        console.error("Main city scene not available when creating drone.");
    }
}

function createPropeller(hubMaterial, bladeMaterial) {
    const propellerGroup = new THREE.Group();
    propellerGroup.name = "Propeller";

    const hubRadius = 0.1;
    const hubHeight = 0.08;
    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(hubRadius, hubRadius, hubHeight, 8),
        hubMaterial
    );
    hub.castShadow = true;
    propellerGroup.add(hub);

    const blades = new THREE.Group();
    blades.name = "Blades";
    propellerGroup.add(blades);

    const bladeLength = 0.6;
    const bladeWidth = 0.1;
    const bladeThickness = 0.01;
    const bladeGeometry = new THREE.BoxGeometry(bladeLength, bladeThickness, bladeWidth);

    const blade1 = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade1.castShadow = true;
    blades.add(blade1);

    const blade2 = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade2.rotation.y = Math.PI / 2;
    blade2.castShadow = true;
    blades.add(blade2);

    blades.position.y = hubHeight / 2 + bladeThickness / 2;

    return propellerGroup;
}

function setupInputListeners() {
    resetControlState();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    enableTouchButtonListeners();
    enableJoystickListeners();

    // Ensure land button handler is correct
    const landButton = droneContainer?.querySelector('.drone-land-btn');
    if (landButton) {
        landButton.onclick = handlePlaceAttempt;
        updateDroneUIButtonText("Place LLM");
    }
}

function removeInputListeners() {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    disableTouchButtonListeners();
    disableJoystickListeners();

    const landButton = droneContainer?.querySelector('.drone-land-btn');
    if (landButton) {
        landButton.onclick = null;
    }
}

function resetControlState() {
    for (const key in droneControls) {
        droneControls[key] = false;
    }
    touchActiveControls = {};
    if (joystickActive) {
        handleJoystickEnd();
    }
}

function handleKeyDown(event) {
    if (!droneActive || isAutoNavigating) return;

    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
        return;
    }

    const key = event.key.toLowerCase();
    let handled = true;

    switch (key) {
        case 'w': droneControls.backward = true; break;
        case 's': droneControls.forward = true; break;
        case 'a': droneControls.left = true; break;
        case 'd': droneControls.right = true; break;
        case 'q': droneControls.down = true; break;
        case 'e': droneControls.up = true; break;
        case 'arrowleft': droneControls.rotateLeft = true; break;
        case 'arrowright': droneControls.rotateRight = true; break;
        case 'p': handlePlaceAttempt(); break;
        case 'escape': deactivateDroneTransport(true); break;
        default: handled = false;
    }
    if (handled) event.preventDefault();
}

function handleKeyUp(event) {
    if (!droneActive || isAutoNavigating) return;

    const key = event.key.toLowerCase();
    switch (key) {
        case 'w': droneControls.backward = false; break;
        case 's': droneControls.forward = false; break;
        case 'a': droneControls.left = false; break;
        case 'd': droneControls.right = false; break;
        case 'q': droneControls.down = false; break;
        case 'e': droneControls.up = false; break;
        case 'arrowleft': droneControls.rotateLeft = false; break;
        case 'arrowright': droneControls.rotateRight = false; break;
    }
}

function setupTouchButtonListeners() {
    droneContainer.querySelectorAll('.drone-touch-btn').forEach(btn => {
        const control = btn.getAttribute('data-control');
        if (!['forward', 'backward', 'left', 'right'].includes(control)) {
            // Remove existing listeners before adding new ones to prevent duplicates
            btn.removeEventListener('touchstart', handleTouchStartWrapper);
            btn.removeEventListener('touchend', handleTouchEndWrapper);
            btn.removeEventListener('touchcancel', handleTouchEndWrapper);
            btn.removeEventListener('mousedown', handleTouchStartWrapper);
            btn.removeEventListener('mouseup', handleTouchEndWrapper);
            btn.removeEventListener('mouseleave', handleTouchEndWrapper);

            // Add new listeners using wrappers
            btn.addEventListener('touchstart', handleTouchStartWrapper, { passive: false });
            btn.addEventListener('touchend', handleTouchEndWrapper);
            btn.addEventListener('touchcancel', handleTouchEndWrapper);
            btn.addEventListener('mousedown', handleTouchStartWrapper);
            btn.addEventListener('mouseup', handleTouchEndWrapper);
            btn.addEventListener('mouseleave', handleTouchEndWrapper);

            // Store control reference on the element for wrappers
            btn.dataset.controlRef = control;
        }
    });
}

// Wrapper functions to pass control parameter
function handleTouchStartWrapper(e) {
    if (isAutoNavigating) return;
    handleTouchStart(e, e.currentTarget.dataset.controlRef);
}

function handleTouchEndWrapper(e) {
    if (isAutoNavigating) return;
    handleTouchEnd(e, e.currentTarget.dataset.controlRef);
}

function handleTouchStart(event, control) {
    event.preventDefault();
    event.stopPropagation();
    droneControls[control] = true;
    touchActiveControls[control] = true;
    const targetButton = event.currentTarget;
    if (targetButton) targetButton.style.backgroundColor = 'rgba(60, 179, 113, 0.8)';
}

function handleTouchEnd(event, control) {
    event.preventDefault();
    event.stopPropagation();
    if (touchActiveControls.hasOwnProperty(control)) {
        droneControls[control] = false;
        delete touchActiveControls[control];
    }
    const btn = droneContainer.querySelector(`.drone-touch-btn[data-control="${control}"]`);
    if (btn) {
        btn.style.backgroundColor = 'rgba(60, 179, 113, 0.4)';
    }
}

function setupJoystickListeners() {
    if (!joystickContainerElement || !joystickThumb) return;

    const rect = joystickContainerElement.getBoundingClientRect();
    joystickOrigin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
    joystickRadius = rect.width / 2;

    joystickContainerElement.removeEventListener('touchstart', handleJoystickStart);
    joystickContainerElement.removeEventListener('touchmove', handleJoystickMove);
    joystickContainerElement.removeEventListener('touchend', handleJoystickEnd);
    joystickContainerElement.removeEventListener('touchcancel', handleJoystickEnd);
    joystickContainerElement.removeEventListener('mousedown', handleJoystickStart);
    window.removeEventListener('mousemove', handleJoystickMove);
    window.removeEventListener('mouseup', handleJoystickEnd);

    joystickContainerElement.addEventListener('touchstart', handleJoystickStart, { passive: false });
    joystickContainerElement.addEventListener('touchmove', handleJoystickMove, { passive: false });
    joystickContainerElement.addEventListener('touchend', handleJoystickEnd);
    joystickContainerElement.addEventListener('touchcancel', handleJoystickEnd);

    joystickContainerElement.addEventListener('mousedown', handleJoystickStart);
    window.addEventListener('mousemove', handleJoystickMove);
    window.addEventListener('mouseup', handleJoystickEnd);
}

function handleJoystickStart(event) {
    if (isAutoNavigating) return;
    event.preventDefault();
    joystickActive = true;
    const rect = joystickContainerElement.getBoundingClientRect();
    joystickOrigin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
    handleJoystickMove(event);
}

function handleJoystickMove(event) {
    if (!joystickActive || isAutoNavigating) return;

    event.preventDefault();

    let clientX, clientY;
    if (event.touches) {
        if (event.touches.length === 0) return;
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }

    const deltaX = clientX - joystickOrigin.x;
    const deltaY = clientY - joystickOrigin.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX);

    let displacement = Math.min(distance, JOYSTICK_MAX_DISPLACEMENT);
    const clampedX = Math.cos(angle) * displacement;
    const clampedY = Math.sin(angle) * displacement;

    joystickThumb.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

    const threshold = JOYSTICK_MAX_DISPLACEMENT * 0.2;
    const controlStrength = displacement / JOYSTICK_MAX_DISPLACEMENT;

    if (clampedY < -threshold) {
        droneControls.backward = true;
        droneControls.forward = false;
    } else if (clampedY > threshold) {
        droneControls.forward = true;
        droneControls.backward = false;
    } else {
        droneControls.forward = false;
        droneControls.backward = false;
    }

    if (clampedX < -threshold) {
        droneControls.left = true;
        droneControls.right = false;
    } else if (clampedX > threshold) {
        droneControls.right = true;
        droneControls.left = false;
    } else {
        droneControls.left = false;
        droneControls.right = false;
    }
}

function handleJoystickEnd(event) {
    if (!joystickActive && event && event.type !== 'mouseup' && event.type !== 'mouseleave') return;
    joystickActive = false;

    if (joystickThumb) {
        joystickThumb.style.transform = 'translate(0, 0)';
    }

    droneControls.forward = false;
    droneControls.backward = false;
    droneControls.left = false;
    droneControls.right = false;
}

// Renamed and modified to handle both manual and auto navigation
function updateDroneState() {
    if (!droneModel || !droneActive) return;

    if (isAutoNavigating) {
        updateAutoNavigationPhysics();
    } else {
        updateManualPhysics();
    }

    // Common physics updates (altitude, boundaries) - only apply if not placing
    if (droneModel.position.y < MIN_ALTITUDE && !isPlacing) {
        droneModel.position.y = MIN_ALTITUDE;
        droneVelocity.y = Math.max(0, droneVelocity.y);
    }

    const mapBoundary = (config.citySize || 500) / 2;
    droneModel.position.x = THREE.MathUtils.clamp(droneModel.position.x, -mapBoundary, mapBoundary);
    droneModel.position.z = THREE.MathUtils.clamp(droneModel.position.z, -mapBoundary, mapBoundary);

    // Propeller animation based on combined velocity/input - should run even during placement start
    // Calculate speed even if placing, based on current velocity and controls
    const verticalThrust = droneControls.up ? 1 : (droneControls.down ? -0.5 : 0);
    const speedSq = droneVelocity.lengthSq();
    const propellerSpeed = 1.0 + Math.abs(droneVelocity.y) * 8 + verticalThrust * 2 + Math.sqrt(speedSq) * 5;
    droneModel.traverse(child => {
        if (child.name === "Blades" && child.parent && child.parent.name === "Propeller") {
            const parentPosition = child.parent.position;
            const direction = (parentPosition.x > 0) ? 1 : -1;
            child.rotation.y += propellerSpeed * direction * 0.25;
        }
    });

    // Check if hovering over a valid plot *after* updating position,
    // but only if not currently in the placement sequence.
    // The placement sequence handles its own final plot check.
    if (!isPlacing) {
        checkHoveringPlot();
        updatePlacementButtonState();
    }
}

function updateManualPhysics() {
    // --- Rotation ---
    let targetRotationY = 0;
    if (droneControls.rotateLeft) targetRotationY += ROTATION_SPEED;
    if (droneControls.rotateRight) targetRotationY -= ROTATION_SPEED;

    droneAngularVelocity.y += targetRotationY;
    droneAngularVelocity.y *= ROTATION_DAMPING;
    droneAngularVelocity.y = THREE.MathUtils.clamp(droneAngularVelocity.y, -MAX_ROTATION_SPEED, MAX_ROTATION_SPEED);
    droneModel.rotation.y += droneAngularVelocity.y;

    // --- Movement ---
    const forwardVector = new THREE.Vector3();
    droneModel.getWorldDirection(forwardVector).negate();

    const rightVector = new THREE.Vector3().crossVectors(mainCityCamera.up, forwardVector).normalize();

    let targetVelocityInput = new THREE.Vector3();
    if (droneControls.forward) targetVelocityInput.add(forwardVector);
    if (droneControls.backward) targetVelocityInput.sub(forwardVector);
    if (droneControls.left) targetVelocityInput.sub(rightVector);
    if (droneControls.right) targetVelocityInput.add(rightVector);

    // Normalize horizontal input if moving diagonally
    const horizontalMagnitudeSq = targetVelocityInput.x * targetVelocityInput.x + targetVelocityInput.z * targetVelocityInput.z;
    if (horizontalMagnitudeSq > 1e-6) {
        const scale = 1.0 / Math.sqrt(horizontalMagnitudeSq);
        targetVelocityInput.x *= scale;
        targetVelocityInput.z *= scale;
    }

    let verticalVelocityInput = 0;
    if (droneControls.up) verticalVelocityInput += VERTICAL_SPEED;
    if (droneControls.down) verticalVelocityInput -= VERTICAL_SPEED;

    // Apply acceleration towards target input velocity
    droneVelocity.x += (targetVelocityInput.x * MAX_SPEED - droneVelocity.x) * ACCELERATION;
    droneVelocity.z += (targetVelocityInput.z * MAX_SPEED - droneVelocity.z) * ACCELERATION;
    droneVelocity.y += (verticalVelocityInput - droneVelocity.y) * ACCELERATION;

    // Apply deceleration (friction/drag)
    droneVelocity.x *= DECELERATION;
    droneVelocity.z *= DECELERATION;
    droneVelocity.y *= DECELERATION;

    // Clamp horizontal speed
    const currentSpeedSq = droneVelocity.x * droneVelocity.x + droneVelocity.z * droneVelocity.z;
    if (currentSpeedSq > MAX_SPEED * MAX_SPEED) {
        const scale = MAX_SPEED / Math.sqrt(currentSpeedSq);
        droneVelocity.x *= scale;
        droneVelocity.z *= scale;
    }

    // Apply final velocity to position
    droneModel.position.add(droneVelocity);
}

function updateAutoNavigationPhysics() {
    const directionToTarget = new THREE.Vector3().subVectors(autoNavTargetPosition, droneModel.position);
    const distanceToTarget = directionToTarget.length();

    if (distanceToTarget < AUTO_NAV_STOP_THRESHOLD && !autoNavReachedTarget) {
        // Reached target, stop precisely
        console.log("Auto-navigation: Reached target plot.");
        droneVelocity.set(0, 0, 0);
        droneAngularVelocity.set(0, 0, 0);
        isAutoNavigating = false;
        window.isAutoNavigating = false;
        autoNavReachedTarget = true;
        // Don't reset isHoveringValidPlot here, let checkHoveringPlot handle it

        // Re-enable controls and reset UI
        enableManualControls();
        updateDroneUIButtonText("Place LLM");
        const landButton = droneContainer.querySelector('.drone-land-btn');
        if (landButton) landButton.onclick = handlePlaceAttempt;

        // Force a hover check immediately after stopping
        checkHoveringPlot();
        updatePlacementButtonState();

    } else if (distanceToTarget < AUTO_NAV_ARRIVAL_THRESHOLD) {
        // Decelerate smoothly as we approach
        droneVelocity.multiplyScalar(0.90);
        droneAngularVelocity.y *= 0.85;
        droneModel.rotation.y += droneAngularVelocity.y;
        droneModel.position.add(droneVelocity);

    } else {
        // --- Rotation ---
        // Calculate target rotation to face the destination
        const targetRotationY = Math.atan2(directionToTarget.x, directionToTarget.z);
        let deltaRotation = targetRotationY - droneModel.rotation.y;

        // Ensure shortest rotation angle
        while (deltaRotation > Math.PI) deltaRotation -= Math.PI * 2;
        while (deltaRotation < -Math.PI) deltaRotation += Math.PI * 2;

        // Apply rotation smoothly
        const rotationStep = THREE.MathUtils.clamp(deltaRotation, -AUTO_NAV_ROTATION_SPEED, AUTO_NAV_ROTATION_SPEED);
        droneModel.rotation.y += rotationStep;

        // --- Movement ---
        // Only move forward significantly if facing the target reasonably well
        if (Math.abs(deltaRotation) < Math.PI / 4) {
            directionToTarget.normalize();
            // Apply velocity towards target, considering vertical separately
            droneVelocity.x += (directionToTarget.x * AUTO_NAV_SPEED - droneVelocity.x) * ACCELERATION * 2;
            droneVelocity.z += (directionToTarget.z * AUTO_NAV_SPEED - droneVelocity.z) * ACCELERATION * 2;
            droneVelocity.y += (directionToTarget.y * AUTO_NAV_SPEED - droneVelocity.y) * ACCELERATION * 2;

        } else {
            // If not facing target, prioritize rotation and reduce forward speed
            droneVelocity.x *= 0.95;
            droneVelocity.z *= 0.95;
            droneVelocity.y *= 0.98;
        }

        // Clamp speed
        const currentSpeedSq = droneVelocity.x * droneVelocity.x + droneVelocity.z * droneVelocity.z + droneVelocity.y * droneVelocity.y;
        if (currentSpeedSq > AUTO_NAV_SPEED * AUTO_NAV_SPEED) {
            const scale = AUTO_NAV_SPEED / Math.sqrt(currentSpeedSq);
            droneVelocity.multiplyScalar(scale);
        }

        droneModel.position.add(droneVelocity);
    }
}

function checkHoveringPlot() {
    if (!droneActive || !droneModel || isPlacing) {
        isHoveringValidPlot = false;
        currentHoveredPlotId = null;
        return;
    }

    const raycaster = new THREE.Raycaster(droneModel.position, new THREE.Vector3(0, -1, 0));
    const intersects = raycaster.intersectObjects(mainCityScene.children, true);

    let foundValidPlot = false;
    let hoveredPlotId = null; // Local variable for this check

    for (const intersect of intersects) {
        let obj = intersect.object;
        while (obj && (!obj.userData || (obj.userData.type !== 'lot' && obj.userData.type !== 'lot_target')) && obj.name !== 'primaryGround') {
            obj = obj.parent;
        }

        if (obj && obj.userData && (obj.userData.type === 'lot' || obj.userData.type === 'lot_target')) {
            const plotData = cityData.lots.find(lot => lot.id === obj.userData.id);
            const isFull = plotData && (plotData.occupants || []).length >= (plotData.maxCapacity || 8);
            // Check if plot exists, is available OR not full, and drone is centered
            if (plotData && !isFull) {
                const distFromCenterX = Math.abs(droneModel.position.x - plotData.x);
                const distFromCenterZ = Math.abs(droneModel.position.z - plotData.z);
                if (distFromCenterX < plotData.width / 2 && distFromCenterZ < plotData.height / 2) {
                    foundValidPlot = true;
                    hoveredPlotId = plotData.id; // Store the ID of the valid hovered plot
                    break;
                }
            }
        }
        // Stop checking if we hit the ground or an invalid object first
        if (obj && obj.name === 'primaryGround') {
            break;
        }
    }

    isHoveringValidPlot = foundValidPlot;
    currentHoveredPlotId = hoveredPlotId; // Update the global state
}

function updatePlacementButtonState() {
    const landButton = droneContainer?.querySelector('.drone-land-btn');
    if (landButton) {
        if (isHoveringValidPlot && !isAutoNavigating && !isPlacing) {
            landButton.disabled = false;
            landButton.style.opacity = '1';
            landButton.style.cursor = 'pointer';
            landButton.textContent = "Place LLM"; // Ensure correct text
        } else if (isAutoNavigating) {
            landButton.disabled = false;
            landButton.style.opacity = '1';
            landButton.style.cursor = 'pointer';
            landButton.textContent = "Cancel Auto-Pilot";
        } else if (isPlacing) {
            landButton.disabled = true;
            landButton.style.opacity = '0.5';
            landButton.style.cursor = 'not-allowed';
            landButton.textContent = "Placing...";
        } else { // Not hovering valid plot, not auto-nav, not placing
            landButton.disabled = true;
            landButton.style.opacity = '0.5';
            landButton.style.cursor = 'not-allowed';
            landButton.textContent = "Place LLM";
        }
    }
}

function handlePlaceAttempt() {
    // Only allow placing if hovering, not auto-navigating, and not already placing
    if (!isHoveringValidPlot || !currentHoveredPlotId || isAutoNavigating || isPlacing) {
        console.warn("Placement attempt failed. Conditions not met:", {isHoveringValidPlot, currentHoveredPlotId, isAutoNavigating, isPlacing});
        return;
    }

    console.log("Starting placement sequence...");
    isPlacing = true;
    placementStartTime = performance.now();
    updatePlacementButtonState();

    // Disable manual controls during placement
    disableManualControls();

    startPlacementSequence();
}

/**
 * Calculates the lowest Y point of a model relative to its origin.
 * @param {THREE.Object3D} modelToMeasure The model to measure.
 * @returns {number} The minimum Y value in the model's local coordinate system.
 */
function getModelMinYLocal(modelToMeasure) {
    if (!modelToMeasure) return 0;
    const tempModel = modelToMeasure.clone();
    tempModel.position.set(0,0,0); // Reset position for accurate local box
    tempModel.rotation.set(0, 0, 0);
    tempModel.scale.set(1, 1, 1);
    tempModel.updateMatrixWorld(true);

    const box = new THREE.Box3();
    box.setFromObject(tempModel, true);

    // Ensure the box is valid
    if (box.isEmpty() || !isFinite(box.min.y)) {
        console.warn("Could not compute valid bounding box for model:", modelToMeasure.name);
        return 0;
    }

    return box.min.y;
}

function startPlacementSequence() {
    if (!droneModel || !llmModel || !currentHoveredPlotId) { // Check for hovered plot ID
        console.error("Cannot start placement: Drone model, LLM model, or hovered plot ID not found.");
        isPlacing = false;
        updatePlacementButtonState();
        enableManualControls();
        return;
    }

    // Get the plot data for the currently hovered plot
    const targetPlotData = cityData.lots.find(lot => lot.id === currentHoveredPlotId);
    if (!targetPlotData) {
        console.error(`Cannot start placement: Plot data not found for ID ${currentHoveredPlotId}.`);
        isPlacing = false;
        updatePlacementButtonState();
        enableManualControls();
        return;
    }

    // --- Calculate Final Placement Height (Refined Logic) ---
    // 1. Get ground height below drone (use plot center for consistency)
    let groundY = 0.01;
    // Raycast down from plot center instead of drone position for more reliable ground height
    const groundRaycaster = new THREE.Raycaster(new THREE.Vector3(targetPlotData.x, 10, targetPlotData.z), new THREE.Vector3(0, -1, 0));
    const groundIntersects = groundRaycaster.intersectObjects(mainCityScene.children, true);
    for (const intersect of groundIntersects) {
        let obj = intersect.object;
        while (obj && (!obj.userData || (obj.userData.type !== 'lot' && obj.userData.type !== 'lot_target')) && obj.name !== 'primaryGround' && obj.name !== 'distantTerrain') {
             obj = obj.parent;
        }
         if (obj && ( (obj.userData && (obj.userData.type === 'lot' || obj.userData.type === 'lot_target')) || obj.name === 'primaryGround' || obj.name === 'distantTerrain') ) {
            groundY = intersect.point.y;
            break;
        }
    }

    // 2. Get LLM model's lowest Y point relative to its *own origin*
    const llmMinYLocal = getModelMinYLocal(llmModel);

    // 3. Get the vertical offset at which the LLM is attached to the drone
    // This is the Y position of the llmModel relative to the droneModel's origin.
    const attachmentOffsetY = llmModel.position.y;

    // 4. Calculate the final target Y position for the DRONE's origin
    // Drone Target Y = Ground Y - LLM Min Y (relative to LLM origin) - LLM Attachment Offset (relative to Drone origin) + Buffer
    const droneTargetY = groundY - llmMinYLocal - attachmentOffsetY + PLACEMENT_GROUND_OFFSET;


    // --- End Calculation ---

    const startY = droneModel.position.y;
    const duration = PLACEMENT_DURATION;
    let placementFrameId = null;

    console.log(`Placement - DroneStart: ${startY.toFixed(3)}, DroneTarget: ${droneTargetY.toFixed(3)}, GroundY: ${groundY.toFixed(3)}, LLM_MinY_Local: ${llmMinYLocal.toFixed(3)}, AttachmentOffset: ${attachmentOffsetY.toFixed(3)}`);

    function animatePlacement() {
        if (!isPlacing || !droneModel) {
            if (placementFrameId) cancelAnimationFrame(placementFrameId);
            console.log("Placement animation cancelled or drone missing.");
            return;
        }

        const elapsed = performance.now() - placementStartTime;
        let progress = Math.min(elapsed / duration, 1);
        // Ease-in-out quadratic easing
        progress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Interpolate Drone's Y position
        droneModel.position.y = THREE.MathUtils.lerp(startY, droneTargetY, progress);
        // Interpolate X and Z towards the plot center for precise landing
        // droneModel.position.x = THREE.MathUtils.lerp(droneModel.position.x, targetPlotData.x, progress * 0.1); // Slower horizontal adjustment
        // droneModel.position.z = THREE.MathUtils.lerp(droneModel.position.z, targetPlotData.z, progress * 0.1);

        // Update propeller speed during placement
        // Base speed + speed inversely proportional to progress (faster at start)
        const propellerSpeed = 0.5 + (1.0 - progress) * 2.0;
        droneModel.traverse(child => {
             if (child.name === "Blades" && child.parent && child.parent.name === "Propeller") {
                 const parentPosition = child.parent.position;
                 // Alternate rotation direction based on propeller position for realism
                 const direction = (parentPosition.x * parentPosition.z < 0) ? 1 : -1; // Simple alternating direction
                 child.rotation.y += propellerSpeed * direction * 0.25;
             }
         });

        if (progress < 1) {
            placementFrameId = requestAnimationFrame(animatePlacement);
        } else {
            // --- Placement animation complete ---
            console.log("Lowering animation complete. Placing LLM.");
            droneModel.position.y = droneTargetY;
            // Ensure final X/Z position is exactly at plot center
            // droneModel.position.x = targetPlotData.x;
            // droneModel.position.z = targetPlotData.z;

            // Final placement logic (use the known target plot data)
            if (targetPlotData) {
                // Use the calculated groundY for the final placement point
                const finalGroundPoint = new THREE.Vector3(droneModel.position.x, groundY, droneModel.position.z);
                placeLLMOnPlot(targetPlotData, finalGroundPoint);
            } else {
                console.error("Placement failed: Target plot data became invalid during placement.");
                // Fly back up slightly if placement fails
                const failStartY = droneModel.position.y;
                const failTargetY = failStartY + 2.0; // Fly up 2 units
                const failDuration = 500;
                const failStartTime = performance.now();
                function animateFailLift() {
                     const failElapsed = performance.now() - failStartTime;
                     const failProgress = Math.min(failElapsed / failDuration, 1);
                     if (droneModel) { // Check if drone still exists
                        droneModel.position.y = THREE.MathUtils.lerp(failStartY, failTargetY, failProgress);
                     }
                     if (failProgress < 1) {
                         requestAnimationFrame(animateFailLift);
                     } else {
                         isPlacing = false;
                         enableManualControls();
                         updatePlacementButtonState();
                     }
                }
                animateFailLift();
            }
        }
    }

    animatePlacement();
}

function placeLLMOnPlot(plotData, placementGroundPoint) {
    if (!currentLLMTransporting || !mainCityScene) return;

    if (!cityData || !Array.isArray(cityData.lots)) {
        console.error("Critical Error: cityData or cityData.lots is not available in placeLLMOnPlot!");
        deactivateDroneTransport(true);
        return;
    }

    const currentPlotData = cityData.lots.find(lot => lot.id === plotData.id);
    if (!currentPlotData) {
        console.error(`Critical Error: Could not find plot data with ID ${plotData.id} in cityData.lots during final placement update.`);
        deactivateDroneTransport(true);
        return;
    }

    // Check capacity before placing
    const maxCapacity = currentPlotData.maxCapacity || 8;
    if ((currentPlotData.occupants || []).length >= maxCapacity) {
        console.warn(`Placement aborted: Plot ${currentPlotData.name} is already full.`);
        // Handle failure (e.g., fly back up) similar to placement failure
        const failStartY = droneModel.position.y;
        const failTargetY = failStartY + 2.0; // Fly up 2 units
        const failDuration = 500;
        const failStartTime = performance.now();
        function animateFailLift() {
            const failElapsed = performance.now() - failStartTime;
            const failProgress = Math.min(failElapsed / failDuration, 1);
            if (droneModel) { // Check if drone still exists
                droneModel.position.y = THREE.MathUtils.lerp(failStartY, failTargetY, failProgress);
            }
            if (failProgress < 1) {
                requestAnimationFrame(animateFailLift);
            } else {
                isPlacing = false;
                enableManualControls();
                updatePlacementButtonState();
            }
        }
        animateFailLift();
        return;
    }

    const placedLLMModel = renderLLMCharacter(THREE, currentLLMTransporting);

    // Calculate the model's lowest point relative to its origin
    const llmMinYLocal = getModelMinYLocal(placedLLMModel);

    // Set final position using the ground intersection point and the model's lowest point offset
    placedLLMModel.position.x = placementGroundPoint.x;
    placedLLMModel.position.z = placementGroundPoint.z;
    // Final Y = Ground Y - Offset of lowest point from origin + small buffer
    placedLLMModel.position.y = placementGroundPoint.y - llmMinYLocal + PLACEMENT_GROUND_OFFSET;

    console.log(`Final Placed LLM Pos - X: ${placedLLMModel.position.x.toFixed(3)}, Z: ${placedLLMModel.position.z.toFixed(3)}, GroundY: ${placementGroundPoint.y.toFixed(3)}, MinYLocal: ${llmMinYLocal.toFixed(3)}, Final Y: ${placedLLMModel.position.y.toFixed(3)}`);

    // *** Set the placed model's rotation to match the drone's rotation ***
    if (droneModel) {
        placedLLMModel.rotation.y = droneModel.rotation.y;
        console.log(`Applied drone rotation Y (${droneModel.rotation.y.toFixed(3)}) to placed LLM.`);
    } else {
        placedLLMModel.rotation.y = 0; // Fallback if drone model is somehow gone
        console.warn("Drone model not found during placement, defaulting rotation to 0.");
    }

    placedLLMModel.castShadow = true;
    placedLLMModel.receiveShadow = true;
    placedLLMModel.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    mainCityScene.add(placedLLMModel);

    // Update plot data in cityData
    if (!currentPlotData.occupants) { // Initialize if it somehow doesn't exist
        currentPlotData.occupants = [];
    }
    currentPlotData.occupants.push(currentLLMTransporting.id); // Add LLM to occupants array
    currentPlotData.available = false; // Mark as unavailable (occupied)

    // Remove plot's click target mesh if plot is now full
    if (currentPlotData.occupants.length >= maxCapacity) {
        console.log(`Plot ${currentPlotData.name} is now full. Removing click target.`);
        const objectsToRemove = [];
        mainCityScene.traverse(obj => {
            if (obj && obj.userData && obj.userData.id === currentPlotData.id && obj.name === 'plot_click_target') {
                objectsToRemove.push(obj);
            }
        });
        objectsToRemove.forEach(obj => {
            if (obj.parent) {
                disposeHierarchy(obj);
                console.log(`Removed ${obj.name} (ID: ${obj.userData.id})`);
            } else {
                console.warn(`Object ${obj.name} has no parent, cannot remove.`);
                disposeHierarchy(obj);
            }
        });
    }

    // Hide hover info panel
    import('./plotHoverInfo.js').then(module => {
        if (typeof module.hidePlotInfoPanel === 'function') {
            module.hidePlotInfoPanel();
        }
    });

    console.log(`LLM ${currentLLMTransporting.name} placed on plot ${currentPlotData.name}. Occupants: ${currentPlotData.occupants.length}/${maxCapacity}`);

    // Deactivate drone after successful placement, focusing on the placed model
    deactivateDroneTransport(false, placedLLMModel.position.clone());
}

function disposeHierarchy(object) {
    // Safety check: Ensure the object is valid before proceeding
    if (!object) {
        console.warn("disposeHierarchy called with null or undefined object.");
        return;
    }

    object.traverse(child => {
        // Safety check: Ensure child is valid before accessing properties
        if (child && child.isMesh) {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                // Check if material is an array
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        // Safety check: Ensure material instance is valid
                        if (material) {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        }
                    });
                } else {
                    // Safety check: Ensure material instance is valid
                    if (child.material) {
                        if (child.material.map) child.material.map.dispose();
                        child.material.dispose();
                    }
                }
            }
        }
    });
    // Remove the object itself from its parent *after* disposing children
    if (object.parent) {
        object.parent.remove(object);
    }
}

export function deactivateDroneTransport(cancel = false, focusTarget = null) {
    if (!droneActive) return;

    // Handle cancellation during placement
    if (isPlacing) {
        console.log("Cancelling placement sequence.");
        isPlacing = false;
        // Optional: Add a quick "fly away" animation here?
        enableManualControls();
    }

    // Cancel auto-navigation if active
    if (isAutoNavigating) {
        cancelAutoNavigation();
    }

    droneActive = false;
    window.droneActive = false;
    isHoveringValidPlot = false;
    currentHoveredPlotId = null; // Clear hovered plot ID on deactivate

    removeInputListeners();

    if (droneAnimationId) {
        cancelAnimationFrame(droneAnimationId);
        droneAnimationId = null;
    }

    if (droneContainer) {
        droneContainer.classList.remove('active');
        setTimeout(() => {
            if (droneContainer && droneContainer.parentNode) {
                droneContainer.parentNode.removeChild(droneContainer);
            }
            droneContainer = null;
        }, 500);
    }

    if (droneModel) {
        if (llmModel && llmModel.parent === droneModel) {
            droneModel.remove(llmModel);
        }
        if (droneModel.parent) {
            droneModel.parent.remove(droneModel);
        }
        disposeHierarchy(droneModel);
        droneModel = null;
        llmModel = null;
    }

    // --- Music Change ---
    // Ensure city music is playing when drone deactivates (if not already)
    playTrack('city');
    // --- End Music Change ---

    if (mainCityControls) {
        mainCityControls.enabled = true;

        if (cancel || !focusTarget) {
            if (originalCameraPosition && originalCameraTarget) {
                console.log("Starting camera transition back...");
                const transitionDuration = 1000;
                const startTime = performance.now();
                const startCamPos = mainCityCamera.position.clone();
                const startTarget = mainCityControls.target.clone();

                function transitionBack() {
                    if (window.droneActive) {
                        console.log("Drone reactivated, cancelling camera return transition.");
                        cameraTransitionId = null;
                        return;
                    }
                    // Ensure originalCameraPosition and originalCameraTarget are still valid
                    if (!originalCameraPosition || !originalCameraTarget) {
                        console.warn("Original camera state missing during transition. Stopping.");
                        cameraTransitionId = null;
                        if (mainCityControls) mainCityControls.enabled = true;
                        return;
                    }

                    const elapsed = performance.now() - startTime;
                    const progress = Math.min(elapsed / transitionDuration, 1);
                    const easeProgress = 1 - Math.pow(1 - progress, 3);

                    mainCityCamera.position.lerpVectors(startCamPos, originalCameraPosition, easeProgress);
                    mainCityControls.target.lerpVectors(startTarget, originalCameraTarget, easeProgress);

                    mainCityCamera.lookAt(mainCityControls.target);
                    mainCityControls.update();

                    if (progress < 1) {
                        cameraTransitionId = requestAnimationFrame(transitionBack);
                    } else {
                        console.log("Camera transition back complete.");
                        mainCityCamera.position.copy(originalCameraPosition);
                        mainCityControls.target.copy(originalCameraTarget);
                        mainCityCamera.lookAt(mainCityControls.target);
                        mainCityControls.update();

                        originalCameraPosition = null;
                        originalCameraTarget = null;
                        cameraTransitionId = null;
                        mainCityControls.enabled = true;
                    }
                }
                if (cameraTransitionId) {
                    cancelAnimationFrame(cameraTransitionId);
                }
                cameraTransitionId = requestAnimationFrame(transitionBack);
            } else {
                console.warn("No valid original camera state to transition back to.");
                mainCityControls.target.set(0, 0, 0);
                mainCityControls.update();
                if (mainCityCamera) mainCityCamera.lookAt(mainCityControls.target);
                mainCityControls.enabled = true;
                originalCameraPosition = null;
                originalCameraTarget = null;
            }
        } else {
            console.log("Placement successful. Focusing camera on placed LLM at:", focusTarget);

            // Set controls target to the focus target
            mainCityControls.target.copy(focusTarget);

            // Keep the camera position where it is (it was following the drone)
            // Optionally, pull back slightly or adjust height for a better view
            const currentCamPos = mainCityCamera.position.clone();
            const direction = new THREE.Vector3().subVectors(currentCamPos, focusTarget).normalize();
            // Check if direction is valid before applying
            if (direction.lengthSq() > 0.001) {
                mainCityCamera.position.copy(focusTarget).add(direction.multiplyScalar(10));
            } else {
                // Fallback if direction is zero (camera and target are too close)
                mainCityCamera.position.copy(focusTarget).add(new THREE.Vector3(0, 5, 10));
            }
            mainCityCamera.position.y = Math.max(mainCityCamera.position.y, 3);

            // Point camera at the target and update controls
            mainCityCamera.lookAt(mainCityControls.target);
            mainCityControls.update();

            // Clear original state as we are not returning to it
            originalCameraPosition = null;
            originalCameraTarget = null;
            if (cameraTransitionId) {
                cancelAnimationFrame(cameraTransitionId);
                cameraTransitionId = null;
            }
        }
    }
    if (cancel) console.log('Drone transport cancelled');
    currentLLMTransporting = null;
}

function animateDrone() {
    if (!droneActive) return;
    droneAnimationId = requestAnimationFrame(animateDrone);

    // Update drone physics state ONLY if not placing
    if (!isPlacing) {
        updateDroneState(); // Handles movement, rotation, hover check etc.
        // Note: Propeller animation is handled inside updateDroneState
    } else {
        // Propeller animation needs to run even during placement,
        // let's call a simplified version or extract it.
        // This is handled inside `animatePlacement` via requestAnimationFrame.
    }

    // Position the camera based on the current drone position,
    // regardless of placement state, as long as the drone model exists.
    if (droneModel) {
        positionCameraForDroneView();
    }

    // Rendering is handled by the main cityScene loop
}

function positionCameraForDroneView(instant = false) {
    if (!droneModel || !mainCityCamera || !mainCityControls) return;

    mainCityControls.enabled = false;

    const offset = new THREE.Vector3(0, CAMERA_FOLLOW_HEIGHT, -CAMERA_FOLLOW_DISTANCE);

    offset.applyQuaternion(droneModel.quaternion);

    const targetCamPos = droneModel.position.clone().add(offset);

    const targetLookAt = droneModel.position.clone().add(new THREE.Vector3(0, 0.5, 0));

    if (instant) {
        mainCityCamera.position.copy(targetCamPos);
        mainCityControls.target.copy(targetLookAt);
    } else {
        mainCityCamera.position.lerp(targetCamPos, CAMERA_LERP_FACTOR);
        mainCityControls.target.lerp(targetLookAt, CAMERA_LERP_FACTOR);
    }

    mainCityCamera.lookAt(mainCityControls.target);

    // Don't call controls.update() here when controls are disabled for drone
    // mainCityControls.update();
}